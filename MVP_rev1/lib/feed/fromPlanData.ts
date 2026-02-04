/**
 * Build UserFinancialState and TriggerSignals from onboarding/plan data.
 * Used when Feed scenario is "My data" so Leaps and Clarity use real user data where possible.
 */

import { getPaychecksPerMonth } from '@/lib/onboarding/usePlanData';
import type { FinalPlanData } from '@/lib/onboarding/plan';
import type { UserFinancialState, TriggerSignals } from './leapTypes';
import type { OnboardingState } from '@/lib/onboarding/types';

export const LIVE_SCENARIO_ID = 'live';

/**
 * Builds UserFinancialState from FinalPlanData + onboarding store.
 * Uses real data where available; fills gaps with safe defaults for simulation scenarios.
 */
export function buildUserFinancialStateFromPlan(
  planData: FinalPlanData | null,
  store: Pick<
    OnboardingState,
    'income' | 'assets' | 'debts' | 'payrollContributions' | 'plaidConnected' | 'safetyStrategy'
  >
): UserFinancialState {
  if (!planData || !Array.isArray(planData.paycheckCategories)) {
    return getDefaultLiveState();
  }

  const income = store.income;
  const payFrequency = income?.payFrequency ?? 'biweekly';
  const paychecksPerMonth = getPaychecksPerMonth(payFrequency);
  const paycheckAmount = typeof planData.paycheckAmount === 'number' ? planData.paycheckAmount : 0;
  const takeHomePayMonthly = paycheckAmount * paychecksPerMonth;

  const needsCategories = planData.paycheckCategories.filter(
    (c) => c.key === 'essentials' || c.key === 'debt_minimums'
  );
  const wantsCategories = planData.paycheckCategories.filter((c) => c.key === 'fun_flexible');
  const savingsCategories = planData.paycheckCategories.filter(
    (c) =>
      c.key === 'emergency' ||
      c.key === 'long_term_investing' ||
      c.key === 'debt_extra'
  );
  const pct = (c: { percent?: number }) => (typeof c.percent === 'number' ? c.percent : 0);
  const needsPercent = needsCategories.reduce((s, c) => s + pct(c), 0);
  const wantsPercent = wantsCategories.reduce((s, c) => s + pct(c), 0);
  const savingsPercent = savingsCategories.reduce((s, c) => s + pct(c), 0);

  const cashBalance =
    store.assets?.filter((a) => a.type === 'cash').reduce((s, a) => s + a.value$, 0) ??
    planData.emergencyFund?.current ??
    0;
  const monthlyBasics =
    takeHomePayMonthly > 0
      ? (needsPercent / 100) * takeHomePayMonthly
      : 2000;
  const safetyBufferTarget = Math.max(1000, monthlyBasics * 0.5);

  const ef = planData.emergencyFund;
  const emergencyFundTargetMonths = ef?.monthsTarget ?? 6;
  const emergencyFundCurrent$ = ef?.current ?? 0;
  const emergencyFundTarget$ = ef?.target ?? monthlyBasics * emergencyFundTargetMonths;
  const emergencyFundMonths =
    emergencyFundTarget$ > 0 && monthlyBasics > 0
      ? Math.min(emergencyFundTargetMonths, (emergencyFundCurrent$ / monthlyBasics))
      : 0;

  const debts = store.debts ?? [];
  const planDebts = planData.debts ?? [];
  const highAprFromStore = debts.filter((d) => (d as { aprPct?: number }).aprPct != null && (d as { aprPct: number }).aprPct > 10);
  const highAprFromPlan = planDebts.filter((d) => d.apr != null && d.apr > 10);
  const hasHighAprDebt = highAprFromStore.length > 0 || highAprFromPlan.length > 0;
  const highAprDebtApr =
    (highAprFromStore[0] as { aprPct?: number } | undefined)?.aprPct ??
    highAprFromPlan[0]?.apr ??
    undefined;

  const payroll = store.payrollContributions;
  const employerMatchEligible = payroll?.hasEmployerMatch === 'yes';
  const match401kCategory = planData.paycheckCategories
    .flatMap((c) => c.subCategories ?? [])
    .find((s) => s.key === '401k_match');
  const match401kAmount = match401kCategory?.amount ?? 0;
  const employerMatchMet = employerMatchEligible && match401kAmount > 0.01;

  let employerMatchGapMonthly: number | undefined;
  if (employerMatchEligible && !employerMatchMet && income) {
    const grossPerPaycheck = income.grossIncome$ ?? income.netIncome$ ?? 0;
    const grossMonthly = grossPerPaycheck * paychecksPerMonth;
    const capPct = payroll?.employerMatchCapPct ?? 6;
    const matchPct = payroll?.employerMatchPct ?? 50;
    const maxMatchMonthly = grossMonthly * (capPct / 100) * (matchPct / 100);
    const currentMatchMonthly = match401kAmount * paychecksPerMonth;
    const gap = Math.max(0, maxMatchMonthly - currentMatchMonthly);
    if (gap > 0) employerMatchGapMonthly = Math.round(gap);
  }

  const hsaEligible = payroll?.hsaEligible === true;
  const hsaCategory = planData.paycheckCategories
    .flatMap((c) => c.subCategories ?? [])
    .find((s) => s.key === 'hsa');
  const hsaContributing = hsaEligible && (hsaCategory?.amount ?? 0) > 0.01;

  // EF monthly from applied plan (emergency category per paycheck * paychecks per month)
  const emergencyCategory = planData.paycheckCategories.find((c) => c.key === 'emergency');
  const appliedPlanEfMonthly =
    (emergencyCategory?.amount ?? 0) * paychecksPerMonth;

  return {
    takeHomePayMonthly,
    paycheckDetected: store.plaidConnected === true,
    needsPercent,
    wantsPercent,
    savingsPercent,
    cashBalance,
    safetyBufferTarget,
    emergencyFundMonths,
    emergencyFundTargetMonths,
    hasHighAprDebt,
    highAprDebtApr: highAprDebtApr ?? undefined,
    employerMatchEligible,
    employerMatchMet,
    hsaEligible,
    hsaContributing,
    unimplementedLeaps: [],
    employerMatchGapMonthly,
    appliedPlanEfMonthly: appliedPlanEfMonthly > 0 ? Math.round(appliedPlanEfMonthly) : undefined,
  };
}

