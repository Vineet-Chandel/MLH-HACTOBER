import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AnalysisOutputSchema,
  AnalyzeRequestSchema,
  ScamPatternEnum,
  DetectedLanguageEnum,
  OutputLanguageEnum,
  UserStateEnum,
} from '../src/validators/analysisSchema.js';

import {
  findEvidenceMatch,
  verifyEvidence,
  buildNormalizedIndexMap,
} from '../src/services/analyze.js';

import {
  buildAnalysisPrompt,
  buildImageAnalysisPrompt,
  DEFENSIVE_SYSTEM_INSTRUCTION,
  IMAGE_DEFENSIVE_SYSTEM_INSTRUCTION,
} from '../src/services/prompt.js';

import {
  buildStaticGuidance,
  getStaticGuidance,
} from '../src/services/staticGuidance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------------------------------------------------------
// 1. DATA FILES DETERMINISTIC TESTS
// --------------------------------------------------------------------------
test('1. DATA FILES: india-scam-patterns.json schema, unique ids, en/hi completeness, needs_verification', () => {
  const filePath = path.resolve(__dirname, '../src/data/india-scam-patterns.json');
  assert.ok(fs.existsSync(filePath), 'india-scam-patterns.json must exist');

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);

  assert.equal(
    parsed._comment,
    'Hindi drafted by AI; needs review by a native speaker before release.',
    'Must have top-level comment matching draft notice'
  );

  const patterns = Array.isArray(parsed) ? parsed : parsed.patterns;
  assert.ok(Array.isArray(patterns), 'patterns must be an array');

  const requiredIds = [
    'kyc_update',
    'upi_collect_request',
    'parcel_customs',
    'electricity_disconnection',
    'fake_job_task',
    'digital_arrest',
    'bank_impersonation_otp',
    'prize_lottery',
    'loan_app_harassment',
    'remote_access_app',
  ];

  const seenIds = new Set();
  for (const pat of patterns) {
    assert.ok(pat.id, 'Every pattern must have an id');
    assert.ok(!seenIds.has(pat.id), `Duplicate pattern ID found: ${pat.id}`);
    seenIds.add(pat.id);

    // en and hi completeness
    assert.ok(typeof pat.title_en === 'string' && pat.title_en.trim().length > 0, `Missing title_en for ${pat.id}`);
    assert.ok(typeof pat.title_hi === 'string' && pat.title_hi.trim().length > 0, `Missing title_hi for ${pat.id}`);
    assert.ok(Array.isArray(pat.signals) && pat.signals.length > 0, `Missing signals for ${pat.id}`);
    assert.ok(typeof pat.legit_look_alikes === 'string' && pat.legit_look_alikes.trim().length > 0, `Missing legit_look_alikes for ${pat.id}`);
    assert.ok(typeof pat.static_tip_en === 'string' && pat.static_tip_en.trim().length > 0, `Missing static_tip_en for ${pat.id}`);
    assert.ok(typeof pat.static_tip_hi === 'string' && pat.static_tip_hi.trim().length > 0, `Missing static_tip_hi for ${pat.id}`);

    // Every pattern making factual claims about institutional behaviors must have needs_verification: true
    assert.equal(
      pat.needs_verification,
      true,
      `Pattern ${pat.id} makes institutional factual claims and must have needs_verification: true`
    );
  }

  for (const id of requiredIds) {
    assert.ok(seenIds.has(id), `Missing required pattern ID: ${id}`);
  }
});

test('2. DATA FILES: regions/in.json exact allowlist, allowed hosts and phone', () => {
  const filePath = path.resolve(__dirname, '../src/data/regions/in.json');
  assert.ok(fs.existsSync(filePath), 'regions/in.json must exist');

  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);

  assert.equal(data.region, 'IN');
  assert.equal(data.label, 'India');
  assert.ok(Array.isArray(data.resources), 'resources must be an array');

  const ALLOWED_HOSTS = new Set(['cybercrime.gov.in', 'sancharsaathi.gov.in']);
  const ALLOWED_PHONES = new Set(['1930']);

  let found1930 = false;
  let foundCybercrime = false;
  let foundSancharSaathi = false;

  for (const res of data.resources) {
    assert.ok(res.id, 'Resource must have an id');
    assert.ok(res.name_en, `Resource ${res.id} missing name_en`);
    assert.ok(res.name_hi, `Resource ${res.id} missing name_hi`);
    assert.ok(res.use_for_en, `Resource ${res.id} missing use_for_en`);
    assert.ok(res.use_for_hi, `Resource ${res.id} missing use_for_hi`);

    if (res.url) {
      const parsed = new URL(res.url);
      assert.ok(
        ALLOWED_HOSTS.has(parsed.hostname),
        `Host ${parsed.hostname} is not in the exact allowlist`
      );
      if (parsed.hostname === 'cybercrime.gov.in') foundCybercrime = true;
      if (parsed.hostname === 'sancharsaathi.gov.in') {
        foundSancharSaathi = true;
        assert.equal(res.needs_verification, true, 'Sanchar Saathi must have needs_verification: true');
      }
    }

    if (res.number) {
      assert.ok(
        ALLOWED_PHONES.has(res.number),
        `Phone ${res.number} is not in the exact allowlist`
      );
      if (res.number === '1930') found1930 = true;
    }
  }

  assert.ok(found1930, 'Must include 1930 phone helpline');
  assert.ok(foundCybercrime, 'Must include cybercrime.gov.in');
  assert.ok(foundSancharSaathi, 'Must include sancharsaathi.gov.in');
});

