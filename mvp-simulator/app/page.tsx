/**
 * MVP Simulator
 *
 * Single-page tool to enter all manual onboarding inputs and run the same
 * engines (income allocation, savings allocation, net worth simulation) to
 * produce outputs for verification against the real app.
 */

'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChevronDown, ChevronRight, Play, Plus, Trash2 } from 'lucide-react';
import type {
  IncomeState,
  FixedExpense,
  Debt,
  Asset,
  AssetType,
  PayFrequency,
  RiskConstraints,
  SafetyStrategy,
  PayrollContributions,
  PulsePreferences,
} from '@/lib/onboarding/types';
import type { OnboardingState, Goal } from '@/lib/onboarding/types';
import { generateInitialPaycheckPlanFromEngines, generateBoostedPlanAndProjection } from '@/lib/onboarding/plan';
import { getPaychecksPerMonth } from '@/lib/onboarding/usePlanData';
import { simulateScenario } from '@/lib/sim/netWorth';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { MVPSimulatorChat } from '@/components/MVPSimulatorChat';

const PAY_FREQUENCIES: { value: PayFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'semimonthly', label: 'Twice a month' },
  { value: 'monthly', label: 'Monthly' },
];

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'investment', label: 'Investment' },
  { value: '401k', label: '401K' },
  { value: 'roth', label: 'Roth' },
];

interface SimulatorResult {
  initialPlan: { needs$: number; wants$: number; savings$: number };
  boostedPlan: {
    needs$: number;
    wants$: number;
    savings$: number;
    savingsBreakdown?: {
      ef$: number;
      debt$: number;
      match401k$: number;
      hsa$: number;
      retirement$: number;
      retirementAcctType?: 'Roth' | 'Traditional401k';
      brokerage$: number;
    };
    notes?: string[];
  };
  netWorth: {
    labels: string[];
    netWorth: number[];
    assets: number[];
    liabilities: number[];
    kpis: { efReachedMonth?: number; debtFreeMonth?: number; netWorthAtYears?: Record<number, number> };
  };
  error?: string;
}

function buildSimulatorState(form: FormState): OnboardingState {
  const paychecksPerYear = form.payFrequency === 'monthly' ? 12 : getPaychecksPerMonth(form.payFrequency) * 12;
  const income: IncomeState = {
    grossIncome$: form.incomeIsGross ? form.incomeAmount : 0,
    netIncome$: form.incomeIsGross ? 0 : form.incomeAmount,
    payFrequency: form.payFrequency,
    annualSalary$: form.incomeAmount * paychecksPerYear,
    incomeSingle$: form.incomeAmount * paychecksPerYear,
  };

  const riskConstraints: RiskConstraints = {
    shiftLimitPct: form.shiftLimitPct,
    targets: {
      needsPct: form.targetNeedsPct / 100,
      wantsPct: form.targetWantsPct / 100,
      savingsPct: form.targetSavingsPct / 100,
    },
    actuals3m: form.useActualsFromExpenses
      ? undefined
      : {
          needsPct: form.actualsNeedsPct / 100,
          wantsPct: form.actualsWantsPct / 100,
          savingsPct: form.actualsSavingsPct / 100,
        },
    assumptions: {
      cashYieldPct: form.cashYieldPct,
      nominalReturnPct: form.nominalReturnPct,
      taxDragBrokeragePct: form.taxDragBrokeragePct,
      inflationRatePct: form.inflationRatePct,
    },
  };

  const pm = getPaychecksPerMonth(form.payFrequency);
  const grossMonthly = form.incomeAmount * pm;
  const hasMatch = form.has401k && form.hasEmployerMatch === 'yes' && form.employerMatchPct != null && form.employerMatchCapPct != null;
  const match401kPerMonth$ = hasMatch
    ? grossMonthly * (form.employerMatchCapPct! / 100)
    : 0;

  const safetyStrategy: SafetyStrategy = {
    efTargetMonths: form.efTargetMonths,
    efBalance$: form.efBalance$,
    liquidity: form.liquidity,
    retirementFocus: form.retirementFocus,
    onIDR: form.onIDR,
    match401kPerMonth$,
    iraRoomThisYear$: form.iraRoomThisYear$,
    k401RoomThisYear$: form.k401RoomThisYear$,
  };

  const payrollContributions: PayrollContributions = {
    ...form.payrollContributions,
    has401k: form.has401k,
    hasEmployerMatch: form.hasEmployerMatch,
    employerMatchPct: form.hasEmployerMatch === 'yes' ? form.employerMatchPct : null,
    employerMatchCapPct: form.hasEmployerMatch === 'yes' ? form.employerMatchCapPct : null,
    hasHSA: form.hasHSA,
    hsaEligible: form.hsaEligible,
    hsaCoverageType: form.hsaCoverageType,
    currentlyContributingHSA: form.currentlyContributingHSA,
    contributionTypeHSA: form.contributionTypeHSA,
    contributionValueHSA: form.contributionValueHSA,
    contributionFrequencyHSA: form.contributionFrequencyHSA,
    employerHSAContribution: form.employerHSAContribution,
    employerHSAAmount$: form.employerHSAAmount$,
  };

  return {
    currentStep: 'plan-final',
    isComplete: false,
    plaidConnected: false,
    income,
    fixedExpenses: form.expenses,
    debts: form.debts,
    assets: form.assets,
    goals: form.goals as Goal[],
    primaryGoal: form.primaryGoal,
    riskConstraints,
    safetyStrategy,
    payrollContributions,
    pulsePreferences: form.pulsePreferences,
  };
}

interface FormState {
  incomeAmount: number;
  incomeIsGross: boolean;
  payFrequency: PayFrequency;
  expenses: FixedExpense[];
  debts: Debt[];
  assets: Asset[];
  goals: Array<{ id: string; type: string; name: string; targetAmount$?: number; priority: number }>;
  primaryGoal: OnboardingState['primaryGoal'];
  targetNeedsPct: number;
  targetWantsPct: number;
  targetSavingsPct: number;
  actualsNeedsPct: number;
  actualsWantsPct: number;
  actualsSavingsPct: number;
  useActualsFromExpenses: boolean;
  shiftLimitPct: number;
  cashYieldPct: number;
  nominalReturnPct: number;
  taxDragBrokeragePct: number;
  inflationRatePct: number;
  efTargetMonths: number;
  efBalance$: number;
  liquidity: SafetyStrategy['liquidity'];
  retirementFocus: SafetyStrategy['retirementFocus'];
  onIDR: boolean;
  /** Has 401k; when true and employer matches, we use Match % and Up to % */
  has401k: boolean;
  /** Currently contributing to 401(k)? */
  contributing401k: 'yes' | 'no';
  /** If contributing, how much per month ($) */
  contributing401kMonthly$: number | null;
  hasEmployerMatch: 'yes' | 'no' | 'not_sure';
  employerMatchPct: number | null;
  employerMatchCapPct: number | null;
  iraRoomThisYear$: number;
  k401RoomThisYear$: number;
  // HSA (feeds payrollContributions)
  hsaEligible: boolean;
  hsaCoverageType: 'self' | 'family' | 'unknown';
  hasHSA: boolean;
  currentlyContributingHSA: 'yes' | 'no';
  contributionTypeHSA: 'percent_gross' | 'amount' | null;
  contributionValueHSA: number | null;
  contributionFrequencyHSA: 'per_paycheck' | 'per_month' | null;
  employerHSAContribution: 'yes' | 'no' | 'not_sure';
  employerHSAAmount$: number | null;
  payrollContributions?: PayrollContributions;
  pulsePreferences: PulsePreferences;
}

