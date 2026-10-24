import { getGemmaClient, getGemmaModel } from './gemma.js';
import {
  DEFENSIVE_SYSTEM_INSTRUCTION,
  buildAnalysisPrompt,
  buildRepairPrompt,
} from './prompt.js';
import { AnalysisOutputSchema } from '../validators/analysisSchema.js';

export class AnalysisError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} status
   */
  constructor(code, message, status) {
    super(message);
    this.name = 'AnalysisError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Strips markdown code blocks (e.g. ```json ... ```) from raw model output.
 * @param {string} text
 * @returns {string}
 */
export function stripFences(text) {
  if (typeof text !== 'string') return '';
  const trimmed = text.trim();
  const fenceRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
  const match = trimmed.match(fenceRegex);
  if (match) {
    return match[1].trim();
  }
  return trimmed;
}

/**
 * Normalizes text for whitespace and case insensitive comparison.
 * @param {string} str
 * @returns {string}
 */
function normalizeForComparison(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Verifies that indicator evidence quotes actually appear in the submitted content.
 * Flags unverified quotes on the indicator and tallies the total unverified count.
 *
 * @param {Array<Object>} indicators
 * @param {string} submittedText
 * @param {string} [submittedUrl]
 * @returns {{ verifiedIndicators: Array<Object>, unverifiedCount: number }}
 */
export function verifyEvidence(indicators, submittedText, submittedUrl = '') {
  if (!Array.isArray(indicators)) {
    return { verifiedIndicators: [], unverifiedCount: 0 };
  }

  const normalizedSource = normalizeForComparison(
    `${submittedText} ${submittedUrl || ''}`
  );

  let unverifiedCount = 0;

  const verifiedIndicators = indicators.map((ind) => {
    const normalizedEvidence = normalizeForComparison(ind.evidence);
    const appearsInSource =
      normalizedEvidence.length > 0 &&
      normalizedSource.includes(normalizedEvidence);

    if (!appearsInSource) {
      unverifiedCount++;
      return {
        ...ind,
        unverified: true,
      };
    }

    return {
      ...ind,
      unverified: false,
    };
  });

  return { verifiedIndicators, unverifiedCount };
}

/**
 * Maps downstream API errors to safe application error codes.
 * @param {unknown} err
 * @returns {AnalysisError}
 */
export function mapToAnalysisError(err) {
  if (err instanceof AnalysisError) return err;

  const msg = err?.message || String(err);
  const codeName = err?.code || '';

  if (
    msg.includes('TIMEOUT') ||
    codeName === 'ETIMEDOUT' ||
    err?.name === 'TimeoutError' ||
    msg.includes('aborted')
  ) {
    return new AnalysisError(
      'TIMEOUT',
      'The security analysis service timed out after 30 seconds. Please try again.',
      504
    );
  }

  if (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('429') ||
    msg.includes('quota')
  ) {
    return new AnalysisError(
      'RATE_LIMITED',
      'Model request quota or rate limit exceeded. Please wait a moment before trying again.',
      429
    );
  }

  if (
    msg.includes('API_KEY_INVALID') ||
    msg.includes('401') ||
    msg.includes('UNAUTHENTICATED')
  ) {
    return new AnalysisError(
      'AUTH_FAILED',
      'Authentication with the AI service failed. Verify your GEMINI_API_KEY configuration.',
      502
    );
  }

  if (
    msg.includes('NOT_FOUND') ||
    msg.includes('404') ||
    msg.includes('is not accessible')
  ) {
    return new AnalysisError(
      'MODEL_UNAVAILABLE',
      'The requested Gemma model is currently unavailable on the backend.',
      503
    );
  }

  return new AnalysisError(
    'MODEL_UNAVAILABLE',
    'Unable to communicate with the AI model service. Please try again.',
    503
  );
}

/**
 * Extracts the final answer text from Google GenAI response, filtering out thinking / reasoning parts.
 * @param {Object} response
 * @returns {string}
 */
export function extractResponseText(response) {
  if (!response) return '';

  const candidate = response.candidates?.[0];
  if (candidate?.content?.parts && Array.isArray(candidate.content.parts)) {
    // Gemma models can emit thinking parts with thought: true
    const nonThoughtParts = candidate.content.parts.filter(
      (p) => !p.thought && typeof p.text === 'string' && p.text.trim()
    );

    if (nonThoughtParts.length > 0) {
      return nonThoughtParts.map((p) => p.text.trim()).join('\n');
    }

    // Fallback: If only thought parts are present, find the JSON block inside
    for (const part of candidate.content.parts) {
      if (typeof part.text === 'string') {
        const jsonMatch = part.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) return jsonMatch[0];
      }
    }
  }

  if (typeof response.text === 'string' && response.text.trim()) {
    const text = response.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return jsonMatch[0];
    return text;
  }

  return '';
}

/**
 * Executes a single generation call to Gemma with a timeout.
 * @param {string} promptText
 * @param {string} systemInstruction
 * @returns {Promise<string>}
 */
async function callGemmaWithTimeout(promptText, systemInstruction) {
  const ai = getGemmaClient();
  const model = getGemmaModel();
  const timeoutMs = Number(process.env.ANALYSIS_TIMEOUT_MS) || 60000;

  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new AnalysisError(
          'TIMEOUT',
          `The security analysis service timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`,
          504
        )
      );
    }, timeoutMs);
  });

  try {
    const generationPromise = ai.models.generateContent({
      model,
      contents: promptText,
      config: {
        systemInstruction,
        temperature: 0.1,
        maxOutputTokens: 1500,
      },
    }).then((res) => extractResponseText(res));

    const result = await Promise.race([generationPromise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (error) {
    clearTimeout(timer);
    throw mapToAnalysisError(error);
  }
}

/**
 * Parses and validates model output against the Zod schema.
 * Resilient against stray text before/after the JSON block.
 * @param {string} rawOutput
 * @returns {{ success: true, data: Object } | { success: false, errors: any }}
 */
function parseAndValidate(rawOutput) {
  if (!rawOutput || typeof rawOutput !== 'string') {
    return { success: false, errors: 'Empty response from model' };
  }

  const cleaned = stripFences(rawOutput);
  let parsedJson;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch (parseError) {
    // Fallback: look for embedded JSON object in text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsedJson = JSON.parse(jsonMatch[0]);
      } catch (innerError) {
        return {
          success: false,
          errors: `Invalid JSON syntax: ${parseError.message}`,
        };
      }
    } else {
      return {
        success: false,
        errors: `Invalid JSON syntax: ${parseError.message}`,
      };
    }
  }

  const result = AnalysisOutputSchema.safeParse(parsedJson);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors,
    };
  }

  return { success: true, data: result.data };
}

