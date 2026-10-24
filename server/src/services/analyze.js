import { getGemmaClient, getGemmaModel } from './gemma.js';
import {
  DEFENSIVE_SYSTEM_INSTRUCTION,
  IMAGE_DEFENSIVE_SYSTEM_INSTRUCTION,
  buildAnalysisPrompt,
  buildImageAnalysisPrompt,
  buildRepairPrompt,
} from './prompt.js';
import {
  AnalysisOutputSchema,
  ImageAnalysisOutputSchema,
} from '../validators/analysisSchema.js';

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
 * Normalizes to NFC and strips zero-width joiners/non-joiners.
 * @param {string} str
 * @returns {string}
 */
function normalizeForComparison(str) {
  if (!str) return '';
  return str
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds an index map mapping normalized NFC, zero-width stripped character positions
 * back to original character offsets (start, end) in the submitted text.
 * @param {string} text
 * @returns {{ normalizedStr: string, charMap: Array<{ origStart: number, origEnd: number }> }}
 */
export function buildNormalizedIndexMap(text) {
  if (typeof text !== 'string' || !text) {
    return { normalizedStr: '', charMap: [] };
  }

  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let normalizedStr = '';
  const charMap = [];

  for (const s of seg.segment(text)) {
    const origStart = s.index;
    const origEnd = s.index + s.segment.length;
    // Normalize to NFC and strip zero-width characters (ZWNJ, ZWJ, ZWSP, BOM)
    const norm = s.segment.normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '');
    for (let i = 0; i < norm.length; i++) {
      charMap.push({ origStart, origEnd });
      normalizedStr += norm[i];
    }
  }

  return { normalizedStr, charMap };
}

/**
 * Finds character offsets (start, end) of an evidence quote within the submitted text.
 * Handles Unicode NFC normalization, zero-width joiners/non-joiners stripping,
 * case-insensitivity, and whitespace normalization while returning exact slice offsets
 * in the original submitted text. Returns the first occurrence if repeated.
 *
 * @param {string} submittedText
 * @param {string} evidenceQuote
 * @returns {{ found: true, start: number, end: number } | { found: false }}
 */