const defaultFormState: FormState = {
  incomeAmount: 8000,
  incomeIsGross: false,
  payFrequency: 'monthly',
  expenses: [],
  debts: [],
  assets: [],
  goals: [],
  primaryGoal: undefined,
  targetNeedsPct: 50,
  targetWantsPct: 30,
  targetSavingsPct: 20,
  actualsNeedsPct: 50,
  actualsWantsPct: 30,
  actualsSavingsPct: 20,
  useActualsFromExpenses: true,
  shiftLimitPct: 4,
  cashYieldPct: 4,
  nominalReturnPct: 9,
  taxDragBrokeragePct: 0.5,
  inflationRatePct: 2.5,
  efTargetMonths: 3,
  efBalance$: 0,
  liquidity: 'Medium',
  retirementFocus: 'High',
  onIDR: false,
  has401k: true,
  contributing401k: 'no',
  contributing401kMonthly$: null,
  hasEmployerMatch: 'no',
  employerMatchPct: null,
  employerMatchCapPct: null,
  iraRoomThisYear$: 7000,
  k401RoomThisYear$: 23000,
  hsaEligible: false,
  hsaCoverageType: 'unknown',
  hasHSA: false,
  currentlyContributingHSA: 'no',
  contributionTypeHSA: null,
  contributionValueHSA: null,
  contributionFrequencyHSA: null,
  employerHSAContribution: 'no',
  employerHSAAmount$: null,
  pulsePreferences: { enabled: false, frequency: 'weekly', channels: ['email'] },
};