// --------------------------------------------------------------------------
// 2. ZOD SCHEMA DETERMINISTIC TESTS
// --------------------------------------------------------------------------
test('3. ZOD SCHEMA: accepts new optional fields, safely defaults, validates enums, backwards compatible', () => {
  // Baseline old-shape response (without detected_language, scam_pattern, pattern_rationale)
  const oldShape = {
    risk_level: 'suspicious',
    summary: 'A suspicious lure attempting credential theft.',
    heuristic_score: 75,
    indicators: [
      {
        category: 'urgency',
        evidence: 'act now',
        explanation: 'Creates false pressure.',
        severity: 'high',
      },
    ],
    positive_or_neutral_signals: [],
    recommended_actions: ['Do not click link'],
    limitations: ['Headers unverified'],
  };

  const parsedOld = AnalysisOutputSchema.safeParse(oldShape);
  assert.ok(parsedOld.success, 'Old shape must validate cleanly');
  assert.equal(parsedOld.data.detected_language, 'unclear', 'detected_language defaults safely to unclear');
  assert.equal(parsedOld.data.scam_pattern, 'none', 'scam_pattern defaults safely to none');
  assert.equal(parsedOld.data.pattern_rationale, '', 'pattern_rationale defaults safely to empty string');

  // New shape with all new optional fields
  const newShape = {
    ...oldShape,
    detected_language: 'hinglish',
    scam_pattern: 'kyc_update',
    pattern_rationale: 'Urgent account suspension threat asking for KYC verification.',
  };

  const parsedNew = AnalysisOutputSchema.safeParse(newShape);
  assert.ok(parsedNew.success, 'New shape must validate cleanly');
  assert.equal(parsedNew.data.detected_language, 'hinglish');
  assert.equal(parsedNew.data.scam_pattern, 'kyc_update');
  assert.equal(parsedNew.data.pattern_rationale, newShape.pattern_rationale);

  // Rejection of invalid enums
  const badLanguage = { ...newShape, detected_language: 'klingon' };
  assert.equal(AnalysisOutputSchema.safeParse(badLanguage).success, false, 'Invalid language must be rejected');

  const badPattern = { ...newShape, scam_pattern: 'crypto_airdrop_fake' };
  assert.equal(AnalysisOutputSchema.safeParse(badPattern).success, false, 'Invalid scam pattern must be rejected');

  // Request validation with new fields
  const validRequest = {
    message: 'Aapka khata block hone wala hai',
    message_type: 'call',
    output_language: 'hi',
    user_state: 'paid_money',
  };
  const parsedReq = AnalyzeRequestSchema.safeParse(validRequest);
  assert.ok(parsedReq.success, 'Request with call message_type, output_language, user_state must validate');
  assert.equal(parsedReq.data.message_type, 'call');
  assert.equal(parsedReq.data.output_language, 'hi');
  assert.equal(parsedReq.data.user_state, 'paid_money');

  // Request defaults
  const minimalRequest = {
    message: 'Hello world',
    message_type: 'sms',
  };
  const parsedMin = AnalyzeRequestSchema.safeParse(minimalRequest);
  assert.ok(parsedMin.success);
  assert.equal(parsedMin.data.output_language, 'match');
  assert.equal(parsedMin.data.user_state, 'none');
});

