import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AnalyzeRequestSchema,
  AnalysisOutputSchema,
} from '../src/validators/analysisSchema.js';
import {
  stripFences,
  findEvidenceMatch,
  verifyEvidence,
  mapToAnalysisError,
  analyzeMessage,
  AnalysisError,
} from '../src/services/analyze.js';

test('1. Request validation unit tests', async (t) => {
  // Empty message
  const emptyRes = AnalyzeRequestSchema.safeParse({
    message: '   ',
    message_type: 'sms',
  });
  assert.equal(emptyRes.success, false);
  assert.match(emptyRes.error.errors[0].message, /cannot be empty/i);

  // Message too long (>15000 characters)
  const tooLongRes = AnalyzeRequestSchema.safeParse({
    message: 'a'.repeat(15001),
    message_type: 'email',
  });
  assert.equal(tooLongRes.success, false);
  assert.match(tooLongRes.error.errors[0].message, /exceeds 15,000/i);

  // Bad message_type
  const badTypeRes = AnalyzeRequestSchema.safeParse({
    message: 'Valid message content',
    message_type: 'whatsapp',
  });
  assert.equal(badTypeRes.success, false);

  // Valid message with trimming and optional URL
  const validRes = AnalyzeRequestSchema.safeParse({
    message: '  Please verify your account at the link below.  ',
    message_type: 'email',
    url: 'https://example-phish.com/login',
  });
  assert.equal(validRes.success, true);
  assert.equal(
    validRes.data.message,
    'Please verify your account at the link below.'
  );
  assert.equal(validRes.data.url, 'https://example-phish.com/login');
});

test('2. Zod model output schema accept / reject tests', async (t) => {
  const validOutput = {
    risk_level: 'suspicious',
    summary: 'Message contains urgent call to action and unusual URL.',
    heuristic_score: 75,
    indicators: [
      {
        category: 'urgency',
        evidence: 'immediate action required',
        explanation: 'Creates false urgency to bypass critical thinking.',
        severity: 'high',
        uncertainty: 'Sender identity not verified independently.',
      },
    ],
    positive_or_neutral_signals: ['Standard greeting used'],
    recommended_actions: ['Do not click link', 'Contact support via known app'],
    limitations: ['URL was not dynamically retrieved'],
  };

  const acceptRes = AnalysisOutputSchema.safeParse(validOutput);
  assert.equal(acceptRes.success, true);

  // Missing required risk_level
  const missingField = { ...validOutput };
  delete missingField.risk_level;
  const rejectMissing = AnalysisOutputSchema.safeParse(missingField);
  assert.equal(rejectMissing.success, false);

  // Out of range heuristic_score (> 100)
  const outOfBounds = { ...validOutput, heuristic_score: 105 };
  const rejectScore = AnalysisOutputSchema.safeParse(outOfBounds);
  assert.equal(rejectScore.success, false);

  // Invalid indicator category
  const badCategory = {
    ...validOutput,
    indicators: [{ ...validOutput.indicators[0], category: 'alien_signal' }],
  };
  const rejectCategory = AnalysisOutputSchema.safeParse(badCategory);
  assert.equal(rejectCategory.success, false);
});

test('3. Fence stripping unit tests', () => {
  // Markdown json fence
  const markdownFenced = '```json\n{"risk_level":"low_concern"}\n```';
  assert.equal(stripFences(markdownFenced), '{"risk_level":"low_concern"}');

  // Generic fence without language tag
  const genericFence = '```\n{"risk_level":"suspicious"}\n```';
  assert.equal(stripFences(genericFence), '{"risk_level":"suspicious"}');

  // Plain JSON without fences
  const plainJson = '{"risk_level":"inconclusive"}';
  assert.equal(stripFences(plainJson), '{"risk_level":"inconclusive"}');

  // Non-string input handling
  assert.equal(stripFences(null), '');
});

test('4. Evidence verification unit tests', () => {
  const submittedText =
    'Your bank account is locked. Please click here to verify.';
  const submittedUrl = 'https://fake-bank-auth.com';

  const indicators = [
    {
      category: 'urgency',
      evidence: 'bank account is locked',
      explanation: 'Urgent account suspension claim.',
      severity: 'high',
      uncertainty: '',
    },
    {
      category: 'domain_mismatch',
      evidence: 'fake-bank-auth.com',
      explanation: 'Suspicious domain name.',
      severity: 'high',
      uncertainty: '',
    },
    {
      category: 'impersonation',
      evidence: 'hallucinated phrase not in text',
      explanation: 'Should be flagged as unverified.',
      severity: 'medium',
      uncertainty: '',
    },
  ];

  const { verifiedIndicators, unverifiedCount } = verifyEvidence(
    indicators,
    submittedText,
    submittedUrl
  );

  assert.equal(verifiedIndicators.length, 3);
  assert.equal(verifiedIndicators[0].unverified, false);
  assert.equal(verifiedIndicators[0].evidence_match.found, true);
  assert.equal(verifiedIndicators[0].evidence_match.start, 5);
  assert.equal(verifiedIndicators[0].evidence_match.end, 27);
  assert.equal(
    submittedText.slice(
      verifiedIndicators[0].evidence_match.start,
      verifiedIndicators[0].evidence_match.end
    ),
    'bank account is locked'
  );

  assert.equal(verifiedIndicators[1].unverified, false);
  assert.equal(verifiedIndicators[1].evidence_match.found, false);

  assert.equal(verifiedIndicators[2].unverified, true);
  assert.equal(verifiedIndicators[2].evidence_match.found, false);
  assert.equal(unverifiedCount, 1);
});

