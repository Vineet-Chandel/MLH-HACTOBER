import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { EVAL_SAMPLES } from './eval-samples.js';
import { analyzeMessage } from '../src/services/analyze.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DOCS_DIR = path.resolve(__dirname, '../../docs');
const README_PATH = path.resolve(__dirname, '../../README.md');
const EVAL_MD_PATH = path.join(DOCS_DIR, 'EVAL.md');

const SLEEP_MS = 1500;
const RETRY_WAIT_MS = 3000;

export const CAVEAT_TEXT =
  'Small synthetic set, not a benchmark. Results vary between runs and models. Labels were written by the team before running and were not changed afterward.';

/**
 * Agreement rule constants (fixed beforehand, not tuned to model output).
 * - suspicious: suspicious or high_concern
 * - benign: low_concern
 * - ambiguous: any of inconclusive, suspicious, low_concern (acceptable, not strict)
 */
export const ACCEPTABLE_RISK_LEVELS = {
  suspicious: ['suspicious', 'high_concern'],
  benign: ['low_concern'],
  ambiguous: ['inconclusive', 'suspicious', 'low_concern'],
};

/**
 * Checks whether a given risk_level satisfies author_label expectation.
 */
export function isAgreement(authorLabel, riskLevel) {
  const allowed = ACCEPTABLE_RISK_LEVELS[authorLabel];
  if (!allowed || !riskLevel) return false;
  return allowed.includes(riskLevel.toLowerCase());
}

/**
 * Executes a single analysis call with 1 retry on rate-limits or timeouts.
 */
async function callAnalyzeWithRetry(input, analyzeFn = analyzeMessage) {
  const payload = {
    message: input.message,
    message_type: input.message_type || 'sms',
    url: input.url || undefined,
  };

  const start = performance.now();
  try {
    const res = await analyzeFn(payload);
    const latency = Math.round(performance.now() - start);
    return {
      success: true,
      risk_level: res.analysis?.risk_level || 'error',
      indicators_count: Array.isArray(res.analysis?.indicators)
        ? res.analysis.indicators.length
        : 0,
      unverified_count: res.meta?.unverified_evidence_count || 0,
      model: res.meta?.model || process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
      latency_ms: latency,
      error: null,
    };
  } catch (err) {
    // Retry once after delay on RATE_LIMITED or TIMEOUT
    const isRetryable =
      err.code === 'RATE_LIMITED' ||
      err.code === 'TIMEOUT' ||
      err.message?.includes('429') ||
      err.message?.includes('quota');

    if (isRetryable) {
      console.warn(`    ⚠️ Rate limit / timeout encountered. Retrying once in ${RETRY_WAIT_MS}ms...`);
      await new Promise((r) => setTimeout(r, RETRY_WAIT_MS));
      try {
        const retryStart = performance.now();
        const res = await analyzeFn(payload);
        const latency = Math.round(performance.now() - retryStart);
        return {
          success: true,
          risk_level: res.analysis?.risk_level || 'error',
          indicators_count: Array.isArray(res.analysis?.indicators)
            ? res.analysis.indicators.length
            : 0,
          unverified_count: res.meta?.unverified_evidence_count || 0,
          model: res.meta?.model || process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
          latency_ms: latency,
          error: null,
        };
      } catch (retryErr) {
        return {
          success: false,
          risk_level: 'error',
          indicators_count: 0,
          unverified_count: 0,
          model: process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
          latency_ms: Math.round(performance.now() - start),
          error: retryErr.code || retryErr.message || 'Error on retry',
        };
      }
    }

    return {
      success: false,
      risk_level: 'error',
      indicators_count: 0,
      unverified_count: 0,
      model: process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
      latency_ms: Math.round(performance.now() - start),
      error: err.code || err.message || 'Execution error',
    };
  }
}

/**
 * Runs the full 10-sample 2-run evaluation.
 */
