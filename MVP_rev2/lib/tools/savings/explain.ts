/**
 * Savings Allocation explainability — toolOutput.explain
 * Built ONLY from engine inputs + allocation + optional payroll/context.
 * No Sidekick math, no UI math. Spec: Pre-Tax vs Post-Tax (Unified, Including HSA).
 */

import type { SavingsAllocation, SavingsInputs } from '@/lib/alloc/savings';

const ENGINE_VERSION = '1.0';
const TAX_YEAR = new Date().getFullYear();
const HIGH_APR_THRESHOLD = 0.10;
const ESTIMATED_MARGINAL_TAX_RATE = 0.25;

export type StepId =
  | 'CAPTURE_MATCH'
  | 'FUND_HSA'
  | 'BUILD_EF'
  | 'PAY_HIGH_APR_DEBT'
  | 'RETIREMENT_VS_BROKERAGE';

export type WhyCode =
  | 'FREE_MONEY_BEST_ROI'
  | 'TRIPLE_TAX_ADVANTAGE'
  | 'STABILITY_BEFORE_GROWTH'
  | 'STOP_THE_BLEEDING_GUARANTEED_RETURN'
  | 'TAX_EFFICIENCY_VS_LIQUIDITY';

export interface SavingsExplainMeta {
  engineVersion: string;
  taxYear: number;
  dataQuality: { payroll: 'estimated' | 'observed'; cashflow: 'estimated' | 'observed' };
}

export interface SavingsExplainInputs {
  savingsBudget$: number;
  efTarget$: number;
  efBalance$: number;
  matchNeedThisPeriod$: number;
  incomeSingle$: number;
  onIDR?: boolean;
  liquidity?: string;
  retirementFocus?: string;
  hsaEligible?: boolean;
  hsaCoverageType?: string;
  hsaRoomThisYear$?: number;
  iraRoomThisYear$?: number;
  k401RoomThisYear$?: number;
  highAprDebtCount: number;
}

export interface SavingsExplainDerived {
  emergencyFund: {
    targetAmount: number;
    gapAmount: number;
    currentMonths?: number;
    targetMonths?: number;
  };
  debt: {
    hasHighAprDebt: boolean;
    highAprThreshold: number;
    totalHighAprBalance: number;
  };
  match: {
    matchCaptured: number;
    matchThresholdContributionMonthly: number;
    matchGapMonthly: number;
    employerMatchMonthlyAtCurrent: number;
    employerMatchMonthlyAtRecommended: number;
    matchRateEffective: number;
  };
  pretaxTradeoffs?: {
    deltaPretaxMonthly: number;
    estimatedTaxSavingsDeltaMonthly: number;
    takeHomeDeltaMonthly: number;
    wealthMoveDeltaMonthly: number;
  };
  capsAndRemainingRoom: {
    hsaAnnualCapEstimated?: number;
    hsaRemainingRoomMonthly: number;
    k401RemainingRoomMonthly?: number;
    iraRemainingRoomMonthly?: number;
  };
  postTaxAvailable: {
    before: number;
    after: number;
    delta: number;
  };
  fairness?: {
    totalSavingsTargetMonthly: number;
    cashSavingsTargetMonthly: number;
  };
}

export interface SavingsExplainDecisionStep {
  step: number;
  id: StepId;
  eligible: boolean;
  triggered: boolean;
  whyCode: WhyCode;
  userFacingWhyNuggetKey?: string;
}

export interface SavingsExplainOutputs {
  preTaxPlan: {
    recommended401kEmployeePct?: number;
    recommended401kEmployeeMonthly: number;
    recommendedHsaMonthly: number;
    employerMatchMonthlyEstimated: number;
    employerHsaMonthlyEstimated: number;
    matchCapturedAfterApply: number;
  };
  changeSummary: {
    pretaxInvestedDeltaMonthly: number;
    employerMatchDeltaMonthly: number;
    estimatedTaxSavingsDeltaMonthly: number;
    takeHomeChangeDeltaMonthly: number;
    totalInvestedDeltaMonthly: number;
    netCashImpactDeltaMonthly: number;
  };
  postTaxAllocation: {
    postTaxSavingsAvailableMonthly: number;
    ef$: number;
    debt$: number;
    retirementTaxAdv$: number;
    brokerage$: number;
    constraints?: { efCapped?: boolean; debtCapped?: boolean };
  };
  impact?: {
    netWorthDeltaToday?: number;
    netWorthDelta6?: number;
    netWorthDelta12?: number;
    netWorthDelta24?: number;
  };
}

