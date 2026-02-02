/**
 * Savings tool — ProposedPlan and context types for chat-first flow.
 * Adapter must NOT invent numbers; use only values from savingsResult/userState.
 */

export interface PlanStep {
  id: string;
  type: string;
  label: string;
  amountMonthly?: number;
  note?: string;
}

export interface ProposedPlanTotals {
  postTaxAllocationMonthly?: number;
  preTax401kMonthlyEst?: number;
  hsaMonthlyEst?: number;
}

export interface ProposedPlan {
  steps: PlanStep[];
  totals: ProposedPlanTotals;
  assumptions: string[];
  warnings?: string[];
  keyMetric: { label: string; value: string };
}

export interface SavingsAllocationUserState {
  savingsBudget$: number;
  efTarget$: number;
  efBalance$: number;
  highAprDebts: Array<{ balance$: number; aprPct: number }>;
  matchNeedThisPeriod$: number;
  incomeSingle$: number;
  onIDR?: boolean;
  liquidity?: 'High' | 'Medium' | 'Low';
  retirementFocus?: 'High' | 'Medium' | 'Low';
  iraRoomThisYear$?: number;
  k401RoomThisYear$?: number;
  hsaEligible?: boolean;
  hsaCoverageType?: 'self' | 'family' | 'unknown';
  currentHSAMonthly$?: number;
  hsaRoomThisYear$?: number;
  prioritizeHSA?: boolean;
  /** For toolOutput.explain: employer match rate 0–100 (e.g. 50). */
  employerMatchRatePct?: number;
  /** For toolOutput.explain: employer HSA $/month. */
  employerHsaMonthly$?: number;
  /** For toolOutput.explain: monthly basics for EF currentMonths. */
  monthlyBasicsForEf?: number;
  /** For toolOutput.explain: EF target months (e.g. 3, 6). */
  efTargetMonths?: number;
  /** For toolOutput.explain: gross income monthly (fairness). */
  grossIncomeMonthly?: number;
  /** For toolOutput.explain: current/saved plan (monthly). First-time users: omit or zeros. */
  currentPlan?: {
    match401k$: number;
    preTax401k$?: number;
    hsa$: number;
    ef$: number;
    debt$: number;
    retirementTaxAdv$: number;
    brokerage$: number;
  };
}