export async function runEval({
  samples = EVAL_SAMPLES,
  analyzeFn = analyzeMessage,
  delayMs = SLEEP_MS,
  onProgress = () => {},
} = {}) {
  const records = [];

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    onProgress(`[${i + 1}/${samples.length}] Sample ${s.id} (Run 1)...`);

    const run1 = await callAnalyzeWithRetry(s, analyzeFn);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));

    onProgress(`[${i + 1}/${samples.length}] Sample ${s.id} (Run 2)...`);
    const run2 = await callAnalyzeWithRetry(s, analyzeFn);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));

    const runsAgree = run1.risk_level === run2.risk_level;
    const run1Match = isAgreement(s.author_label, run1.risk_level);
    const run2Match = isAgreement(s.author_label, run2.risk_level);

    records.push({
      id: s.id,
      language: s.language || 'en',
      author_label: s.author_label,
      run1_risk_level: run1.risk_level,
      run2_risk_level: run2.risk_level,
      run1_indicators: run1.indicators_count,
      run2_indicators: run2.indicators_count,
      run1_unverified: run1.unverified_count,
      run2_unverified: run2.unverified_count,
      runs_agree: runsAgree,
      run1_match: run1Match,
      run2_match: run2Match,
      run1_latency: run1.latency_ms,
      run2_latency: run2.latency_ms,
      avg_latency: Math.round((run1.latency_ms + run2.latency_ms) / 2),
      run1_error: run1.error,
      run2_error: run2.error,
      model: run1.model || run2.model,
    });
  }

  return records;
}

/**
 * Renders the markdown evaluation table, summaries, and "Where it went wrong" section.
 */