export function findEvidenceMatch(submittedText, evidenceQuote) {
  if (
    typeof submittedText !== 'string' ||
    typeof evidenceQuote !== 'string' ||
    !submittedText.trim() ||
    !evidenceQuote.trim()
  ) {
    return { found: false };
  }

  // Check 1: Exact match first (fast path)
  const exactIdx = submittedText.indexOf(evidenceQuote);
  if (exactIdx !== -1) {
    return {
      found: true,
      start: exactIdx,
      end: exactIdx + evidenceQuote.length,
    };
  }

  // Check 2: Unicode NFC & zero-width stripped index-mapped matching
  const normMap = buildNormalizedIndexMap(submittedText);
  if (!normMap.normalizedStr) return { found: false };

  // Prepare candidates: direct quote, and quote with surrounding quotation marks stripped
  const rawTrimmed = evidenceQuote.trim();
  const strippedQuotes = rawTrimmed.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  const candidates = [rawTrimmed];
  if (strippedQuotes && strippedQuotes !== rawTrimmed) {
    candidates.push(strippedQuotes);
  }

  for (const candidate of candidates) {
    const normCandidate = candidate
      .normalize('NFC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '');
    if (!normCandidate) continue;

    // Direct substring check in normalized text
    const directIdx = normMap.normalizedStr.indexOf(normCandidate);
    if (directIdx !== -1) {
      const origStart = normMap.charMap[directIdx].origStart;
      const origEnd = normMap.charMap[directIdx + normCandidate.length - 1].origEnd;
      return { found: true, start: origStart, end: origEnd };
    }

    // Tokenized regex matching with whitespace and case insensitivity
    const tokens = normCandidate.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;

    const pattern = tokens
      .map((tok) => tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+');

    try {
      const regex = new RegExp(pattern, 'i');
      const match = normMap.normalizedStr.match(regex);
      if (match && typeof match.index === 'number') {
        const normStart = match.index;
        const normEnd = match.index + match[0].length;
        const origStart = normMap.charMap[normStart].origStart;
        const origEnd = normMap.charMap[normEnd - 1].origEnd;
        return {
          found: true,
          start: origStart,
          end: origEnd,
        };
      }
    } catch {
      // Fallback if regex construction fails
    }
  }

  return { found: false };
}

/**
 * Verifies that indicator evidence quotes actually appear in the submitted content.
 * Adds evidence_match with character offsets for quotes found in submittedText.
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
    // 1. Calculate character offsets into original submitted text
    const evidenceMatch = findEvidenceMatch(submittedText, ind.evidence);

    // 2. Determine whether the evidence is verified in text or url
    let appearsInSource = false;
    if (evidenceMatch.found) {
      appearsInSource = true;
    } else {
      const normalizedEvidence = normalizeForComparison(ind.evidence);
      appearsInSource =
        normalizedEvidence.length > 0 &&
        normalizedSource.includes(normalizedEvidence);
    }

    if (!appearsInSource) {
      unverifiedCount++;
      return {
        ...ind,
        evidence_match: evidenceMatch,
        unverified: true,
      };
    }

    return {
      ...ind,
      evidence_match: evidenceMatch,
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
        maxOutputTokens: 4096,
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
 * @param {string} [input.output_language]
 * @param {Function} [customCallFn] Optional mockable call function for deterministic unit testing.
 * @returns {Promise<{ analysis: Object, meta: Object }>}
 */
export async function analyzeMessage(
  { message, message_type, url, output_language = 'match' },
  customCallFn = null
) {
  const startTime = Date.now();
  const modelName = getGemmaModel();

  const callModel = customCallFn || callGemmaWithTimeout;
  const initialPrompt = buildAnalysisPrompt({
    message,
    message_type,
    url,
    output_language,
  });

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

/**
 * Verifies indicator evidence for image analysis against the model's transcribed_text.
 * Visual elements are not matched against text and are never counted as unverified quotes.
 *
 * @param {Array<Object>} indicators
 * @param {string} transcribedText
 * @returns {{ verifiedIndicators: Array<Object>, unverifiedCount: number }}
 */
export function verifyImageEvidence(indicators, transcribedText = '') {
  if (!Array.isArray(indicators)) {
    return { verifiedIndicators: [], unverifiedCount: 0 };
  }

  let unverifiedCount = 0;

  const verifiedIndicators = indicators.map((ind) => {
    // 1. Visual elements: do not count as unverified, return reason: 'visual'
    if (ind.evidence_source === 'visual_element') {
      return {
        ...ind,
        evidence_source: 'visual_element',
        evidence_match: {
          found: false,
          reason: 'visual',
          source: 'visual_element',
        },
        unverified: false,
      };
    }

    // 2. Transcribed text indicators: match against transcribed_text only
    const transcript = typeof transcribedText === 'string' ? transcribedText : '';
    if (!transcript.trim()) {
      unverifiedCount++;
      return {
        ...ind,
        evidence_source: 'transcribed_text',
        evidence_match: {
          found: false,
          source: 'transcribed_text',
        },
        unverified: true,
      };
    }

    const match = findEvidenceMatch(transcript, ind.evidence);
    if (match.found) {
      return {
        ...ind,
        evidence_source: 'transcribed_text',
        evidence_match: {
          ...match,
          source: 'transcribed_text',
        },
        unverified: false,
      };
    }

    unverifiedCount++;
    return {
      ...ind,
      evidence_source: 'transcribed_text',
      evidence_match: {
        found: false,
        source: 'transcribed_text',
      },
      unverified: true,
    };
  });

  return { verifiedIndicators, unverifiedCount };
}

/**
 * Parses and validates image analysis model output against the ImageAnalysisOutputSchema.
 * @param {string} rawOutput
 * @returns {{ success: true, data: Object } | { success: false, errors: any }}
 */
export function parseAndValidateImage(rawOutput) {
  if (!rawOutput || typeof rawOutput !== 'string') {
    return { success: false, errors: 'Empty response from model' };
  }

  const cleaned = stripFences(rawOutput);
  let parsedJson;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch (parseError) {
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

  const result = ImageAnalysisOutputSchema.safeParse(parsedJson);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors,
    };
  }

  return { success: true, data: result.data };
}

/**
 * Executes a single multimodal generation call to Gemma with timeout.
 * @param {Array<Object>|string} contents
 * @param {string} systemInstruction
 * @returns {Promise<string>}
 */
async function callGemmaMultimodalWithTimeout(contents, systemInstruction) {
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
      contents,
      config: {
        systemInstruction,
        temperature: 0.1,
        maxOutputTokens: 4096,
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
 * Main multimodal image analysis orchestrator.
 *
 * @param {Object} input
 * @param {Buffer} input.imageBuffer
 * @param {string} input.mimeType
 * @param {string} [input.message_type]
 * @param {string} [input.context_note]
 * @param {string} [input.output_language]
 * @param {Function} [customCallFn] Optional mockable call function for testing.
 * @returns {Promise<{ analysis: Object, meta: Object }>}
 */
export async function analyzeImage(
  { imageBuffer, mimeType, message_type = 'other', context_note = '', output_language = 'match' },
  customCallFn = null
) {
  const startTime = Date.now();
  const modelName = getGemmaModel();

  const callModel = customCallFn || callGemmaMultimodalWithTimeout;
  const initialPrompt = buildImageAnalysisPrompt({ message_type, context_note, output_language });

  const initialContents = [
    {
      role: 'user',
      parts: [
        { text: initialPrompt },
        {
          inlineData: {
            mimeType,
            data: imageBuffer.toString('base64'),
          },
        },
      ],
    },
  ];

  // 1. Initial Model Call
  const rawOutput = await callModel(
    initialContents,
    IMAGE_DEFENSIVE_SYSTEM_INSTRUCTION
  );

  // 2. Parse and Validate
  let validation = parseAndValidateImage(rawOutput);

  // 3. One bounded repair attempt if validation fails
  if (!validation.success) {
    const repairPrompt = buildRepairPrompt(rawOutput, validation.errors);
    try {
      const repairedOutput = await callModel(
        repairPrompt,
        IMAGE_DEFENSIVE_SYSTEM_INSTRUCTION
      );
      validation = parseAndValidateImage(repairedOutput);
    } catch {
      // Continue to check validation
    }

    if (!validation.success) {
      throw new AnalysisError(
        'MODEL_OUTPUT_INVALID',
        'The model produced output that could not be validated against the security schema.',
        502
      );
    }
  }

  // 4. Evidence verification against image_observations.transcribed_text
  const { verifiedIndicators, unverifiedCount } = verifyImageEvidence(
    validation.data.indicators,
    validation.data.image_observations?.transcribed_text
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
      input_type: 'image',
    },
  };
}
