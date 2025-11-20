/**
 * Savings Optimizer
 * 
 * Allows users to adjust Needs and Wants percentages to see impact on Savings and Net Worth.
 */

'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { buildFinalPlanData, type FinalPlanData } from '@/lib/onboarding/plan';
import type { OnboardingState } from '@/lib/onboarding/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { X, ArrowRight } from 'lucide-react';
import { NetWorthChart } from '@/components/charts/NetWorthChart';

// Helper to get paychecks per month
function getPaychecksPerMonth(frequency: string): number {
  switch (frequency) {
    case 'weekly': return 4.33;
    case 'biweekly': return 2.17;
    case 'semimonthly': return 2;
    case 'monthly': return 1;
    default: return 2.17;
  }
}

function SavingsOptimizerContent() {
  const router = useRouter();
  const baselineState = useOnboardingStore();
  
  // Use centralized hook for baseline plan data - ensures consistency with other pages
  const baselinePlanDataFromHook = usePlanData();
  const baselinePlanData = baselinePlanDataFromHook;

  // Get initial Needs and Wants amounts from baseline plan (monthly)
  const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
  const baselineNeedsCategories = baselinePlanData?.paycheckCategories.filter(c => 
    c.key === 'essentials' || c.key === 'debt_minimums'
  ) || [];
  const baselineWantsCategories = baselinePlanData?.paycheckCategories.filter(c => 
    c.key === 'fun_flexible'
  ) || [];
  const baselineSavingsCategories = baselinePlanData?.paycheckCategories.filter(c => 
    c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
  ) || [];

  const baselineMonthlyNeeds = baselineNeedsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
  const baselineMonthlyWants = baselineWantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
  const baselineMonthlySavings = baselineSavingsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
  const monthlyIncome = (baselineState.income?.netIncome$ || baselineState.income?.grossIncome$ || 0) * paychecksPerMonth;

  // Slider values (as percentages of income)
  const baselineNeedsPct = (baselineMonthlyNeeds / monthlyIncome) * 100;
  const baselineWantsPct = (baselineMonthlyWants / monthlyIncome) * 100;
  const baselineSavingsPct = Math.max(0, 100 - baselineNeedsPct - baselineWantsPct);

  const [needsPct, setNeedsPct] = useState(baselineNeedsPct);
  const [wantsPct, setWantsPct] = useState(baselineWantsPct);
  const [savingsPct, setSavingsPct] = useState(baselineSavingsPct);
  const [originalNeedsPct, setOriginalNeedsPct] = useState(baselineNeedsPct);
  const [originalWantsPct, setOriginalWantsPct] = useState(baselineWantsPct);

  // Initialize original values
  useEffect(() => {
    if (baselinePlanData) {
      setOriginalNeedsPct(baselineNeedsPct);
      setOriginalWantsPct(baselineWantsPct);
      setNeedsPct(baselineNeedsPct);
      setWantsPct(baselineWantsPct);
      setSavingsPct(baselineSavingsPct);
    }
  }, [baselinePlanData, baselineNeedsPct, baselineWantsPct, baselineSavingsPct]);

  // Build scenario state with adjusted Needs and Wants percentages
  const scenarioState = useMemo((): OnboardingState => {
    const actuals3mNeedsPct = needsPct / 100;
    const actuals3mWantsPct = wantsPct / 100;
    const actuals3mSavingsPct = savingsPct / 100;
    const targetsFromSliders = {
      needsPct: actuals3mNeedsPct,
      wantsPct: actuals3mWantsPct,
      savingsPct: actuals3mSavingsPct,
    };
    
    console.log('[Savings Optimizer] Building scenarioState', {
      needsPct,
      wantsPct,
      actuals3mNeedsPct,
      actuals3mWantsPct,
      actuals3mSavingsPct,
      actuals3mSum: actuals3mNeedsPct + actuals3mWantsPct + actuals3mSavingsPct,
      baselinePlaidConnected: baselineState.plaidConnected,
      baselineFixedExpensesCount: baselineState.fixedExpenses.length,
    });
    
    const state: OnboardingState = {
      ...baselineState,
      // Preserve all state including plaidConnected, fixedExpenses, debts, etc.
      fixedExpenses: [...baselineState.fixedExpenses],
      plaidConnected: baselineState.plaidConnected, // Explicitly preserve Plaid connection status
      riskConstraints: baselineState.riskConstraints ? {
        ...baselineState.riskConstraints,
        targets: targetsFromSliders,
        actuals3m: {
          needsPct: actuals3mNeedsPct,
          wantsPct: actuals3mWantsPct,
          savingsPct: actuals3mSavingsPct,
        },
      } : {
        shiftLimitPct: 0.04,
        targets: targetsFromSliders,
        actuals3m: targetsFromSliders,
      },
      initialPaycheckPlan: undefined, // Force recalculation from state
    };
    
    console.log('[Savings Optimizer] ScenarioState created', {
      plaidConnected: state.plaidConnected,
      fixedExpensesCount: state.fixedExpenses.length,
      hasInitialPaycheckPlan: !!state.initialPaycheckPlan,
      actuals3m: state.riskConstraints?.actuals3m,
    });
    
    return state;
  }, [baselineState, needsPct, wantsPct, savingsPct]);

  // Calculate scenario plan data
  const scenarioPlanData = useMemo(() => {
    console.log('[Savings Optimizer] Calling buildFinalPlanData with scenarioState', {
      needsPct,
      wantsPct,
      plaidConnected: scenarioState.plaidConnected,
      hasInitialPaycheckPlan: !!scenarioState.initialPaycheckPlan,
      fixedExpensesCount: scenarioState.fixedExpenses.length,
      debtsCount: scenarioState.debts.length,
      income: scenarioState.income?.netIncome$,
      actuals3m: scenarioState.riskConstraints?.actuals3m,
    });
    
    try {
      const plan = buildFinalPlanData(scenarioState);
      const scenarioPaychecksPerMonth = getPaychecksPerMonth(scenarioState.income?.payFrequency || 'biweekly');
      const monthlyIncome = plan.paycheckAmount * scenarioPaychecksPerMonth;
      const targetNeedsMonthly = (needsPct / 100) * monthlyIncome;
      const targetWantsMonthly = (wantsPct / 100) * monthlyIncome;
      const targetSavingsMonthly = Math.max(0, monthlyIncome - targetNeedsMonthly - targetWantsMonthly);
      const targetNeedsPerPaycheck = targetNeedsMonthly / scenarioPaychecksPerMonth;
      const targetWantsPerPaycheck = targetWantsMonthly / scenarioPaychecksPerMonth;
      const targetSavingsPerPaycheck = targetSavingsMonthly / scenarioPaychecksPerMonth;

      const needsIndexes = plan.paycheckCategories
        .map((cat, idx) => ({ cat, idx }))
        .filter(({ cat }) => cat.key === 'essentials' || cat.key === 'debt_minimums');
      const wantsIndexes = plan.paycheckCategories
        .map((cat, idx) => ({ cat, idx }))
        .filter(({ cat }) => cat.key === 'fun_flexible');
      const savingsIndexes = plan.paycheckCategories
        .map((cat, idx) => ({ cat, idx }))
        .filter(({ cat }) => cat.key === 'emergency' || cat.key === 'debt_extra' || cat.key === 'long_term_investing');

      const sumAmounts = (entries: { cat: typeof plan.paycheckCategories[number] }[]) =>
        entries.reduce((sum, { cat }) => sum + cat.amount, 0);

      const scaleAndUpdate = (
        entries: { cat: typeof plan.paycheckCategories[number]; idx: number }[],
        targetPerPaycheck: number
      ) => {
        const current = sumAmounts(entries);
        const scale = current > 0 ? targetPerPaycheck / current : 0;
        entries.forEach(({ cat, idx }) => {
          const newAmount = scale > 0 ? cat.amount * scale : 0;
          plan.paycheckCategories[idx] = {
            ...cat,
            amount: newAmount,
            percent: (newAmount / plan.paycheckAmount) * 100,
          };
        });
      };

      scaleAndUpdate(needsIndexes, targetNeedsPerPaycheck);
      scaleAndUpdate(wantsIndexes, targetWantsPerPaycheck);
      scaleAndUpdate(savingsIndexes, targetSavingsPerPaycheck);
      
      // Calculate monthly amounts for verification
      const paychecksPerMonth = getPaychecksPerMonth(scenarioState.income?.payFrequency || 'biweekly');
      const needsCategories = plan.paycheckCategories.filter(c => c.key === 'essentials' || c.key === 'debt_minimums');
      const wantsCategories = plan.paycheckCategories.filter(c => c.key === 'fun_flexible');
      const savingsCategories = plan.paycheckCategories.filter(c => c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra');
      const monthlyNeeds = needsCategories.reduce((sum, c) => sum + c.amount, 0) * scenarioPaychecksPerMonth;
      const monthlyWants = wantsCategories.reduce((sum, c) => sum + c.amount, 0) * scenarioPaychecksPerMonth;
      const monthlySavings = savingsCategories.reduce((sum, c) => sum + c.amount, 0) * scenarioPaychecksPerMonth;
      
      console.log('[Savings Optimizer] Scenario plan calculated', {
        needsPct,
        wantsPct,
        paycheckCategoriesCount: plan.paycheckCategories.length,
        monthlyNeeds: monthlyNeeds.toFixed(2),
        monthlyWants: monthlyWants.toFixed(2),
        monthlySavings: monthlySavings.toFixed(2),
        netWorthDataPoints: plan.netWorthChartData.netWorth.length,
      });
      return plan;
    } catch (err) {
      console.error('[Savings Optimizer] Scenario plan data error:', err);
      return baselinePlanData;
    }
  }, [scenarioState, baselinePlanData, needsPct, wantsPct]);

  // Calculate income distribution from scenario plan data
  // Always use scenarioPlanData to show dynamic updates in bar chart as sliders change
  const incomeDistribution = useMemo(() => {
    // Always prefer scenarioPlanData for dynamic updates, fallback to baselinePlanData if needed
    const planToUse = scenarioPlanData || baselinePlanData;
    
    if (!planToUse) {
      console.warn('[Savings Optimizer] No plan data available, using empty distribution');
      return {
        monthlyNeeds: 0,
        monthlyWants: 0,
        monthlySavings: 0,
        needsPct: 0,
        wantsPct: 0,
        savingsPct: 0,
      };
    }

    const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
    
    const needsCategories = planToUse.paycheckCategories.filter(c => 
      c.key === 'essentials' || c.key === 'debt_minimums'
    );
    const wantsCategories = planToUse.paycheckCategories.filter(c => 
      c.key === 'fun_flexible'
    );
    const savingsCategories = planToUse.paycheckCategories.filter(c => 
      c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
    );

    const monthlyNeeds = needsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
    const monthlyWants = wantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
    const monthlySavings = savingsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
    const monthlyTotal = monthlyNeeds + monthlyWants + monthlySavings;

    const calculatedNeedsPct = monthlyTotal > 0 ? (monthlyNeeds / monthlyTotal) * 100 : 0;
    const calculatedWantsPct = monthlyTotal > 0 ? (monthlyWants / monthlyTotal) * 100 : 0;
    const calculatedSavingsPct = monthlyTotal > 0 ? (monthlySavings / monthlyTotal) * 100 : 0;

    console.log('[Savings Optimizer] Recalculating income distribution', {
      sliderNeedsPct: needsPct,
      sliderWantsPct: wantsPct,
      calculatedNeedsPct: calculatedNeedsPct.toFixed(1),
      calculatedWantsPct: calculatedWantsPct.toFixed(1),
      calculatedSavingsPct: calculatedSavingsPct.toFixed(1),
      usingBaseline: planToUse === baselinePlanData,
      paycheckCategoriesCount: planToUse.paycheckCategories.length,
      categories: planToUse.paycheckCategories.map(c => ({ key: c.key, amount: c.amount, label: c.label }))
    });

    return {
      monthlyNeeds,
      monthlyWants,
      monthlySavings,
      needsPct: calculatedNeedsPct,
      wantsPct: calculatedWantsPct,
      savingsPct: calculatedSavingsPct,
    };
  }, [scenarioPlanData, baselinePlanData, baselineState.income?.payFrequency, needsPct, wantsPct]);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Calculate baseline values for comparison
  const baselineIncomeDistribution = useMemo(() => {
    if (!baselinePlanData) return null;
    const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
    const needsCategories = baselinePlanData.paycheckCategories.filter(c => 
      c.key === 'essentials' || c.key === 'debt_minimums'
    );
    const wantsCategories = baselinePlanData.paycheckCategories.filter(c => 
      c.key === 'fun_flexible'
    );
    const savingsCategories = baselinePlanData.paycheckCategories.filter(c => 
      c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
    );
    return {
      monthlyNeeds: needsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth,
      monthlyWants: wantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth,
      monthlySavings: savingsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth,
    };
  }, [baselinePlanData, baselineState.income?.payFrequency]);

  // Calculate confirmation dialog values - use actual plan data values (like rent optimizer)
  const confirmationValues = useMemo(() => {
    if (!baselineIncomeDistribution || !incomeDistribution) return null;
    
    // Use actual values from scenario plan data (incomeDistribution) vs baseline
    const needsDelta = incomeDistribution.monthlyNeeds - baselineIncomeDistribution.monthlyNeeds;
    const wantsDelta = incomeDistribution.monthlyWants - baselineIncomeDistribution.monthlyWants;
    const savingsDelta = incomeDistribution.monthlySavings - baselineIncomeDistribution.monthlySavings;
    
    return {
      needs: {
        current: baselineIncomeDistribution.monthlyNeeds,
        new: incomeDistribution.monthlyNeeds, // Use actual scenario value
        delta: needsDelta,
      },
      wants: {
        current: baselineIncomeDistribution.monthlyWants,
        new: incomeDistribution.monthlyWants, // Use actual scenario value
        delta: wantsDelta,
      },
      savings: {
        current: baselineIncomeDistribution.monthlySavings,
        new: incomeDistribution.monthlySavings, // Use actual scenario value
        delta: savingsDelta,
      },
    };
  }, [baselineIncomeDistribution, incomeDistribution]);

  const handleConfirmApply = () => {
    // Update riskConstraints with new percentages
    if (baselineState.riskConstraints) {
      baselineState.updateRiskConstraints({
        actuals3m: {
          needsPct: needsPct / 100,
          wantsPct: wantsPct / 100,
          savingsPct: savingsPct / 100,
        },
      });
    }
    // Clear initialPaycheckPlan to force recalculation from updated state
    baselineState.setInitialPaycheckPlan(undefined as any); // Cast to any to allow undefined
    
    // Rebuild the plan after state updates
    try {
      const updatedPlanData = buildFinalPlanData(baselineState);
      console.log('[Savings Optimizer] Plan updated successfully:', updatedPlanData);
    } catch (error) {
      console.error('[Savings Optimizer] Error rebuilding plan after update:', error);
    }
    
    setShowConfirmDialog(false);
    router.push('/app/home'); // Navigate to home after applying
  };

  const handleApply = () => {
    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  // Determine if values have changed
  const hasChanged = Math.abs(needsPct - originalNeedsPct) > 0.1 || Math.abs(wantsPct - originalWantsPct) > 0.1;

  if (!baselinePlanData || !scenarioPlanData || !incomeDistribution) {
    return (
      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading optimizer...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { monthlyNeeds, monthlyWants, monthlySavings, needsPct: displayNeedsPct, wantsPct: displayWantsPct, savingsPct: displaySavingsPct } = incomeDistribution;

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Savings Optimization</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-8 w-8"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            {/* Income Distribution */}
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900 dark:text-white">Income Distribution</h2>
                <ArrowRight className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="rounded-lg border bg-white p-4 dark:bg-slate-800">
                {/* Horizontal Bar Chart */}
                <div className="mb-4 h-8 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="flex h-full">
                    <div
                      className="bg-orange-500"
                      style={{ width: `${displayNeedsPct}%` }}
                    />
                    <div
                      className="bg-blue-400"
                      style={{ width: `${displayWantsPct}%` }}
                    />
                    <div
                      className="bg-green-400"
                      style={{ width: `${displaySavingsPct}%` }}
                    />
                  </div>
                </div>
                {/* Legend */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 rounded-full bg-orange-500"></div>
                    <span>Needs ${(monthlyNeeds / 1000).toFixed(1)}K</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 rounded-full bg-blue-400"></div>
                    <span>Wants ${(monthlyWants / 1000).toFixed(1)}K</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 rounded-full bg-green-400"></div>
                    <span>Savings ${(monthlySavings / 1000).toFixed(1)}K</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Needs Slider */}
            <div className="mb-6">
              <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Needs</h2>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Percentage of Income</span>
                    <span className="text-sm font-semibold">{needsPct.toFixed(1)}%</span>
                  </div>
                  <Slider
                    value={[needsPct]}
                    onValueChange={([value]) => {
                      let newNeedsPct = Math.max(0, Math.min(100, value));
                      let newWantsPct = wantsPct;
                      if (newNeedsPct + newWantsPct > 100) {
                        newWantsPct = Math.max(0, 100 - newNeedsPct);
                      }
                      let newSavingsPct = 100 - newNeedsPct - newWantsPct;
                      if (newSavingsPct < 0) {
                        newSavingsPct = 0;
                        newWantsPct = Math.max(0, 100 - newNeedsPct);
                      }
                      setNeedsPct(newNeedsPct);
                      if (newWantsPct !== wantsPct) {
                        setWantsPct(newWantsPct);
                      }
                      if (newSavingsPct !== savingsPct) {
                        setSavingsPct(newSavingsPct);
                      }
                    }}
                    min={0}
                    max={100}
                    step={0.5}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
                    <div className="text-right text-lg font-semibold">
                      ${monthlyNeeds.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Wants Slider */}
            <div className="mb-6">
              <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Wants</h2>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Percentage of Income</span>
                    <span className="text-sm font-semibold">{wantsPct.toFixed(1)}%</span>
                  </div>
                  <Slider
                    value={[wantsPct]}
                    onValueChange={([value]) => {
                      let newWantsPct = Math.max(0, Math.min(100, value));
                      let newNeedsPct = needsPct;
                      if (newNeedsPct + newWantsPct > 100) {
                        newNeedsPct = Math.max(0, 100 - newWantsPct);
                      }
                      let newSavingsPct = 100 - newNeedsPct - newWantsPct;
                      if (newSavingsPct < 0) {
                        newSavingsPct = 0;
                        newNeedsPct = Math.max(0, 100 - newWantsPct);
                      }
                      setWantsPct(newWantsPct);
                      if (newNeedsPct !== needsPct) {
                        setNeedsPct(newNeedsPct);
                      }
                      if (newSavingsPct !== savingsPct) {
                        setSavingsPct(newSavingsPct);
                      }
                    }}
                    min={0}
                    max={100}
                    step={0.5}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
                    <div className="text-right text-lg font-semibold">
                      ${monthlyWants.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Savings (calculated automatically) */}
            <div className="mb-6">
              <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Savings</h2>
              <div className="rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
                <div className="text-right text-lg font-semibold">
                  ${monthlySavings.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                </div>
                <div className="mt-1 text-right text-sm text-slate-600 dark:text-slate-400">
                  {savingsPct.toFixed(1)}% of income
                </div>
              </div>
            </div>

            {/* Wealth Accumulation */}
            <Card>
              <CardHeader>
                <CardTitle>Wealth Accumulation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Net Worth Chart */}
                <div className="overflow-x-auto rounded-lg border bg-white p-4 dark:bg-slate-800">
                  <div className="min-w-0">
                    <NetWorthChart
                      key={`savings-${needsPct}-${wantsPct}`}
                      labels={scenarioPlanData.netWorthChartData.labels}
                      netWorth={scenarioPlanData.netWorthChartData.netWorth}
                      assets={scenarioPlanData.netWorthChartData.assets}
                      liabilities={scenarioPlanData.netWorthChartData.liabilities}
                      baselineNetWorth={hasChanged ? baselinePlanData.netWorthChartData.netWorth : undefined}
                      height={400}
                    />
                  </div>
                </div>

                {/* Key Milestones - always show scenario values with delta from baseline */}
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
            Implement Savings Optimization
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && confirmationValues && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl">Confirm Changes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Please review the changes before applying them to your plan:
              </p>
              
              {/* Changes Summary */}
              <div className="space-y-3 rounded-lg border bg-slate-50 p-4 dark:bg-slate-800">
                {/* Needs */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Needs</h3>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Current:</span>
                    <span className="font-semibold">${confirmationValues.needs.current.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">New:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">${confirmationValues.needs.new.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                  </div>
                  <div className="flex items-center justify-between text-sm border-t pt-2">
                    <span className="text-slate-600 dark:text-slate-400">Change:</span>
                    <span className={`font-semibold ${confirmationValues.needs.delta >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {confirmationValues.needs.delta >= 0 ? '+' : ''}${confirmationValues.needs.delta.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                    </span>
                  </div>
                </div>

                {/* Wants */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Wants</h3>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Current:</span>
                    <span className="font-semibold">${confirmationValues.wants.current.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">New:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">${confirmationValues.wants.new.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                  </div>
                  <div className="flex items-center justify-between text-sm border-t pt-2">
                    <span className="text-slate-600 dark:text-slate-400">Change:</span>
                    <span className={`font-semibold ${confirmationValues.wants.delta >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {confirmationValues.wants.delta >= 0 ? '+' : ''}${confirmationValues.wants.delta.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                    </span>
                  </div>
                </div>

                {/* Savings */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Savings</h3>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Current:</span>
                    <span className="font-semibold">${confirmationValues.savings.current.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">New:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">${confirmationValues.savings.new.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                  </div>
                  <div className="flex items-center justify-between text-sm border-t pt-2">
                    <span className="text-slate-600 dark:text-slate-400">Change:</span>
                    <span className={`font-semibold ${confirmationValues.savings.delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {confirmationValues.savings.delta >= 0 ? '+' : ''}${confirmationValues.savings.delta.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
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

export default function SavingsOptimizerPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading optimizer...
            </p>
          </CardContent>
        </Card>
      </div>
    }>
      <SavingsOptimizerContent />
    </Suspense>
  );
}
