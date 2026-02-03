/**
 * Income Plan (4-state) — main content for savings-helper tool.
 * Supports onboarding mode: hide scenario, custom back link, callback on first-time plan confirm.
 */

'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { buildFinalPlanData, buildProposedNetWorthFromBaseline } from '@/lib/onboarding/plan';
import type { OnboardingState } from '@/lib/onboarding/types';
import { buildIncomeAllocationSnapshotFromInputs } from '@/lib/income/incomeAllocationLifecycle';
import type { IncomeAllocationSnapshot, IncomeAllocationState } from '@/lib/income/incomeAllocationLifecycle';
import { buildAdjustPlanMessage } from '@/lib/income/adjustPlanMessage';
import { calculateSavingsBreakdown, calculateDisplaySavingsBreakdown, calculatePreTaxSavings } from '@/lib/utils/savingsCalculations';
import { buildChatCurrentPlanData } from '@/lib/chat/buildChatPlanData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

export type SimulateScenario = 'default' | IncomeAllocationState;

export interface IncomePlanContentProps {
  /** Onboarding: hide scenario selector */
  hideScenario?: boolean;
  /** Onboarding: back button goes to this href instead of router.back() */
  backHref?: string;
  /** Onboarding: called when user confirms first-time plan (before closing modal) */
  onConfirmPlan?: () => void;
  /** Onboarding: when in "go to allocator" modal, called when user clicks Continue instead of opening savings-allocator */
  onContinueToNextStep?: () => void;
}

const SIMULATE_OPTIONS: { value: SimulateScenario; label: string }[] = [
  { value: 'default', label: 'My data' },
  { value: 'FIRST_TIME', label: 'Simulate: First time' },
  { value: 'ON_TRACK', label: 'Simulate: On track' },
  { value: 'OVERSAVED', label: 'Simulate: Oversaved' },
  { value: 'UNDERSAVED', label: 'Simulate: Undersaved' },
];
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { IncomePlanHeroCard } from '@/components/tools/IncomePlanHeroCard';
import { IncomePlanChatCard } from '@/components/tools/IncomePlanChatCard';

function getPaychecksPerMonth(frequency: string): number {
  switch (frequency) {
    case 'weekly': return 4.33;
    case 'biweekly': return 2.17;
    case 'semimonthly': return 2;
    case 'monthly': return 1;
    default: return 2.17;
  }
}

