import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAgreement,
  ACCEPTABLE_RISK_LEVELS,
  renderEvalMarkdown,
  extractReadmeEvalSection,
  updateReadme,
  runEval,
  CAVEAT_TEXT,
} from '../scripts/eval.js';
import { EVAL_SAMPLES } from '../scripts/eval-samples.js';

test('EVAL AGREEMENT FUNCTION: matches specification constants', () => {
  // Suspicious -> suspicious or high_concern
  assert.equal(isAgreement('suspicious', 'suspicious'), true);
  assert.equal(isAgreement('suspicious', 'high_concern'), true);
  assert.equal(isAgreement('suspicious', 'low_concern'), false);
  assert.equal(isAgreement('suspicious', 'inconclusive'), false);

  // Benign -> low_concern
  assert.equal(isAgreement('benign', 'low_concern'), true);
  assert.equal(isAgreement('benign', 'suspicious'), false);
  assert.equal(isAgreement('benign', 'high_concern'), false);
  assert.equal(isAgreement('benign', 'inconclusive'), false);

  // Ambiguous -> inconclusive, suspicious, low_concern
  assert.equal(isAgreement('ambiguous', 'inconclusive'), true);
  assert.equal(isAgreement('ambiguous', 'suspicious'), true);
  assert.equal(isAgreement('ambiguous', 'low_concern'), true);
  assert.equal(isAgreement('ambiguous', 'other_unknown'), false);
});

test('EVAL TABLE RENDERER: formats markdown table, summary, and failure breakdown', () => {
  const mockRecords = [
    {
      id: 'synth-suspicious-01-otp',
      language: 'en',
      author_label: 'suspicious',
      run1_risk_level: 'suspicious',
      run2_risk_level: 'suspicious',
      run1_indicators: 3,
      run2_indicators: 3,
      run1_unverified: 0,
      run2_unverified: 0,
      runs_agree: true,
      run1_match: true,
      run2_match: true,
      avg_latency: 1200,
      model: 'gemma-4-test',
    },
    {
      id: 'synth-benign-01-tx-alert',
      language: 'en',
      author_label: 'benign',
      run1_risk_level: 'low_concern',
      run2_risk_level: 'suspicious', // simulated disagreement
      run1_indicators: 0,
      run2_indicators: 1,
      run1_unverified: 0,
      run2_unverified: 1,
      runs_agree: false,
      run1_match: true,
      run2_match: false,
      avg_latency: 1100,
      model: 'gemma-4-test',
    },
  ];

  const md = renderEvalMarkdown(mockRecords, { model: 'gemma-4-test', date: '2026-10-24' });

  // Caveat text present
  assert.ok(md.includes(CAVEAT_TEXT));
  // Summary counts table present
  assert.ok(md.includes('## Summary Counts'));
  assert.ok(md.includes('Strict Agreement'));
  assert.ok(md.includes('Run-to-Run Consistency'));
  // Results table present
  assert.ok(md.includes('## Evaluation Results Table'));
  assert.ok(md.includes('synth-suspicious-01-otp'));
  assert.ok(md.includes('synth-benign-01-tx-alert'));
  // Where it went wrong section lists disagreements and altered quotes by ID
  assert.ok(md.includes('## Where It Went Wrong'));
  assert.ok(md.includes('synth-benign-01-tx-alert'));
  assert.ok(md.includes('Run-to-run inconsistency'));
  assert.ok(md.includes('unverified quotes'));

  // Never logs raw message content
  for (const sample of EVAL_SAMPLES) {
    if (sample.message.length > 20) {
      assert.ok(!md.includes(sample.message), 'Markdown must not contain raw message text');
    }
  }
});

test('README MARKER REPLACEMENT: handles missing marker and idempotent re-runs', () => {
  const initialReadme = `# Project LinkSleuth\n\nSome project overview text.\n\n## Roadmap\n- [ ] Task 1`;
  const sectionContent = `<!-- EVAL:START -->\n### Eval Run 1\n- Metric: 100%\n<!-- EVAL:END -->`;

  // 1. Missing marker: creates "## Evaluation (small, honest)" and inserts markers
  const updated1 = updateReadme(initialReadme, sectionContent);
  assert.ok(updated1.includes('## Evaluation (small, honest)'));
  assert.ok(updated1.includes('<!-- EVAL:START -->'));
  assert.ok(updated1.includes('### Eval Run 1'));
  assert.ok(updated1.includes('<!-- EVAL:END -->'));

  // 2. Re-run: replaces block in-place without duplicating header or markers
  const sectionContent2 = `<!-- EVAL:START -->\n### Eval Run 2 (Updated)\n- Metric: 90%\n<!-- EVAL:END -->`;
  const updated2 = updateReadme(updated1, sectionContent2);

  assert.ok(updated2.includes('### Eval Run 2 (Updated)'));
  assert.ok(!updated2.includes('### Eval Run 1'));

  // Verify markers appear exactly once
  const startCount = (updated2.match(/<!-- EVAL:START -->/g) || []).length;
  const endCount = (updated2.match(/<!-- EVAL:END -->/g) || []).length;
  const headerCount = (updated2.match(/## Evaluation \(small, honest\)/g) || []).length;

  assert.equal(startCount, 1, 'EVAL:START marker must appear exactly once');
  assert.equal(endCount, 1, 'EVAL:END marker must appear exactly once');
  assert.equal(headerCount, 1, 'Evaluation section header must appear exactly once');
});

test('MOCKED RUN EVAL: processes 10 samples with 2 passes deterministically', async () => {
  const mockAnalyzeFn = async (input) => {
    // Deterministic mock model response based on message content
    const msg = input.message.toLowerCase();
    const isSusp = msg.includes('urgent') || msg.includes('blocked') || msg.includes('customs');
    return {
      analysis: {
        risk_level: isSusp ? 'suspicious' : 'low_concern',
        heuristic_score: isSusp ? 85 : 5,
        indicators: isSusp ? [{ evidence: 'test', explanation: 'mock finding' }] : [],
      },
      meta: {
        model: 'gemma-4-mock',
        unverified_evidence_count: 0,
      },
    };
  };

  const records = await runEval({
    samples: EVAL_SAMPLES,
    analyzeFn: mockAnalyzeFn,
    delayMs: 0, // no delay for unit test
  });

  assert.equal(records.length, 10);
  for (const r of records) {
    assert.ok(r.id);
    assert.ok(r.run1_risk_level);
    assert.ok(r.run2_risk_level);
    assert.equal(typeof r.runs_agree, 'boolean');
  }
});