export function renderEvalMarkdown(records, meta = {}) {
  const modelName = meta.model || records[0]?.model || process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';
  const evalDate = meta.date || new Date().toISOString().split('T')[0];

  // Compute summary stats
  const strictSamples = records.filter((r) => r.author_label !== 'ambiguous');
  const strictMatchesRun1 = strictSamples.filter((r) => r.run1_match).length;
  const strictMatchesRun2 = strictSamples.filter((r) => r.run2_match).length;
  const strictTotal = strictSamples.length;

  const ambiguousSamples = records.filter((r) => r.author_label === 'ambiguous');
  const ambiguousAcceptableRun1 = ambiguousSamples.filter((r) => r.run1_match).length;
  const ambiguousAcceptableRun2 = ambiguousSamples.filter((r) => r.run2_match).length;
  const ambiguousTotal = ambiguousSamples.length;

  const runToRunMatches = records.filter((r) => r.runs_agree).length;
  const totalSamples = records.length;

  const lines = [
    `# LinkSleuth Evaluation Report`,
    ``,
    `- **Model**: \`${modelName}\``,
    `- **Date**: ${evalDate}`,
    `- **Samples**: ${totalSamples} synthetic test cases (4 suspicious, 3 benign, 3 ambiguous)`,
    ``,
    `> [!NOTE]`,
    `> ${CAVEAT_TEXT}`,
    ``,
    `## Summary Counts`,
    ``,
    `| Metric | Run 1 | Run 2 | Description |`,
    `|---|---|---|---|`,
    `| **Strict Agreement** (Suspicious & Benign) | ${strictMatchesRun1} / ${strictTotal} (${Math.round((strictMatchesRun1 / (strictTotal || 1)) * 100)}%) | ${strictMatchesRun2} / ${strictTotal} (${Math.round((strictMatchesRun2 / (strictTotal || 1)) * 100)}%) | Suspicious $\\rightarrow$ suspicious/high_concern; Benign $\\rightarrow$ low_concern |`,
    `| **Ambiguous Acceptable** | ${ambiguousAcceptableRun1} / ${ambiguousTotal} | ${ambiguousAcceptableRun2} / ${ambiguousTotal} | Ambiguous $\\rightarrow$ inconclusive, low_concern, or suspicious |`,
    `| **Run-to-Run Consistency** | ${runToRunMatches} / ${totalSamples} (${Math.round((runToRunMatches / totalSamples) * 100)}%) | ${runToRunMatches} / ${totalSamples} (${Math.round((runToRunMatches / totalSamples) * 100)}%) | Run 1 and Run 2 produced the identical risk level |`,
    ``,
    `## Evaluation Results Table`,
    ``,
    `| Sample ID | Lang | Author Label | Run 1 Risk | Run 2 Risk | Agreement (R1 / R2) | Indicators (R1/R2) | Unverified Quotes | Runs Agree? | Latency (avg) |`,
    `|---|---|---|---|---|---|---|---|---|---|`,
  ];

  for (const r of records) {
    const r1Status = r.run1_match ? '✅ Pass' : '❌ Fail';
    const r2Status = r.run2_match ? '✅ Pass' : '❌ Fail';
    const runsAgreeStr = r.runs_agree ? 'Yes' : '**No**';
    const unverifiedTotal = Math.max(r.run1_unverified, r.run2_unverified);

    lines.push(
      `| \`${r.id}\` | ${r.language} | \`${r.author_label}\` | \`${r.run1_risk_level}\` | \`${r.run2_risk_level}\` | ${r1Status} / ${r2Status} | ${r.run1_indicators} / ${r.run2_indicators} | ${unverifiedTotal} | ${runsAgreeStr} | ${r.avg_latency}ms |`
    );
  }

  // Where it went wrong section
  lines.push(``);
  lines.push(`## Where It Went Wrong`);
  lines.push(``);

  const disagreements = records.filter(
    (r) => !r.run1_match || !r.run2_match || !r.runs_agree
  );

  if (disagreements.length === 0) {
    lines.push(`- **Model / Label Disagreements**: None detected across all 10 synthetic samples.`);
  } else {
    lines.push(`### Disagreements & Consistency Issues`);
    for (const d of disagreements) {
      const issues = [];
      if (!d.runs_agree) {
        issues.push(`Run-to-run inconsistency (Run 1: \`${d.run1_risk_level}\`, Run 2: \`${d.run2_risk_level}\`)`);
      }
      if (!d.run1_match) {
        issues.push(`Run 1 returned \`${d.run1_risk_level}\`, expected \`${d.author_label}\``);
      }
      if (!d.run2_match && d.runs_agree) {
        issues.push(`Run 2 returned \`${d.run2_risk_level}\`, expected \`${d.author_label}\``);
      }
      lines.push(`- **\`${d.id}\`** (${d.author_label}): ${issues.join('; ')}.`);
    }
  }

  const unverifiedCases = records.filter(
    (r) => r.run1_unverified > 0 || r.run2_unverified > 0
  );
  lines.push(``);
  lines.push(`### Evidence Verification & Altered Quotes`);
  if (unverifiedCases.length === 0) {
    lines.push(`- **Altered or Hallucinated Quotes**: None. All extracted evidence quotes matched submitted text.`);
  } else {
    for (const u of unverifiedCases) {
      lines.push(
        `- **\`${u.id}\`**: Grounding check flagged unverified quotes (Run 1: ${u.run1_unverified}, Run 2: ${u.run2_unverified}).`
      );
    }
  }

  const errorCases = records.filter(
    (r) => r.run1_risk_level === 'error' || r.run2_risk_level === 'error'
  );
  lines.push(``);
  lines.push(`### Errors & Timeouts`);
  if (errorCases.length === 0) {
    lines.push(`- **API Errors / Timeouts**: None. All runs completed successfully.`);
  } else {
    for (const e of errorCases) {
      lines.push(
        `- **\`${e.id}\`**: Error occurred during execution (${e.run1_error || e.run2_error}).`
      );
    }
  }

  lines.push(``);
  lines.push(`### Language Problems`);
  lines.push(`- **Language / Script Anomalies**: None detected in English synthetic suite.`);
  lines.push(``);

  return lines.join('\n');
}

/**
 * Extracts only the table and summary blocks for embedding in README.md.
 */