export function IncomePlanContent(props?: IncomePlanContentProps) {
  const { hideScenario = false, backHref, onConfirmPlan, onContinueToNextStep } = props ?? {};
  const isOnboarding = onConfirmPlan != null;
  const router = useRouter();
  const baselineState = useOnboardingStore();
  const baselinePlanData = usePlanData();
  const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
  const monthlyIncome = baselinePlanData?.paycheckAmount ? baselinePlanData.paycheckAmount * paychecksPerMonth : 0;

  const netIncomeMonthly = useMemo(() => {
    const income = baselineState.income;
    if (!income) return monthlyIncome;
    return (income.netIncome$ || income.grossIncome$ || 0) * paychecksPerMonth;
  }, [baselineState.income, paychecksPerMonth, monthlyIncome]);

  // Last 3 months actual spend from expenses (fully settled proxy)
  const last3m_avg = useMemo(() => {
    const incomeAmount = baselineState.income?.netIncome$ || baselineState.income?.grossIncome$ || 0;
    const monthlyIncomeCalc = incomeAmount * paychecksPerMonth;
    if (!monthlyIncomeCalc || monthlyIncomeCalc <= 0) {
      return { needs: 0, wants: 0, totalSpend: 0 };
    }
    let needsTotal = 0;
    let wantsTotal = 0;
    for (const expense of baselineState.fixedExpenses) {
      let monthlyAmount = expense.amount$;
      if (expense.frequency === 'weekly') monthlyAmount = expense.amount$ * 4.33;
      else if (expense.frequency === 'biweekly') monthlyAmount = expense.amount$ * 2.17;
      else if (expense.frequency === 'semimonthly') monthlyAmount = expense.amount$ * 2;
      else if (expense.frequency === 'yearly') monthlyAmount = expense.amount$ / 12;
      if (expense.category === 'needs') needsTotal += monthlyAmount;
      else if (expense.category === 'wants') wantsTotal += monthlyAmount;
      else needsTotal += monthlyAmount;
    }
    if (baselineState.debts?.length) {
      const totalDebtMinPayments$ = baselineState.debts.reduce((sum, d) => sum + d.minPayment$, 0);
      needsTotal += totalDebtMinPayments$ * paychecksPerMonth;
    }
    const totalSpend = needsTotal + wantsTotal;
    return { needs: needsTotal, wants: wantsTotal, totalSpend };
  }, [baselineState.fixedExpenses, baselineState.debts, baselineState.income, paychecksPerMonth]);

  // Last month: use last 3 months as proxy (MVP — no separate last-month feed)
  const lastMonth = useMemo(() => ({
    needs: last3m_avg.needs,
    wants: last3m_avg.wants,
    totalSpend: last3m_avg.totalSpend,
    savings: Math.max(0, netIncomeMonthly - last3m_avg.totalSpend),
  }), [last3m_avg, netIncomeMonthly]);

  // Baseline plan's monthly contribution (exact total used in net worth sim) so proposed = baseline ± amount and delta reflects full undersave
  const baselineMonthlySavings = useMemo(() => {
    // Prefer the simulation total (ef + debt + 401k + match + HSA + retirement + brokerage) so scenario math is exact
    if (baselinePlanData?.monthlySavingsTotal != null && baselinePlanData.monthlySavingsTotal > 0) {
      return baselinePlanData.monthlySavingsTotal;
    }
    if (!baselinePlanData?.paycheckCategories) return null;
    const savingsCategories = baselinePlanData.paycheckCategories.filter(
      (c: { key: string }) => c.key === 'debt_extra' || c.key === 'emergency' || c.key === 'long_term_investing'
    );
    const perPaycheck = savingsCategories.reduce((sum: number, c: { amount: number }) => sum + c.amount, 0);
    return perPaycheck * paychecksPerMonth;
  }, [baselinePlanData, paychecksPerMonth]);

  // Current plan from stored plan data (when user has set a plan)
  const currentPlan = useMemo(() => {
    if (!baselinePlanData?.paycheckCategories || netIncomeMonthly <= 0) return undefined;
    const needsCategories = baselinePlanData.paycheckCategories.filter(
      (c: { key: string }) => c.key === 'essentials' || c.key === 'debt_minimums'
    );
    const wantsCategories = baselinePlanData.paycheckCategories.filter(
      (c: { key: string }) => c.key === 'fun_flexible'
    );
    const monthlyNeeds = needsCategories.reduce((sum: number, c: { amount: number }) => sum + c.amount, 0) * paychecksPerMonth;
    const monthlyWants = wantsCategories.reduce((sum: number, c: { amount: number }) => sum + c.amount, 0) * paychecksPerMonth;
    const plannedSpend = monthlyNeeds + monthlyWants;
    const plannedSavings = Math.max(0, netIncomeMonthly - plannedSpend);
    if (plannedSavings === 0 && plannedSpend >= netIncomeMonthly) return undefined;
    return {
      plannedSavings,
      plannedSpend,
      plannedNeeds: monthlyNeeds,
      plannedWants: monthlyWants,
    };
  }, [baselinePlanData, netIncomeMonthly, paychecksPerMonth]);

  const searchParams = useSearchParams();
  const [simulateScenario, setSimulateScenario] = useState<SimulateScenario>('default');
  const [simulateAmount, setSimulateAmount] = useState(200);
  const appliedFeedParamsRef = useRef(false);

  // When opening from feed (source=feed), apply URL scenario and simulateAmount once so the right mode is selected.
  useEffect(() => {
    if (appliedFeedParamsRef.current || searchParams?.get('source') !== 'feed') return;
    const scenario = searchParams?.get('scenario');
    const valid: SimulateScenario[] = ['default', 'FIRST_TIME', 'ON_TRACK', 'OVERSAVED', 'UNDERSAVED'];
    if (scenario && valid.includes(scenario as SimulateScenario)) {
      setSimulateScenario(scenario as SimulateScenario);
      appliedFeedParamsRef.current = true;
    }
    const amount = searchParams?.get('simulateAmount');
    if (amount != null && amount !== '') {
      const n = Number(amount);
      if (!Number.isNaN(n) && n >= 0) setSimulateAmount(n);
      appliedFeedParamsRef.current = true;
    }
  }, [searchParams]);

  // For simulation: we need a currentPlan when simulating ON_TRACK / OVERSAVED / UNDERSAVED. If user has none, use synthetic from last3m.
  const currentPlanForSimulation = useMemo(() => {
    if (currentPlan) return currentPlan;
    if (simulateScenario === 'default' || simulateScenario === 'FIRST_TIME') return undefined;
    const plannedSavings = Math.max(0, netIncomeMonthly - last3m_avg.totalSpend);
    const plannedSpend = netIncomeMonthly - plannedSavings;
    return {
      plannedSavings,
      plannedSpend,
      plannedNeeds: last3m_avg.needs,
      plannedWants: last3m_avg.wants,
    };
  }, [currentPlan, simulateScenario, netIncomeMonthly, last3m_avg]);

  // Monthly needs/wants from plan (for complete savings breakdown)
  const monthlyNeedsFromPlan = useMemo(() => {
    if (!baselinePlanData?.paycheckCategories) return 0;
    const needsCategories = baselinePlanData.paycheckCategories.filter(
      (c: { key: string }) => c.key === 'essentials' || c.key === 'debt_minimums'
    );
    return needsCategories.reduce((sum: number, c: { amount: number }) => sum + c.amount, 0) * paychecksPerMonth;
  }, [baselinePlanData, paychecksPerMonth]);
  const monthlyWantsFromPlan = useMemo(() => {
    if (!baselinePlanData?.paycheckCategories) return 0;
    const wantsCategories = baselinePlanData.paycheckCategories.filter(
      (c: { key: string }) => c.key === 'fun_flexible'
    );
    return wantsCategories.reduce((sum: number, c: { amount: number }) => sum + c.amount, 0) * paychecksPerMonth;
  }, [baselinePlanData, paychecksPerMonth]);

  // Complete savings breakdown (payroll 401k/HSA, match, post-tax allocation) for chat "what is my current savings"
  const completeSavingsBreakdown = useMemo(() => {
    if (!baselineState.income || !baselinePlanData?.paycheckCategories) return null;
    const breakdown = calculateSavingsBreakdown(
      baselineState.income,
      baselineState.payrollContributions ?? undefined,
      monthlyNeedsFromPlan,
      monthlyWantsFromPlan
    );
    const preTax = calculatePreTaxSavings(baselineState.income, baselineState.payrollContributions ?? undefined);
    const emergencyCategory = baselinePlanData.paycheckCategories.find((c: { key: string }) => c.key === 'emergency');
    const debtExtraCategory = baselinePlanData.paycheckCategories.find((c: { key: string }) => c.key === 'debt_extra');
    const longTermCategory = baselinePlanData.paycheckCategories.find(
      (c: { key: string }) => c.key === 'long_term_investing'
    ) as { subCategories?: Array<{ key: string; amount: number }> } | undefined;
    let retirementTaxAdv$ = 0;
    let brokerage$ = 0;
    let planEmployee401kMonthly = 0;
    if (longTermCategory?.subCategories) {
      const r = longTermCategory.subCategories.find((s: { key: string }) => s.key === 'retirement_tax_advantaged');
      const b = longTermCategory.subCategories.find((s: { key: string }) => s.key === 'brokerage');
      const matchSub = longTermCategory.subCategories.find((s: { key: string }) => s.key === '401k_match');
      retirementTaxAdv$ = (r?.amount ?? 0) * paychecksPerMonth;
      brokerage$ = (b?.amount ?? 0) * paychecksPerMonth;
      planEmployee401kMonthly = (matchSub?.amount ?? 0) * paychecksPerMonth;
    }
    const ef$ = (emergencyCategory?.amount ?? 0) * paychecksPerMonth;
    const debt$ = (debtExtraCategory?.amount ?? 0) * paychecksPerMonth;
    // Employer match: use payroll-derived when available. When 0 (e.g. payroll not configured), derive from plan's employee 401k: match = employee × (match rate). 50% up to 6% → match = employee × 0.5.
    const matchRatePct = baselineState.payrollContributions?.employerMatchPct ?? 50;
    const employerMatchMonthly =
      breakdown.employerMatchMTD > 0
        ? breakdown.employerMatchMTD
        : planEmployee401kMonthly > 0
          ? Math.round((planEmployee401kMonthly * matchRatePct) / 100)
          : 0;
    return {
      payroll401kMonthly: preTax.traditional401k.monthly,
      hsaMonthly: preTax.hsa.monthly,
      employerMatchMonthly,
      employerHSAMonthly: breakdown.employerHSAMTD,
      postTaxCashMonthly: breakdown.cashSavingsMTD,
      allocation: {
        emergencyFund: ef$,
        debtPayoff: debt$,
        retirementTaxAdv: retirementTaxAdv$,
        brokerage: brokerage$,
      },
      totalSavingsMonthly: breakdown.totalSavingsMTD,
    };
  }, [baselineState.income, baselineState.payrollContributions, baselinePlanData, monthlyNeedsFromPlan, monthlyWantsFromPlan, paychecksPerMonth]);

  // Display savings breakdown (plan-based overrides) — matches Income tab, FinancialSidekick, savings-allocator
  const displaySavingsBreakdown = useMemo(
    () =>
      calculateDisplaySavingsBreakdown(
        baselineState.income ?? undefined,
        baselineState.payrollContributions ?? undefined,
        monthlyNeedsFromPlan,
        monthlyWantsFromPlan,
        baselinePlanData?.paycheckCategories ?? null
      ),
    [
      baselineState.income,
      baselineState.payrollContributions,
      monthlyNeedsFromPlan,
      monthlyWantsFromPlan,
      baselinePlanData?.paycheckCategories,
    ]
  );

  // Current plan data for chat — consistent across all chat windows
  const currentPlanDataForChat = useMemo(
    () =>
      buildChatCurrentPlanData(baselinePlanData ?? null, {
        paychecksPerMonth,
        savingsBreakdown: displaySavingsBreakdown,
      }),
    [baselinePlanData, paychecksPerMonth, displaySavingsBreakdown]
  );

  // Onboarding: force no current plan so we always show FIRST_TIME (set your first plan).
  const effectiveCurrentPlan = useMemo(() => {
    if (onConfirmPlan) return undefined;
    if (simulateScenario === 'FIRST_TIME') return undefined;
    return currentPlanForSimulation;
  }, [onConfirmPlan, simulateScenario, currentPlanForSimulation]);

  const effectiveLastMonth = useMemo(() => {
    if (simulateScenario === 'default' || !effectiveCurrentPlan) return lastMonth;
    const ratio = last3m_avg.totalSpend > 0
      ? { needs: last3m_avg.needs / last3m_avg.totalSpend, wants: last3m_avg.wants / last3m_avg.totalSpend }
      : { needs: 0.5, wants: 0.5 };
    if (simulateScenario === 'ON_TRACK') {
      const savings = effectiveCurrentPlan.plannedSavings;
      const totalSpend = netIncomeMonthly - savings;
      return {
        needs: totalSpend * ratio.needs,
        wants: totalSpend * ratio.wants,
        totalSpend,
        savings,
      };
    }
    if (simulateScenario === 'OVERSAVED') {
      const amount = Math.max(0, simulateAmount);
      const savings = Math.min(netIncomeMonthly, effectiveCurrentPlan.plannedSavings + amount);
      const totalSpend = netIncomeMonthly - savings;
      return {
        needs: totalSpend * ratio.needs,
        wants: totalSpend * ratio.wants,
        totalSpend,
        savings,
      };
    }
    if (simulateScenario === 'UNDERSAVED') {
      const amount = Math.max(0, simulateAmount);
      const savings = Math.max(0, effectiveCurrentPlan.plannedSavings - amount);
      const totalSpend = netIncomeMonthly - savings;
      return {
        needs: totalSpend * ratio.needs,
        wants: totalSpend * ratio.wants,
        totalSpend,
        savings,
      };
    }
    return lastMonth;
  }, [simulateScenario, simulateAmount, effectiveCurrentPlan, lastMonth, last3m_avg, netIncomeMonthly]);

  const snapshot = useMemo(() => buildIncomeAllocationSnapshotFromInputs({
    netIncomeMonthly,
    last3m_avg,
    lastMonth: effectiveLastMonth,
    currentPlan: effectiveCurrentPlan,
    netWorthCurrent: baselinePlanData ?? null,
    netWorthProposed: null,
    employerMatchMonthly: completeSavingsBreakdown?.employerMatchMonthly ?? 0,
  }), [netIncomeMonthly, last3m_avg, effectiveLastMonth, effectiveCurrentPlan, baselinePlanData, completeSavingsBreakdown?.employerMatchMonthly]);

  // Net worth based on current saving (last 3 months actuals) — always shown as second line
  const currentSavingPlanData = useMemo(() => {
    if (!baselineState || !baselinePlanData || netIncomeMonthly <= 0) return null;
    const savingsPct = Math.max(0, Math.min(1, (netIncomeMonthly - last3m_avg.totalSpend) / netIncomeMonthly));
    const needsPct = last3m_avg.totalSpend > 0 ? last3m_avg.needs / netIncomeMonthly : 0.5 * (1 - savingsPct);
    const wantsPct = last3m_avg.totalSpend > 0 ? last3m_avg.wants / netIncomeMonthly : 0.5 * (1 - savingsPct);
    const actualsSum = needsPct + wantsPct + savingsPct;
    const pct =
      actualsSum > 0.001 && Math.abs(actualsSum - 1) > 0.001
        ? { needsPct: needsPct / actualsSum, wantsPct: wantsPct / actualsSum, savingsPct: savingsPct / actualsSum }
        : { needsPct, wantsPct, savingsPct };
    const state: OnboardingState = {
      ...baselineState,
      riskConstraints: baselineState.riskConstraints
        ? { ...baselineState.riskConstraints, targets: pct, actuals3m: pct, bypassWantsFloor: true }
        : { shiftLimitPct: 0.04, targets: pct, actuals3m: pct, bypassWantsFloor: true },
      initialPaycheckPlan: undefined,
    };
    try {
      return buildFinalPlanData(state);
    } catch {
      return null;
    }
  }, [baselineState, baselinePlanData, netIncomeMonthly, last3m_avg]);

  // 20-year net worth index (240 months = 20 years; simulation is 0-based, so index 239)
  const MONTHS_20Y = 240;

  /** When the user or AI proposes a specific amount in chat, show that in Explore options and update chart (must be declared before proposedPlanData useMemo). */
  const [proposedPlannedSavingsFromChat, setProposedPlannedSavingsFromChat] = useState<number | null>(null);

  // Proposed plan net worth: when user proposed an amount in chat, or UNDERSAVED/OVERSAVED, run sim with that monthly savings so chart and projection update.
  const proposedPlanData = useMemo(() => {
    if (!baselineState || !baselinePlanData || netIncomeMonthly <= 0) return null;

    // When user proposed a specific savings amount in chat, show proposed plan (chart + projection) for that amount.
    if (proposedPlannedSavingsFromChat != null) {
      const proposedSavings = Math.max(0, Math.min(netIncomeMonthly, proposedPlannedSavingsFromChat));
      const savingsPct = proposedSavings / netIncomeMonthly;
      const spendPct = 1 - savingsPct;
      const needsPct = spendPct * 0.5;
      const wantsPct = spendPct * 0.5;
      const pct = { needsPct, wantsPct, savingsPct };
      const state: OnboardingState = {
        ...baselineState,
        riskConstraints: baselineState.riskConstraints
          ? { ...baselineState.riskConstraints, targets: pct, actuals3m: pct, bypassWantsFloor: true }
          : { shiftLimitPct: 0.04, targets: pct, actuals3m: pct, bypassWantsFloor: true },
        initialPaycheckPlan: undefined,
        safetyStrategy: baselineState.safetyStrategy
          ? { ...baselineState.safetyStrategy, customSavingsAllocation: undefined }
          : undefined,
      };
      try {
        return buildFinalPlanData(state, {
          forSimulationComparison: true,
          overrideMonthlySavingsBudget: proposedSavings,
        });
      } catch {
        return null;
      }
    }

    const amount = Math.max(0, simulateAmount);

    // Prefer "baseline minus $X/month" sim when UNDERSAVED and baseline exposes scenario input — exact delta every month
    if (simulateScenario === 'UNDERSAVED' && baselinePlanData.netWorthScenarioInput) {
      const proposed = buildProposedNetWorthFromBaseline(baselinePlanData, -amount);
      if (proposed) {
        return {
          ...baselinePlanData,
          netWorthProjection: proposed.netWorthProjection,
          netWorthChartData: proposed.netWorthChartData,
        };
      }
    }

    // Fallback: build proposed via engine (override budget)
    let proposedSavings: number;
    if (simulateScenario === 'OVERSAVED') {
      const base = baselineMonthlySavings ?? effectiveCurrentPlan?.plannedSavings;
      if (base == null) return null;
      proposedSavings = Math.min(netIncomeMonthly, base + amount);
    } else if (simulateScenario === 'UNDERSAVED') {
      const base = baselineMonthlySavings ?? effectiveCurrentPlan?.plannedSavings;
      if (base == null) return null;
      proposedSavings = Math.max(0, base - amount);
    } else if ((snapshot.state === 'OVERSAVED' || snapshot.state === 'UNDERSAVED') && snapshot.plan.currentPlan) {
      const rec = snapshot.plan.recommendedPlan;
      if (Math.abs(rec.plannedSavings - snapshot.plan.currentPlan.plannedSavings) < 1) return null;
      proposedSavings = rec.plannedSavings;
    } else {
      return null;
    }
    const savingsPct = proposedSavings / netIncomeMonthly;
    const spendPct = 1 - savingsPct;
    const needsPct = spendPct * 0.5;
    const wantsPct = spendPct * 0.5;
    const pct = { needsPct, wantsPct, savingsPct };
    const state: OnboardingState = {
      ...baselineState,
      riskConstraints: baselineState.riskConstraints
        ? { ...baselineState.riskConstraints, targets: pct, actuals3m: pct, bypassWantsFloor: true }
        : { shiftLimitPct: 0.04, targets: pct, actuals3m: pct, bypassWantsFloor: true },
      initialPaycheckPlan: undefined,
      safetyStrategy: baselineState.safetyStrategy
        ? { ...baselineState.safetyStrategy, customSavingsAllocation: undefined }
        : undefined,
    };
    try {
      return buildFinalPlanData(state, {
        forSimulationComparison: true,
        overrideMonthlySavingsBudget: proposedSavings,
      });
    } catch {
      return null;
    }
  }, [simulateScenario, simulateAmount, baselineMonthlySavings, effectiveCurrentPlan, snapshot.state, snapshot.plan.recommendedPlan, snapshot.plan.currentPlan, baselineState, baselinePlanData, netIncomeMonthly, proposedPlannedSavingsFromChat]);

  // Baseline net worth at 20 years (for chat: "reduce your net worth by $X in 20 years")
  const baselineNetWorthAt20Y = useMemo(() => {
    const nw = baselinePlanData?.netWorthChartData?.netWorth;
    if (!nw?.length) return undefined;
    const idx = Math.min(MONTHS_20Y - 1, nw.length - 1); // 20 years = 240 months, 0-based index 239
    return Math.round((nw[idx] ?? 0) * 100) / 100;
  }, [baselinePlanData]);

  /** Compute projected net worth at 20 years if user saved exactly this much per month (for chat impact wording) */
  const getProposedNetWorthAt20Y = useMemo(() => {
    if (!baselineState || !baselinePlanData || netIncomeMonthly <= 0) return undefined;
    return (monthlySavings: number) => {
      const proposedSavings = Math.max(0, Math.min(netIncomeMonthly, monthlySavings));
      const savingsPct = proposedSavings / netIncomeMonthly;
      const spendPct = 1 - savingsPct;
      const needsPct = spendPct * 0.5;
      const wantsPct = spendPct * 0.5;
      const pct = { needsPct, wantsPct, savingsPct };
      const state: OnboardingState = {
        ...baselineState,
        riskConstraints: baselineState.riskConstraints
          ? { ...baselineState.riskConstraints, targets: pct, actuals3m: pct, bypassWantsFloor: true }
          : { shiftLimitPct: 0.04, targets: pct, actuals3m: pct, bypassWantsFloor: true },
        initialPaycheckPlan: undefined,
        safetyStrategy: baselineState.safetyStrategy
          ? { ...baselineState.safetyStrategy, customSavingsAllocation: undefined }
          : undefined,
      };
      try {
        const plan = buildFinalPlanData(state, {
          forSimulationComparison: true,
          overrideMonthlySavingsBudget: proposedSavings,
        });
        const nw = plan?.netWorthChartData?.netWorth;
        if (!nw?.length) return null;
        const idx = Math.min(MONTHS_20Y - 1, nw.length - 1);
        return Math.round((nw[idx] ?? 0) * 100) / 100;
      } catch {
        return null;
      }
    };
  }, [baselineState, baselinePlanData, netIncomeMonthly]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'first_time' | 'oversaved' | 'undersaved' | 'on_track' | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Chat-led "Adjust plan" flow
  const [uiMode, setUiMode] = useState<'DEFAULT' | 'ADJUST_REVIEW'>('DEFAULT');
  const [pendingAction, setPendingAction] = useState<'APPLY_RECOMMENDED' | null>(null);
  const [chatFocusRequested, setChatFocusRequested] = useState(false);
  const [lastInjectedMessageKey, setLastInjectedMessageKey] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  /** After user confirms Apply in modal: show "go to Savings Allocator" step inside same modal */
  const [confirmModalStep, setConfirmModalStep] = useState<'confirm' | 'go_to_allocator'>('confirm');

  const nextMonthLabel = snapshot.period.nextMonth_label ?? 'next month';

  const adjustPlanMessage = useMemo(() => {
    if (uiMode !== 'ADJUST_REVIEW') return null;
    return buildAdjustPlanMessage(snapshot, proposedPlannedSavingsFromChat ?? undefined);
  }, [uiMode, snapshot, proposedPlannedSavingsFromChat]);

  const handlePrimaryCta = () => {
    if (snapshot.state === 'FIRST_TIME') {
      setConfirmMode('first_time');
      setConfirmModalStep('confirm');
      setShowConfirmModal(true);
    } else if (snapshot.state === 'ON_TRACK') {
      setToastMessage('Keeping your plan.');
      setTimeout(() => setToastMessage(null), 2000);
    } else if (snapshot.state === 'OVERSAVED' || snapshot.state === 'UNDERSAVED') {
      // Chat-led flow: do NOT open modal; focus chat and show deterministic message
      setUiMode('ADJUST_REVIEW');
      setChatFocusRequested(true);
    }
  };

  const handleSecondaryCta = () => {
    if (snapshot.state === 'ON_TRACK' || snapshot.state === 'FIRST_TIME') {
      setUiMode('ADJUST_REVIEW');
      setChatFocusRequested(true);
      return;
    }
    setToastMessage('Keeping your plan.');
    setTimeout(() => setToastMessage(null), 2000);
  };

  const onApplyFromChat = () => {
    setConfirmModalStep('confirm');
    setPendingAction('APPLY_RECOMMENDED');
    const rec = snapshot.plan.recommendedPlan;
    const current = snapshot.plan.currentPlan?.plannedSavings ?? 0;
    const amountToApply = proposedPlannedSavingsFromChat ?? rec.plannedSavings;
    const hasProposedChange = proposedPlannedSavingsFromChat != null || Math.abs(rec.plannedSavings - current) > 1;
    const isOnTrackWithChange = snapshot.state === 'ON_TRACK' && hasProposedChange;
    setConfirmMode(
      snapshot.state === 'OVERSAVED' ? 'oversaved'
      : snapshot.state === 'UNDERSAVED' ? 'undersaved'
      : snapshot.state === 'FIRST_TIME' ? 'first_time'
      : isOnTrackWithChange ? (amountToApply >= current ? 'oversaved' : 'undersaved')
      : snapshot.state === 'ON_TRACK' ? 'on_track'
      : null
    );
    setShowConfirmModal(true);
  };

  const onAskQuestionFromChat = () => {
    setChatFocusRequested(true);
  };

  const onKeepPlanFromChat = () => {
    setUiMode('DEFAULT');
    setLastInjectedMessageKey(null);
    setProposedPlannedSavingsFromChat(null);
    baselineState.setProposedSavingsFromHelper?.(null);
    setToastMessage('Keeping your plan.');
    setTimeout(() => setToastMessage(null), 2000);
  };

  const onProposalFromChat = (plannedSavings: number) => {
    setProposedPlannedSavingsFromChat(plannedSavings);
    setUiMode('ADJUST_REVIEW');
    setChatFocusRequested(true);
  };

  /** When user types a savings amount in chat: update local state and store so savings-allocator can show it as Proposed Plan, and show Apply/Ask/Keep in chat. */
  const onUserProposedAmount = (amount: number) => {
    setProposedPlannedSavingsFromChat(amount);
    baselineState.setProposedSavingsFromHelper?.(amount);
    setUiMode('ADJUST_REVIEW');
    setChatFocusRequested(true);
  };

  const persistPlan = (plannedSavings: number, plannedSpend: number) => {
    if (netIncomeMonthly <= 0) return;
    const savingsPct = plannedSavings / netIncomeMonthly;
    const spendPct = 1 - savingsPct;
    const needsPct = spendPct * 0.5;
    const wantsPct = spendPct * 0.5;
    const targets = { needsPct, wantsPct, savingsPct };
    // Single atomic update so Income, Monthly Pulse, etc. always see latest user state
    if (typeof baselineState.applyIncomePlanFromSavingsHelper === 'function') {
      baselineState.applyIncomePlanFromSavingsHelper(targets);
    } else {
      if (baselineState.riskConstraints) {
        baselineState.updateRiskConstraints({ targets, actuals3m: targets, bypassWantsFloor: true });
      } else {
        baselineState.setRiskConstraints({ targets, actuals3m: targets, shiftLimitPct: 0.04, bypassWantsFloor: true });
      }
      baselineState.setInitialPaycheckPlan(undefined);
      if (typeof baselineState.invalidatePlan === 'function') {
        baselineState.invalidatePlan();
      }
    }
  };

  const handleConfirm = () => {
    const rec = snapshot.plan.recommendedPlan;
    if (confirmMode === 'on_track') {
      closeConfirmModal();
      setUiMode('DEFAULT');
      setLastInjectedMessageKey(null);
      setProposedPlannedSavingsFromChat(null);
      baselineState.setProposedSavingsFromHelper?.(null);
      setToastMessage('Keeping your plan for next month.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    if (confirmMode === 'first_time' || confirmMode === 'oversaved' || confirmMode === 'undersaved') {
      const amountToApply = proposedPlannedSavingsFromChat ?? rec.plannedSavings;
      baselineState.setProposedSavingsFromHelper?.(amountToApply);
      setPendingAction(null);
      setUiMode('DEFAULT');
      setLastInjectedMessageKey(null);
      setProposedPlannedSavingsFromChat(null);
      if (onContinueToNextStep) {
        // Onboarding: skip "Next: update your savings allocation" modal and go straight to next step
        setShowConfirmModal(false);
        setConfirmMode(null);
        setConfirmModalStep('confirm');
        onContinueToNextStep();
      } else {
        // App (savings-helper): show modal with "Go to Savings Allocator"
        setConfirmModalStep('go_to_allocator');
        setToastMessage('Target saved — accept in Savings Allocator to apply.');
        setTimeout(() => setToastMessage(null), 3000);
      }
    }
  };

  const handleConfirmationMessageShown = () => {
    setConfirmationMessage(null);
  };

  const closeConfirmModal = () => {
    setShowConfirmModal(false);
    setConfirmMode(null);
    setConfirmModalStep('confirm');
  };

  const handleOpenSavingsAllocatorFromModal = () => {
    closeConfirmModal();
    router.push('/app/tools/savings-allocator');
  };

  const handleContinueFromModalOnboarding = () => {
    closeConfirmModal();
    onContinueToNextStep?.();
  };

  useEffect(() => {
    if (chatFocusRequested) {
      const t = setTimeout(() => setChatFocusRequested(false), 500);
      return () => clearTimeout(t);
    }
  }, [chatFocusRequested]);

  if (!baselinePlanData && currentPlan === undefined && snapshot.mode === 'MONTHLY_CHECKIN') {
    return (
      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">Loading income plan...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-xl space-y-6">
          {/* 1. Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Income Plan</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {hideScenario
                  ? 'Set your monthly savings target based on your spending.'
                  : 'Figure out how much you can safely save — then adjust month to month.'}
              </p>
            </div>
            {backHref ? (
              <Link href={backHref} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </Link>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8">
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Scenario (simulate 4 states) — hidden in onboarding */}
          {!hideScenario && (
          <Card className="border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Scenario
              </CardTitle>
            </CardHeader>
            <CardContent>
              <select
                value={simulateScenario}
                onChange={(e) => setSimulateScenario(e.target.value as SimulateScenario)}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
              >
                {SIMULATE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {(simulateScenario === 'OVERSAVED' || simulateScenario === 'UNDERSAVED') && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {simulateScenario === 'OVERSAVED' ? 'How much more than planned did you save?' : 'How much less than planned did you save?'}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">$</span>
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={simulateAmount}
                      onChange={(e) => setSimulateAmount(Math.max(0, Number(e.target.value) || 0))}
                      className="w-24 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
                    />
                    <span className="text-sm text-slate-500 dark:text-slate-400">/ month</span>
                  </div>
                </div>
              )}
              {simulateScenario !== 'default' && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Simulating &quot;{snapshot.state}&quot; — hero, chat, and details use this scenario.
                </p>
              )}
            </CardContent>
          </Card>
          )}

          {/* 2. Hero Card (state-driven) */}
          <IncomePlanHeroCard
            snapshot={snapshot}
            onPrimaryCta={handlePrimaryCta}
            onSecondaryCta={handleSecondaryCta}
          />

          {/* 3. Ribbit Chat */}
          <IncomePlanChatCard
            snapshot={snapshot}
            uiMode={uiMode}
            adjustPlanMessage={adjustPlanMessage}
            chatFocusRequested={chatFocusRequested}
            lastInjectedMessageKey={lastInjectedMessageKey}
            onMessageInjected={setLastInjectedMessageKey}
            onApply={onApplyFromChat}
            onAskQuestion={onAskQuestionFromChat}
            onKeepPlan={onKeepPlanFromChat}
            onProposalFromChat={onProposalFromChat}
            onUserProposedAmount={onUserProposedAmount}
            baselineNetWorthAt20Y={baselineNetWorthAt20Y}
            getProposedNetWorthAt20Y={getProposedNetWorthAt20Y}
            confirmationMessage={confirmationMessage}
            onConfirmationMessageShown={handleConfirmationMessageShown}
            completeSavingsBreakdown={completeSavingsBreakdown}
            currentPlanDataForChat={currentPlanDataForChat}
          />

          {/* 4. Net worth impact — same format as savings-allocator: title, subtitle, boxes above chart */}
          {baselinePlanData && (
            <div className="space-y-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">Net worth impact</h2>
              {/* Subtitle: EF months when available from plan (matches savings-allocator context line) */}
              {baselinePlanData.emergencyFund?.monthsToTarget != null && baselinePlanData.emergencyFund?.monthsTarget != null && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
                  <span>
                    You&apos;re at ~{Math.round(baselinePlanData.emergencyFund.monthsToTarget)} months, target is {baselinePlanData.emergencyFund.monthsTarget}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {(proposedPlanData ?? baselinePlanData).netWorthProjection.map((projection: { label: string; value: number }) => {
                  const compareData = proposedPlanData ? baselinePlanData : currentSavingPlanData;
                  const compareValue = compareData?.netWorthProjection?.find((p: { label: string }) => p.label === projection.label)?.value;
                  const delta =
                    proposedPlanData && projection.label === 'Today'
                      ? 0
                      : (compareValue != null ? projection.value - compareValue : 0);
                  const showDelta = compareValue != null && (proposedPlanData ? true : Math.abs(delta) > 1);
                  const deltaLabel = proposedPlanData ? 'vs Current' : 'vs current saving';
                  return (
                    <div
                      key={projection.label}
                      className="rounded-lg border bg-white p-4 text-center dark:bg-slate-800 dark:border-slate-700"
                    >
                      <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                        {projection.label}
                      </p>
                      <p className={`text-2xl font-bold ${
                        projection.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        ${projection.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                      {showDelta && (
                        <p className={`mt-1 text-xs font-medium ${
                          delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {delta >= 0 ? '+' : ''}${delta.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {deltaLabel}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="overflow-x-auto rounded-lg border bg-white p-4 dark:bg-slate-800 dark:border-slate-700">
                <NetWorthChart
                  key={`income-plan-nw-${simulateScenario}-${simulateAmount}-${proposedPlanData ? 'proposed' : 'planned'}-${(proposedPlanData ?? baselinePlanData).netWorthChartData.netWorth.length}-${(proposedPlanData ?? baselinePlanData).netWorthChartData.netWorth[(proposedPlanData ?? baselinePlanData).netWorthChartData.netWorth.length - 1] ?? 0}`}
                  labels={(proposedPlanData ?? baselinePlanData).netWorthChartData.labels}
                  netWorth={(proposedPlanData ?? baselinePlanData).netWorthChartData.netWorth}
                  assets={(proposedPlanData ?? baselinePlanData).netWorthChartData.assets}
                  liabilities={(proposedPlanData ?? baselinePlanData).netWorthChartData.liabilities}
                  baselineNetWorth={proposedPlanData ? baselinePlanData.netWorthChartData.netWorth : currentSavingPlanData?.netWorthChartData?.netWorth}
                  seriesLabels={proposedPlanData
                    ? { primary: 'Proposed plan', baseline: 'Planned net worth (current)' }
                    : { primary: 'Planned net worth', baseline: 'Based on current saving' }}
                  height={400}
                />
                <p className="mt-2 text-xs text-center text-slate-500 dark:text-slate-400">
                  Projections assume ~9% growth on investments (retirement, brokerage), 4% on cash. Undersaved = less contributed each month, so the gap vs current plan grows over time.
                </p>
              </div>
            </div>
          )}

          {/* 5. Details accordion */}
          <div className="border rounded-lg border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setDetailsOpen((o) => !o)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span>See details</span>
              {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {detailsOpen && (
              <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-4 bg-slate-50/50 dark:bg-slate-900/30 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Past 3 months (actuals)</h3>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between"><span>Needs</span> ${Math.round(snapshot.actuals.last3m_avg.needs).toLocaleString()}/mo</div>
                  <div className="flex justify-between"><span>Wants</span> ${Math.round(snapshot.actuals.last3m_avg.wants).toLocaleString()}/mo</div>
                  <div className="flex justify-between font-medium"><span>Total spend</span> ${Math.round(snapshot.actuals.last3m_avg.totalSpend).toLocaleString()}/mo</div>
                </div>
                {snapshot.actuals.lastMonth && (
                  <>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Last month (actuals)</h3>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between"><span>Needs</span> ${Math.round(snapshot.actuals.lastMonth.needs).toLocaleString()}/mo</div>
                      <div className="flex justify-between"><span>Wants</span> ${Math.round(snapshot.actuals.lastMonth.wants).toLocaleString()}/mo</div>
                      <div className="flex justify-between"><span>Total spend</span> ${Math.round(snapshot.actuals.lastMonth.totalSpend).toLocaleString()}/mo</div>
                      <div className="flex justify-between"><span>Savings</span> ${Math.round(snapshot.actuals.lastMonth.savings).toLocaleString()}/mo</div>
                    </div>
                  </>
                )}
                {snapshot.plan.currentPlan && (
                  <>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Current plan vs recommended</h3>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between"><span>Planned savings (current)</span> ${Math.round(snapshot.plan.currentPlan.plannedSavings).toLocaleString()}/mo</div>
                      <div className="flex justify-between"><span>Planned savings (recommended)</span> ${Math.round(snapshot.plan.recommendedPlan.plannedSavings).toLocaleString()}/mo</div>
                      {snapshot.deltas.recommended_change != null && snapshot.deltas.recommended_change !== 0 && (
                        <div className="flex justify-between font-medium"><span>Change</span> {snapshot.deltas.recommended_change >= 0 ? '+' : ''}${Math.round(snapshot.deltas.recommended_change).toLocaleString()}/mo</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* Confirmation modal (only when user clicks Apply from chat or FIRST_TIME primary CTA) */}
      {showConfirmModal && (confirmMode === 'first_time' || confirmMode === 'oversaved' || confirmMode === 'undersaved' || confirmMode === 'on_track') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                {confirmModalStep === 'go_to_allocator'
                  ? 'Next: update your savings allocation'
                  : confirmMode === 'first_time'
                    ? 'Set your income plan?'
                    : confirmMode === 'on_track'
                      ? 'Keep plan for next month?'
                      : `Confirm plan for ${nextMonthLabel}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {confirmModalStep === 'go_to_allocator' ? (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {isOnboarding
                      ? 'Your new target is saved. Continue to the next step to set up payroll and savings allocation.'
                      : 'Your new target is saved. Go to Savings Allocator to see the breakdown and accept the plan.'}
                  </p>
                  <div className="flex gap-3">
                    {isOnboarding ? (
                      <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleContinueFromModalOnboarding}>
                        Continue
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" className="flex-1" onClick={closeConfirmModal}>
                          Close
                        </Button>
                        <Button className="flex-1 bg-green-600 hover:bg-green-700 gap-1.5" onClick={handleOpenSavingsAllocatorFromModal}>
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open Savings Allocator
                        </Button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {confirmMode === 'first_time'
                      ? `This sets your monthly savings target to $${Math.round((proposedPlannedSavingsFromChat ?? snapshot.plan.recommendedPlan.plannedSavings)).toLocaleString()}.`
                      : confirmMode === 'on_track'
                        ? 'Your current plan stays in place for next month. No changes will be made.'
                        : `Monthly savings target: $${Math.round(snapshot.plan.currentPlan?.plannedSavings ?? 0).toLocaleString()} → $${Math.round((proposedPlannedSavingsFromChat ?? snapshot.plan.recommendedPlan.plannedSavings)).toLocaleString()}`
                    }
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={closeConfirmModal}>
                      Cancel
                    </Button>
                    <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleConfirm}>
                      Confirm
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