// --------------------------------------------------------------------------
// 3. EVIDENCE MATCHING DETERMINISTIC TESTS
// --------------------------------------------------------------------------
test('4. EVIDENCE MATCHING: Devanagari exact, NFC vs NFD, zero-width chars, Hinglish, mixed script, repeated phrase, no match', () => {
  // A. Devanagari exact match
  const textDev = 'सूचना: आपका खाता तुरंत बंद कर दिया जाएगा।';
  const matchDev = findEvidenceMatch(textDev, 'खाता तुरंत बंद');
  assert.ok(matchDev.found, 'Devanagari exact match should be found');
  assert.equal(textDev.slice(matchDev.start, matchDev.end), 'खाता तुरंत बंद');

  // B. NFC vs NFD input (e.g. composed vs decomposed)
  const textNFD = 'Verify your re\u0301sume\u0301 now'; // NFD: e + combining acute
  const quoteNFC = 'résumé'; // NFC
  const matchNFC_NFD = findEvidenceMatch(textNFD, quoteNFC);
  assert.ok(matchNFC_NFD.found, 'NFC quote should match NFD input');
  assert.equal(textNFD.slice(matchNFC_NFD.start, matchNFC_NFD.end), 're\u0301sume\u0301');

  // C. Zero-width characters (ZWNJ \u200C and ZWJ \u200D in input)
  const textZW = 'आपका बैंक खा\u200Cता ब्लॉक हो गया है।'; // ZWNJ inside खाता
  const quotePlain = 'खाता ब्लॉक'; // plain without ZWNJ
  const matchZW = findEvidenceMatch(textZW, quotePlain);
  assert.ok(matchZW.found, 'Quote without ZWNJ must match source text with ZWNJ');
  assert.equal(textZW.slice(matchZW.start, matchZW.end), 'खा\u200Cता ब्लॉक');

  // D. Hinglish romanized match with whitespace differences
  const textHinglish = 'Aapka  SBI bank khata   suspend ho gaya hai.';
  const quoteHinglish = 'aapka sbi bank khata';
  const matchHinglish = findEvidenceMatch(textHinglish, quoteHinglish);
  assert.ok(matchHinglish.found, 'Hinglish quote with whitespace/case variation should match');
  assert.equal(textHinglish.slice(matchHinglish.start, matchHinglish.end), 'Aapka  SBI bank khata');

  // E. Mixed script (English + Devanagari)
  const textMixed = 'Dear User, आपका electricity bill बाकी है। Call XXXXXXXXXX';
  const quoteMixed = 'आपका electricity bill बाकी है';
  const matchMixed = findEvidenceMatch(textMixed, quoteMixed);
  assert.ok(matchMixed.found, 'Mixed script quote should match');
  assert.equal(textMixed.slice(matchMixed.start, matchMixed.end), 'आपका electricity bill बाकी है');

  // F. Repeated phrase returns first occurrence
  const textRepeated = 'call this number. For details call this number immediately.';
  const matchRepeated = findEvidenceMatch(textRepeated, 'call this number');
  assert.ok(matchRepeated.found);
  assert.equal(matchRepeated.start, 0);

  // G. No match returns found: false
  const matchNone = findEvidenceMatch(textDev, 'unrelated fraudulent string');
  assert.equal(matchNone.found, false, 'Non-existent quote must return found: false');
});

// --------------------------------------------------------------------------
// 4. PROMPT BUILDER DETERMINISTIC TESTS
// --------------------------------------------------------------------------
test('5. PROMPT BUILDER: includes pattern hints and output_language rule, excludes user_state and static tips', () => {
  const prompt = buildAnalysisPrompt({
    message: 'Suspicious text here',
    message_type: 'sms',
    output_language: 'hi',
  });

  // Includes output language rule
  assert.ok(prompt.includes('Requested Output Language: hi'), 'Must include output language request');
  assert.ok(prompt.includes('Hindi (Devanagari script)'), 'Must include language instruction rule');

  // Includes pattern hints in the system instruction
  assert.ok(DEFENSIVE_SYSTEM_INSTRUCTION.includes('kyc_update'), 'System instruction must include kyc_update hint');
  assert.ok(DEFENSIVE_SYSTEM_INSTRUCTION.includes('upi_collect_request'), 'System instruction must include upi_collect_request hint');
  assert.ok(DEFENSIVE_SYSTEM_INSTRUCTION.includes('digital_arrest'), 'System instruction must include digital_arrest hint');
  assert.ok(DEFENSIVE_SYSTEM_INSTRUCTION.includes('Legitimate Look-Alikes:'), 'System instruction must include legitimate look-alikes');

  // Must NOT include user_state
  assert.ok(!prompt.includes('user_state'), 'Prompt must NOT include user_state');
  assert.ok(!prompt.includes('paid_money'), 'Prompt must NOT include paid_money');
  assert.ok(!prompt.includes('clicked_link'), 'Prompt must NOT include clicked_link');
  assert.ok(!DEFENSIVE_SYSTEM_INSTRUCTION.includes('user_state'), 'System instruction must NOT include user_state');

  // Must NOT include static tips (static_tip_* are reserved for static guidance)
  assert.ok(!DEFENSIVE_SYSTEM_INSTRUCTION.includes('static_tip'), 'System instruction must NOT include static tips');
  assert.ok(!prompt.includes('Good to know'), 'Prompt must NOT include static tip headers');
});