/**
 * Builds TriggerSignals from plan/store. Some signals (e.g. lastPaycheckISO) are not in plan data.
 */
export function buildTriggerSignalsFromPlan(
  planData: FinalPlanData | null,
  store: Pick<OnboardingState, 'income' | 'assets' | 'plaidConnected'>
): TriggerSignals {
  const nowISO = new Date().toISOString();
  if (!planData) {
    return { nowISO, cashRisk: false, surplusCash: false };
  }

  const income = store.income;
  const paychecksPerMonth = getPaychecksPerMonth(income?.payFrequency ?? 'biweekly');
  const paycheckAmount = typeof planData.paycheckAmount === 'number' ? planData.paycheckAmount : 0;
  const takeHomePayMonthly = paycheckAmount * paychecksPerMonth;
  const monthlyBasics = takeHomePayMonthly * 0.5;
  const cashBalance =
    store.assets?.filter((a) => a.type === 'cash').reduce((s, a) => s + a.value$, 0) ??
    planData.emergencyFund?.current ??
    0;
  const safetyBufferTarget = Math.max(1000, monthlyBasics * 0.5);

  const cashRisk = cashBalance < safetyBufferTarget;
  const surplusCash = cashBalance > safetyBufferTarget * 1.2;

  return {
    nowISO,
    lastPaycheckISO: undefined,
    cashRisk,
    surplusCash,
  };
}

function getDefaultLiveState(): UserFinancialState {
  return {
    takeHomePayMonthly: 0,
    paycheckDetected: false,
    needsPercent: 0,
    wantsPercent: 0,
    savingsPercent: 0,
    cashBalance: 0,
    safetyBufferTarget: 2000,
    emergencyFundMonths: 0,
    emergencyFundTargetMonths: 6,
    hasHighAprDebt: false,
    employerMatchEligible: false,
    employerMatchMet: false,
    hsaEligible: false,
    hsaContributing: false,
    unimplementedLeaps: [],
  };
}