test('4b. Character offset evidence matching unit tests', () => {
  const text =
    'URGENT: Your First National Bank account has been suspended due to suspicious activity. Please verify your account immediately at https://example.com/login. Action required immediately.';

  // 1. Exact match
  const exact = findEvidenceMatch(text, 'First National Bank');
  assert.equal(exact.found, true);
  assert.equal(exact.start, 13);
  assert.equal(exact.end, 32);
  assert.equal(text.slice(exact.start, exact.end), 'First National Bank');

  // 2. Case difference
  const caseDiff = findEvidenceMatch(text, 'urgent: your first national bank');
  assert.equal(caseDiff.found, true);
  assert.equal(caseDiff.start, 0);
  assert.equal(caseDiff.end, 32);
  assert.equal(
    text.slice(caseDiff.start, caseDiff.end),
    'URGENT: Your First National Bank'
  );

  // 3. Extra whitespace (in quote or in text)
  const whitespaceText = 'Please    verify \n  your account    immediately';
  const whitespaceMatch = findEvidenceMatch(
    whitespaceText,
    'Please verify your account immediately'
  );
  assert.equal(whitespaceMatch.found, true);
  assert.equal(whitespaceMatch.start, 0);
  assert.equal(whitespaceMatch.end, whitespaceText.length);
  assert.equal(
    whitespaceText.slice(whitespaceMatch.start, whitespaceMatch.end),
    whitespaceText
  );

  // Also extra whitespace in quote matching normal text
  const whitespaceQuoteMatch = findEvidenceMatch(
    text,
    'suspicious   activity'
  );
  assert.equal(whitespaceQuoteMatch.found, true);
  assert.equal(text.slice(whitespaceQuoteMatch.start, whitespaceQuoteMatch.end), 'suspicious activity');

  // 4. No match
  const noMatch = findEvidenceMatch(text, 'completely fabricated cryptographic proof');
  assert.equal(noMatch.found, false);

  // 5. Repeated phrase (must return the first occurrence)
  // "immediately" appears twice: first after "your account", second in "Action required immediately."
  const repeated = findEvidenceMatch(text, 'immediately');
  assert.equal(repeated.found, true);
  const firstImmediateIdx = text.indexOf('immediately');
  assert.equal(repeated.start, firstImmediateIdx);
  assert.equal(repeated.end, firstImmediateIdx + 'immediately'.length);

  // 6. Overlapping quotes
  // Quote A: "First National Bank account"
  // Quote B: "Bank account has been suspended"
  const overlapA = findEvidenceMatch(text, 'First National Bank account');
  const overlapB = findEvidenceMatch(text, 'Bank account has been suspended');
  assert.equal(overlapA.found, true);
  assert.equal(overlapB.found, true);
  assert.equal(text.slice(overlapA.start, overlapA.end), 'First National Bank account');
  assert.equal(text.slice(overlapB.start, overlapB.end), 'Bank account has been suspended');
  // Confirm they overlap in character range
  assert(overlapA.start < overlapB.start);
  assert(overlapA.end > overlapB.start);
});

test('5. Repair-path logic with mocked model', async () => {
  const validOutputObj = {
    risk_level: 'suspicious',
    summary: 'Repaired analysis.',
    heuristic_score: 60,
    indicators: [
      {
        category: 'credential_request',
        evidence: 'enter your password',
        explanation: 'Credential harvesting indicator.',
        severity: 'high',
        uncertainty: '',
      },
    ],
    positive_or_neutral_signals: [],
    recommended_actions: ['Ignore email'],
    limitations: [],
  };

  // Case A: First call fails validation (malformed JSON), second call (repair) succeeds
  let callCount = 0;
  const mockSucceedsOnRepair = async () => {
    callCount++;
    if (callCount === 1) {
      return '{ malformed_json: true, missing_fields';
    }
    return JSON.stringify(validOutputObj);
  };

  const repairResult = await analyzeMessage(
    {
      message: 'Please enter your password to confirm.',
      message_type: 'email',
    },
    mockSucceedsOnRepair
  );

  assert.equal(callCount, 2);
  assert.equal(repairResult.analysis.risk_level, 'suspicious');
  assert.equal(repairResult.meta.unverified_evidence_count, 0);

  // Case B: Both initial and repair call fail -> throws MODEL_OUTPUT_INVALID (502)
  let failCount = 0;
  const mockAlwaysFails = async () => {
    failCount++;
    return 'Not valid JSON at all';
  };

  await assert.rejects(
    async () => {
      await analyzeMessage(
        {
          message: 'Some test message.',
          message_type: 'sms',
        },
        mockAlwaysFails
      );
    },
    (err) => {
      assert(err instanceof AnalysisError);
      assert.equal(err.code, 'MODEL_OUTPUT_INVALID');
      assert.equal(err.status, 502);
      return true;
    }
  );
  assert.equal(failCount, 2);
});

test('6. Error-code mapping tests', () => {
  // Timeout error
  const timeoutErr = mapToAnalysisError(new Error('Request TIMEOUT'));
  assert.equal(timeoutErr.code, 'TIMEOUT');
  assert.equal(timeoutErr.status, 504);

  // Quota / Rate limit error
  const rateLimitErr = mapToAnalysisError(
    new Error('429 RESOURCE_EXHAUSTED quota exceeded')
  );
  assert.equal(rateLimitErr.code, 'RATE_LIMITED');
  assert.equal(rateLimitErr.status, 429);

  // Auth failed error
  const authErr = mapToAnalysisError(new Error('API_KEY_INVALID: 401'));
  assert.equal(authErr.code, 'AUTH_FAILED');
  assert.equal(authErr.status, 502);

  // Model unavailable error
  const unavailableErr = mapToAnalysisError(
    new Error('Requested model NOT_FOUND')
  );
  assert.equal(unavailableErr.code, 'MODEL_UNAVAILABLE');
  assert.equal(unavailableErr.status, 503);
});