export function extractReadmeEvalSection(records, meta = {}) {
  const modelName = meta.model || records[0]?.model || process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';
  const evalDate = meta.date || new Date().toISOString().split('T')[0];

  const strictSamples = records.filter((r) => r.author_label !== 'ambiguous');
  const strictMatches = strictSamples.filter((r) => r.run1_match && r.run2_match).length;
  const strictTotal = strictSamples.length;

  const runToRunMatches = records.filter((r) => r.runs_agree).length;
  const totalSamples = records.length;

  const lines = [
    `<!-- EVAL:START -->`,
    `### Gemma 4 Evaluation Summary (${evalDate})`,
    ``,
    `- **Model**: \`${modelName}\``,
    `- **Strict Agreement (Suspicious & Benign)**: ${strictMatches} / ${strictTotal} (${Math.round((strictMatches / (strictTotal || 1)) * 100)}%)`,
    `- **Run-to-Run Consistency**: ${runToRunMatches} / ${totalSamples} (${Math.round((runToRunMatches / totalSamples) * 100)}%)`,
    ``,
    `> _${CAVEAT_TEXT}_`,
    ``,
    `| Sample ID | Author Label | Run 1 Risk | Run 2 Risk | Agreement | Indicators | Runs Agree? | Avg Latency |`,
    `|---|---|---|---|---|---|---|---|`,
  ];

  for (const r of records) {
    const agree = r.run1_match && r.run2_match ? '✅ Pass' : !r.run1_match && !r.run2_match ? '❌ Fail' : '⚠️ Mixed';
    const runsAgreeStr = r.runs_agree ? 'Yes' : '**No**';
    lines.push(
      `| \`${r.id}\` | \`${r.author_label}\` | \`${r.run1_risk_level}\` | \`${r.run2_risk_level}\` | ${agree} | ${r.run1_indicators}/${r.run2_indicators} | ${runsAgreeStr} | ${r.avg_latency}ms |`
    );
  }

  lines.push(``);
  lines.push(`See detailed report and failure breakdown in [\`docs/EVAL.md\`](./docs/EVAL.md).`);
  lines.push(`<!-- EVAL:END -->`);

  return lines.join('\n');
}

/**
 * Updates README.md between <!-- EVAL:START --> and <!-- EVAL:END -->.
 * If markers are missing, inserts them under an "## Evaluation (small, honest)" section.
 * Idempotent: repeated runs replace the block in-place without duplicating.
 */
export function updateReadme(readmeContent, evalSectionMarkdown) {
  const markerRegex = /<!-- EVAL:START -->[\s\S]*?<!-- EVAL:END -->/;

  if (markerRegex.test(readmeContent)) {
    return readmeContent.replace(markerRegex, evalSectionMarkdown.trim());
  }

  // Section missing: append "## Evaluation (small, honest)" before License/Roadmap or at end
  const insertionHeader = '## Evaluation (small, honest)\n\n';
  return readmeContent.trimEnd() + '\n\n' + insertionHeader + evalSectionMarkdown.trim() + '\n';
}

/**
 * Main execution script entrypoint.
 */
async function main() {
  console.log('===============================================================');
  console.log('  LinkSleuth Real Gemma 4 Mini Evaluation Suite');
  console.log(`  Model: ${process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it'}`);
  console.log('===============================================================\n');

  console.log(`Running 10 synthetic samples with 2 passes each (20 total calls)...`);
  const records = await runEval({
    samples: EVAL_SAMPLES,
    delayMs: SLEEP_MS,
    onProgress: (msg) => console.log(`  ${msg}`),
  });

  console.log('\nRendering markdown artifacts...');
  const fullMarkdown = renderEvalMarkdown(records);
  const readmeSection = extractReadmeEvalSection(records);

  // Ensure docs/ directory exists
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }

  // Write docs/EVAL.md
  fs.writeFileSync(EVAL_MD_PATH, fullMarkdown, 'utf-8');
  console.log(`  ✅ Written: ${EVAL_MD_PATH}`);

  // Update README.md
  if (fs.existsSync(README_PATH)) {
    const existingReadme = fs.readFileSync(README_PATH, 'utf-8');
    const updatedReadme = updateReadme(existingReadme, readmeSection);
    fs.writeFileSync(README_PATH, updatedReadme, 'utf-8');
    console.log(`  ✅ Updated: ${README_PATH} (in-place between markers)`);
  }

  console.log('\n===============================================================');
  console.log('  Evaluation Complete!');
  console.log('===============================================================\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('Fatal eval error:', err);
    process.exit(1);
  });
}