// --------------------------------------------------------------------------
// 5. STATIC GUIDANCE BUILDER DETERMINISTIC TESTS
// --------------------------------------------------------------------------
test('6. STATIC GUIDANCE BUILDER: correct tip for each id and language, null for none/unclear, user_state selects block', () => {
  // English tip for kyc_update
  const g1 = buildStaticGuidance({
    scam_pattern: 'kyc_update',
    output_language: 'en',
    user_state: 'none',
  });
  assert.equal(g1.source, 'static_not_ai');
  assert.equal(g1.region, 'IN');
  assert.ok(g1.pattern_tip);
  assert.equal(g1.pattern_tip.id, 'kyc_update');
  assert.ok(g1.pattern_tip.title.includes('KYC'));
  assert.ok(g1.pattern_tip.tip.includes('Legitimate banks'));
  assert.equal(g1.user_state, 'none');
  assert.equal(g1.user_state_guidance, null);

  // Hindi tip for kyc_update
  const g2 = buildStaticGuidance({
    scam_pattern: 'kyc_update',
    output_language: 'hi',
    user_state: 'paid_money',
  });
  assert.ok(g2.pattern_tip);
  assert.ok(g2.pattern_tip.title.includes('केवाईसी'));
  assert.ok(g2.pattern_tip.tip.includes('वैध बैंक'));
  assert.equal(g2.user_state, 'paid_money');
  assert.ok(g2.user_state_guidance);
  assert.equal(g2.user_state_guidance.level, 'urgent');
  assert.ok(g2.user_state_guidance.heading.includes('पैसे भेज दिए'));
  // Ordering: 1930 first, bank second, cybercrime portal third
  assert.ok(g2.user_state_guidance.steps[0].includes('1930'), 'First step must be calling 1930');
  assert.ok(g2.user_state_guidance.steps[1].includes('बैंक'), 'Second step must be contacting bank');
  assert.ok(g2.user_state_guidance.steps[2].includes('cybercrime.gov.in'), 'Third step must be cybercrime portal');

  // Null pattern tip for none, unclear, and other
  const gNone = buildStaticGuidance({ scam_pattern: 'none' });
  assert.equal(gNone.pattern_tip, null);

  const gUnclear = buildStaticGuidance({ scam_pattern: 'unclear' });
  assert.equal(gUnclear.pattern_tip, null);

  const gOther = buildStaticGuidance({ scam_pattern: 'other' });
  assert.equal(gOther.pattern_tip, null);

  // Selected user_state blocks for shared_info and clicked_link
  const gShared = buildStaticGuidance({ user_state: 'shared_info', output_language: 'en' });
  assert.ok(gShared.user_state_guidance.heading.includes('Shared Sensitive Information'));
  assert.ok(gShared.user_state_guidance.steps[0].includes('Change your account passwords'));

  const gClicked = buildStaticGuidance({ user_state: 'clicked_link', output_language: 'en' });
  assert.ok(gClicked.user_state_guidance.heading.includes('Clicked a Suspicious Link'));
  assert.ok(gClicked.user_state_guidance.steps[0].includes('Do not enter any personal details'));
});

// --------------------------------------------------------------------------
// 6. WHERE TO REPORT SECURITY LINK CHECK (STATIC CHECK)
// --------------------------------------------------------------------------
test('7. SECURITY CHECK: WhereToReportPanel renders only allowlisted static anchors with rel="noopener noreferrer"', () => {
  const componentPath = path.resolve(__dirname, '../../client/src/components/WhereToReportPanel.jsx');
  assert.ok(fs.existsSync(componentPath), 'WhereToReportPanel.jsx must exist');

  const content = fs.readFileSync(componentPath, 'utf-8');

  // Verify that any <a> tag in WhereToReportPanel has target="_blank" and rel="noopener noreferrer"
  assert.ok(content.includes('target="_blank"'), 'Must have target="_blank"');
  assert.ok(content.includes('rel="noopener noreferrer"'), 'Must have rel="noopener noreferrer"');

  // Verify that it uses staticGuidance and never submitted URLs
  assert.ok(content.includes('staticGuidance'), 'Must use staticGuidance prop');
  assert.ok(content.includes('resources'), 'Must use resources from static guidance');
  assert.ok(!content.includes('submittedUrl'), 'Must not render submittedUrl as links');
  assert.ok(!content.includes('analysisResult.image_observations'), 'Must not render image URLs as links');
  assert.ok(content.includes('href={`tel:${res.number}`}'), 'Must support tel: links for phone numbers');
});