export interface SavingsExplainGuardrails {
  hsaClamped: boolean;
  hsaMaxed: boolean;
  matchMaxed?: boolean;
  notes: string[];
}

/** Same categories as currentPlan/proposedPlan for delta rows. */
export type DeltaRowId =
  | 'EMPLOYER_MATCH'
  | '401K_CONTRIB'
  | 'HSA'
  | 'EMERGENCY_FUND'
  | 'HIGH_APR_DEBT'
  | 'RETIREMENT'
  | 'BROKERAGE';

/** Reason codes for delta row explainability. */
export type DeltaReasonCode =
  | 'MATCH_FREE_MONEY'
  | 'HSA_TAX_ADVANTAGE'
  | 'EF_BELOW_TARGET'
  | 'HIGH_APR_DEBT_RETURN'
  | 'REALLOCATE_TO_FOUNDATION'
  | 'MAINTAIN_DEBT_PAYMENT';

/** Facts object: relevant numbers from toolOutput (no UI math). Keys are semantic (e.g. currentMonths, targetMonths, matchGapMonthly). */
export type DeltaRowFacts = Record<string, number | undefined>;

export interface DeltaRowWhy {
  primaryReasonCode: DeltaReasonCode;
  facts: DeltaRowFacts;
  /** Required when deltaMonthly is negative. */
  tradeoff?: string;
  /** One-line "Why" text using only values from facts (user-specific). */
  whyLine: string;
}

export interface DeltaRow {
  id: DeltaRowId;
  label: string;
  current: { monthly?: number; pct?: number };
  proposed: { monthly?: number; pct?: number };
  /** Flat values for UI. */
  currentMonthly: number;
  proposedMonthly: number;
  deltaMonthly: number;
  whyKey: DeltaRowId;
  whyText: string;
  why: DeltaRowWhy;
}

export interface SavingsExplainPlanSnapshot {
  match401k$: number;
  preTax401k$?: number;
  hsa$: number;
  ef$: number;
  debt$: number;
  retirementTaxAdv$: number;
  brokerage$: number;
}

export interface SavingsExplainDelta {
  headline?: string;
  rows: DeltaRow[];
  /** True when current and proposed are the same (no changes). */
  isNoChange?: boolean;
  /** When true (e.g. first_time, no user changes), UI shows only Ribbit Proposal column. */
  singleColumn?: boolean;
}

export interface SavingsAllocationExplain {
  meta: SavingsExplainMeta;
  inputs: SavingsExplainInputs;
  derived: SavingsExplainDerived;
  decisions: SavingsExplainDecisionStep[];
  outputs: SavingsExplainOutputs;
  guardrails: SavingsExplainGuardrails;
  /** Current (saved/baseline) plan — same categories. First-time users: all zeros. */
  currentPlan: SavingsExplainPlanSnapshot;
  /** Proposed (engine) plan. */
  proposedPlan: SavingsExplainPlanSnapshot;
  /** Plan deltas for UI: current vs proposed + why. */
  delta: SavingsExplainDelta;
}

