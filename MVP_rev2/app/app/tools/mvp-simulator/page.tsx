/**
 * MVP Simulator
 *
 * Single-page tool to enter all manual onboarding inputs and run the same
 * engines (income allocation, savings allocation, net worth simulation) to
 * produce outputs for verification against the real app.
 */

'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChevronDown, ChevronRight, Play, Plus, Trash2 } from 'lucide-react';
import type {
  IncomeState,
  FixedExpense,
  Debt,
  Asset,
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
import { MVPSimulatorChat } from '@/components/tools/MVPSimulatorChat';

const PAY_FREQUENCIES: { value: PayFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'semimonthly', label: 'Twice a month' },
  { value: 'monthly', label: 'Monthly' },
];

const ASSET_TYPES: Array<'cash' | 'brokerage' | 'retirement' | 'hsa' | 'other'> = [
  'cash',
  'brokerage',
  'retirement',
  'hsa',
  'other',
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
      retirement$: number;
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

  const safetyStrategy: SafetyStrategy = {
    efTargetMonths: form.efTargetMonths,
    efBalance$: form.efBalance$,
    liquidity: form.liquidity,
    retirementFocus: form.retirementFocus,
    onIDR: form.onIDR,
    match401kPerMonth$: form.match401kPerMonth$,
    iraRoomThisYear$: form.iraRoomThisYear$,
    k401RoomThisYear$: form.k401RoomThisYear$,
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
    payrollContributions: form.payrollContributions,
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
  match401kPerMonth$: number;
  iraRoomThisYear$: number;
  k401RoomThisYear$: number;
  payrollContributions?: PayrollContributions;
  pulsePreferences: PulsePreferences;
}

const defaultFormState: FormState = {
  incomeAmount: 4000,
  incomeIsGross: false,
  payFrequency: 'biweekly',
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
  match401kPerMonth$: 0,
  iraRoomThisYear$: 7000,
  k401RoomThisYear$: 23000,
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
    safety: true,
    payroll: false,
    pulse: false,
  });

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
      const efBalance$ =
        state.assets.filter((a) => a.type === 'cash').reduce((s, a) => s + a.value$, 0) || 0;
      const openingBalances = {
        cash: efBalance$,
        brokerage: state.assets.filter((a) => a.type === 'brokerage').reduce((s, a) => s + a.value$, 0),
        retirement: state.assets.filter((a) => a.type === 'retirement').reduce((s, a) => s + a.value$, 0),
        hsa: state.assets.find((a) => a.type === 'hsa')?.value$,
        otherAssets: state.assets.filter((a) => a.type === 'other').reduce((s, a) => s + a.value$, 0),
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
        retirementTaxAdv$: (paycheckPlan.savingsBreakdown?.retirement$ ?? 0) * paychecksPerMonth,
        brokerage$: (paycheckPlan.savingsBreakdown?.brokerage$ ?? 0) * paychecksPerMonth,
      };
      const horizonMonths = 120; // 10 years for chart
      const scenarioInput = {
        startDate: new Date().toISOString().split('T')[0],
        horizonMonths,
        inflationRatePct: form.inflationRatePct,
        nominalReturnPct: form.nominalReturnPct,
        cashYieldPct: form.cashYieldPct,
        taxDragBrokeragePct: form.taxDragBrokeragePct,
        openingBalances,
        monthlyPlan: Array.from({ length: horizonMonths }, (_, i) => ({ ...monthlyPlan, monthIndex: i })),
        goals: { efTarget$: monthlyBasics * form.efTargetMonths },
      };
      const series = simulateScenario(scenarioInput);

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
          labels: series.labels,
          netWorth: series.netWorth,
          assets: series.assets,
          liabilities: series.liabilities,
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
        assetsCount: form.assets.length,
        efTargetMonths: form.efTargetMonths,
        efBalance$: form.efBalance$,
        liquidity: form.liquidity,
        retirementFocus: form.retirementFocus,
        match401kPerMonth$: form.match401kPerMonth$,
      },
      outputs: {
        paycheckPlanPerPeriod: {
          needs$: result.boostedPlan.needs$,
          wants$: result.boostedPlan.wants$,
          savings$: result.boostedPlan.savings$,
          savingsBreakdown: result.boostedPlan.savingsBreakdown,
        },
        monthlyPulse: {
          needs$: result.boostedPlan.needs$ * paychecksPerMonth,
          wants$: result.boostedPlan.wants$ * paychecksPerMonth,
          savings$: result.boostedPlan.savings$ * paychecksPerMonth,
          ef$: (result.boostedPlan.savingsBreakdown?.ef$ ?? 0) * paychecksPerMonth,
          debt$: (result.boostedPlan.savingsBreakdown?.debt$ ?? 0) * paychecksPerMonth,
          match401k$: (result.boostedPlan.savingsBreakdown?.match401k$ ?? 0) * paychecksPerMonth,
          retirement$: (result.boostedPlan.savingsBreakdown?.retirement$ ?? 0) * paychecksPerMonth,
          brokerage$: (result.boostedPlan.savingsBreakdown?.brokerage$ ?? 0) * paychecksPerMonth,
        },
        netWorth: result.netWorth.kpis,
        notes: result.boostedPlan.notes,
      },
      monthlyIncome,
    };
  }, [result, form]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
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

              {/* Safety & strategy */}
              <Section
                title="Safety & strategy"
                open={sectionsOpen.safety}
                onToggle={() => toggleSection('safety')}
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
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
                <div className="mt-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">401(k) match needed per month ($) to capture full match</label>
                  <input
                    type="number"
                    value={form.match401kPerMonth$ || ''}
                    onChange={(e) => setForm((f) => ({ ...f, match401kPerMonth$: parseFloat(e.target.value) || 0 }))}
                    min={0}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
                      onChange={(ev) => updateAsset(a.id, { type: ev.target.value as Asset['type'] })}
                      className="max-w-[100px] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    >
                      {ASSET_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
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

              {/* Assumptions (collapsed by default) */}
              <Section
                title="Assumptions (returns, inflation)"
                open={sectionsOpen.payroll}
                onToggle={() => toggleSection('payroll')}
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
                    {result.boostedPlan.savingsBreakdown && (
                      <>
                        <div className="border-t pt-3">
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Savings breakdown (per period)</div>
                          <ul className="mt-1 list-inside list-disc text-sm text-slate-600 dark:text-slate-400">
                            <li>Emergency fund: ${result.boostedPlan.savingsBreakdown.ef$.toFixed(2)}</li>
                            <li>High-APR debt: ${result.boostedPlan.savingsBreakdown.debt$.toFixed(2)}</li>
                            <li>401(k) match: ${result.boostedPlan.savingsBreakdown.match401k$.toFixed(2)}</li>
                            <li>Retirement (tax-adv): ${result.boostedPlan.savingsBreakdown.retirement$.toFixed(2)}</li>
                            <li>Brokerage: ${result.boostedPlan.savingsBreakdown.brokerage$.toFixed(2)}</li>
                          </ul>
                        </div>
                        {result.boostedPlan.notes && result.boostedPlan.notes.length > 0 && (
                          <div className="border-t pt-2 text-xs text-slate-500">
                            {result.boostedPlan.notes.slice(0, 5).map((n, i) => (
                              <div key={i}>{n}</div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
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
                      return (
                        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                          <div><span className="text-slate-500">Needs</span> ${(result.boostedPlan.needs$ * pm).toFixed(0)}/mo</div>
                          <div><span className="text-slate-500">Wants</span> ${(result.boostedPlan.wants$ * pm).toFixed(0)}/mo</div>
                          <div><span className="text-slate-500">Savings</span> ${(result.boostedPlan.savings$ * pm).toFixed(0)}/mo</div>
                          {breakdown && (
                            <>
                              <div><span className="text-slate-500">EF</span> ${(breakdown.ef$ * pm).toFixed(0)}/mo</div>
                              <div><span className="text-slate-500">Debt</span> ${(breakdown.debt$ * pm).toFixed(0)}/mo</div>
                              <div><span className="text-slate-500">Match</span> ${(breakdown.match401k$ * pm).toFixed(0)}/mo</div>
                              <div><span className="text-slate-500">Retirement</span> ${(breakdown.retirement$ * pm).toFixed(0)}/mo</div>
                              <div><span className="text-slate-500">Brokerage</span> ${(breakdown.brokerage$ * pm).toFixed(0)}/mo</div>
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
                    <CardDescription>10-year simulation from savings & net worth engines.</CardDescription>
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

      {/* Chat: ask how outputs were calculated */}
      <MVPSimulatorChat userPlanData={userPlanDataForChat} />
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