export default function MVPSimulatorPage() {
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [result, setResult] = useState<SimulatorResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({
    income: true,
    expenses: false,
    debts: false,
    assets: false,
    allocation: true,
    ef: true,
    k401: true,
    hsa: true,
    assumptions: false,
    pulse: false,
  });
  const [chatOpen, setChatOpen] = useState(false);
  const [splitRatio, setSplitRatio] = useState(2 / 3);
  const [resizing, setResizing] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(true);
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const el = splitContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const ratio = Math.max(0.2, Math.min(0.8, y / rect.height));
      setSplitRatio(ratio);
    };
    const onUp = () => setResizing(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing]);

  const runSimulation = () => {
    setIsRunning(true);
    setResult(null);
    try {
      const state = buildSimulatorState(form);
      const initialPlan = generateInitialPaycheckPlanFromEngines(state);
      const { paycheckPlan, netWorthProjection, efReachedMonth, debtFreeMonth } =
        generateBoostedPlanAndProjection(state);

      // Build full net worth series for chart (plan.ts only returns sampled projection)
      const income = state.income!;
      const incomePeriod$ = income.netIncome$ || income.grossIncome$ || 0;
      const paychecksPerMonth = getPaychecksPerMonth(income.payFrequency || 'biweekly');
      const monthlyIncome$ = incomePeriod$ * paychecksPerMonth;
      const monthlyBasics =
        state.fixedExpenses
          .filter((e) => e.category === 'needs')
          .reduce((s, e) => s + e.amount$, 0) || monthlyIncome$ * 0.3;
      const cashFromAssets =
        state.assets.filter((a) => a.type === 'cash').reduce((s, a) => s + a.value$, 0) || 0;
      const efBalance$ = form.efBalance$ ?? 0;
      const openingCash = efBalance$ + cashFromAssets;
      const brokerageFromAssets = state.assets.filter((a) => a.type === 'investment').reduce((s, a) => s + a.value$, 0);
      const retirementFromAssets =
        state.assets.filter((a) => a.type === '401k' || a.type === 'roth').reduce((s, a) => s + a.value$, 0);
      const openingBalances = {
        cash: openingCash,
        brokerage: brokerageFromAssets,
        retirement: retirementFromAssets,
        hsa: undefined,
        otherAssets: 0,
        liabilities: state.debts.map((d) => ({
          name: d.name,
          balance: d.balance$,
          aprPct: d.aprPct,
          minPayment: d.minPayment$,
          extraPayment: (d.isHighApr || d.aprPct > 10) ? paycheckPlan.savingsBreakdown?.debt$ : undefined,
        })),
      };
      const monthlyPlan = {
        monthIndex: 0,
        incomeNet: monthlyIncome$,
        needs$: paycheckPlan.needs$ * paychecksPerMonth,
        wants$: paycheckPlan.wants$ * paychecksPerMonth,
        ef$: (paycheckPlan.savingsBreakdown?.ef$ ?? 0) * paychecksPerMonth,
        highAprDebt$: (paycheckPlan.savingsBreakdown?.debt$ ?? 0) * paychecksPerMonth,
        match401k$: (paycheckPlan.savingsBreakdown?.match401k$ ?? 0) * paychecksPerMonth,
        hsa$: (paycheckPlan.savingsBreakdown?.hsa$ ?? 0) * paychecksPerMonth,
        retirementTaxAdv$: (paycheckPlan.savingsBreakdown?.retirement$ ?? 0) * paychecksPerMonth,
        brokerage$: (paycheckPlan.savingsBreakdown?.brokerage$ ?? 0) * paychecksPerMonth,
      };
      const horizonMonths = 480; // 40 years for chart
      const scenarioInput = {
        startDate: new Date().toISOString().split('T')[0],
        horizonMonths,
        inflationRatePct: form.inflationRatePct,
        nominalReturnPct: form.nominalReturnPct,
        cashYieldPct: form.cashYieldPct,
        taxDragBrokeragePct: form.taxDragBrokeragePct,
        openingBalances,
        monthlyPlan: Array.from({ length: horizonMonths }, (_, i) => ({ ...monthlyPlan, monthIndex: i })),
        goals: form.efTargetMonths > 0 ? { efTarget$: monthlyBasics * form.efTargetMonths } : {},
      };
      const series = simulateScenario(scenarioInput);

      // Prepend opening snapshot so chart shows user's starting assets (e.g. 30K EF) at "Today"
      const openingAssets = openingCash + brokerageFromAssets + retirementFromAssets;
      const openingLiabilities = state.debts.reduce((s, d) => s + d.balance$, 0);
      const openingNetWorth = openingAssets - openingLiabilities;

      setResult({
        initialPlan: {
          needs$: initialPlan.needs$,
          wants$: initialPlan.wants$,
          savings$: initialPlan.savings$,
        },
        boostedPlan: {
          needs$: paycheckPlan.needs$,
          wants$: paycheckPlan.wants$,
          savings$: paycheckPlan.savings$,
          savingsBreakdown: paycheckPlan.savingsBreakdown,
          notes: paycheckPlan.notes,
        },
        netWorth: {
          labels: ['Start', ...series.labels],
          netWorth: [openingNetWorth, ...series.netWorth],
          assets: [openingAssets, ...series.assets],
          liabilities: [openingLiabilities, ...series.liabilities],
          kpis: {
            efReachedMonth: series.kpis.efReachedMonth,
            debtFreeMonth: series.kpis.debtFreeMonth,
            netWorthAtYears: series.kpis.netWorthAtYears,
          },
        },
      });
    } catch (err) {
      setResult({
        initialPlan: { needs$: 0, wants$: 0, savings$: 0 },
        boostedPlan: { needs$: 0, wants$: 0, savings$: 0 },
        netWorth: {
          labels: [],
          netWorth: [],
          assets: [],
          liabilities: [],
          kpis: {},
        },
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsRunning(false);
    }
  };

  const toggleSection = (key: string) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const addExpense = () => {
    setForm((f) => ({
      ...f,
      expenses: [
        ...f.expenses,
        {
          id: `exp-${Date.now()}`,
          name: '',
          amount$: 0,
          frequency: 'monthly' as const,
          category: 'needs',
        },
      ],
    }));
  };
  const updateExpense = (id: string, updates: Partial<FixedExpense>) => {
    setForm((f) => ({
      ...f,
      expenses: f.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
  };
  const removeExpense = (id: string) => {
    setForm((f) => ({ ...f, expenses: f.expenses.filter((e) => e.id !== id) }));
  };

  const addDebt = () => {
    setForm((f) => ({
      ...f,
      debts: [
        ...f.debts,
        {
          id: `debt-${Date.now()}`,
          name: '',
          balance$: 0,
          aprPct: 0,
          minPayment$: 0,
          isHighApr: false,
        },
      ],
    }));
  };
  const updateDebt = (id: string, updates: Partial<Debt>) => {
    setForm((f) => ({
      ...f,
      debts: f.debts.map((d) => (d.id === id ? { ...d, ...updates, isHighApr: (updates.aprPct ?? d.aprPct) > 10 } : d)),
    }));
  };
  const removeDebt = (id: string) => {
    setForm((f) => ({ ...f, debts: f.debts.filter((d) => d.id !== id) }));
  };

  const addAsset = () => {
    setForm((f) => ({
      ...f,
      assets: [
        ...f.assets,
        { id: `asset-${Date.now()}`, name: '', value$: 0, type: 'cash' },
      ],
    }));
  };
  const updateAsset = (id: string, updates: Partial<Asset>) => {
    setForm((f) => ({
      ...f,
      assets: f.assets.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    }));
  };
  const removeAsset = (id: string) => {
    setForm((f) => ({ ...f, assets: f.assets.filter((a) => a.id !== id) }));
  };

  const userPlanDataForChat = useMemo(() => {
    if (!result) return undefined;
    const paychecksPerMonth = getPaychecksPerMonth(form.payFrequency);
    const incomePeriod$ = form.incomeAmount;
    const monthlyIncome = incomePeriod$ * paychecksPerMonth;
    const monthlyNeeds = result.boostedPlan.needs$ * paychecksPerMonth;
    const bd = result.boostedPlan.savingsBreakdown;

    // User debt state (for prompt): high-APR = APR>10% or isHighApr
    const highAprDebts = form.debts
      .filter((d) => d.isHighApr || (d.aprPct ?? 0) > 10)
      .map((d) => ({ name: d.name, balance$: d.balance$, aprPct: d.aprPct }));
    const totalHighAprBalance = highAprDebts.reduce((s, d) => s + d.balance$, 0);
    const debtAllocMo = (bd?.debt$ ?? 0) * paychecksPerMonth;

    // Net worth graph data (index 0 = Start/today; indices 1+ = end of month 0, 1, ...)
    const nw = result.netWorth?.netWorth ?? [];
    const netWorthAtStart = nw[0] ?? 0;
    const netWorthAt1Y = nw[12] ?? netWorthAtStart; // end of month 11
    const kpis = result.netWorth.kpis ?? {};
    const netWorthAt5Y = kpis.netWorthAtYears?.[5] ?? (nw[60] ?? 0);
    const netWorthAt10Y = kpis.netWorthAtYears?.[10] ?? (nw[120] ?? 0);
    const netWorthAt20Y = kpis.netWorthAtYears?.[20] ?? (nw[240] ?? 0);
    const netWorthAt40Y = kpis.netWorthAtYears?.[40] ?? (nw[480] ?? nw[nw.length - 1] ?? 0);

    const cashFromAssets = form.assets.filter((a) => a.type === 'cash').reduce((s, a) => s + a.value$, 0) || 0;
    const efBalanceForNW = form.efBalance$ ?? 0;
    const openingCash = efBalanceForNW + cashFromAssets;
    const brokerageFromAssets = form.assets.filter((a) => a.type === 'investment').reduce((s, a) => s + a.value$, 0);
    const retirementFromAssets = form.assets.filter((a) => a.type === '401k' || a.type === 'roth').reduce((s, a) => s + a.value$, 0);

    // Build calculation steps so the chat can show the exact math
    const incomeSteps: string[] = [
      `Income per period (user input) = $${incomePeriod$.toFixed(2)} at ${form.payFrequency} → ${paychecksPerMonth.toFixed(2)} paychecks/month → monthly income = $${monthlyIncome.toFixed(2)}.`,
      `Targets (user input): Needs ${form.targetNeedsPct}%, Wants ${form.targetWantsPct}%, Savings ${form.targetSavingsPct}%. In dollars: Needs = ${(incomePeriod$ * form.targetNeedsPct / 100).toFixed(2)}, Wants = ${(incomePeriod$ * form.targetWantsPct / 100).toFixed(2)}, Savings = ${(incomePeriod$ * form.targetSavingsPct / 100).toFixed(2)}.`,
      form.useActualsFromExpenses
        ? `Actuals baseline: derived from the user's expense entries (Needs/Wants/Savings split from categorized expenses).`
        : `Actuals baseline (user input): Needs ${form.actualsNeedsPct}%, Wants ${form.actualsWantsPct}%, Savings ${form.actualsSavingsPct}% → Needs = $${(incomePeriod$ * form.actualsNeedsPct / 100).toFixed(2)}, Wants = $${(incomePeriod$ * form.actualsWantsPct / 100).toFixed(2)}, Savings = $${(incomePeriod$ * form.actualsSavingsPct / 100).toFixed(2)}.`,
      `Shift limit (user input): max ${(form.shiftLimitPct > 1 ? form.shiftLimitPct : form.shiftLimitPct * 100).toFixed(0)}% of income per period can move from Wants → Savings. If savings is below target, shift = min(savings gap %, shift limit %) × income.`,
      `Final allocation: Needs $${result.boostedPlan.needs$.toFixed(2)}, Wants $${result.boostedPlan.wants$.toFixed(2)}, Savings $${result.boostedPlan.savings$.toFixed(2)} per period (sum = income).`,
    ];

    const efTarget$ = form.efTargetMonths * monthlyNeeds;
    const efGap$ = Math.max(0, efTarget$ - form.efBalance$);
    const monthlySavingsBudget = result.boostedPlan.savings$ * paychecksPerMonth;
    const efCapMo$ = monthlySavingsBudget * 0.40;
    const efAllocMo = (bd?.ef$ ?? 0) * paychecksPerMonth;
    const debtCapMo$ = (monthlySavingsBudget - efAllocMo) * 0.40;
    const savingsSteps: string[] = [
      `Savings allocation runs in monthly space (same as app). Monthly savings budget = per-period savings × paychecks/month = $${result.boostedPlan.savings$.toFixed(2)} × ${paychecksPerMonth.toFixed(2)} = $${monthlySavingsBudget.toFixed(2)}.`,
      `Priority order: 1) 401(k) match, 2) HSA (if eligible), 3) Emergency fund, 4) High-APR debt, 5) Retirement vs brokerage split. Allocator outputs are monthly; we convert to per-paycheck (÷ paychecks/month) for the plan.`,
      `Emergency fund: EF target = efTargetMonths × monthly needs = ${form.efTargetMonths} × $${monthlyNeeds.toFixed(2)} = $${efTarget$.toFixed(2)}. EF gap = target − current balance = $${efTarget$.toFixed(2)} − $${form.efBalance$.toFixed(2)} = $${efGap$.toFixed(2)}. EF cap = 40% of monthly savings budget = 0.40 × $${monthlySavingsBudget.toFixed(2)} = $${efCapMo$.toFixed(2)}. EF allocation = min(EF gap, EF cap, remaining after match/HSA) → $${efAllocMo.toFixed(2)}/month = $${(bd?.ef$ ?? 0).toFixed(2)} per period.`,
      `High-APR debt (user state): User entered ${form.debts.length} debt(s). High-APR (APR>10% or isHighApr): ${highAprDebts.length ? highAprDebts.map((d) => `${d.name} $${d.balance$.toFixed(0)} @ ${d.aprPct}%`).join('; ') : 'none'}. Total high-APR balance = $${totalHighAprBalance.toFixed(2)}. Cap = 40% of (monthly savings budget − EF allocation) = 0.40 × ($${monthlySavingsBudget.toFixed(2)} − $${efAllocMo.toFixed(2)}) = $${debtCapMo$.toFixed(2)}. Allocation = min(total high-APR balance, cap, remaining) → $${debtAllocMo.toFixed(2)}/month = $${(bd?.debt$ ?? 0).toFixed(2)} per period. When total high-APR balance is $0, allocation is $0.`,
      (() => {
        const hasMatch = form.has401k && form.hasEmployerMatch === 'yes' && form.employerMatchPct != null && form.employerMatchCapPct != null;
        if (!hasMatch) return `401(k) match: employer match = ${form.hasEmployerMatch}; no Match % / Up to % entered. Allocated $${(bd?.match401k$ ?? 0).toFixed(2)}/period ($${(bd?.match401k$ ?? 0) * paychecksPerMonth}/month).`;
        const capPct = form.employerMatchCapPct!;
        const matchPct = form.employerMatchPct!;
        const employeeNeedMo = monthlyIncome * (capPct / 100);
        const employerMatchMo = monthlyIncome * (capPct / 100) * (matchPct / 100);
        return `401(k) match: Match % = ${matchPct}%, Up to % of pay = ${capPct}%. Match need (monthly) = monthly income × (Up to %/100) = $${monthlyIncome.toFixed(0)} × ${capPct}% = $${employeeNeedMo.toFixed(0)}/month. Allocator receives monthly match need; we allocate up to that from monthly budget. Employer match $ = income × (Up to %/100) × (Match %/100) = $${employerMatchMo.toFixed(0)}/month. Stored per period: $${(bd?.match401k$ ?? 0).toFixed(2)}.`;
      })(),
      `HSA (if eligible): after match, allocate to HSA from monthly remaining; baseline $100–200/mo or prioritizeHSA; clamped to annual room. Allocated $${((bd?.hsa$ ?? 0) * paychecksPerMonth).toFixed(2)}/month = $${(bd?.hsa$ ?? 0).toFixed(2)} per period. Employer HSA (user input): $${(form.employerHSAAmount$ ?? 0).toFixed(0)}/month.`,
      `Retirement vs brokerage: split of remaining monthly budget by liquidity (${form.liquidity}) and retirement focus (${form.retirementFocus}). Account type: ${(bd?.retirementAcctType ?? 'Roth') === 'Traditional401k' ? '401(k)' : 'Roth'} (income/IDR rule). IRA first, then 401(k), spill to brokerage. Retirement (tax-adv) = $${(bd?.retirement$ ?? 0).toFixed(2)}/period; Brokerage = $${(bd?.brokerage$ ?? 0).toFixed(2)}/period.`,
      `Display: 401K (Pre-tax) = employee 401(k) contribution only. If "Currently contributing to 401(k)?" Yes and $/month entered, use that; else match need + traditional retirement (when Traditional). When Roth, retirement$ goes to IRA (post-tax); when Traditional, retirement$ to 401(k) beyond match, so include in 401K (Pre-tax). Payroll = 401K (Pre-tax) + Employee HSA only. Employer 401K match and Employer HSA are separate (not in payroll).`,
      `Pre-tax savings = 401(k) match + Employee HSA + (retirement $ if Traditional 401k) = $${(bd ? (bd.match401k$ + (bd.hsa$ ?? 0) + ((bd.retirementAcctType ?? 'Roth') === 'Traditional401k' ? bd.retirement$ : 0)) : 0).toFixed(2)}/period. Post-tax savings = EF + debt + brokerage + (retirement $ if Roth) = $${(bd ? (bd.ef$ + bd.debt$ + bd.brokerage$ + ((bd.retirementAcctType ?? 'Roth') === 'Roth' ? bd.retirement$ : 0)) : 0).toFixed(2)}/period.`,
    ];

    const netWorthSteps: string[] = [
      `Starting point (month 0): Opening cash = EF balance + Cash assets = $${efBalanceForNW.toFixed(0)} + $${cashFromAssets.toFixed(0)} = $${openingCash.toFixed(0)}. Brokerage from Investment assets ($${brokerageFromAssets.toFixed(0)}); retirement from 401K + Roth assets ($${retirementFromAssets.toFixed(0)}). Liabilities from user debts. Net worth at start = assets − liabilities = $${netWorthAtStart.toLocaleString('en-US', { maximumFractionDigits: 0 })}.`,
      `Net worth simulation: 40 years (480 months). Same data feeds the Net Worth graph. Each month: (1) Apply growth: cash × (1 + cashYield/12), brokerage × (1 + (nominalReturn − taxDrag)/12), retirement × (1 + nominalReturn/12), HSA × (1 + nominalReturn/12). User assumptions: cash yield ${form.cashYieldPct}%/yr, nominal return ${form.nominalReturnPct}%/yr, tax drag on brokerage ${form.taxDragBrokeragePct}%/yr.`,
      `(2) Inflows: cash += EF + unallocated; brokerage += brokerage$ from plan; retirement += match$ + retirement$ from plan; HSA += hsa$ from plan (all monthly from allocator).`,
      `(3) Debts: interest = balance × (APR/12); then apply min payment; then apply extra payment (high-APR debt $ from plan) to highest APR first. When a debt is paid off, its min payment is redirected to brokerage.`,
      `(4) Cash outflows: needs + wants + all debt payments. Net worth at month t = assets − liabilities.`,
      `Graph data (use for net worth answers): Start $${netWorthAtStart.toLocaleString('en-US', { maximumFractionDigits: 0 })}; 1Y $${netWorthAt1Y.toLocaleString('en-US', { maximumFractionDigits: 0 })}; 5Y $${netWorthAt5Y.toLocaleString('en-US', { maximumFractionDigits: 0 })}; 10Y $${netWorthAt10Y.toLocaleString('en-US', { maximumFractionDigits: 0 })}; 20Y $${netWorthAt20Y.toLocaleString('en-US', { maximumFractionDigits: 0 })}; 40Y $${netWorthAt40Y.toLocaleString('en-US', { maximumFractionDigits: 0 })}. KPIs: EF target reached month ${kpis.efReachedMonth != null ? kpis.efReachedMonth + 1 : '—'}; debt-free month ${kpis.debtFreeMonth != null ? kpis.debtFreeMonth + 1 : '—'}.`,
    ];

    const userInputSummary: Record<string, string | number> = {
      'Income (per period)': `$${form.incomeAmount.toFixed(2)}`,
      'Pay frequency': form.payFrequency,
      'Target Needs %': form.targetNeedsPct,
      'Target Wants %': form.targetWantsPct,
      'Target Savings %': form.targetSavingsPct,
      'Shift limit %': form.shiftLimitPct > 1 ? form.shiftLimitPct : form.shiftLimitPct * 100,
      'EF target (months of needs)': form.efTargetMonths,
      'EF current balance': `$${form.efBalance$.toFixed(2)}`,
      'Has 401(k)': form.has401k ? 'Yes' : 'No',
      'Currently contributing to 401(k)': form.contributing401k,
      '401(k) contribution per month ($)': form.contributing401k === 'yes' && form.contributing401kMonthly$ != null ? form.contributing401kMonthly$ : '—',
      'Employer match': form.hasEmployerMatch,
      'Match %': form.employerMatchPct ?? '—',
      'Up to % of pay': form.employerMatchCapPct ?? '—',
      'Liquidity': form.liquidity,
      'Retirement focus': form.retirementFocus,
      'Number of expenses': form.expenses.length,
      'Number of debts': form.debts.length,
      'High-APR debts (count)': highAprDebts.length,
      'Total high-APR balance ($)': totalHighAprBalance,
      'Debt allocation /month ($)': debtAllocMo,
      'Number of assets': form.assets.length,
      'HSA eligible': form.hsaEligible ? 'Yes' : 'No',
      'HSA coverage': form.hsaCoverageType,
      'Employer HSA per month': form.employerHSAAmount$ != null ? `$${form.employerHSAAmount$}` : '—',
      'Cash yield %': form.cashYieldPct,
      'Nominal return %': form.nominalReturnPct,
      'Tax drag (brokerage) %': form.taxDragBrokeragePct,
    };
    if (!form.useActualsFromExpenses) {
      userInputSummary['Actuals Needs %'] = form.actualsNeedsPct;
      userInputSummary['Actuals Wants %'] = form.actualsWantsPct;
      userInputSummary['Actuals Savings %'] = form.actualsSavingsPct;
    } else {
      userInputSummary['Actuals'] = 'derived from expenses';
    }

    return {
      context: 'mvp-simulator',
      inputs: {
        income: { amount: form.incomeAmount, frequency: form.payFrequency, isGross: form.incomeIsGross },
        targets: { needsPct: form.targetNeedsPct, wantsPct: form.targetWantsPct, savingsPct: form.targetSavingsPct },
        actuals: form.useActualsFromExpenses
          ? 'derived from expenses'
          : { needsPct: form.actualsNeedsPct, wantsPct: form.actualsWantsPct, savingsPct: form.actualsSavingsPct },
        shiftLimitPct: form.shiftLimitPct,
        expensesCount: form.expenses.length,
        debtsCount: form.debts.length,
        debts: form.debts.map((d) => ({ name: d.name, balance$: d.balance$, aprPct: d.aprPct, minPayment$: d.minPayment$, isHighApr: d.isHighApr || (d.aprPct ?? 0) > 10 })),
        highAprDebts,
        totalHighAprBalance,
        debtAllocationMo: debtAllocMo,
        assetsCount: form.assets.length,
        assets: form.assets.map((a) => ({ name: a.name, value$: a.value$, type: a.type })),
        expenses: form.expenses.map((e) => ({ category: e.category, amount$: e.amount$ })),
        efTargetMonths: form.efTargetMonths,
        efBalance$: form.efBalance$,
        liquidity: form.liquidity,
        retirementFocus: form.retirementFocus,
        has401k: form.has401k,
        contributing401k: form.contributing401k,
        contributing401kMonthly$: form.contributing401kMonthly$,
        hasEmployerMatch: form.hasEmployerMatch,
        employerMatchPct: form.employerMatchPct,
        employerMatchCapPct: form.employerMatchCapPct,
      },
      outputs: {
        paycheckPlanPerPeriod: {
          needs$: result.boostedPlan.needs$,
          wants$: result.boostedPlan.wants$,
          savings$: result.boostedPlan.savings$,
          savingsBreakdown: result.boostedPlan.savingsBreakdown,
          preTaxSavings$: bd
            ? bd.match401k$ + (bd.hsa$ ?? 0) + ((bd.retirementAcctType ?? 'Roth') === 'Traditional401k' ? bd.retirement$ : 0)
            : 0,
          postTaxSavings$: bd
            ? bd.ef$ + bd.debt$ + bd.brokerage$ + ((bd.retirementAcctType ?? 'Roth') === 'Roth' ? bd.retirement$ : 0)
            : 0,
          hsa$: bd?.hsa$ ?? 0,
        },
        monthlyPulse: {
          needs$: result.boostedPlan.needs$ * paychecksPerMonth,
          wants$: result.boostedPlan.wants$ * paychecksPerMonth,
          savings$: result.boostedPlan.savings$ * paychecksPerMonth,
          ef$: (bd?.ef$ ?? 0) * paychecksPerMonth,
          debt$: (bd?.debt$ ?? 0) * paychecksPerMonth,
          match401k$: (bd?.match401k$ ?? 0) * paychecksPerMonth,
          retirement$: (bd?.retirement$ ?? 0) * paychecksPerMonth,
          brokerage$: (bd?.brokerage$ ?? 0) * paychecksPerMonth,
          preTaxSavings$: bd
            ? (bd.match401k$ + (bd.hsa$ ?? 0) + ((bd.retirementAcctType ?? 'Roth') === 'Traditional401k' ? bd.retirement$ : 0)) * paychecksPerMonth
            : 0,
          postTaxSavings$: bd
            ? (bd.ef$ + bd.debt$ + bd.brokerage$ + ((bd.retirementAcctType ?? 'Roth') === 'Roth' ? bd.retirement$ : 0)) * paychecksPerMonth
            : 0,
          hsa$: (bd?.hsa$ ?? 0) * paychecksPerMonth,
          employerHSAMo: form.employerHSAAmount$ ?? 0,
        },
        netWorth: {
          source: 'Same data as the Net Worth graph (40-year simulation).',
          netWorthAtStart,
          netWorthAt1Y,
          netWorthAt5Y,
          netWorthAt10Y,
          netWorthAt20Y,
          netWorthAt40Y,
          efReachedMonth: kpis.efReachedMonth,
          debtFreeMonth: kpis.debtFreeMonth,
          netWorthAtYears: kpis.netWorthAtYears,
        },
        notes: result.boostedPlan.notes,
      },
      monthlyIncome,
      calculationSteps: {
        income: incomeSteps,
        savings: savingsSteps,
        netWorth: netWorthSteps,
      },
      userInputSummary,
    };
  }, [result, form]);

  const mainContent = (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">MVP Simulator</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Enter manual onboarding inputs and run the same engines to verify outputs (savings, allocations, monthly pulse, net worth) against the real app.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: Inputs */}
          <Card>
            <CardHeader>
              <CardTitle>Inputs (manual onboarding flow)</CardTitle>
              <CardDescription>Match the fields from the real onboarding to compare results.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Income */}
              <Section
                title="Income"
                open={sectionsOpen.income}
                onToggle={() => toggleSection('income')}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Amount per period ($)</label>
                    <input
                      type="number"
                      value={form.incomeAmount || ''}
                      onChange={(e) => setForm((f) => ({ ...f, incomeAmount: parseFloat(e.target.value) || 0 }))}
                      min={0}
                      step={1}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Pay frequency</label>
                    <select
                      value={form.payFrequency}
                      onChange={(e) => setForm((f) => ({ ...f, payFrequency: e.target.value as PayFrequency }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    >
                      {PAY_FREQUENCIES.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="incomeIsGross"
                    checked={form.incomeIsGross}
                    onChange={(e) => setForm((f) => ({ ...f, incomeIsGross: e.target.checked }))}
                    className="rounded border-slate-300"
                  />
                  <label htmlFor="incomeIsGross" className="text-sm font-medium text-slate-700 dark:text-slate-300">Amount is gross (pre-tax)</label>
                </div>
              </Section>

              {/* Allocation targets & actuals */}
              <Section
                title="Allocation (targets & actuals)"
                open={sectionsOpen.allocation}
                onToggle={() => toggleSection('allocation')}
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Target Needs %</label>
                    <input
                      type="number"
                      value={form.targetNeedsPct}
                      onChange={(e) => setForm((f) => ({ ...f, targetNeedsPct: parseFloat(e.target.value) || 0 }))}
                      min={0}
                      max={100}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Target Wants %</label>
                    <input
                      type="number"
                      value={form.targetWantsPct}
                      onChange={(e) => setForm((f) => ({ ...f, targetWantsPct: parseFloat(e.target.value) || 0 }))}
                      min={0}
                      max={100}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Target Savings %</label>
                    <input
                      type="number"
                      value={form.targetSavingsPct}
                      onChange={(e) => setForm((f) => ({ ...f, targetSavingsPct: parseFloat(e.target.value) || 0 }))}
                      min={0}
                      max={100}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useActualsFromExpenses"
                    checked={form.useActualsFromExpenses}
                    onChange={(e) => setForm((f) => ({ ...f, useActualsFromExpenses: e.target.checked }))}
                    className="rounded border-slate-300"
                  />
                  <label htmlFor="useActualsFromExpenses" className="text-sm font-medium text-slate-700 dark:text-slate-300">Derive actuals from expenses (otherwise use % below)</label>
                </div>
                {!form.useActualsFromExpenses && (
                  <div className="mt-2 grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Actuals Needs %</label>
                      <input
                        type="number"
                        value={form.actualsNeedsPct}
                        onChange={(e) => setForm((f) => ({ ...f, actualsNeedsPct: parseFloat(e.target.value) || 0 }))}
                        min={0}
                        max={100}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Actuals Wants %</label>
                      <input
                        type="number"
                        value={form.actualsWantsPct}
                        onChange={(e) => setForm((f) => ({ ...f, actualsWantsPct: parseFloat(e.target.value) || 0 }))}
                        min={0}
                        max={100}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Actuals Savings %</label>
                      <input
                        type="number"
                        value={form.actualsSavingsPct}
                        onChange={(e) => setForm((f) => ({ ...f, actualsSavingsPct: parseFloat(e.target.value) || 0 }))}
                        min={0}
                        max={100}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                )}
                <div className="mt-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Shift limit % (max % from Wants → Savings per period)</label>
                  <input
                    type="number"
                    value={form.shiftLimitPct}
                    onChange={(e) => setForm((f) => ({ ...f, shiftLimitPct: parseFloat(e.target.value) || 0 }))}
                    min={0}
                    max={20}
                    step={0.5}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </Section>

              {/* Emergency fund */}
              <Section
                title="Emergency fund"
                open={sectionsOpen.ef}
                onToggle={() => toggleSection('ef')}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">EF target (months)</label>
                    <input
                      type="number"
                      value={form.efTargetMonths}
                      onChange={(e) => setForm((f) => ({ ...f, efTargetMonths: parseFloat(e.target.value) || 0 }))}
                      min={1}
                      max={12}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Current EF balance ($)</label>
                    <input
                      type="number"
                      value={form.efBalance$ || ''}
                      onChange={(e) => setForm((f) => ({ ...f, efBalance$: parseFloat(e.target.value) || 0 }))}
                      min={0}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </Section>

              {/* 401(k) */}
              <Section
                title="401(k)"
                open={sectionsOpen.k401}
                onToggle={() => toggleSection('k401')}
              >
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="has401k"
                    checked={form.has401k}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      has401k: e.target.checked,
                      ...(e.target.checked ? {} : {
                        contributing401k: 'no' as const,
                        contributing401kMonthly$: null,
                        hasEmployerMatch: 'no' as const,
                        employerMatchPct: null,
                        employerMatchCapPct: null,
                      }),
                    }))}
                    className="rounded border-slate-300"
                  />
                  <label htmlFor="has401k" className="text-sm font-medium text-slate-700 dark:text-slate-300">Has 401(k)</label>
                </div>
                {form.has401k && (
                <>
                <div className="mt-2">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Currently contributing to 401(k)?</p>
                  <div className="flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="contributing401k"
                        checked={form.contributing401k === 'yes'}
                        onChange={() => setForm((f) => ({ ...f, contributing401k: 'yes' }))}
                        className="rounded-full border-slate-300"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Yes</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="contributing401k"
                        checked={form.contributing401k === 'no'}
                        onChange={() => setForm((f) => ({ ...f, contributing401k: 'no', contributing401kMonthly$: null }))}
                        className="rounded-full border-slate-300"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">No</span>
                    </label>
                  </div>
                  {form.contributing401k === 'yes' && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">How much per month ($)</label>
                      <input
                        type="number"
                        min={0}
                        value={form.contributing401kMonthly$ ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, contributing401kMonthly$: e.target.value ? parseFloat(e.target.value) : null }))}
                        placeholder="e.g. 500"
                        className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Employer match?</p>
                  <div className="flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="hasEmployerMatch"
                        checked={form.hasEmployerMatch === 'yes'}
                        onChange={() => setForm((f) => ({ ...f, hasEmployerMatch: 'yes' }))}
                        className="rounded-full border-slate-300"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Yes</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="hasEmployerMatch"
                        checked={form.hasEmployerMatch === 'no'}
                        onChange={() => setForm((f) => ({ ...f, hasEmployerMatch: 'no', employerMatchPct: null, employerMatchCapPct: null }))}
                        className="rounded-full border-slate-300"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">No</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="hasEmployerMatch"
                        checked={form.hasEmployerMatch === 'not_sure'}
                        onChange={() => setForm((f) => ({ ...f, hasEmployerMatch: 'not_sure', employerMatchPct: null, employerMatchCapPct: null }))}
                        className="rounded-full border-slate-300"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Not sure</span>
                    </label>
                  </div>
                  {form.hasEmployerMatch === 'yes' && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-3">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">How does the match work?</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Match %</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={form.employerMatchPct ?? ''}
                            onChange={(e) => setForm((f) => ({ ...f, employerMatchPct: e.target.value ? parseFloat(e.target.value) : null }))}
                            placeholder="0–100"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Up to % of pay</label>
                          <input
                            type="number"
                            min={0}
                            max={15}
                            value={form.employerMatchCapPct ?? ''}
                            onChange={(e) => setForm((f) => ({ ...f, employerMatchCapPct: e.target.value ? parseFloat(e.target.value) : null }))}
                            placeholder="0–15"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Example: 50% match up to 6%</p>
                    </div>
                  )}
                </div>
                </>
                )}
              </Section>

              {/* HSA */}
              <Section
                title="HSA"
                open={sectionsOpen.hsa}
                onToggle={() => toggleSection('hsa')}
              >
                <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="hsaEligible"
                      checked={form.hsaEligible}
                      onChange={(e) => setForm((f) => ({ ...f, hsaEligible: e.target.checked, hasHSA: e.target.checked ? f.hasHSA : false }))}
                      className="rounded border-slate-300"
                    />
                    <label htmlFor="hsaEligible" className="text-sm text-slate-700 dark:text-slate-300">HSA eligible (HDHP)</label>
                  </div>
                  {form.hsaEligible && (
                    <>
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">HSA coverage</label>
                        <select
                          value={form.hsaCoverageType}
                          onChange={(e) => setForm((f) => ({ ...f, hsaCoverageType: e.target.value as 'self' | 'family' | 'unknown' }))}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="unknown">Unknown</option>
                          <option value="self">Self</option>
                          <option value="family">Family</option>
                        </select>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="hasHSA"
                          checked={form.hasHSA}
                          onChange={(e) => setForm((f) => ({ ...f, hasHSA: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                        <label htmlFor="hasHSA" className="text-sm text-slate-700 dark:text-slate-300">Currently contributing to HSA</label>
                      </div>
                      {form.hasHSA && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">HSA contribution type</label>
                            <select
                              value={form.contributionTypeHSA ?? ''}
                              onChange={(e) => setForm((f) => ({ ...f, contributionTypeHSA: e.target.value ? e.target.value as 'percent_gross' | 'amount' : null }))}
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            >
                              <option value="">—</option>
                              <option value="percent_gross">% of gross</option>
                              <option value="amount">Amount</option>
                            </select>
                          </div>
                          {form.contributionTypeHSA && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Value {form.contributionTypeHSA === 'percent_gross' ? '(%)' : '($)'}</label>
                                <input
                                  type="number"
                                  value={form.contributionValueHSA ?? ''}
                                  onChange={(e) => setForm((f) => ({ ...f, contributionValueHSA: e.target.value ? parseFloat(e.target.value) : null }))}
                                  min={0}
                                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                />
                              </div>
                              {form.contributionTypeHSA === 'amount' && (
                                <div>
                                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Frequency</label>
                                  <select
                                    value={form.contributionFrequencyHSA ?? ''}
                                    onChange={(e) => setForm((f) => ({ ...f, contributionFrequencyHSA: e.target.value ? e.target.value as 'per_paycheck' | 'per_month' : null }))}
                                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                  >
                                    <option value="">—</option>
                                    <option value="per_paycheck">Per paycheck</option>
                                    <option value="per_month">Per month</option>
                                  </select>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Employer HSA contribution</label>
                        <select
                          value={form.employerHSAContribution}
                          onChange={(e) => setForm((f) => ({ ...f, employerHSAContribution: e.target.value as 'yes' | 'no' | 'not_sure' }))}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                          <option value="not_sure">Not sure</option>
                        </select>
                      </div>
                      {form.employerHSAContribution === 'yes' && (
                        <div className="mt-2">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Employer HSA per month ($)</label>
                          <input
                            type="number"
                            value={form.employerHSAAmount$ ?? ''}
                            onChange={(e) => setForm((f) => ({ ...f, employerHSAAmount$: e.target.value ? parseFloat(e.target.value) : null }))}
                            min={0}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                          />
                        </div>
                      )}
                    </>
                  )}
              </Section>

              {/* Expenses */}
              <Section
                title="Fixed expenses (bills)"
                open={sectionsOpen.expenses}
                onToggle={() => toggleSection('expenses')}
              >
                <p className="mb-2 text-xs text-slate-500">Monthly amounts; use category for needs vs wants.</p>
                {form.expenses.map((e) => (
                  <div key={e.id} className="mb-2 flex flex-wrap items-center gap-2 rounded border p-2">
                    <input
                      placeholder="Name"
                      value={e.name}
                      onChange={(ev) => updateExpense(e.id, { name: ev.target.value })}
                      className="max-w-[120px] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={e.amount$ || ''}
                      onChange={(ev) => updateExpense(e.id, { amount$: parseFloat(ev.target.value) || 0 })}
                      className="max-w-[80px] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <select
                      value={e.category || 'needs'}
                      onChange={(ev) => updateExpense(e.id, { category: ev.target.value as 'needs' | 'wants' })}
                      className="max-w-[100px] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="needs">Needs</option>
                      <option value="wants">Wants</option>
                    </select>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeExpense(e.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addExpense}>
                  <Plus className="mr-1 h-4 w-4" /> Add expense
                </Button>
              </Section>

              {/* Debts */}
              <Section
                title="Debts"
                open={sectionsOpen.debts}
                onToggle={() => toggleSection('debts')}
              >
                {form.debts.map((d) => (
                  <div key={d.id} className="mb-2 flex flex-wrap items-center gap-2 rounded border p-2">
                    <input
                      placeholder="Name"
                      value={d.name}
                      onChange={(ev) => updateDebt(d.id, { name: ev.target.value })}
                      className="max-w-[100px] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="number"
                      placeholder="Balance"
                      value={d.balance$ || ''}
                      onChange={(ev) => updateDebt(d.id, { balance$: parseFloat(ev.target.value) || 0 })}
                      className="max-w-[80px] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="number"
                      placeholder="APR %"
                      value={d.aprPct || ''}
                      onChange={(ev) => updateDebt(d.id, { aprPct: parseFloat(ev.target.value) || 0 })}
                      className="max-w-[60px] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="number"
                      placeholder="Min $"
                      value={d.minPayment$ || ''}
                      onChange={(ev) => updateDebt(d.id, { minPayment$: parseFloat(ev.target.value) || 0 })}
                      className="max-w-[70px] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeDebt(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addDebt}>
                  <Plus className="mr-1 h-4 w-4" /> Add debt
                </Button>
              </Section>

              {/* Assets */}
              <Section
                title="Assets"
                open={sectionsOpen.assets}
                onToggle={() => toggleSection('assets')}
              >
                {form.assets.map((a) => (
                  <div key={a.id} className="mb-2 flex flex-wrap items-center gap-2 rounded border p-2">
                    <input
                      placeholder="Name"
                      value={a.name}
                      onChange={(ev) => updateAsset(a.id, { name: ev.target.value })}
                      className="max-w-[100px] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="number"
                      placeholder="Value $"
                      value={a.value$ || ''}
                      onChange={(ev) => updateAsset(a.id, { value$: parseFloat(ev.target.value) || 0 })}
                      className="max-w-[80px] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <select
                      value={a.type}
                      onChange={(ev) => updateAsset(a.id, { type: ev.target.value as AssetType })}
                      className="max-w-[120px] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    >
                      {ASSET_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeAsset(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addAsset}>
                  <Plus className="mr-1 h-4 w-4" /> Add asset
                </Button>
              </Section>

              {/* Assumptions (returns, inflation, liquidity, retirement, IDR) */}
              <Section
                title="Assumptions"
                open={sectionsOpen.assumptions}
                onToggle={() => toggleSection('assumptions')}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Cash yield %</label>
                    <input
                      type="number"
                      value={form.cashYieldPct}
                      onChange={(e) => setForm((f) => ({ ...f, cashYieldPct: parseFloat(e.target.value) || 0 }))}
                      step={0.1}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nominal return %</label>
                    <input
                      type="number"
                      value={form.nominalReturnPct}
                      onChange={(e) => setForm((f) => ({ ...f, nominalReturnPct: parseFloat(e.target.value) || 0 }))}
                      step={0.1}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tax drag brokerage %</label>
                    <input
                      type="number"
                      value={form.taxDragBrokeragePct}
                      onChange={(e) => setForm((f) => ({ ...f, taxDragBrokeragePct: parseFloat(e.target.value) || 0 }))}
                      step={0.1}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Inflation %</label>
                    <input
                      type="number"
                      value={form.inflationRatePct}
                      onChange={(e) => setForm((f) => ({ ...f, inflationRatePct: parseFloat(e.target.value) || 0 }))}
                      step={0.1}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Liquidity</label>
                    <select
                      value={form.liquidity}
                      onChange={(e) => setForm((f) => ({ ...f, liquidity: e.target.value as SafetyStrategy['liquidity'] }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Retirement focus</label>
                    <select
                      value={form.retirementFocus}
                      onChange={(e) => setForm((f) => ({ ...f, retirementFocus: e.target.value as SafetyStrategy['retirementFocus'] }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">IRA room this year ($)</label>
                    <input
                      type="number"
                      value={form.iraRoomThisYear$}
                      onChange={(e) => setForm((f) => ({ ...f, iraRoomThisYear$: parseFloat(e.target.value) || 0 }))}
                      min={0}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">401(k) room this year ($)</label>
                    <input
                      type="number"
                      value={form.k401RoomThisYear$}
                      onChange={(e) => setForm((f) => ({ ...f, k401RoomThisYear$: parseFloat(e.target.value) || 0 }))}
                      min={0}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="onIDR"
                    checked={form.onIDR}
                    onChange={(e) => setForm((f) => ({ ...f, onIDR: e.target.checked }))}
                    className="rounded border-slate-300"
                  />
                  <label htmlFor="onIDR" className="text-sm font-medium text-slate-700 dark:text-slate-300">On IDR (student loans)</label>
                </div>
              </Section>

              <Button
                onClick={runSimulation}
                disabled={isRunning || form.incomeAmount <= 0}
                className="w-full"
                size="lg"
              >
                {isRunning ? 'Running…' : <><Play className="mr-2 h-4 w-4" /> Run simulation</>}
              </Button>
            </CardContent>
          </Card>

          {/* Right: Outputs */}
          <div className="space-y-6">
            {result?.error && (
              <Card className="border-red-200 bg-red-50 dark:bg-red-950/30">
                <CardContent className="pt-6">
                  <p className="text-sm text-red-800 dark:text-red-200">{result.error}</p>
                </CardContent>
              </Card>
            )}

            {result && !result.error && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Paycheck plan (per period)</CardTitle>
                    <CardDescription>Needs / Wants / Savings from income allocation engine.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                        <div className="text-xs text-blue-700 dark:text-blue-300">Needs</div>
                        <div className="font-semibold">${result.boostedPlan.needs$.toFixed(2)}</div>
                      </div>
                      <div className="rounded-lg bg-green-100 p-3 dark:bg-green-900/30">
                        <div className="text-xs text-green-700 dark:text-green-300">Wants</div>
                        <div className="font-semibold">${result.boostedPlan.wants$.toFixed(2)}</div>
                      </div>
                      <div className="rounded-lg bg-purple-100 p-3 dark:bg-purple-900/30">
                        <div className="text-xs text-purple-700 dark:text-purple-300">Savings</div>
                        <div className="font-semibold">${result.boostedPlan.savings$.toFixed(2)}</div>
                      </div>
                    </div>
                    {result.boostedPlan.savingsBreakdown && (() => {
                      const pm = getPaychecksPerMonth(form.payFrequency);
                      const bd = result.boostedPlan.savingsBreakdown;
                      const isTraditional = (bd.retirementAcctType ?? 'Roth') === 'Traditional401k';
                      const cashPostTaxMo = (bd.ef$ + bd.debt$ + bd.brokerage$ + (isTraditional ? 0 : bd.retirement$)) * pm;
                      // Employee 401(k) only: match need + traditional retirement (when Traditional), or user's current $/mo when provided. Employer match is separate.
                      const useCurrent401k = form.contributing401k === 'yes' && form.contributing401kMonthly$ != null && form.contributing401kMonthly$ > 0;
                      const payroll401kMo = useCurrent401k
                        ? form.contributing401kMonthly$!
                        : (bd.match401k$ + (isTraditional ? bd.retirement$ : 0)) * pm;
                      const employeeHSAMo = (bd.hsa$ ?? 0) * pm;
                      // Payroll savings = employee 401K + Employee HSA only (employer match/HSA shown separately)
                      const payrollPreTaxMo = payroll401kMo + employeeHSAMo;
                      const monthlyGross = form.incomeAmount * pm;
                      const hasMatch = form.has401k && form.hasEmployerMatch === 'yes' && form.employerMatchPct != null && form.employerMatchCapPct != null;
                      const employerMatch401kMo = hasMatch
                        ? monthlyGross * (form.employerMatchCapPct! / 100) * (form.employerMatchPct! / 100)  // gross × (Up to %/100) × (Match %/100)
                        : 0;
                      const employerHSAMo = form.employerHSAAmount$ ?? 0;
                      const totalSavingsMo = cashPostTaxMo + payrollPreTaxMo + employerMatch401kMo + employerHSAMo;
                      const savingsPct = monthlyGross > 0 ? (totalSavingsMo / monthlyGross) * 100 : 0;
                      const cashCategories = [
                        { label: 'Emergency Savings', value: bd.ef$ * pm },
                        { label: 'Extra Debt Paydown', value: bd.debt$ * pm },
                        { label: 'Retirement Tax-Advantaged', value: bd.retirement$ * pm },
                        { label: 'Brokerage', value: bd.brokerage$ * pm },
                      ];
                      const cashTotal = cashCategories.reduce((s, c) => s + c.value, 0);
                      return (
                        <>
                          <div className="border-t pt-3">
                            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Total Savings /month: ${totalSavingsMo.toFixed(0)} ({savingsPct.toFixed(0)}% of income)</div>
                            <div className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">Savings Breakdown</div>
                            <ul className="mt-1 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                              <li>Cash savings (Post-tax): estimated ${cashPostTaxMo.toFixed(0)}</li>
                              <li>Payroll savings (Pre-tax):</li>
                              <li className="list-none pl-3 text-slate-500">401K (Pre-tax): ${payroll401kMo.toFixed(0)}</li>
                              <li className="list-none pl-3 text-slate-500">Employee HSA: ${employeeHSAMo.toFixed(0)}</li>
                              <li>Employer 401K match: +${employerMatch401kMo.toFixed(0)}</li>
                              <li>Employer HSA: +${employerHSAMo.toFixed(0)}</li>
                            </ul>
                            <p className="mt-2 text-xs text-slate-500">Total Savings (Cash + Payroll + Employer 401K Match + Employer HSA): ${totalSavingsMo.toFixed(0)}</p>
                            <div className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">Cash Savings Categories</div>
                            <div className="mt-1 space-y-2">
                              {cashCategories.map((c) => (
                                <div key={c.label} className="flex items-center gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                                      <span>{c.label}</span>
                                      <span>${c.value.toFixed(0)}</span>
                                    </div>
                                    <div className="mt-0.5 h-2 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden">
                                      <div className="h-full rounded-full bg-green-500" style={{ width: cashTotal > 0 ? `${(c.value / cashTotal) * 100}%` : '0%' }} />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {result.boostedPlan.notes && result.boostedPlan.notes.length > 0 && (
                              <div className="mt-2 border-t pt-2 text-xs text-slate-500">
                                {result.boostedPlan.notes.slice(0, 5).map((n, i) => (
                                  <div key={i}>{n}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Monthly pulse</CardTitle>
                    <CardDescription>Same allocations in monthly terms (paychecks × frequency).</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const pm = getPaychecksPerMonth(form.payFrequency);
                      const breakdown = result.boostedPlan.savingsBreakdown;
                      const isTraditional = (breakdown?.retirementAcctType ?? 'Roth') === 'Traditional401k';
                      const preTaxPerPeriod = breakdown ? breakdown.match401k$ + (isTraditional ? breakdown.retirement$ : 0) : 0;
                      const postTaxPerPeriod = breakdown ? breakdown.ef$ + breakdown.debt$ + breakdown.brokerage$ + (isTraditional ? 0 : breakdown.retirement$) : 0;
                      return (
                        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                          <div><span className="text-slate-500">Needs</span> ${(result.boostedPlan.needs$ * pm).toFixed(0)}/mo</div>
                          <div><span className="text-slate-500">Wants</span> ${(result.boostedPlan.wants$ * pm).toFixed(0)}/mo</div>
                          <div><span className="text-slate-500">Savings</span> ${(result.boostedPlan.savings$ * pm).toFixed(0)}/mo</div>
                          {breakdown && (
                            <>
                              <div><span className="text-slate-500">EF</span> ${(breakdown.ef$ * pm).toFixed(0)}/mo</div>
                              <div><span className="text-slate-500">Debt</span> ${(breakdown.debt$ * pm).toFixed(0)}/mo</div>
                              <div><span className="text-slate-500">401(k) match</span> ${(breakdown.match401k$ * pm).toFixed(0)}/mo</div>
                              <div><span className="text-slate-500">HSA</span> ${((breakdown.hsa$ ?? 0) * pm).toFixed(0)}/mo</div>
                              <div><span className="text-slate-500">{(breakdown.retirementAcctType ?? 'Roth') === 'Traditional401k' ? '401(k)' : 'Roth'}</span> ${(breakdown.retirement$ * pm).toFixed(0)}/mo</div>
                              <div><span className="text-slate-500">Brokerage</span> ${(breakdown.brokerage$ * pm).toFixed(0)}/mo</div>
                              <div className="col-span-full border-t border-slate-200 pt-2 mt-1 dark:border-slate-600">
                                <span className="text-slate-500">Pre-tax savings</span> ${(preTaxPerPeriod * pm).toFixed(0)}/mo · <span className="text-slate-500">Post-tax savings</span> ${(postTaxPerPeriod * pm).toFixed(0)}/mo
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Net worth projection</CardTitle>
                    <CardDescription>40-year simulation from savings & net worth engines.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <NetWorthChart
                      labels={result.netWorth.labels}
                      netWorth={result.netWorth.netWorth}
                      assets={result.netWorth.assets}
                      liabilities={result.netWorth.liabilities}
                      height={280}
                    />
                    <div className="mt-4 flex flex-wrap gap-4 text-sm">
                      {result.netWorth.kpis.efReachedMonth != null && (
                        <span>EF target reached: month {result.netWorth.kpis.efReachedMonth + 1}</span>
                      )}
                      {result.netWorth.kpis.debtFreeMonth != null && (
                        <span>Debt-free: month {result.netWorth.kpis.debtFreeMonth + 1}</span>
                      )}
                      {result.netWorth.kpis.netWorthAtYears && Object.entries(result.netWorth.kpis.netWorthAtYears).map(([y, v]) => (
                        <span key={y}>{y} yr: ${(v ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
  );

  return (
    <div
      className={
        chatOpen
          ? 'flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-slate-900'
          : 'min-h-screen bg-slate-50 dark:bg-slate-900'
      }
    >
      {chatOpen ? (
        <div
          ref={splitContainerRef}
          className="mx-auto grid min-h-0 flex-1 w-full max-w-6xl overflow-hidden px-4 py-4"
          style={{
            gridTemplateRows: `${splitRatio}fr 8px ${1 - splitRatio}fr`,
            gap: 0,
          }}
        >
          {/* Top tile: simulation + results — 2/3 by default, adjustable */}
          <div className="min-h-0 overflow-y-auto rounded-t-xl border border-b-0 border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            {mainContent}
          </div>
          {/* Draggable resize handle */}
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-valuenow={Math.round(splitRatio * 100)}
            tabIndex={0}
            onMouseDown={handleResizeMouseDown}
            className="flex cursor-ns-resize select-none items-center justify-center border-y border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
            style={{ height: 8, minHeight: 8 }}
          >
            <div className="h-0.5 w-10 rounded-full bg-slate-400 dark:bg-slate-500" />
          </div>
          {/* Bottom tile: chat — 1/3 by default, adjustable */}
          <div className="flex min-h-0 flex-col overflow-hidden rounded-b-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <MVPSimulatorChat
              userPlanData={userPlanDataForChat}
              isOpen={true}
              onClose={() => setChatOpen(false)}
              embedded
            />
          </div>
        </div>
      ) : (
        <>
          {mainContent}
          <MVPSimulatorChat
            userPlanData={userPlanDataForChat}
            isOpen={false}
            onOpen={() => setChatOpen(true)}
          />
        </>
      )}
    </div>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left font-medium text-slate-900 dark:text-white"
      >
        {title}
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}
