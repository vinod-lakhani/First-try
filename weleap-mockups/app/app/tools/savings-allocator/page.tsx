/**
 * Savings Allocator
 * 
 * Allows users to adjust savings allocation across buckets using sliders
 * and see immediate impact on long-term net worth.
 */

'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData, getPaychecksPerMonth } from '@/lib/onboarding/usePlanData';
import { buildFinalPlanData, type FinalPlanData } from '@/lib/onboarding/plan';
import { simulateScenario, type ScenarioInput, type MonthlyPlan as SimMonthlyPlan } from '@/lib/sim/netWorth';
import type { OnboardingState } from '@/lib/onboarding/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { X, ArrowRight, AlertTriangle } from 'lucide-react';
import { NetWorthChart } from '@/components/charts/NetWorthChart';

type PaycheckCategoryWithSubs = FinalPlanData['paycheckCategories'][number] & {
  subCategories?: Array<{
    id?: string;
    key: '401k_match' | 'retirement_tax_advantaged' | 'brokerage';
    label?: string;
    amount: number;
    percent?: number;
  }>;
};

function SavingsAllocatorContent() {
  const router = useRouter();
  const baselineState = useOnboardingStore();
  
  // Use centralized hook for baseline plan data
  const baselinePlanDataFromHook = usePlanData();
  const baselinePlanData = baselinePlanDataFromHook;

  const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
  const monthlyIncome = (baselineState.income?.netIncome$ || baselineState.income?.grossIncome$ || 0) * paychecksPerMonth;

  // Get baseline savings budget and allocation details
  const baselineSavingsData = useMemo(() => {
    if (!baselinePlanData) return null;

    const savingsCategories = baselinePlanData.paycheckCategories.filter(c => 
      c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
    );
    const monthlySavings = savingsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;

    // Extract individual category amounts
    const emergencyCategory = baselinePlanData.paycheckCategories.find(c => c.key === 'emergency');
    const debtExtraCategory = baselinePlanData.paycheckCategories.find(c => c.key === 'debt_extra');
    const longTermCategory = baselinePlanData.paycheckCategories.find(
      c => c.key === 'long_term_investing'
    ) as PaycheckCategoryWithSubs | undefined;
    
    let match401k$ = 0;
    let retirementTaxAdv$ = 0;
    let brokerage$ = 0;
    
    if (longTermCategory?.subCategories) {
      const matchSub = longTermCategory.subCategories.find((s) => s.key === '401k_match');
      const retirementSub = longTermCategory.subCategories.find(
        (s) => s.key === 'retirement_tax_advantaged'
      );
      const brokerageSub = longTermCategory.subCategories.find((s) => s.key === 'brokerage');
      
      match401k$ = (matchSub?.amount || 0) * paychecksPerMonth;
      retirementTaxAdv$ = (retirementSub?.amount || 0) * paychecksPerMonth;
      brokerage$ = (brokerageSub?.amount || 0) * paychecksPerMonth;
    }

    return {
      monthlySavings,
      ef$: (emergencyCategory?.amount || 0) * paychecksPerMonth,
      debt$: (debtExtraCategory?.amount || 0) * paychecksPerMonth,
      match401k$,
      retirementTaxAdv$,
      brokerage$,
    };
  }, [baselinePlanData, paychecksPerMonth]);

  // Get EF and debt data for caps
  const efTargetMonths = baselineState.safetyStrategy?.efTargetMonths || 3;
  const monthlyBasics = baselineState.fixedExpenses
    .filter(e => e.category === 'needs')
    .reduce((sum, e) => sum + e.amount$, 0);
  const efTarget$ = monthlyBasics > 0 ? monthlyBasics * efTargetMonths : monthlyIncome * 0.3 * efTargetMonths;
  const efBalance$ = baselineState.safetyStrategy?.efBalance$ || 
    baselineState.assets.filter(a => a.type === 'cash').reduce((sum, a) => sum + a.value$, 0);
  const efGap$ = Math.max(0, efTarget$ - efBalance$);

  const highAprDebts = baselineState.debts
    .filter(d => d.isHighApr || d.aprPct > 10)
    .map(d => ({ balance$: d.balance$, aprPct: d.aprPct }));
  const totalDebtBalance$ = highAprDebts.reduce((sum, d) => sum + d.balance$, 0);

  // match401kPerMonth$ is already monthly, use directly
  const matchNeedThisPeriod$ = baselineState.safetyStrategy?.match401kPerMonth$ || 0;

  // Initialize slider values from baseline (as percentages of savings budget)
  const [sliders, setSliders] = useState({
    ef: 0,
    debt: 0,
    retirementMatch: 0,
    retirementExtra: 0,
    brokerage: 0,
  });
  const [originalSliders, setOriginalSliders] = useState(sliders);

  const clampSlider = (value: number, cap: number) => Math.max(0, Math.min(cap, value));

  const updateSliderValue = (
    key: keyof typeof sliders,
    rawValue: number,
    cap: number = 100
  ) => {
    const clamped = clampSlider(rawValue, cap);
    setSliders(prev => ({
      ...prev,
        [key]: clamped,
    }));
  };

  useEffect(() => {
    if (baselineSavingsData && baselineSavingsData.monthlySavings > 0) {
      const savingsBudget = baselineSavingsData.monthlySavings;
      
      const efPct = Math.min(40, (baselineSavingsData.ef$ / savingsBudget) * 100);
      const debtPct = Math.min(40, (baselineSavingsData.debt$ / savingsBudget) * 100);
      const matchPct = (baselineSavingsData.match401k$ / savingsBudget) * 100;
      const retExtraPct = (baselineSavingsData.retirementTaxAdv$ / savingsBudget) * 100;
      const brokeragePct = (baselineSavingsData.brokerage$ / savingsBudget) * 100;

      const initial = {
          ef: efPct,
          debt: debtPct,
          retirementMatch: matchPct,
          retirementExtra: retExtraPct,
          brokerage: brokeragePct,
      };

      setSliders(initial);
      setOriginalSliders(initial);
    }
  }, [baselineSavingsData]);

  // Use baseline savings budget (no adjustment)
  const savingsBudget = useMemo(() => {
    if (!baselineSavingsData) return 0;
    return baselineSavingsData.monthlySavings;
  }, [baselineSavingsData]);

  // Calculate desired total from sliders (as percentages of baseline budget)
  // This shows what the user wants to allocate based on their slider settings
  const desiredTotalFromSliders = useMemo(() => {
    if (!baselineSavingsData || savingsBudget <= 0) return 0;
    
    const total =
      (sliders.ef / 100) * savingsBudget +
      (sliders.debt / 100) * savingsBudget +
      (sliders.retirementMatch / 100) * savingsBudget +
      (sliders.retirementExtra / 100) * savingsBudget +
      (sliders.brokerage / 100) * savingsBudget;
    
    return total;
  }, [sliders, savingsBudget, baselineSavingsData]);

  // Calculate custom allocation directly from slider percentages (no normalization)
  const customAllocation = useMemo(() => {
    if (!baselineSavingsData || savingsBudget <= 0) return null;

    const budget = baselineSavingsData.monthlySavings;
    const warnings: string[] = [];

    const efCap = Math.min(budget * 0.4, efGap$ > 0 ? efGap$ : budget);
    const rawEf$ = (sliders.ef / 100) * budget;
    const ef$ = Math.max(0, Math.min(rawEf$, efCap));
    const efHitCap = rawEf$ > efCap;

    const debtCap = budget * 0.4;
    const rawDebt$ = (sliders.debt / 100) * budget;
    const highAprDebt$ = Math.max(0, Math.min(rawDebt$, debtCap));
    const debtHitCap = rawDebt$ > debtCap;

    const matchDesired$ = (sliders.retirementMatch / 100) * budget;
    const match401k$ = Math.max(0, Math.min(matchDesired$, matchNeedThisPeriod$ || matchDesired$));
    if (matchNeedThisPeriod$ > 0 && match401k$ < matchNeedThisPeriod$) {
      warnings.push(
        `Allocating $${match401k$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/month to 401k match leaves $${(matchNeedThisPeriod$ - match401k$).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} of employer match unclaimed.`
      );
    }

    const retirementTaxAdv$ = Math.max(0, (sliders.retirementExtra / 100) * budget);
    const brokerage$ = Math.max(0, (sliders.brokerage / 100) * budget);

    const totalAllocated = ef$ + highAprDebt$ + match401k$ + retirementTaxAdv$ + brokerage$;
    const unallocated$ = Math.max(0, budget - totalAllocated);

    const hitCaps = efHitCap || debtHitCap;

    return {
      ef$,
      highAprDebt$,
      match401k$,
      retirementTaxAdv$,
      brokerage$,
      totalAllocated,
      unallocated$,
      warnings,
      hitCaps,
    };
  }, [baselineSavingsData, savingsBudget, efGap$, matchNeedThisPeriod$, sliders]);

  // Calculate budget status based on desired total from sliders vs actual budget
  const budgetStatus = useMemo(() => {
    if (!customAllocation || !savingsBudget || !baselineSavingsData) return null;
    
    const difference = desiredTotalFromSliders - savingsBudget;
    const isOverBudget = difference > 1; // Allow small rounding differences
    const isUnderBudget = difference < -1;
    
    return {
      desiredTotal: desiredTotalFromSliders,
      budget: savingsBudget,
      difference: Math.abs(difference),
      isOverBudget,
      isUnderBudget,
      isOnBudget: !isOverBudget && !isUnderBudget,
      hasCapsHit: customAllocation.hitCaps,
    };
  }, [desiredTotalFromSliders, savingsBudget, customAllocation, baselineSavingsData]);

  const allocationComparison = useMemo(() => {
    if (!baselineSavingsData || !customAllocation) return null;
    return [
      {
        label: 'Emergency Fund',
        current: baselineSavingsData.ef$,
        updated: customAllocation.ef$,
      },
      {
        label: 'High-APR Debt',
        current: baselineSavingsData.debt$,
        updated: customAllocation.highAprDebt$,
      },
      {
        label: '401k Match',
        current: baselineSavingsData.match401k$,
        updated: customAllocation.match401k$,
      },
      {
        label: 'Retirement Tax-Advantaged',
        current: baselineSavingsData.retirementTaxAdv$,
        updated: customAllocation.retirementTaxAdv$,
      },
      {
        label: 'Brokerage',
        current: baselineSavingsData.brokerage$,
        updated: customAllocation.brokerage$,
      },
    ];
  }, [baselineSavingsData, customAllocation]);

  const scenarioPlanData = useMemo<FinalPlanData | null>(() => {
    if (!customAllocation || !baselinePlanData || !baselineState) return baselinePlanData ?? null;

    try {
      const incomePeriod$ = baselineState.income?.netIncome$ || baselineState.income?.grossIncome$ || 0;
      const essentialsCategories = baselinePlanData.paycheckCategories.filter(c => 
        c.key === 'essentials'
      );
      const debtMinimumCategories = baselinePlanData.paycheckCategories.filter(c => 
        c.key === 'debt_minimums'
      );
      const needsCategories = [...essentialsCategories, ...debtMinimumCategories];
      const wantsCategories = baselinePlanData.paycheckCategories.filter(c => 
        c.key === 'fun_flexible'
      );
      const monthlyEssentials = essentialsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
      const monthlyDebtMinimums = debtMinimumCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
      const monthlyNeeds = monthlyEssentials + monthlyDebtMinimums;
      const monthlyWants = wantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
      
      const assets = baselineState.assets || [];
      const debts = baselineState.debts || [];
      const efBalance$ = baselineState.safetyStrategy?.efBalance$ || 
        assets.filter(a => a.type === 'cash').reduce((sum, a) => sum + a.value$, 0);
      
      const efTargetMonths = baselineState.safetyStrategy?.efTargetMonths || 3;
      const monthlyBasics = baselineState.fixedExpenses
        .filter(e => e.category === 'needs')
        .reduce((sum, e) => sum + e.amount$, 0);
      const efTarget$ = monthlyBasics > 0 
        ? monthlyBasics * efTargetMonths 
        : (incomePeriod$ * 2.17 * 0.3 * efTargetMonths);
      
      const openingBalances = {
        cash: efBalance$,
        brokerage: assets.filter(a => a.type === 'brokerage').reduce((sum, a) => sum + a.value$, 0),
        retirement: assets.filter(a => a.type === 'retirement').reduce((sum, a) => sum + a.value$, 0),
        hsa: assets.find(a => a.type === 'hsa')?.value$,
        otherAssets: assets.filter(a => a.type === 'other').reduce((sum, a) => sum + a.value$, 0),
        liabilities: debts.map(d => ({
          name: d.name,
          balance: d.balance$,
          aprPct: d.aprPct,
          minPayment: d.minPayment$,
          extraPayment: d.isHighApr ? customAllocation.highAprDebt$ : undefined,
        })),
      };
      
      const monthlyPlan: SimMonthlyPlan = {
        monthIndex: 0,
        incomeNet: incomePeriod$ * paychecksPerMonth,
        needs$: Math.max(0, monthlyNeeds),
        wants$: monthlyWants,
        ef$: customAllocation.ef$,
        highAprDebt$: customAllocation.highAprDebt$,
        match401k$: customAllocation.match401k$,
        retirementTaxAdv$: customAllocation.retirementTaxAdv$,
        brokerage$: customAllocation.brokerage$,
      };
      
      console.log('[Savings Allocator] Monthly plan inputs', [{
        incomeNet: monthlyPlan.incomeNet,
        needs$: monthlyPlan.needs$,
        debtMinimums$: monthlyDebtMinimums,
        wants$: monthlyPlan.wants$,
        ef$: monthlyPlan.ef$,
        highAprDebt$: monthlyPlan.highAprDebt$,
        match401k$: monthlyPlan.match401k$,
        retirementTaxAdv$: monthlyPlan.retirementTaxAdv$,
        brokerage$: monthlyPlan.brokerage$,
        unallocated$: customAllocation.unallocated$,
      }]);
      
      const horizonMonths = 480;
      const monthlyPlans: SimMonthlyPlan[] = Array.from({ length: horizonMonths }, (_, i) => ({
        ...monthlyPlan,
        monthIndex: i,
      }));
      
      const riskConstraints = baselineState.riskConstraints;
      const scenarioInput: ScenarioInput = {
        startDate: new Date().toISOString().split('T')[0],
        horizonMonths,
        inflationRatePct: riskConstraints?.assumptions?.inflationRatePct || 2.5,
        nominalReturnPct: riskConstraints?.assumptions?.nominalReturnPct || 9.0,
        cashYieldPct: riskConstraints?.assumptions?.cashYieldPct || 4.0,
        taxDragBrokeragePct: 0.5,
        openingBalances,
        monthlyPlan: monthlyPlans,
        goals: {
          efTarget$,
        },
      };
      
      const simulation = simulateScenario(scenarioInput);
      
      const chartLabels: string[] = [];
      const chartNetWorth: number[] = [];
      const chartAssets: number[] = [];
      const chartLiabilities: number[] = [];
      
      for (let i = 0; i < simulation.netWorth.length; i += 3) {
        const month = i + 1;
        const year = Math.floor(month / 12);
        const monthInYear = (month % 12) || 12;
        chartLabels.push(`${monthInYear}/${year}`);
        chartNetWorth.push(simulation.netWorth[i] || 0);
        chartAssets.push(simulation.assets[i] || 0);
        chartLiabilities.push(simulation.liabilities[i] || 0);
      }
      
      const currentNetWorth = simulation.netWorth[0] || 0;
      const netWorth6m = simulation.netWorth[5] || currentNetWorth;
      const netWorth12m = simulation.netWorth[11] || currentNetWorth;
      const netWorth24m = simulation.netWorth[23] || simulation.netWorth[simulation.netWorth.length - 1] || currentNetWorth;
      
      const modifiedPlan: FinalPlanData = {
        ...baselinePlanData,
        netWorthChartData: {
          labels: chartLabels,
          netWorth: chartNetWorth,
          assets: chartAssets,
          liabilities: chartLiabilities,
        },
        netWorthProjection: [
          { label: 'Today', months: 0, value: currentNetWorth },
          { label: '6 Months', months: 6, value: netWorth6m },
          { label: '12 Months', months: 12, value: netWorth12m },
          { label: '24 Months', months: 24, value: netWorth24m },
        ],
      };
      
      console.log('[Savings Allocator] Scenario net worth calculated', {
        dataPoints: chartNetWorth.length,
        firstValue: chartNetWorth[0],
        lastValue: chartNetWorth[chartNetWorth.length - 1],
        netWorth12m,
        netWorth24m,
        customSavings: {
          ef$: customAllocation.ef$,
          debt$: customAllocation.highAprDebt$,
          match401k$: customAllocation.match401k$,
          retirementTaxAdv$: customAllocation.retirementTaxAdv$,
          brokerage$: customAllocation.brokerage$,
        },
      });
      
      return modifiedPlan;
    } catch (err) {
      console.error('[Savings Allocator] Error running net worth simulator:', err);
      return baselinePlanData ?? null;
    }
  }, [customAllocation, baselinePlanData, baselineState, paychecksPerMonth]);

  // Use baseline plan's net worth chart data, but resample to match scenario format (every 3 months)
  // The baselinePlanData has full 480-month simulation, but scenario samples every 3 months
  const baselineNetWorthChartData = useMemo(() => {
    if (!baselinePlanData?.netWorthChartData) return null;
    
    // Resample baseline data to match scenario sampling (every 3 months)
    const baselineNetWorth = baselinePlanData.netWorthChartData.netWorth;
    const resampledNetWorth: number[] = [];
    const resampledLabels: string[] = [];
    
    for (let i = 0; i < baselineNetWorth.length; i += 3) {
      const month = i + 1;
      const year = Math.floor(month / 12);
      const monthInYear = (month % 12) || 12;
      resampledLabels.push(`${monthInYear}/${year}`);
      resampledNetWorth.push(baselineNetWorth[i] || 0);
    }
    
    console.log('[Savings Allocator] Resampled baseline net worth to match scenario format', {
      originalDataPoints: baselineNetWorth.length,
      resampledDataPoints: resampledNetWorth.length,
      firstValue: resampledNetWorth[0],
      lastValue: resampledNetWorth[resampledNetWorth.length - 1],
    });
    
    return {
      labels: resampledLabels,
      netWorth: resampledNetWorth,
    };
  }, [baselinePlanData]);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Determine if values have changed
  const hasChanged = useMemo(() => {
    return Math.abs(sliders.ef - originalSliders.ef) > 0.1 ||
      Math.abs(sliders.debt - originalSliders.debt) > 0.1 ||
      Math.abs(sliders.retirementMatch - originalSliders.retirementMatch) > 0.1 ||
      Math.abs(sliders.retirementExtra - originalSliders.retirementExtra) > 0.1 ||
      Math.abs(sliders.brokerage - originalSliders.brokerage) > 0.1;
  }, [sliders, originalSliders]);

  const handleConfirmApply = () => {
    if (!customAllocation) return;
    
    // Save custom savings allocation to safetyStrategy
    // This will override the engine's calculation in buildFinalPlanData
    baselineState.updateSafetyStrategy({
      customSavingsAllocation: {
        ef$: customAllocation.ef$,
        highAprDebt$: customAllocation.highAprDebt$,
        match401k$: customAllocation.match401k$,
        retirementTaxAdv$: customAllocation.retirementTaxAdv$,
        brokerage$: customAllocation.brokerage$,
      },
    });
    
    // Clear initialPaycheckPlan to force recalculation
    baselineState.setInitialPaycheckPlan(undefined as any);
    
    setShowConfirmDialog(false);
    router.push('/app/income'); // Navigate to Income tab to see the changes
  };

  const handleApply = () => {
    setShowConfirmDialog(true);
  };

  if (!baselinePlanData || !baselineSavingsData || !customAllocation || !scenarioPlanData) {
    return (
      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading allocator...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate income distribution
  const essentialsCategories = scenarioPlanData.paycheckCategories.filter(c => c.key === 'essentials');
  const debtMinimumCategories = scenarioPlanData.paycheckCategories.filter(c => c.key === 'debt_minimums');
  const needsCategories = [...essentialsCategories, ...debtMinimumCategories];
  const wantsCategories = scenarioPlanData.paycheckCategories.filter(c => 
    c.key === 'fun_flexible'
  );
  const savingsCategories = scenarioPlanData.paycheckCategories.filter(c => 
    c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
  );

  const monthlyEssentials = essentialsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
  const monthlyDebtMinimums = debtMinimumCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
  const monthlyNeeds = monthlyEssentials + monthlyDebtMinimums;
  const monthlyWants = wantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
  const monthlySavings = savingsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
  const monthlyTotal = monthlyNeeds + monthlyWants + monthlySavings;

  const needsPct = monthlyTotal > 0 ? (monthlyNeeds / monthlyTotal) * 100 : 0;
  const wantsPct = monthlyTotal > 0 ? (monthlyWants / monthlyTotal) * 100 : 0;
  const savingsPct = monthlyTotal > 0 ? (monthlySavings / monthlyTotal) * 100 : 0;

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Savings Allocation</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-8 w-8"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Warnings */}
          {customAllocation.warnings.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <div className="flex-1 space-y-1">
                  {customAllocation.warnings.map((warning, idx) => (
                    <p key={idx} className="text-sm text-yellow-800 dark:text-yellow-200">
                      {warning}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="space-y-6">
            {/* Budget Status */}
            {budgetStatus && (
              <div className="mb-6">
                <div className={`rounded-lg border-2 p-4 ${
                  budgetStatus.isOverBudget 
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                    : budgetStatus.isUnderBudget
                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                    : 'border-green-500 bg-green-50 dark:bg-green-900/20'
                }`}>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Budget Status</h3>
                    <span className={`text-lg font-bold ${
                      budgetStatus.isOverBudget 
                        ? 'text-red-600 dark:text-red-400' 
                        : budgetStatus.isUnderBudget
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {budgetStatus.isOverBudget 
                        ? `Over by $${budgetStatus.difference.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                        : budgetStatus.isUnderBudget
                        ? `Under by $${budgetStatus.difference.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                        : 'On Budget'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Desired Total (from sliders):</span>
                      <span className="ml-2 font-semibold">${budgetStatus.desiredTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Current Budget:</span>
                      <span className="ml-2 font-semibold">${budgetStatus.budget.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                  <div className="mt-3 rounded bg-white/50 p-2 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
                    <p>💡 The total above is calculated by adding up all slider percentages. Adjust sliders below to see how your desired allocation compares to your current budget.</p>
                  </div>
                  {budgetStatus.isOverBudget && (
                    <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                      ⚠️ Your desired allocation (${budgetStatus.desiredTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}) exceeds your current budget (${budgetStatus.budget.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}). Reduce slider values to stay within budget.
                    </p>
                  )}
                  {budgetStatus.isUnderBudget && (
                    <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                      ℹ️ Your desired allocation (${budgetStatus.desiredTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}) is under your current budget (${budgetStatus.budget.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}). You can increase slider values to use more of your budget.
                    </p>
                  )}
                  {budgetStatus.isOnBudget && (
                    <p className="mt-2 text-sm text-green-700 dark:text-green-300">
                      ✓ Your desired allocation matches your current budget.
                    </p>
                  )}
                  {budgetStatus.hasCapsHit && (
                    <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                      ⚠️ Some allocations hit maximum caps (EF: 40% of budget, Debt: 40% of budget). The actual allocation may be lower than your slider settings indicate.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Savings Category Sliders */}
            <div className="space-y-6">
              <h2 className="font-semibold text-slate-900 dark:text-white">Savings Categories</h2>
              
              {/* Emergency Fund */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium text-slate-900 dark:text-white">Emergency Fund</h3>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    ${customAllocation.ef$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                  </span>
                </div>
                <Slider
                  value={[sliders.ef]}
                  onValueChange={([value]) => updateSliderValue('ef', value, 40)}
                  min={0}
                  max={40}
                  step={1}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {efGap$ > 0 ? `Gap: $${efGap$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : 'Emergency fund target met'}
                </p>
              </div>

              {/* High-APR Debt */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium text-slate-900 dark:text-white">High-APR Debt Paydown</h3>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    ${customAllocation.highAprDebt$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                  </span>
                </div>
                <Slider
                  value={[sliders.debt]}
                  onValueChange={([value]) => updateSliderValue('debt', value, 40)}
                  min={0}
                  max={40}
                  step={1}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {totalDebtBalance$ > 0 ? `Balance: $${totalDebtBalance$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : 'No high-APR debt'}
                </p>
              </div>

              {/* Retirement Match */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium text-slate-900 dark:text-white">Retirement — Match</h3>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    ${customAllocation.match401k$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                  </span>
                </div>
                <Slider
                  value={[sliders.retirementMatch]}
                  onValueChange={([value]) => updateSliderValue('retirementMatch', value, 100)}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {matchNeedThisPeriod$ > 0 ? `Required: $${matchNeedThisPeriod$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} to capture full match` : 'No employer match'}
                </p>
              </div>

              {/* Retirement Extra */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium text-slate-900 dark:text-white">Retirement — Additional (401k/Roth)</h3>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    ${customAllocation.retirementTaxAdv$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                  </span>
                </div>
                <Slider
                  value={[sliders.retirementExtra]}
                  onValueChange={([value]) => updateSliderValue('retirementExtra', value, 100)}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Brokerage */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium text-slate-900 dark:text-white">Brokerage (Taxable Investing)</h3>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    ${customAllocation.brokerage$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                  </span>
                </div>
                <Slider
                  value={[sliders.brokerage]}
                  onValueChange={([value]) => updateSliderValue('brokerage', value, 100)}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>

            {/* Wealth Accumulation */}
            <Card>
              <CardHeader>
                <CardTitle>Wealth Accumulation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-lg border bg-white p-4 dark:bg-slate-800">
                  <div className="min-w-0">
                    <NetWorthChart
                      key={`savings-allocator-${sliders.ef}-${sliders.debt}-${sliders.retirementMatch}-${sliders.retirementExtra}-${sliders.brokerage}-${scenarioPlanData.netWorthChartData.netWorth.length}`}
                      labels={scenarioPlanData.netWorthChartData.labels}
                      netWorth={scenarioPlanData.netWorthChartData.netWorth}
                      assets={scenarioPlanData.netWorthChartData.assets}
                      liabilities={scenarioPlanData.netWorthChartData.liabilities}
                      baselineNetWorth={
                        baselineNetWorthChartData && baselineNetWorthChartData.netWorth.length === scenarioPlanData.netWorthChartData.netWorth.length
                          ? [...baselineNetWorthChartData.netWorth] 
                          : undefined
                      }
                      height={400}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {scenarioPlanData.netWorthProjection.map((projection) => {
                    const baselineValue = baselinePlanData.netWorthProjection.find(p => p.label === projection.label)?.value || 0;
                    const scenarioValue = projection.value;
                    const delta = scenarioValue - baselineValue;
                    const showDelta = hasChanged && Math.abs(delta) > 1;
                    
                    return (
                      <div
                        key={projection.label}
                        className="rounded-lg border bg-white p-4 text-center dark:bg-slate-800"
                      >
                        <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                          {projection.label}
                        </p>
                        <p className={`text-2xl font-bold ${
                          scenarioValue >= 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          ${scenarioValue.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </p>
                        {showDelta && (
                          <p className={`mt-1 text-xs font-medium ${
                            delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {delta >= 0 ? '+' : ''}${delta.toLocaleString('en-US', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })} vs Current
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {allocationComparison && (
                  <div className="rounded-lg border bg-white p-4 dark:bg-slate-800">
                    <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Monthly Allocation Changes
                    </h3>
                    <div className="space-y-2 text-sm">
                      {allocationComparison.map((row) => {
                        const delta = row.updated - row.current;
                        return (
                          <div key={row.label} className="flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-400">{row.label}</span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              ${row.updated.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              {Math.abs(delta) > 1 && (
                                <span className={`ml-2 text-xs ${delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {delta >= 0 ? '+' : ''}
                                  ${Math.abs(delta).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Implement Button */}
      <div className="border-t bg-background px-4 py-4">
        <div className="mx-auto max-w-lg space-y-4">
          <Button
            onClick={handleApply}
            className="w-full bg-green-600 text-white hover:bg-green-700"
            size="lg"
          >
            Implement Savings Allocation
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && customAllocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl">Confirm Changes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Please review the changes before applying them to your plan:
              </p>
              
              <div className="space-y-3 rounded-lg border bg-slate-50 p-4 dark:bg-slate-800">
                {baselineSavingsData && (
                  <>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">Emergency Fund</h3>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Current Plan:</span>
                        <span className="font-semibold">${baselineSavingsData.ef$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">New Plan:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">${customAllocation.ef$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      {Math.abs(customAllocation.ef$ - baselineSavingsData.ef$) > 0.01 && (
                        <div className="flex items-center justify-between text-sm border-t pt-2">
                          <span className="text-slate-600 dark:text-slate-400">Change:</span>
                          <span className={`font-semibold ${(customAllocation.ef$ - baselineSavingsData.ef$) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {(customAllocation.ef$ - baselineSavingsData.ef$) >= 0 ? '+' : ''}${(customAllocation.ef$ - baselineSavingsData.ef$).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">High-APR Debt</h3>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Current Plan:</span>
                        <span className="font-semibold">${baselineSavingsData.debt$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">New Plan:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">${customAllocation.highAprDebt$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      {Math.abs(customAllocation.highAprDebt$ - baselineSavingsData.debt$) > 0.01 && (
                        <div className="flex items-center justify-between text-sm border-t pt-2">
                          <span className="text-slate-600 dark:text-slate-400">Change:</span>
                          <span className={`font-semibold ${(customAllocation.highAprDebt$ - baselineSavingsData.debt$) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {(customAllocation.highAprDebt$ - baselineSavingsData.debt$) >= 0 ? '+' : ''}${(customAllocation.highAprDebt$ - baselineSavingsData.debt$).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">Retirement Match</h3>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Current Plan:</span>
                        <span className="font-semibold">${baselineSavingsData.match401k$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">New Plan:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">${customAllocation.match401k$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      {Math.abs(customAllocation.match401k$ - baselineSavingsData.match401k$) > 0.01 && (
                        <div className="flex items-center justify-between text-sm border-t pt-2">
                          <span className="text-slate-600 dark:text-slate-400">Change:</span>
                          <span className={`font-semibold ${(customAllocation.match401k$ - baselineSavingsData.match401k$) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {(customAllocation.match401k$ - baselineSavingsData.match401k$) >= 0 ? '+' : ''}${(customAllocation.match401k$ - baselineSavingsData.match401k$).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">Retirement Additional</h3>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Current Plan:</span>
                        <span className="font-semibold">${baselineSavingsData.retirementTaxAdv$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">New Plan:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">${customAllocation.retirementTaxAdv$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      {Math.abs(customAllocation.retirementTaxAdv$ - baselineSavingsData.retirementTaxAdv$) > 0.01 && (
                        <div className="flex items-center justify-between text-sm border-t pt-2">
                          <span className="text-slate-600 dark:text-slate-400">Change:</span>
                          <span className={`font-semibold ${(customAllocation.retirementTaxAdv$ - baselineSavingsData.retirementTaxAdv$) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {(customAllocation.retirementTaxAdv$ - baselineSavingsData.retirementTaxAdv$) >= 0 ? '+' : ''}${(customAllocation.retirementTaxAdv$ - baselineSavingsData.retirementTaxAdv$).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">Brokerage</h3>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Current Plan:</span>
                        <span className="font-semibold">${baselineSavingsData.brokerage$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">New Plan:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">${customAllocation.brokerage$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      {Math.abs(customAllocation.brokerage$ - baselineSavingsData.brokerage$) > 0.01 && (
                        <div className="flex items-center justify-between text-sm border-t pt-2">
                          <span className="text-slate-600 dark:text-slate-400">Change:</span>
                          <span className={`font-semibold ${(customAllocation.brokerage$ - baselineSavingsData.brokerage$) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {(customAllocation.brokerage$ - baselineSavingsData.brokerage$) >= 0 ? '+' : ''}${(customAllocation.brokerage$ - baselineSavingsData.brokerage$).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                These changes will update your savings allocation plan. The new plan will be applied immediately and will show in the Income and Home tabs.
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmApply}
                  className="flex-1 bg-green-600 text-white hover:bg-green-700"
                >
                  Confirm & Apply
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function SavingsAllocatorPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading allocator...
            </p>
          </CardContent>
        </Card>
      </div>
    }>
      <SavingsAllocatorContent />
    </Suspense>
  );
}

