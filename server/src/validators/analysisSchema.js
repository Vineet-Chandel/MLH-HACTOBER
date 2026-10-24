import { z } from 'zod';

export const IndicatorCategoryEnum = z.enum([
  'impersonation',
  'urgency',
  'credential_request',
  'domain_mismatch',
  'payment_request',
  'attachment_or_link',
  'inconsistency',
  'other',
]);

export const IndicatorSeverityEnum = z.enum(['low', 'medium', 'high']);

export const EvidenceSourceEnum = z.enum(['transcribed_text', 'visual_element']);

export const EvidenceMatchSchema = z.object({
  found: z.boolean(),
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().nonnegative().optional(),
  reason: z.string().optional(),
  source: z.string().optional(),
});

export const IndicatorSchema = z.object({
  category: IndicatorCategoryEnum,
  evidence: z.string().min(1).max(1000),
  explanation: z.string().min(1).max(1000),
  severity: IndicatorSeverityEnum,
  uncertainty: z.string().max(1000).default(''),
  evidence_source: EvidenceSourceEnum.optional().default('transcribed_text'),
  evidence_match: EvidenceMatchSchema.optional(),
  unverified: z.boolean().optional(),
});

export const RiskLevelEnum = z.enum([
  'low_concern',
  'suspicious',
  'high_concern',
  'inconclusive',
]);

export const DetectedLanguageEnum = z.enum([
  'en',
  'hi',
  'hinglish',
  'mixed',
  'other',
  'unclear',
]);

export const ScamPatternEnum = z.enum([
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
  'other',
  'none',
  'unclear',
]);

export const OutputLanguageEnum = z.enum(['match', 'en', 'hi']);

export const UserStateEnum = z.enum([
  'none',
  'clicked_link',
  'shared_info',
  'paid_money',
]);

export const AnalysisOutputSchema = z.object({
  risk_level: RiskLevelEnum,
  summary: z.string().min(1).max(2000),
  heuristic_score: z.number().int().min(0).max(100),
  indicators: z.array(IndicatorSchema).max(25).default([]),
  positive_or_neutral_signals: z.array(z.string().max(500)).max(25).default([]),
  recommended_actions: z.array(z.string().max(500)).max(25).default([]),
  limitations: z.array(z.string().max(500)).max(25).default([]),
  detected_language: DetectedLanguageEnum.optional().default('unclear'),
  scam_pattern: ScamPatternEnum.optional().default('none'),
  pattern_rationale: z.string().max(400).optional().default(''),
});

export const ImageObservationsSchema = z.object({
  transcribed_text: z.string().max(6000).default(''),
  visual_elements: z.array(z.string().max(300)).max(15).default([]),
  visible_urls: z.array(z.string().max(2048)).max(10).default([]),
  image_quality_note: z.string().max(1000).default(''),
});

export const ImageAnalysisOutputSchema = AnalysisOutputSchema.extend({
  image_observations: ImageObservationsSchema,
});

export const MessageTypeEnum = z.enum(['sms', 'email', 'call', 'other']);

export const AnalyzeRequestSchema = z.object({
  message: z
    .string({ required_error: 'Message text is required' })
    .transform((val) => val.trim())
    .pipe(
      z
        .string()
        .min(1, 'Message text cannot be empty')
        .max(15000, 'Message text exceeds 15,000 characters limit')
    ),
  message_type: MessageTypeEnum,
  url: z
    .string()
    .max(2048, 'URL cannot exceed 2048 characters')
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : undefined)),
  claimed_org: z
    .string()
    .max(100, 'Claimed organization cannot exceed 100 characters')
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : undefined)),
  output_language: OutputLanguageEnum.optional().default('match'),
  user_state: UserStateEnum.optional().default('none'),
});

export const AnalyzeImageRequestSchema = z.object({
  message_type: MessageTypeEnum.optional().default('other'),
  context_note: z
    .string()
    .max(500, 'Context note cannot exceed 500 characters')
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : undefined)),
  claimed_org: z
    .string()
    .max(100, 'Claimed organization cannot exceed 100 characters')
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : undefined)),
  output_language: OutputLanguageEnum.optional().default('match'),
  user_state: UserStateEnum.optional().default('none'),
});
