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

export const IndicatorSchema = z.object({
  category: IndicatorCategoryEnum,
  evidence: z.string().min(1).max(1000),
  explanation: z.string().min(1).max(1000),
  severity: IndicatorSeverityEnum,
  uncertainty: z.string().max(1000).default(''),
});

export const RiskLevelEnum = z.enum([
  'low_concern',
  'suspicious',
  'high_concern',
  'inconclusive',
]);

export const AnalysisOutputSchema = z.object({
  risk_level: RiskLevelEnum,
  summary: z.string().min(1).max(2000),
  heuristic_score: z.number().int().min(0).max(100),
  indicators: z.array(IndicatorSchema).max(25).default([]),
  positive_or_neutral_signals: z.array(z.string().max(500)).max(25).default([]),
  recommended_actions: z.array(z.string().max(500)).max(25).default([]),
  limitations: z.array(z.string().max(500)).max(25).default([]),
});

export const MessageTypeEnum = z.enum(['sms', 'email', 'other']);

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
});
