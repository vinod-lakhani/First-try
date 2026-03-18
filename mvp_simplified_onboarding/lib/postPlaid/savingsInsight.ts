/**
 * Post-Plaid savings insight logic
 * Calculates recommendations for savings rate adjustment
 */

import { projectNetWorth } from "@/lib/sim/projectNetWorth";

export type SavingsInsightResult = {
  currentSavings: number;
  currentRatePct: number;
  currentNetWorth30Y: number;
  recommendedRatePct: number;
  recommendedSavings: number;
  recommendedNetWorth30Y: number;
  improvementPct: number;
  rateIncreasePct: number;
};

/**
 * Get average monthly savings from last 3 months (mock - in production would come from Plaid)
 */
export function getAvgMonthlySavingsLast3Months(): number {
  // Mock: simulate last 3 months. In production, fetch from transactions.
  return 1180; // e.g. $1,180, $1,250, $1,110 avg
}

/**
 * Compute recommended savings rate increase.
 * - Up to +4% increase
 * - Do not exceed reasonable threshold (e.g. 35%)
 * - Avoid rigid 20% anchoring
 */
export function getRecommendedSavingsRate(
  currentRatePct: number,
  monthlyIncome: number
): { recommendedRatePct: number; rateIncreasePct: number } {
  const MAX_INCREASE_PCT = 4;
  const MAX_SAVINGS_RATE_PCT = 35;
  const MIN_SAVINGS_RATE_PCT = 5;

  // Cap current rate for safety
  const cappedCurrent = Math.max(MIN_SAVINGS_RATE_PCT, Math.min(MAX_SAVINGS_RATE_PCT, currentRatePct));

  // Add up to 4%, but don't exceed max
  let recommendedRatePct = Math.min(cappedCurrent + MAX_INCREASE_PCT, MAX_SAVINGS_RATE_PCT);

  // Avoid anchoring at exactly 20% - nudge slightly if we'd land there
  if (Math.abs(recommendedRatePct - 20) < 1) {
    recommendedRatePct = recommendedRatePct >= 20 ? 21 : 19;
  }

  const rateIncreasePct = Math.round((recommendedRatePct - cappedCurrent) * 10) / 10;
  return { recommendedRatePct, rateIncreasePct };
}

/**
 * Compute full savings insight for post-Plaid flow
 */
export function computeSavingsInsight(
  monthlyIncome: number,
  avgMonthlySavings?: number
): SavingsInsightResult | null {
  const savings = avgMonthlySavings ?? getAvgMonthlySavingsLast3Months();
  const currentRatePct = monthlyIncome > 0 ? (savings / monthlyIncome) * 100 : 0;

  if (monthlyIncome <= 0 || savings <= 0) return null;

  const { recommendedRatePct, rateIncreasePct } = getRecommendedSavingsRate(currentRatePct, monthlyIncome);

  // No meaningful recommendation if already at or above recommended
  if (rateIncreasePct <= 0) return null;

  const recommendedSavings = Math.round(monthlyIncome * (recommendedRatePct / 100));

  const { netWorth: currentNW } = projectNetWorth(savings, 30);
  const { netWorth: recommendedNW } = projectNetWorth(recommendedSavings, 30);

  const currentNetWorth30Y = currentNW[currentNW.length - 1] ?? 0;
  const recommendedNetWorth30Y = recommendedNW[recommendedNW.length - 1] ?? 0;
  const improvementPct =
    currentNetWorth30Y > 0
      ? Math.round(((recommendedNetWorth30Y - currentNetWorth30Y) / currentNetWorth30Y) * 100)
      : 0;

  return {
    currentSavings: Math.round(savings),
    currentRatePct: Math.round(currentRatePct * 10) / 10,
    currentNetWorth30Y,
    recommendedRatePct: Math.round(recommendedRatePct * 10) / 10,
    recommendedSavings,
    recommendedNetWorth30Y,
    improvementPct,
    rateIncreasePct,
  };
}
