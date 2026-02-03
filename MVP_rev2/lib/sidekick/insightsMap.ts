/**
 * Sidekick "Why this?" — short human blurbs per Sidekick Insight ID.
 * Used in Sidekick recommendation cards and chat context.
 * Keep each blurb to 1–2 sentences max.
 */

import type { SidekickInsightId } from '@/lib/feed/leapTypes';
import { SIDEKICK_INSIGHT_IDS } from '@/lib/feed/leapTypes';

export const SIDEKICK_INSIGHTS_MAP: Record<SidekickInsightId, string> = {
  [SIDEKICK_INSIGHT_IDS.EMPLOYER_MATCH_FREE_MONEY]:
    "Employer match is free money — it's one of the highest ROI moves.",
  [SIDEKICK_INSIGHT_IDS.HSA_TAX_ADVANTAGE]:
    'HSAs can be triple tax-advantaged when used correctly.',
  [SIDEKICK_INSIGHT_IDS.EMERGENCY_FUND_FREEDOM]:
    'An emergency fund reduces stress and prevents expensive debt.',
  [SIDEKICK_INSIGHT_IDS.PAYCHECK_ADAPTATION]:
    'Small paycheck tweaks compound without feeling restrictive.',
  [SIDEKICK_INSIGHT_IDS.NEEDS_VS_WANTS_CLARITY]:
    'Keeping needs stable makes saving feel easier.',
  [SIDEKICK_INSIGHT_IDS.SMALL_MOVES_BIG_IMPACT]:
    'Small recurring moves add up faster than you think.',
  [SIDEKICK_INSIGHT_IDS.SAVINGS_STACK_ORDER]:
    'We prioritize safety and high ROI before long-term investing.',
  [SIDEKICK_INSIGHT_IDS.START_RETIREMENT_EARLY]:
    'Starting retirement savings early gives compound growth more time to work.',
};

/**
 * Returns the short insight blurb for a given Sidekick Insight ID, or null if unknown.
 */
export function getInsightBlurb(insightId: SidekickInsightId | undefined): string | null {
  if (!insightId) return null;
  return SIDEKICK_INSIGHTS_MAP[insightId] ?? null;
}