/**
 * Main analysis orchestrator.
 *
 * @param {Object} input
 * @param {string} input.message
 * @param {string} input.message_type
 * @param {string} [input.url]
 * @param {Function} [customCallFn] Optional mockable call function for deterministic unit testing.
 * @returns {Promise<{ analysis: Object, meta: Object }>}
 */
export async function analyzeMessage(
  { message, message_type, url },
  customCallFn = null
) {
  const startTime = Date.now();
  const modelName = getGemmaModel();

  const callModel = customCallFn || callGemmaWithTimeout;
  const initialPrompt = buildAnalysisPrompt({ message, message_type, url });

  // 1. Initial Model Call
  const rawOutput = await callModel(initialPrompt, DEFENSIVE_SYSTEM_INSTRUCTION);

  // 2. Parse and Validate
  let validation = parseAndValidate(rawOutput);

  // 3. One bounded repair attempt if initial response fails validation
  if (!validation.success) {
    const repairPrompt = buildRepairPrompt(rawOutput, validation.errors);
    try {
      const repairedOutput = await callModel(
        repairPrompt,
        DEFENSIVE_SYSTEM_INSTRUCTION
      );
      validation = parseAndValidate(repairedOutput);
    } catch {
      // If the repair call itself throws, continue to check validation
    }

    if (!validation.success) {
      throw new AnalysisError(
        'MODEL_OUTPUT_INVALID',
        'The model produced output that could not be validated against the security schema.',
        502
      );
    }
  }

  // 4. Grounding verification: verify that evidence quotes exist in the submitted content
  const { verifiedIndicators, unverifiedCount } = verifyEvidence(
    validation.data.indicators,
    message,
    url
  );

  const finalAnalysis = {
    ...validation.data,
    indicators: verifiedIndicators,
  };

  const latency_ms = Date.now() - startTime;

  return {
    analysis: finalAnalysis,
    meta: {
      model: modelName,
      latency_ms,
      unverified_evidence_count: unverifiedCount,
    },
  };
}
