import inRegionData from '../data/regions/in.json' with { type: 'json' };
import indiaPatternsData from '../data/india-scam-patterns.json' with { type: 'json' };
import actionGuidanceData from '../data/user-action-guidance.json' with { type: 'json' };

const rawPatterns = Array.isArray(indiaPatternsData)
  ? indiaPatternsData
  : indiaPatternsData.patterns || [];

/**
 * Builds static, unalterable guidance for reporting and immediate response.
 * Completely decoupled from AI model outputs and untrusted submission text.
 *
 * @param {Object} params
 * @param {string} [params.scam_pattern] - Pattern ID from analysis schema ('kyc_update', etc.)
 * @param {string} [params.output_language] - 'match', 'en', or 'hi'
 * @param {string} [params.detected_language] - 'en', 'hi', 'hinglish', etc.
 * @param {string} [params.user_state] - 'none', 'clicked_link', 'shared_info', or 'paid_money'
 * @param {string} [params.region] - Region code, defaults to 'IN'
 * @returns {Object} Static guidance payload.
 */
export function buildStaticGuidance({
  scam_pattern = 'none',
  output_language = 'match',
  detected_language = 'unclear',
  user_state = 'none',
  region = 'IN',
} = {}) {
  // Determine effective display language: 'hi' if explicitly requested or if matching a Hindi message
  const isHindi =
    output_language === 'hi' ||
    (output_language === 'match' && detected_language === 'hi');
  const langKey = isHindi ? 'hi' : 'en';

  // 1. Resolve localized reporting resources from in.json
  const resources = (inRegionData.resources || []).map((res) => ({
    id: res.id,
    type: res.type,
    name: isHindi ? res.name_hi || res.name_en : res.name_en,
    use_for: isHindi ? res.use_for_hi || res.use_for_en : res.use_for_en,
    name_en: res.name_en,
    name_hi: res.name_hi || res.name_en,
    use_for_en: res.use_for_en,
    use_for_hi: res.use_for_hi || res.use_for_en,
    url: res.url || undefined,
    number: res.number || undefined,
    needs_verification: Boolean(res.needs_verification),
  }));

  // 2. Resolve static pattern tip (never model text)
  let pattern_tip = null;
  const nonTipPatterns = new Set(['none', 'unclear', 'other', '']);
  if (scam_pattern && !nonTipPatterns.has(scam_pattern)) {
    const matchedPattern = rawPatterns.find((p) => p.id === scam_pattern);
    if (matchedPattern) {
      pattern_tip = {
        id: matchedPattern.id,
        title: isHindi ? matchedPattern.title_hi : matchedPattern.title_en,
        tip: isHindi ? matchedPattern.static_tip_hi : matchedPattern.static_tip_en,
        title_en: matchedPattern.title_en,
        title_hi: matchedPattern.title_hi,
        tip_en: matchedPattern.static_tip_en,
        tip_hi: matchedPattern.static_tip_hi,
        needs_verification: Boolean(matchedPattern.needs_verification),
      };
    }
  }

  // 3. Resolve user_state guidance from user-action-guidance.json
  let user_state_guidance = null;
  const validState = ['clicked_link', 'shared_info', 'paid_money'].includes(user_state)
    ? user_state
    : 'none';

  if (validState !== 'none' && actionGuidanceData.states?.[validState]) {
    const guidanceDef = actionGuidanceData.states[validState];
    user_state_guidance = {
      state: validState,
      level: guidanceDef.level,
      heading: isHindi ? guidanceDef.heading_hi : guidanceDef.heading_en,
      steps: isHindi ? guidanceDef.steps_hi : guidanceDef.steps_en,
      heading_en: guidanceDef.heading_en,
      heading_hi: guidanceDef.heading_hi,
      steps_en: guidanceDef.steps_en,
      steps_hi: guidanceDef.steps_hi,
    };
  }

  return {
    source: 'static_not_ai',
    region: inRegionData.region || 'IN',
    label: inRegionData.label || 'India',
    urgent_advice: inRegionData.urgent_advice_en || '',
    resources,
    pattern_tip,
    user_state: validState,
    user_state_guidance,
  };
}

/**
 * Convenience alias for buildStaticGuidance.
 */
export const getStaticGuidance = (region = 'IN', options = {}) =>
  buildStaticGuidance({ region, ...options });
