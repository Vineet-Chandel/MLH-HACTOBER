import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { analyzeMessage } from '../src/services/analyze.js';
import { getGemmaModel } from '../src/services/gemma.js';
import samplesData from '../src/data/india-samples.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Computes whether the returned model risk_level agrees with the human author label.
 * Rules:
 * - suspicious -> 'suspicious' or 'high_concern'
 * - benign -> 'low_concern'
 * - ambiguous -> 'inconclusive', 'suspicious', or 'low_concern'
 */
export function checkAgreement(authorLabel, modelRiskLevel) {
  if (authorLabel === 'suspicious') {
    return modelRiskLevel === 'suspicious' || modelRiskLevel === 'high_concern';
  }
  if (authorLabel === 'benign') {
    return modelRiskLevel === 'low_concern';
  }
  if (authorLabel === 'ambiguous') {
    return (
      modelRiskLevel === 'inconclusive' ||
      modelRiskLevel === 'suspicious' ||
      modelRiskLevel === 'low_concern'
    );
  }
  return false;
}

async function runIndiaEval() {
  const modelName = getGemmaModel();
  const dateStr = new Date().toISOString().split('T')[0];
  console.log(`=======================================================`);
  console.log(`  LinkSleuth India Scam Coverage Evaluation`);
  console.log(`  Target Model: ${modelName}`);
  console.log(`  Date:         ${dateStr}`);
  console.log(`  Sample Count: ${samplesData.length}`);
  console.log(`=======================================================\n`);

  const results = [];

  for (let i = 0; i < samplesData.length; i++) {
    const sample = samplesData[i];
    console.log(`[${i + 1}/${samplesData.length}] Evaluating sample: ${sample.id} (${sample.author_label})...`);

    // Run 1
    console.log(`  -> Executing Run 1...`);
    let run1Result = null;
    let run1Error = null;
    try {
      run1Result = await analyzeMessage({
        message: sample.message,
        message_type: sample.message_type || 'sms',
        url: sample.url || undefined,
        output_language: sample.language === 'hi' ? 'hi' : 'match',
      });
    } catch (err) {
      console.error(`  Run 1 failed:`, err.message);
      run1Error = err.message;
    }

    await sleep(2500); // delay to respect model quota

    // Run 2
    console.log(`  -> Executing Run 2...`);
    let run2Result = null;
    let run2Error = null;
    try {
      run2Result = await analyzeMessage({
        message: sample.message,
        message_type: sample.message_type || 'sms',
        url: sample.url || undefined,
        output_language: sample.language === 'hi' ? 'hi' : 'match',
      });
    } catch (err) {
      console.error(`  Run 2 failed:`, err.message);
      run2Error = err.message;
    }

    await sleep(2500); // delay to respect model quota

    const run1Risk = run1Result?.analysis?.risk_level || 'ERROR';
    const run2Risk = run2Result?.analysis?.risk_level || 'ERROR';

    const run1Agrees = checkAgreement(sample.author_label, run1Risk);
    const run2Agrees = checkAgreement(sample.author_label, run2Risk);
    const overallAgrees = run1Agrees && run2Agrees;
    const consistent = run1Risk === run2Risk;

    const scamPattern1 = run1Result?.analysis?.scam_pattern || 'none';
    const detectedLang1 = run1Result?.analysis?.detected_language || 'unclear';
    const indicatorsCount1 = run1Result?.analysis?.indicators?.length ?? 0;
    const unverifiedCount1 = run1Result?.meta?.unverified_evidence_count ?? 0;
    const highlightingMatched1 = unverifiedCount1 === 0 && (indicatorsCount1 === 0 || run1Result?.analysis?.indicators?.every(ind => ind.evidence_match?.found));

    const indicatorsCount2 = run2Result?.analysis?.indicators?.length ?? 0;
    const unverifiedCount2 = run2Result?.meta?.unverified_evidence_count ?? 0;
    const highlightingMatched2 = unverifiedCount2 === 0 && (indicatorsCount2 === 0 || run2Result?.analysis?.indicators?.every(ind => ind.evidence_match?.found));

    const bothHighlighted = highlightingMatched1 && highlightingMatched2;

    results.push({
      id: sample.id,
      author_label: sample.author_label,
      language: sample.language,
      message_type: sample.message_type,
      run1_risk: run1Risk,
      run2_risk: run2Risk,
      scam_pattern: scamPattern1,
      detected_language: detectedLang1,
      indicators_count: `${indicatorsCount1}/${indicatorsCount2}`,
      unverified_count: `${unverifiedCount1}/${unverifiedCount2}`,
      highlight_matched: bothHighlighted ? 'YES' : (highlightingMatched1 ? 'Run 1 only' : (highlightingMatched2 ? 'Run 2 only' : 'NO')),
      agrees: overallAgrees ? 'PASS' : 'FAIL',
      run1_agrees: run1Agrees,
      run2_agrees: run2Agrees,
      consistent: consistent ? 'YES' : 'NO',
      run1_summary: run1Result?.analysis?.summary || '',
      run2_summary: run2Result?.analysis?.summary || '',
      run1Error,
      run2Error,
    });

    console.log(`  Done: Run1=${run1Risk}, Run2=${run2Risk}, Pattern=${scamPattern1}, Agrees=${overallAgrees ? 'PASS' : 'FAIL'}, Consistent=${consistent ? 'YES' : 'NO'}\n`);
  }

  // Generate docs/EVAL.md content
  const total = results.length;
  const passCount = results.filter((r) => r.agrees === 'PASS').length;
  const consistentCount = results.filter((r) => r.consistent === 'YES').length;
  const highlightPassCount = results.filter((r) => r.highlight_matched === 'YES').length;

  const mdLines = [
    `# LinkSleuth India Scam Coverage Evaluation (docs/EVAL.md)`,
    ``,
    `- **Model:** \`${modelName}\``,
    `- **Evaluation Date:** ${dateStr}`,
    `- **Total Synthetic Samples:** ${total}`,
    `- **Agreement Rate:** ${passCount} / ${total} (${Math.round((passCount / total) * 100)}%)`,
    `- **Run-to-Run Consistency:** ${consistentCount} / ${total} (${Math.round((consistentCount / total) * 100)}%)`,
    `- **Highlight Grounding Match Rate:** ${highlightPassCount} / ${total} (${Math.round((highlightPassCount / total) * 100)}%)`,
    ``,
    `> **Honesty & Integrity Policy:** LinkSleuth reports all model results honestly. Failure cases, run-to-run variances, and edge cases are preserved without cherry-picking or tuning sample labels to force artificial passes. Message contents are omitted to prevent data leakage.`,
    ``,
    `## Per-Sample Evaluation Table`,
    ``,
    `| Sample ID | Author Label | Run 1 Risk | Run 2 Risk | Scam Pattern | Language | Indicators (R1/R2) | Highlighting Matched? | Agrees with Author Label? | Consistent? |`,
    `|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|`,
  ];

  for (const r of results) {
    mdLines.push(
      `| \`${r.id}\` | \`${r.author_label}\` | \`${r.run1_risk}\` | \`${r.run2_risk}\` | \`${r.scam_pattern}\` | \`${r.detected_language}\` | ${r.indicators_count} | ${r.highlight_matched} | **${r.agrees}** | ${r.consistent} |`
    );
  }

  mdLines.push(``);
  mdLines.push(`## Analysis of Disagreements & Observations`);
  mdLines.push(``);

  const failures = results.filter((r) => r.agrees === 'FAIL');
  if (failures.length === 0) {
    mdLines.push(`- **Disagreements:** None. All ${total} samples produced risk levels consistent with author intentions across both runs.`);
  } else {
    mdLines.push(`### Disagreements with Author Label:`);
    for (const f of failures) {
      mdLines.push(`- **\`${f.id}\`** (intended \`${f.author_label}\`): Run 1 returned \`${f.run1_risk}\`, Run 2 returned \`${f.run2_risk}\`. Pattern: \`${f.scam_pattern}\`.`);
    }
  }

  const inconsistent = results.filter((r) => r.consistent === 'NO');
  if (inconsistent.length > 0) {
    mdLines.push(``);
    mdLines.push(`### Run-to-Run Inconsistencies:`);
    for (const inc of inconsistent) {
      mdLines.push(`- **\`${inc.id}\`**: Run 1 gave \`${inc.run1_risk}\` while Run 2 gave \`${inc.run2_risk}\`.`);
    }
  } else {
    mdLines.push(`- **Consistency:** 100% of samples yielded identical risk levels between Run 1 and Run 2.`);
  }

  const unverified = results.filter((r) => r.highlight_matched !== 'YES');
  if (unverified.length > 0) {
    mdLines.push(``);
    mdLines.push(`### Evidence Grounding Highlights:`);
    for (const u of unverified) {
      mdLines.push(`- **\`${u.id}\`**: Highlighting match status: ${u.highlight_matched}. Unverified count: ${u.unverified_count}.`);
    }
  } else {
    mdLines.push(`- **Evidence Grounding:** 100% of extracted quotes verbatim matched original input spans with zero unverified quotes.`);
  }

  const outDir = path.resolve(__dirname, '../../docs');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, 'EVAL.md');
  fs.writeFileSync(outPath, mdLines.join('\n'), 'utf-8');

  console.log(`\n[eval-india] Successfully wrote evaluation results to ${outPath}`);
  console.log(`[eval-india] Agreement: ${passCount}/${total}, Consistency: ${consistentCount}/${total}`);
}

runIndiaEval().catch((err) => {
  console.error('[eval-india] Fatal error:', err);
  process.exit(1);
});
