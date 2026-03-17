/**
 * Estimate monthly take-home pay from annual gross income.
 * Uses a simple assumption: ~70% take-home after federal, state, and FICA.
 * This is a rough estimate for onboarding; actual take-home varies by
 * filing status, state, deductions, etc.
 */
export function estimateMonthlyTakeHome(annualGross: number): number {
  if (annualGross <= 0 || !Number.isFinite(annualGross)) return 0;
  const takeHomeRate = 0.7; // ~70% after taxes and deductions
  return Math.round((annualGross * takeHomeRate) / 12);
}
