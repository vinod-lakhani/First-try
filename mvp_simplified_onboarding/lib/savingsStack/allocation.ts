/**
 * Savings Stack Allocation Logic
 *
 * Priority order per spec:
 * 1. Emergency Fund (~40% until target)
 * 2. 401k match (if exists) — capture full match first
 * 3. HSA (if eligible) — toward max
 * 4. High-APR Debt (~40% of remaining, APR ≥ 10%)
 * 5. Retirement (Roth vs Traditional per ~$190K heuristic)
 * 6. Brokerage
 *
 * Retirement Focus Split (medium/default): ~60% retirement, ~40% brokerage
 */

export type BucketId = "401k" | "hsa" | "ef" | "debt" | "roth" | "brokerage" | "shortterm";

export type AllocationInput = {
  monthlySavings: number;
  annualIncome?: number;
  has401k?: boolean;
  hasHsa?: boolean;
  /** Current 401k contribution (employee + employer) from payroll */
  payroll401k?: number;
  /** Current HSA contribution (employee + employer) from payroll */
  payrollHsa?: number;
  /** Match formula: employer contributes matchPct (e.g. 0.5) per $1 up to matchUpToPct of salary */
  matchPct?: number;
  matchUpToPct?: number;
  /** Monthly interest cost (from debts page) */
  monthlyInterest?: number;
  /** Suggested debt payoff from spec: ~40% of (savings - EF) */
  suggestedDebtPayoff?: number;
  /** Retirement focus: "high" | "medium" | "low" */
  retirementFocus?: "high" | "medium" | "low";
};

/** 2025 limits */
const IRA_CAP_2025 = 7_000;
const IRA_CATCHUP_50 = 1_000;
const HSA_SELF_2025 = 4_300;
const HSA_FAMILY_2025 = 8_550;
const HSA_CATCHUP_55 = 1_000;
const INCOME_THRESHOLD = 190_000;

/** ~40% of post-tax savings for EF until target reached */
const EF_PCT = 0.4;

/** ~40% of remaining (after EF) for high-APR debt */
const DEBT_PCT_OF_REMAINING = 0.4;

/** Retirement focus splits: retirement % / brokerage % */
const RETIREMENT_SPLITS = {
  high: { retirement: 0.8, brokerage: 0.2 },
  medium: { retirement: 0.6, brokerage: 0.4 },
  low: { retirement: 0.2, brokerage: 0.8 },
} as const;

/**
 * Compute monthly 401k employee contribution needed to capture full match.
 * Example: 50% match up to 6% of salary → employee contributes 6% of gross.
 */
export function getRecommended401kMatchCapture(
  annualIncome: number,
  matchPct: number,
  matchUpToPct: number
): number {
  if (annualIncome <= 0 || matchPct <= 0 || matchUpToPct <= 0) return 0;
  const monthlyGross = annualIncome / 12;
  const matchUpToDecimal = matchUpToPct / 100;
  const employeeContributionToCapture = monthlyGross * matchUpToDecimal;
  return Math.round(employeeContributionToCapture);
}

/**
 * HSA max (2025) — self coverage. For family, use HSA_FAMILY_2025.
 */
export function getHsaMax2025(family = false): number {
  return family ? HSA_FAMILY_2025 : HSA_SELF_2025;
}

/**
 * IRA max (2025) — $7,000 + $1,000 catch-up if 50+
 */
export function getIraMax2025(age50Plus = false): number {
  return age50Plus ? IRA_CAP_2025 + IRA_CATCHUP_50 : IRA_CAP_2025;
}

/**
 * ~$190K heuristic: income < $190K → favor Roth; income >= $190K → favor Traditional
 */
export function favorRothOverTraditional(annualIncome: number): boolean {
  return annualIncome < INCOME_THRESHOLD;
}

export function computeSavingsStackAllocation(input: AllocationInput): Record<BucketId, number> {
  const {
    monthlySavings,
    annualIncome = 120_000,
    has401k = false,
    hasHsa = false,
    payroll401k = 0,
    payrollHsa = 0,
    matchPct = 0,
    matchUpToPct = 0,
    monthlyInterest = 0,
    suggestedDebtPayoff,
    retirementFocus = "medium",
  } = input;

  const split = RETIREMENT_SPLITS[retirementFocus];

  // Step 1: Emergency Fund (~40%)
  const ef = Math.round(monthlySavings * EF_PCT);

  // Remaining post-tax after EF (401k/HSA are pre-tax, not part of monthlySavings when fromPayroll)
  let remaining = monthlySavings - ef;

  // Step 2 & 3: 401k, HSA — from payroll for display; not subtracted from remaining
  const match401k = payroll401k;
  const hsa = payrollHsa;

  // Step 4: High-APR Debt (~40% of remaining)
  const debtAllocation =
    suggestedDebtPayoff ?? (monthlyInterest > 0 ? Math.round(remaining * DEBT_PCT_OF_REMAINING) : 0);
  const debt = Math.min(debtAllocation, Math.max(0, remaining));
  remaining -= debt;

  // Step 5 & 6: Retirement + Brokerage from remaining
  const roth = Math.round(remaining * split.retirement);
  const brokerage = Math.max(0, remaining - roth);

  return {
    "401k": match401k,
    hsa,
    ef,
    debt,
    roth,
    brokerage,
    shortterm: 0,
  };
}

/**
 * Compute suggested debt payoff: ~40% of (monthlySavings - EF)
 */
export function getSuggestedDebtPayoff(monthlySavings: number): number {
  const ef = Math.round(monthlySavings * EF_PCT);
  const remaining = monthlySavings - ef;
  return Math.round(remaining * DEBT_PCT_OF_REMAINING);
}
