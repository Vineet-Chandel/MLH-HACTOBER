import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectMagicBytes,
  parseImageDimensions,
  validateImageFile,
  ImageValidationError,
} from '../src/validators/imageValidator.js';
import {
  ImageAnalysisOutputSchema,
  AnalyzeImageRequestSchema,
} from '../src/validators/analysisSchema.js';
import { verifyImageEvidence } from '../src/services/analyze.js';

// Minimal valid PNG buffer: 8-byte signature + 13-byte IHDR + CRC (1x1 pixel)
const VALID_1X1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

// Minimal valid JPEG header (SOI + SOF0)
const VALID_JPEG_HEADER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11,
  0x08, 0x00, 0x64, 0x00, 0xc8, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01,
  0x03, 0x11, 0x01,
]); // 200x100 JPEG

// Minimal valid WebP header
const VALID_WEBP_HEADER = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBP'),
  Buffer.from('VP8 '),
  Buffer.alloc(4),
  Buffer.from([0x00, 0x00, 0x00, 0x9d, 0x01, 0x2a, 0x64, 0x00, 0x32, 0x00]), // 100x50 WebP
]);

test('1. Magic bytes detection unit tests', () => {
  // Valid PNG
  assert.equal(detectMagicBytes(VALID_1X1_PNG), 'image/png');

  // Valid JPEG
  assert.equal(detectMagicBytes(VALID_JPEG_HEADER), 'image/jpeg');

  // Valid WebP
  assert.equal(detectMagicBytes(VALID_WEBP_HEADER), 'image/webp');

  // Spoofed file: text content with PNG extension
  const fakePng = Buffer.from('This is actually a plain text file, not a PNG!');
  assert.equal(detectMagicBytes(fakePng), null);

  // Empty buffer
  assert.equal(detectMagicBytes(Buffer.alloc(0)), null);

  // Null/non-buffer
  assert.equal(detectMagicBytes(null), null);
});

test('2. Header dimension parsing unit tests', () => {
  // PNG: 1x1
  const pngDims = parseImageDimensions(VALID_1X1_PNG, 'image/png');
  assert.deepEqual(pngDims, { width: 1, height: 1 });

  // JPEG: 200x100
  const jpegDims = parseImageDimensions(VALID_JPEG_HEADER, 'image/jpeg');
  assert.deepEqual(jpegDims, { width: 200, height: 100 });

  // WebP: 100x50
  const webpDims = parseImageDimensions(VALID_WEBP_HEADER, 'image/webp');
  assert.deepEqual(webpDims, { width: 100, height: 50 });
});

test('3. validateImageFile unit tests', () => {
  // Valid PNG
  const validRes = validateImageFile({ buffer: VALID_1X1_PNG });
  assert.equal(validRes.mimeType, 'image/png');
  assert.equal(validRes.width, 1);
  assert.equal(validRes.height, 1);

  // Missing file / empty buffer
  assert.throws(
    () => validateImageFile(null),
    (err) => err instanceof ImageValidationError && err.code === 'INVALID_INPUT' && err.status === 400
  );

  assert.throws(
    () => validateImageFile({ buffer: Buffer.alloc(0) }),
    (err) => err instanceof ImageValidationError && err.code === 'INVALID_INPUT' && err.status === 400
  );

  // Oversize buffer (> 5 MB)
  const hugeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);
  assert.throws(
    () => validateImageFile({ buffer: hugeBuffer }),
    (err) => err instanceof ImageValidationError && err.code === 'FILE_TOO_LARGE' && err.status === 413
  );

  // Unsupported / fake file type
  const textBuffer = Buffer.from('hello world not an image');
  assert.throws(
    () => validateImageFile({ buffer: textBuffer }),
    (err) => err instanceof ImageValidationError && err.code === 'INVALID_FILE_TYPE' && err.status === 415
  );

  // Absurd dimension (> 8000px)
  const hugePng = Buffer.from(VALID_1X1_PNG);
  hugePng.writeUInt32BE(8001, 16); // set width to 8001
  assert.throws(
    () => validateImageFile({ buffer: hugePng }),
    (err) => err instanceof ImageValidationError && err.code === 'INVALID_INPUT' && err.status === 400
  );
});