export interface BuildExplainOptions {
  /** Employer match rate 0–100 (e.g. 50 for 50%). Used for employerMatchMonthly*. */
  employerMatchRatePct?: number;
  /** Employer HSA contribution $/month. */
  employerHsaMonthly$?: number;
  /** Monthly basics (needs) for EF currentMonths = efBalance$ / this when > 0. */
  monthlyBasicsForEf?: number;
  /** EF target in months (e.g. 3, 6). */
  efTargetMonths?: number;
  /** Gross income monthly for fairness totals (optional). */
  grossIncomeMonthly?: number;
  /** Current/saved plan (monthly). If missing, current = 0 for first-time users. */
  currentPlan?: SavingsExplainPlanSnapshot;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build toolOutput.explain from engine inputs + allocation only.
 * Optional context (match rate, employer HSA, monthly basics, ef months) for derived fields.
 */
export function buildSavingsExplain(
  inputs: SavingsInputs,
  allocation: SavingsAllocation,
  options: BuildExplainOptions = {}
): SavingsAllocationExplain {
  const {
    savingsBudget$,
    efTarget$,
    efBalance$,
    highAprDebts,
    matchNeedThisPeriod$,
    incomeSingle$,
    onIDR,
    liquidity,
    retirementFocus,
    hsaEligible,
    hsaCoverageType,
    hsaRoomThisYear$ = 0,
    iraRoomThisYear$ = 7000,
    k401RoomThisYear$ = 23000,
  } = inputs;

  const {
    employerMatchRatePct = 50,
    employerHsaMonthly$ = 0,
    monthlyBasicsForEf,
    efTargetMonths = 3,
    grossIncomeMonthly,
    currentPlan: currentPlanInput,
  } = options;

  const currentPlan: SavingsExplainPlanSnapshot = {
    match401k$: currentPlanInput?.match401k$ ?? 0,
    preTax401k$: currentPlanInput?.preTax401k$ ?? 0,
    hsa$: currentPlanInput?.hsa$ ?? 0,
    ef$: currentPlanInput?.ef$ ?? 0,
    debt$: currentPlanInput?.debt$ ?? 0,
    retirementTaxAdv$: currentPlanInput?.retirementTaxAdv$ ?? 0,
    brokerage$: currentPlanInput?.brokerage$ ?? 0,
  };

  const proposedPlan: SavingsExplainPlanSnapshot = {
    match401k$: allocation.match401k$,
    preTax401k$: allocation.match401k$,
    hsa$: allocation.hsa$ ?? 0,
    ef$: allocation.ef$,
    debt$: allocation.highAprDebt$,
    retirementTaxAdv$: allocation.retirementTaxAdv$,
    brokerage$: allocation.brokerage$,
  };

  const totalHighAprBalance = round2(highAprDebts.reduce((s, d) => s + d.balance$, 0));
  const efGap$ = round2(Math.max(0, efTarget$ - efBalance$));
  const matchGapMonthly = round2(Math.max(0, matchNeedThisPeriod$ - allocation.match401k$));
  const matchRateEffective = employerMatchRatePct / 100;
  const employerMatchAtRecommended = round2(matchNeedThisPeriod$ * matchRateEffective);
  const employerMatchAtCurrent = round2(allocation.match401k$ * matchRateEffective);

  const ratePct = Math.round(matchRateEffective * 100);
  // Total proposed savings = employee 401k + employer match + employee HSA + employer HSA + post-tax (EF, debt, retirement, brokerage)
  const proposedEmployerMatch$ = employerMatchAtCurrent;
  const proposedEmployerHsa$ = employerHsaMonthly$;
  const totalProposedMonthly =
    proposedPlan.match401k$ +
    proposedEmployerMatch$ +
    proposedPlan.hsa$ +
    proposedEmployerHsa$ +
    proposedPlan.ef$ +
    proposedPlan.debt$ +
    proposedPlan.retirementTaxAdv$ +
    proposedPlan.brokerage$;

  const currentMonths =
    monthlyBasicsForEf != null && monthlyBasicsForEf > 0
      ? round2(efBalance$ / monthlyBasicsForEf)
      : undefined;

  const hsaRemainingRoomMonthly = hsaRoomThisYear$ > 0 ? round2(hsaRoomThisYear$ / 12) : 0;
  const iraRemainingRoomMonthly = iraRoomThisYear$ > 0 ? round2(iraRoomThisYear$ / 12) : 0;
  const k401RemainingRoomMonthly = k401RoomThisYear$ > 0 ? round2(k401RoomThisYear$ / 12) : 0;

  const hsaMaxed = hsaEligible && hsaRoomThisYear$ <= 0;
  const hsaClamped = hsaEligible && allocation.hsa$ > 0 && hsaRoomThisYear$ > 0;

  const postTaxBefore = savingsBudget$;
  const postTaxAfter = savingsBudget$;
  const postTaxDelta = 0;

  const deltaPretaxMonthly = allocation.match401k$ + allocation.hsa$;
  const estimatedTaxSavingsDeltaMonthly = round2(deltaPretaxMonthly * ESTIMATED_MARGINAL_TAX_RATE);
  const takeHomeDeltaMonthly = round2(-deltaPretaxMonthly + estimatedTaxSavingsDeltaMonthly);
  const wealthMoveDeltaMonthly = round2(deltaPretaxMonthly + employerMatchAtCurrent);

  const pretaxInvestedDelta = deltaPretaxMonthly;
  const employerMatchDelta = employerMatchAtCurrent;
  const totalInvestedDelta = pretaxInvestedDelta + employerMatchDelta;
  const netCashImpactDelta = takeHomeDeltaMonthly;

  const decisions: SavingsExplainDecisionStep[] = [
    {
      step: 1,
      id: 'CAPTURE_MATCH',
      eligible: matchNeedThisPeriod$ > 0,
      triggered: allocation.match401k$ > 0,
      whyCode: 'FREE_MONEY_BEST_ROI',
      userFacingWhyNuggetKey: 'match_free_money',
    },
    {
      step: 2,
      id: 'FUND_HSA',
      eligible: !!hsaEligible && hsaRoomThisYear$ > 0,
      triggered: allocation.hsa$ > 0,
      whyCode: 'TRIPLE_TAX_ADVANTAGE',
      userFacingWhyNuggetKey: 'hsa_triple_tax',
    },
    {
      step: 3,
      id: 'BUILD_EF',
      eligible: efGap$ > 0,
      triggered: allocation.ef$ > 0,
      whyCode: 'STABILITY_BEFORE_GROWTH',
      userFacingWhyNuggetKey: 'ef_stability',
    },
    {
      step: 4,
      id: 'PAY_HIGH_APR_DEBT',
      eligible: totalHighAprBalance > 0,
      triggered: allocation.highAprDebt$ > 0,
      whyCode: 'STOP_THE_BLEEDING_GUARANTEED_RETURN',
      userFacingWhyNuggetKey: 'debt_guaranteed_return',
    },
    {
      step: 5,
      id: 'RETIREMENT_VS_BROKERAGE',
      eligible: true,
      triggered: allocation.retirementTaxAdv$ > 0 || allocation.brokerage$ > 0,
      whyCode: 'TAX_EFFICIENCY_VS_LIQUIDITY',
      userFacingWhyNuggetKey: 'retirement_vs_brokerage',
    },
  ];

  const notes: string[] = [];
  notes.push('Payroll contributions are estimated until payroll is connected.');

  const deltaRows: DeltaRow[] = [];
  const highestApr = highAprDebts.length > 0
    ? Math.max(...highAprDebts.map((d) => d.aprPct))
    : undefined;

  const addRow = (
    id: DeltaRowId,
    label: string,
    cur: number,
    prop: number,
    why: DeltaRowWhy,
    whyText: string
  ) => {
    if (cur === 0 && prop === 0) return;
    const curR = round2(cur);
    const propR = round2(prop);
    const deltaR = round2(propR - curR);
    deltaRows.push({
      id,
      label,
      current: { monthly: curR },
      proposed: { monthly: propR },
      currentMonthly: curR,
      proposedMonthly: propR,
      deltaMonthly: deltaR,
      whyKey: id,
      whyText,
      why,
    });
  };

  // Employer match row: show actual match $ (contribution × match rate), not employee contribution
  const currentEmployerMatch$ = round2((currentPlan.preTax401k$ ?? currentPlan.match401k$) * matchRateEffective);
  if (
    currentEmployerMatch$ !== proposedEmployerMatch$ ||
    proposedEmployerMatch$ > 0 ||
    currentEmployerMatch$ > 0
  ) {
    const reasonCode: DeltaReasonCode = 'MATCH_FREE_MONEY';
    const facts: DeltaRowFacts = { matchGapMonthly: matchGapMonthly > 0 ? matchGapMonthly : undefined, matchRatePct: ratePct };
    const whyLine =
      matchGapMonthly > 0 && currentEmployerMatch$ === 0
        ? `Start contributing to capture employer match — free money at ${ratePct}%. Match gap: ~$${Math.round(matchGapMonthly).toLocaleString()}/mo.`
        : matchGapMonthly > 0
          ? `Capture full employer match — free money at ${ratePct}%. Match gap: ~$${Math.round(matchGapMonthly).toLocaleString()}/mo.`
          : allocation.match401k$ > 0
            ? `You're capturing the full employer match (${ratePct}%).`
            : 'Adjusting 401(k) match.';
    addRow('EMPLOYER_MATCH', '401(k) employer match', currentEmployerMatch$, proposedEmployerMatch$, { primaryReasonCode: reasonCode, facts, whyLine }, whyLine);
  }

  const cur401k = currentPlan.preTax401k$ ?? currentPlan.match401k$;
  if (cur401k !== allocation.match401k$ || allocation.match401k$ > 0 || cur401k > 0) {
    const reasonCode: DeltaReasonCode = 'MATCH_FREE_MONEY';
    const facts: DeltaRowFacts = { matchRatePct: ratePct };
    const whyLine = allocation.match401k$ > 0 ? `Save in your 401(k) to capture match and grow retirement (${ratePct}% match).` : 'Adjusting 401(k) contribution.';
    addRow('401K_CONTRIB', '401(k) employee contribution', cur401k, allocation.match401k$, { primaryReasonCode: reasonCode, facts, whyLine }, whyLine);
  }
  if (currentPlan.hsa$ !== (allocation.hsa$ ?? 0) || (allocation.hsa$ ?? 0) > 0 || currentPlan.hsa$ > 0) {
    const reasonCode: DeltaReasonCode = 'HSA_TAX_ADVANTAGE';
    const facts: DeltaRowFacts = { employerHsaMonthly: employerHsaMonthly$ };
    const whyLine =
      (allocation.hsa$ ?? 0) > 0 && employerHsaMonthly$ > 0
        ? `Tax-advantaged health savings. Employer adds ~$${Math.round(employerHsaMonthly$).toLocaleString()}/mo.`
        : (allocation.hsa$ ?? 0) > 0
          ? 'Tax-advantaged health savings.'
          : 'Adjusting HSA.';
    addRow('HSA', 'HSA', currentPlan.hsa$, allocation.hsa$ ?? 0, { primaryReasonCode: reasonCode, facts, whyLine }, whyLine);
  }
  if (currentPlan.ef$ !== allocation.ef$ || allocation.ef$ > 0 || currentPlan.ef$ > 0) {
    const reasonCode: DeltaReasonCode = 'EF_BELOW_TARGET';
    const facts: DeltaRowFacts = {
      currentMonths: currentMonths,
      targetMonths: efTargetMonths,
      gapDollars: efGap$ > 0 ? efGap$ : undefined,
    };
    const whyLine =
      allocation.ef$ > 0 && currentMonths != null
        ? `You're at ~${Math.round(currentMonths)} months of expenses; target is ${efTargetMonths} months. Building buffer.`
        : allocation.ef$ > 0
          ? `Build a buffer so you're at ${efTargetMonths} months of expenses.`
          : 'Adjusting emergency fund.';
    addRow('EMERGENCY_FUND', 'Emergency fund', currentPlan.ef$, allocation.ef$, { primaryReasonCode: reasonCode, facts, whyLine }, whyLine);
  }
  if (currentPlan.debt$ !== allocation.highAprDebt$ || allocation.highAprDebt$ > 0 || currentPlan.debt$ > 0) {
    const reasonCode: DeltaReasonCode = allocation.highAprDebt$ > 0 && allocation.highAprDebt$ === currentPlan.debt$ ? 'MAINTAIN_DEBT_PAYMENT' : 'HIGH_APR_DEBT_RETURN';
    const facts: DeltaRowFacts = { totalHighAprBalance: totalHighAprBalance > 0 ? totalHighAprBalance : undefined, highestApr };
    const whyLine =
      allocation.highAprDebt$ > 0 && totalHighAprBalance > 0
        ? `Pay down high-interest debt for a guaranteed return${highestApr != null ? ` (highest APR ${Math.round(highestApr)}%)` : ''}.`
        : 'Adjusting debt paydown.';
    addRow('HIGH_APR_DEBT', 'High-APR debt paydown', currentPlan.debt$, allocation.highAprDebt$, { primaryReasonCode: reasonCode, facts, whyLine }, whyLine);
  }
  if (currentPlan.retirementTaxAdv$ !== allocation.retirementTaxAdv$ || allocation.retirementTaxAdv$ > 0 || currentPlan.retirementTaxAdv$ > 0) {
    const deltaRet = round2(allocation.retirementTaxAdv$ - currentPlan.retirementTaxAdv$);
    const reasonCode: DeltaReasonCode = 'REALLOCATE_TO_FOUNDATION';
    const facts: DeltaRowFacts = { currentMonths: currentMonths, targetMonths: efTargetMonths, matchGapMonthly: matchGapMonthly > 0 ? matchGapMonthly : undefined };
    const tradeoff =
      deltaRet < 0
        ? 'Temporarily reduced to fund employer match, emergency fund, and high-APR debt first. Restored once EF target is met and match is captured.'
        : undefined;
    const whyLine =
      deltaRet < 0
        ? 'Roth/retirement is temporarily reduced so we can capture match and build your emergency fund first.'
        : allocation.retirementTaxAdv$ > 0
          ? 'Tax-advantaged retirement (Roth IRA, etc.).'
          : 'Adjusting retirement.';
    addRow(
      'RETIREMENT',
      'Roth IRA / Retirement',
      currentPlan.retirementTaxAdv$,
      allocation.retirementTaxAdv$,
      { primaryReasonCode: reasonCode, facts, tradeoff, whyLine },
      whyLine
    );
  }
  if (currentPlan.brokerage$ !== allocation.brokerage$ || allocation.brokerage$ > 0 || currentPlan.brokerage$ > 0) {
    const deltaBroker = round2(allocation.brokerage$ - currentPlan.brokerage$);
    const reasonCode: DeltaReasonCode = 'REALLOCATE_TO_FOUNDATION';
    const tradeoff =
      deltaBroker < 0
        ? 'Temporarily reduced to fund match, emergency fund, and debt paydown first. Restored once EF target is met and match is captured.'
        : undefined;
    const whyLine =
      deltaBroker < 0
        ? 'Investment account is temporarily reduced to prioritize match, emergency fund, and high-APR debt.'
        : allocation.brokerage$ > 0
          ? 'Invest in a taxable brokerage for flexibility.'
          : 'Adjusting brokerage.';
    const facts: DeltaRowFacts = { currentMonths: currentMonths, targetMonths: efTargetMonths, matchGapMonthly: matchGapMonthly > 0 ? matchGapMonthly : undefined };
    addRow(
      'BROKERAGE',
      'Investment account',
      currentPlan.brokerage$,
      allocation.brokerage$,
      { primaryReasonCode: reasonCode, facts, tradeoff, whyLine },
      whyLine
    );
  }

  const freeMatchUnlocked$ = matchGapMonthly > 0 ? round2(matchGapMonthly * matchRateEffective) : 0;
  const isNoChange = deltaRows.length > 0 && deltaRows.every((r) => Math.abs(r.deltaMonthly) < 0.01);
  const deltaHeadline = isNoChange
    ? 'Your savings plan is on track'
    : matchGapMonthly > 0
      ? `Unlock ~$${Math.round(freeMatchUnlocked$).toLocaleString()}/mo in free employer match and boost total savings to ~$${Math.round(totalProposedMonthly).toLocaleString()}/mo.`
      : totalProposedMonthly > 0
        ? `Boost total savings to ~$${Math.round(totalProposedMonthly).toLocaleString()}/mo.`
        : undefined;

  const delta: SavingsExplainDelta = {
    headline: deltaHeadline,
    rows: deltaRows,
    isNoChange,
  };

  return {
    meta: {
      engineVersion: ENGINE_VERSION,
      taxYear: TAX_YEAR,
      dataQuality: { payroll: 'estimated', cashflow: 'observed' },
    },
    inputs: {
      savingsBudget$,
      efTarget$,
      efBalance$,
      matchNeedThisPeriod$,
      incomeSingle$,
      onIDR,
      liquidity,
      retirementFocus,
      hsaEligible,
      hsaCoverageType,
      hsaRoomThisYear$,
      iraRoomThisYear$,
      k401RoomThisYear$,
      highAprDebtCount: highAprDebts.length,
    },
    derived: {
      emergencyFund: {
        targetAmount: efTarget$,
        gapAmount: efGap$,
        currentMonths,
        targetMonths: efTargetMonths,
      },
      debt: {
        hasHighAprDebt: totalHighAprBalance > 0,
        highAprThreshold: HIGH_APR_THRESHOLD,
        totalHighAprBalance,
      },
      match: {
        matchCaptured: allocation.match401k$,
        matchThresholdContributionMonthly: matchNeedThisPeriod$,
        matchGapMonthly,
        employerMatchMonthlyAtCurrent: employerMatchAtCurrent,
        employerMatchMonthlyAtRecommended: employerMatchAtRecommended,
        matchRateEffective,
      },
      capsAndRemainingRoom: {
        hsaRemainingRoomMonthly,
        k401RemainingRoomMonthly,
        iraRemainingRoomMonthly,
      },
      postTaxAvailable: {
        before: postTaxBefore,
        after: postTaxAfter,
        delta: postTaxDelta,
      },
      pretaxTradeoffs: {
        deltaPretaxMonthly,
        estimatedTaxSavingsDeltaMonthly,
        takeHomeDeltaMonthly,
        wealthMoveDeltaMonthly,
      },
      ...(grossIncomeMonthly != null &&
        grossIncomeMonthly > 0 && {
          fairness: {
            totalSavingsTargetMonthly: round2(grossIncomeMonthly * 0.2),
            cashSavingsTargetMonthly: round2(grossIncomeMonthly * 0.15),
          },
        }),
    },
    decisions,
    outputs: {
      preTaxPlan: {
        recommended401kEmployeeMonthly: allocation.match401k$,
        recommendedHsaMonthly: allocation.hsa$,
        employerMatchMonthlyEstimated: employerMatchAtCurrent,
        employerHsaMonthlyEstimated: employerHsaMonthly$,
        matchCapturedAfterApply: allocation.match401k$,
      },
      changeSummary: {
        pretaxInvestedDeltaMonthly: pretaxInvestedDelta,
        employerMatchDeltaMonthly: employerMatchDelta,
        estimatedTaxSavingsDeltaMonthly,
        takeHomeChangeDeltaMonthly: takeHomeDeltaMonthly,
        totalInvestedDeltaMonthly: totalInvestedDelta,
        netCashImpactDeltaMonthly: netCashImpactDelta,
      },
      postTaxAllocation: {
        postTaxSavingsAvailableMonthly: savingsBudget$,
        ef$: allocation.ef$,
        debt$: allocation.highAprDebt$,
        retirementTaxAdv$: allocation.retirementTaxAdv$,
        brokerage$: allocation.brokerage$,
      },
    },
    guardrails: {
      hsaClamped: hsaClamped ?? false,
      hsaMaxed: hsaMaxed ?? false,
      matchMaxed: matchGapMonthly <= 0 && allocation.match401k$ > 0,
      notes,
    },
    currentPlan,
    proposedPlan,
    delta,
  };
}