test('4. Image Zod schema acceptance and rejection unit tests', () => {
  const validImageOutput = {
    risk_level: 'suspicious',
    summary: 'The screenshot shows an urgent bank account suspension SMS.',
    heuristic_score: 80,
    image_observations: {
      transcribed_text:
        'URGENT: Your account has been suspended. Verify at https://secure-login.xyz',
      visual_elements: ['SMS notification bubble', 'Timestamp 14:22', 'Send button'],
      visible_urls: ['https://secure-login.xyz'],
      image_quality_note: 'Clear, high contrast mobile capture',
    },
    indicators: [
      {
        category: 'urgency',
        evidence: 'URGENT: Your account has been suspended',
        explanation: 'Creates false panic.',
        severity: 'high',
        uncertainty: '',
        evidence_source: 'transcribed_text',
      },
      {
        category: 'other',
        evidence: 'SMS notification bubble format without official branding header',
        explanation: 'Visual inconsistency.',
        severity: 'low',
        uncertainty: 'User client app may alter styling',
        evidence_source: 'visual_element',
      },
    ],
    positive_or_neutral_signals: ['No executable attachment shown'],
    recommended_actions: ['Do not follow link', 'Check bank app directly'],
    limitations: ['Image OCR cannot verify remote server certificate'],
  };

  const acceptRes = ImageAnalysisOutputSchema.safeParse(validImageOutput);
  assert.equal(acceptRes.success, true);
  assert.equal(acceptRes.data.image_observations.visible_urls.length, 1);
  assert.equal(acceptRes.data.indicators[1].evidence_source, 'visual_element');

  // Missing image_observations
  const missingObservations = { ...validImageOutput };
  delete missingObservations.image_observations;
  const rejectMissing = ImageAnalysisOutputSchema.safeParse(missingObservations);
  assert.equal(rejectMissing.success, false);

  // Invalid evidence_source
  const invalidSource = {
    ...validImageOutput,
    indicators: [
      {
        ...validImageOutput.indicators[0],
        evidence_source: 'telepathic_transmission',
      },
    ],
  };
  const rejectSource = ImageAnalysisOutputSchema.safeParse(invalidSource);
  assert.equal(rejectSource.success, false);
});

test('5. Form metadata validation (AnalyzeImageRequestSchema)', () => {
  const valid = AnalyzeImageRequestSchema.safeParse({
    message_type: 'sms',
    context_note: 'Received on personal iPhone at 2pm',
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data.message_type, 'sms');
  assert.equal(valid.data.context_note, 'Received on personal iPhone at 2pm');

  // Too long context_note (> 500 chars)
  const tooLong = AnalyzeImageRequestSchema.safeParse({
    message_type: 'email',
    context_note: 'x'.repeat(501),
  });
  assert.equal(tooLong.success, false);
});

test('6. Evidence matching for image transcripts and visual elements', () => {
  const transcribedText =
    'URGENT: Your First National Bank account is locked. Visit https://portal.net/verify immediately.';

  const indicators = [
    {
      category: 'urgency',
      evidence: 'First National Bank account is locked',
      explanation: 'Urgent account suspension.',
      severity: 'high',
      uncertainty: '',
      evidence_source: 'transcribed_text',
    },
    {
      category: 'impersonation',
      evidence: 'Faux bank shield watermark logo',
      explanation: 'Visual logo imitation.',
      severity: 'medium',
      uncertainty: '',
      evidence_source: 'visual_element',
    },
    {
      category: 'credential_request',
      evidence: 'enter your secret pin code now',
      explanation: 'Hallucinated phrase not in transcript.',
      severity: 'high',
      uncertainty: '',
      evidence_source: 'transcribed_text',
    },
  ];

  const { verifiedIndicators, unverifiedCount } = verifyImageEvidence(
    indicators,
    transcribedText
  );

  assert.equal(verifiedIndicators.length, 3);

  // Indicator 1: Transcribed text found in transcript with offsets
  assert.equal(verifiedIndicators[0].unverified, false);
  assert.equal(verifiedIndicators[0].evidence_match.found, true);
  assert.equal(verifiedIndicators[0].evidence_match.source, 'transcribed_text');
  assert.equal(typeof verifiedIndicators[0].evidence_match.start, 'number');
  assert.equal(typeof verifiedIndicators[0].evidence_match.end, 'number');
  assert.equal(
    transcribedText.slice(
      verifiedIndicators[0].evidence_match.start,
      verifiedIndicators[0].evidence_match.end
    ),
    'First National Bank account is locked'
  );

  // Indicator 2: Visual element -> reason: 'visual', not unverified
  assert.equal(verifiedIndicators[1].unverified, false);
  assert.equal(verifiedIndicators[1].evidence_match.found, false);
  assert.equal(verifiedIndicators[1].evidence_match.reason, 'visual');
  assert.equal(verifiedIndicators[1].evidence_match.source, 'visual_element');

  // Indicator 3: Transcribed text quote NOT in transcript -> unverified: true
  assert.equal(verifiedIndicators[2].unverified, true);
  assert.equal(verifiedIndicators[2].evidence_match.found, false);
  assert.equal(verifiedIndicators[2].evidence_match.source, 'transcribed_text');

  // Unverified count: only Indicator 3 is unverified (Indicator 2 is visual)
  assert.equal(unverifiedCount, 1);

  // Edge case: Missing or empty transcribed_text
  const emptyTranscriptRes = verifyImageEvidence(indicators, '');
  assert.equal(emptyTranscriptRes.verifiedIndicators[0].unverified, true);
  assert.equal(emptyTranscriptRes.verifiedIndicators[1].unverified, false); // visual remains valid
  assert.equal(emptyTranscriptRes.verifiedIndicators[2].unverified, true);
  assert.equal(emptyTranscriptRes.unverifiedCount, 2);
});
