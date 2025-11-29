/**
 * Income Allocator Tool
 * 
 * Helps users understand and adjust their income allocation using
 * the NOW / NEXT / GOAL visualization.
 */

'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { buildFinalPlanData, type FinalPlanData } from '@/lib/onboarding/plan';
import type { OnboardingState } from '@/lib/onboarding/types';
import { computeIncomePlan, type IncomePlanInputs, type IncomePlanResult, type NWSState } from '@/lib/income/computePlan';
import { NWSBars } from '@/components/income/NWSBars';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { X, Info } from 'lucide-react';
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

// Helper to round to 2 decimal places
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function IncomeAllocatorPage() {
  const router = useRouter();
  const state = useOnboardingStore();
  const {
    income,
    fixedExpenses,
    debts,
    riskConstraints,
    updateRiskConstraints,
  } = state;

  // Get current plan data (what's shown in Income tab)
  const planData = usePlanData();

  // Get monthly income - use planData if available (same as Income tab), otherwise calculate from income
  const monthlyIncome = useMemo(() => {
    if (planData?.paycheckAmount) {
      const paychecksPerMonth = getPaychecksPerMonth(income?.payFrequency || 'biweekly');
      return planData.paycheckAmount * paychecksPerMonth;
    }
    if (!income?.netIncome$) return 0;
    const paychecksPerMonth = getPaychecksPerMonth(income.payFrequency || 'biweekly');
    return income.netIncome$ * paychecksPerMonth;
  }, [planData, income]);

  // Calculate actuals - prefer riskConstraints.actuals3m if available, otherwise calculate from expenses
  const actuals = useMemo(() => {
    // If we have actuals3m from riskConstraints (e.g., from Plaid), use those
    if (riskConstraints?.actuals3m) {
      const a = riskConstraints.actuals3m;
      // Normalize if needed (might be in percentage format)
      const sum = a.needsPct + a.wantsPct + a.savingsPct;
      let needsPct: number;
      let wantsPct: number;
      let savingsPct: number;
      
      if (Math.abs(sum - 100) < 1 && Math.abs(sum - 1.0) > 0.1) {
        // Convert from percentage format (50, 30, 20) to decimal (0.5, 0.3, 0.2)
        needsPct = round2(a.needsPct / 100);
        wantsPct = round2(a.wantsPct / 100);
        savingsPct = round2(a.savingsPct / 100);
      } else {
        // Already in decimal format, normalize to sum to 1.0
        needsPct = round2(a.needsPct / sum);
        wantsPct = round2(a.wantsPct / sum);
        savingsPct = round2(a.savingsPct / sum);
      }
      
      // Ensure exact sum to 1.0
      const finalSum = needsPct + wantsPct + savingsPct;
      if (Math.abs(finalSum - 1.0) > 0.0001) {
        const diff = round2(1.0 - finalSum);
        // Adjust wants to make it exactly 1.0 (preserve savings)
        wantsPct = round2(wantsPct + diff);
      }
      
      return {
        needsPct: round2(needsPct),
        wantsPct: round2(wantsPct),
        savingsPct: round2(savingsPct),
      };
    }

    // Otherwise calculate from expenses and debts
    if (!monthlyIncome || monthlyIncome === 0) {
      return { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 };
    }

    // Calculate needs from expenses
    const needsExpenses = fixedExpenses
      .filter(e => e.category === 'needs' || !e.category)
      .reduce((sum, exp) => {
        let monthly = exp.amount$;
        if (exp.frequency === 'weekly') monthly = exp.amount$ * 4.33;
        else if (exp.frequency === 'biweekly') monthly = exp.amount$ * 2.17;
        else if (exp.frequency === 'semimonthly') monthly = exp.amount$ * 2;
        else if (exp.frequency === 'yearly') monthly = exp.amount$ / 12;
        return sum + monthly;
      }, 0);

    // Add debt minimum payments
    const debtMinPayments = debts.reduce((sum, d) => {
      const monthly = d.minPayment$ * getPaychecksPerMonth(income?.payFrequency || 'biweekly');
      return sum + monthly;
    }, 0);

    const totalNeeds = needsExpenses + debtMinPayments;

    // Calculate wants from expenses
    const wantsExpenses = fixedExpenses
      .filter(e => e.category === 'wants')
      .reduce((sum, exp) => {
        let monthly = exp.amount$;
        if (exp.frequency === 'weekly') monthly = exp.amount$ * 4.33;
        else if (exp.frequency === 'biweekly') monthly = exp.amount$ * 2.17;
        else if (exp.frequency === 'semimonthly') monthly = exp.amount$ * 2;
        else if (exp.frequency === 'yearly') monthly = exp.amount$ / 12;
        return sum + monthly;
      }, 0);

    // Calculate raw percentages
    const rawNeedsPct = totalNeeds / monthlyIncome;
    const rawWantsPct = wantsExpenses / monthlyIncome;
    const rawSavingsPct = Math.max(0, 1 - rawNeedsPct - rawWantsPct);

    // Ensure they sum to exactly 1.0 by adjusting wants (never touch savings if it's positive)
    const sum = rawNeedsPct + rawWantsPct + rawSavingsPct;
    let needsPct = rawNeedsPct;
    let wantsPct = rawWantsPct;
    let savingsPct = rawSavingsPct;

    if (Math.abs(sum - 1.0) > 0.001) {
      // Normalize, but preserve savings if it's positive
      if (rawSavingsPct > 0) {
        savingsPct = rawSavingsPct;
        needsPct = rawNeedsPct;
        wantsPct = round2(1.0 - savingsPct - needsPct);
      } else {
        // If savings is 0 or negative, normalize all
        needsPct = round2(rawNeedsPct / sum);
        wantsPct = round2(rawWantsPct / sum);
        savingsPct = round2(rawSavingsPct / sum);
      }
    }

    // Final validation - ensure exact sum to 1.0
    const finalSum = needsPct + wantsPct + savingsPct;
    if (Math.abs(finalSum - 1.0) > 0.0001) {
      const diff = round2(1.0 - finalSum);
      // Adjust wants to make it exactly 1.0 (never touch savings)
      wantsPct = round2(wantsPct + diff);
    }

    return {
      needsPct: round2(needsPct),
      wantsPct: round2(wantsPct),
      savingsPct: round2(savingsPct),
    };
  }, [fixedExpenses, debts, monthlyIncome, income?.payFrequency, riskConstraints?.actuals3m]);

  // Get targets from riskConstraints or use defaults
  const defaultTargets = { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 };
  const storedTargets = riskConstraints?.targets || defaultTargets;
  
  // Normalize targets if they're in percentage format (50, 30, 20)
  const targetSum = storedTargets.needsPct + storedTargets.wantsPct + storedTargets.savingsPct;
  const normalizedTargets = useMemo(() => {
    if (Math.abs(targetSum - 100) < 1 && Math.abs(targetSum - 1.0) > 0.1) {
      return {
        needsPct: storedTargets.needsPct / 100,
        wantsPct: storedTargets.wantsPct / 100,
        savingsPct: storedTargets.savingsPct / 100,
      };
    }
    return storedTargets;
  }, [storedTargets, targetSum]);

  // Slider state for targets
  const [targetNeedsPct, setTargetNeedsPct] = useState(normalizedTargets.needsPct * 100);
  const [targetWantsPct, setTargetWantsPct] = useState(normalizedTargets.wantsPct * 100);
  const [targetSavingsPct, setTargetSavingsPct] = useState(normalizedTargets.savingsPct * 100);

  // Update sliders when normalized targets change
  useEffect(() => {
    setTargetNeedsPct(normalizedTargets.needsPct * 100);
    setTargetWantsPct(normalizedTargets.wantsPct * 100);
    setTargetSavingsPct(normalizedTargets.savingsPct * 100);
  }, [normalizedTargets]);

  // Store original target values for comparison
  const [originalTargetNeedsPct, setOriginalTargetNeedsPct] = useState(normalizedTargets.needsPct * 100);
  const [originalTargetWantsPct, setOriginalTargetWantsPct] = useState(normalizedTargets.wantsPct * 100);
  const [originalTargetSavingsPct, setOriginalTargetSavingsPct] = useState(normalizedTargets.savingsPct * 100);

  useEffect(() => {
    setOriginalTargetNeedsPct(normalizedTargets.needsPct * 100);
    setOriginalTargetWantsPct(normalizedTargets.wantsPct * 100);
    setOriginalTargetSavingsPct(normalizedTargets.savingsPct * 100);
  }, [normalizedTargets]);

  // Build scenario state with updated targets (for net worth calculation)
  const scenarioState = useMemo((): OnboardingState => {
    const targetsFromSliders = {
      needsPct: targetNeedsPct / 100,
      wantsPct: targetWantsPct / 100,
      savingsPct: targetSavingsPct / 100,
    };
    
    return {
      ...state,
      fixedExpenses: [...state.fixedExpenses],
      plaidConnected: state.plaidConnected,
      riskConstraints: state.riskConstraints ? {
        ...state.riskConstraints,
        targets: targetsFromSliders,
        // Update actuals3m to match targets for net worth calculation
        actuals3m: {
          needsPct: targetsFromSliders.needsPct,
          wantsPct: targetsFromSliders.wantsPct,
          savingsPct: targetsFromSliders.savingsPct,
        },
      } : {
        shiftLimitPct: 0.04,
        targets: targetsFromSliders,
        actuals3m: targetsFromSliders,
      },
      initialPaycheckPlan: undefined, // Force recalculation
    };
  }, [state, targetNeedsPct, targetWantsPct, targetSavingsPct]);

  // Calculate scenario plan data with updated targets
  const scenarioPlanData = useMemo(() => {
    try {
      const plan = buildFinalPlanData(scenarioState);
      console.log('[Income Allocator] Scenario plan calculated with new targets', {
        targetNeedsPct,
        targetWantsPct,
        targetSavingsPct,
        netWorthDataPoints: plan.netWorthChartData.netWorth.length,
      });
      return plan;
    } catch (err) {
      console.error('[Income Allocator] Scenario plan data error:', err);
      return planData ?? null;
    }
  }, [scenarioState, planData, targetNeedsPct, targetWantsPct, targetSavingsPct]);

  // Check if targets have changed
  const hasChanged = useMemo(() => {
    return Math.abs(targetNeedsPct - originalTargetNeedsPct) > 0.1 ||
           Math.abs(targetWantsPct - originalTargetWantsPct) > 0.1 ||
           Math.abs(targetSavingsPct - originalTargetSavingsPct) > 0.1;
  }, [targetNeedsPct, targetWantsPct, targetSavingsPct, originalTargetNeedsPct, originalTargetWantsPct, originalTargetSavingsPct]);

  // Get shift limit from riskConstraints
  const shiftLimitPct = riskConstraints?.shiftLimitPct || 0.04;

  // Get current plan (what's shown in Income tab) - this is "This Plan"
  // Use the EXACT same calculation as Income tab (source of truth)
  const currentPlan = useMemo<NWSState | null>(() => {
    if (!planData || !monthlyIncome || monthlyIncome === 0) return null;

    const paychecksPerMonth = getPaychecksPerMonth(income?.payFrequency || 'biweekly');
    
    // Extract Needs, Wants, Savings from current plan - same as Income tab
    const needsCategories = planData.paycheckCategories.filter(c => 
      c.key === 'essentials' || c.key === 'debt_minimums'
    );
    const wantsCategories = planData.paycheckCategories.filter(c => 
      c.key === 'fun_flexible'
    );
    const savingsCategories = planData.paycheckCategories.filter(c => 
      c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
    );

    // Calculate monthly amounts - same as Income tab
    const monthlyNeeds = needsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
    const monthlyWants = wantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
    const monthlySavings = savingsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;

    // Use monthlyIncome (take home pay) for percentages - same as Income tab uses for the chart
    // The Income tab uses takeHomePay for the chart display
    const needsPct = monthlyNeeds / monthlyIncome;
    const wantsPct = monthlyWants / monthlyIncome;
    const savingsPct = monthlySavings / monthlyIncome;

    console.log('[Income Allocator] Current plan from planData:', {
      monthlyNeeds,
      monthlyWants,
      monthlySavings,
      monthlyIncome,
      needsPct,
      wantsPct,
      savingsPct,
      sum: needsPct + wantsPct + savingsPct,
    });

    return {
      needsPct: round2(needsPct),
      wantsPct: round2(wantsPct),
      savingsPct: round2(savingsPct),
      income$: monthlyIncome,
    };
  }, [planData, monthlyIncome, income?.payFrequency]);

  // "This Plan" should be the current plan from Income tab (source of truth)
  // Don't compute a recommendation - just use the current plan directly
  const recommendedPlan = currentPlan;

  // Build the result with NOW (actuals), NEXT (recommended plan preserving savings), and GOAL (targets)
  const planResult = useMemo<IncomePlanResult | null>(() => {
    if (!monthlyIncome || monthlyIncome === 0 || !recommendedPlan) return null;

    const goal: NWSState = {
      needsPct: targetNeedsPct / 100,
      wantsPct: targetWantsPct / 100,
      savingsPct: targetSavingsPct / 100,
      income$: monthlyIncome,
    };

    // Generate notes explaining the current plan
    const notes: string[] = [];
    
    notes.push(`This Plan shows your current active income allocation as displayed in the Income tab.`);
    
    if (recommendedPlan) {
      const savingsDelta = (recommendedPlan.savingsPct - actuals.savingsPct) * 100;
      if (Math.abs(savingsDelta) > 0.1) {
        if (savingsDelta > 0) {
          notes.push(`Your current plan has ${Math.round(savingsDelta)} percentage points more savings than your actual spending.`);
        } else {
          notes.push(`Your current plan has ${Math.round(Math.abs(savingsDelta))} percentage points less savings than your actual spending.`);
        }
      }
    }

    return {
      now: {
        needsPct: actuals.needsPct,
        wantsPct: actuals.wantsPct,
        savingsPct: actuals.savingsPct,
        income$: monthlyIncome,
      },
      next: recommendedPlan, // Use recommended plan that preserves savings
      goal,
      notes,
    };
  }, [monthlyIncome, actuals, recommendedPlan, currentPlan, targetNeedsPct, targetWantsPct, targetSavingsPct]);

  const handleTargetChange = (
    category: 'needs' | 'wants' | 'savings',
    value: number
  ) => {
    if (category === 'needs') {
      const newNeeds = Math.max(0, Math.min(100, value));
      const remaining = 100 - newNeeds;
      const otherTotal = targetWantsPct + targetSavingsPct;
      
      if (otherTotal > 0 && remaining > 0) {
        const wantsRatio = targetWantsPct / otherTotal;
        const savingsRatio = targetSavingsPct / otherTotal;
        setTargetNeedsPct(newNeeds);
        setTargetWantsPct(remaining * wantsRatio);
        setTargetSavingsPct(remaining * savingsRatio);
      } else {
        setTargetNeedsPct(newNeeds);
        setTargetWantsPct(remaining / 2);
        setTargetSavingsPct(remaining / 2);
      }
    } else if (category === 'wants') {
      const newWants = Math.max(0, Math.min(100, value));
      const newSavings = Math.max(0, 100 - targetNeedsPct - newWants);
      setTargetWantsPct(newWants);
      setTargetSavingsPct(newSavings);
    } else if (category === 'savings') {
      const newSavings = Math.max(0, Math.min(100, value));
      const newWants = Math.max(0, 100 - targetNeedsPct - newSavings);
      setTargetWantsPct(newWants);
      setTargetSavingsPct(newSavings);
    }
  };

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleApply = () => {
    // Show confirmation dialog instead of directly applying
    setShowConfirmDialog(true);
  };

  const handleConfirmApply = () => {
    const savedDistribution = {
      needsPct: targetNeedsPct / 100,
      wantsPct: targetWantsPct / 100,
      savingsPct: targetSavingsPct / 100,
    };

    // Update riskConstraints with new distribution
    // Set both targets AND actuals3m to the same values so the engine treats it as final (no shifting)
    // Set bypassWantsFloor=true to preserve exact values without normalization
    updateRiskConstraints({
      targets: savedDistribution,
      actuals3m: savedDistribution, // Set to match targets so engine returns as-is
      bypassWantsFloor: true, // Preserve exact values
    });
    
    // Clear initial paycheck plan to force recalculation
    state.setInitialPaycheckPlan(undefined as any);
    
    // Close dialog and navigate
    setShowConfirmDialog(false);
    router.push('/app/income'); // Navigate to Income tab to see the changes
  };

  if (!monthlyIncome || monthlyIncome === 0) {
    return (
      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Income information is required. Please complete the onboarding process.
            </p>
            <Button
              onClick={() => router.push('/onboarding/income')}
              className="mt-4"
              variant="outline"
            >
              Go to Income Step
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!planResult) {
    return (
      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Unable to compute income plan. Please check your information.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Income Allocation</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Compare your actual spending (Today), your current active plan (This Plan), and your target allocation (Goal)
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-8 w-8"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* NOW / NEXT / GOAL Visualization */}
          <Card>
            <CardHeader>
              <CardTitle>Your Income Allocation</CardTitle>
              <CardDescription>
                Monthly income: ${monthlyIncome.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NWSBars
                now={planResult.now}
                next={planResult.next}
                goal={planResult.goal}
              />
            </CardContent>
          </Card>

          {/* Target Sliders */}
          <Card>
            <CardHeader>
              <CardTitle>Adjust Your Goal</CardTitle>
              <CardDescription>
                Set your target allocation percentages. The plan will adjust gradually toward these goals.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Needs Slider */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Needs
                  </span>
                  <span className="text-sm font-semibold">{targetNeedsPct.toFixed(1)}%</span>
                </div>
                <Slider
                  value={[targetNeedsPct]}
                  onValueChange={([value]) => handleTargetChange('needs', value)}
                  min={0}
                  max={100}
                  step={0.5}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Essential expenses like rent, utilities, groceries, and debt payments
                </p>
              </div>

              {/* Wants Slider */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Wants
                  </span>
                  <span className="text-sm font-semibold">{targetWantsPct.toFixed(1)}%</span>
                </div>
                <Slider
                  value={[targetWantsPct]}
                  onValueChange={([value]) => handleTargetChange('wants', value)}
                  min={0}
                  max={100}
                  step={0.5}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Discretionary spending for fun, dining out, and lifestyle choices
                </p>
              </div>

              {/* Savings Slider */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Savings
                  </span>
                  <span className="text-sm font-semibold">{targetSavingsPct.toFixed(1)}%</span>
                </div>
                <Slider
                  value={[targetSavingsPct]}
                  onValueChange={([value]) => handleTargetChange('savings', value)}
                  min={0}
                  max={100}
                  step={0.5}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Money set aside for emergencies, debt payoff, retirement, and future goals
                </p>
              </div>

              {/* Total Validation */}
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Total
                  </span>
                  <span className={`text-sm font-semibold ${
                    Math.abs(targetNeedsPct + targetWantsPct + targetSavingsPct - 100) > 0.1
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-900 dark:text-white'
                  }`}>
                    {(targetNeedsPct + targetWantsPct + targetSavingsPct).toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Net Worth Chart */}
          {scenarioPlanData && (
            <Card>
              <CardHeader>
                <CardTitle>Wealth Accumulation</CardTitle>
                <CardDescription>
                  Projected net worth based on your goal allocation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Net Worth Chart */}
                <div className="overflow-x-auto rounded-lg border bg-white p-4 dark:bg-slate-800">
                  <div className="min-w-0">
                    <NetWorthChart
                      key={`income-allocator-${targetNeedsPct}-${targetWantsPct}-${targetSavingsPct}`}
                      labels={scenarioPlanData.netWorthChartData.labels}
                      netWorth={scenarioPlanData.netWorthChartData.netWorth}
                      assets={scenarioPlanData.netWorthChartData.assets}
                      liabilities={scenarioPlanData.netWorthChartData.liabilities}
                      baselineNetWorth={hasChanged && planData ? planData.netWorthChartData.netWorth : undefined}
                      height={400}
                    />
                  </div>
                </div>

                {/* Net Worth Projections */}
                {scenarioPlanData.netWorthProjection && (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {scenarioPlanData.netWorthProjection.map((projection) => {
                      const baselineValue = planData?.netWorthProjection.find(p => p.label === projection.label)?.value || 0;
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
                )}
              </CardContent>
            </Card>
          )}

          {/* Explanation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Understanding Your Allocation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <div>
                  <p className="font-medium mb-1">Today (Actuals):</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Your actual spending over the last 3 months: {Math.round(actuals.needsPct * 100)}% Needs, {Math.round(actuals.wantsPct * 100)}% Wants, 
                    and {Math.round(actuals.savingsPct * 100)}% Savings.
                  </p>
                </div>
                <div>
                  <p className="font-medium mb-1">This Plan (Current Active Plan):</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Your current active income allocation plan as shown in the Income tab: {Math.round(planResult.next.needsPct * 100)}% Needs, {Math.round(planResult.next.wantsPct * 100)}% Wants, 
                    and {Math.round(planResult.next.savingsPct * 100)}% Savings.
                  </p>
                </div>
                <div>
                  <p className="font-medium mb-1">Goal (Target):</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Your target allocation: {Math.round(targetNeedsPct)}% Needs, {Math.round(targetWantsPct)}% Wants, 
                    and {Math.round(targetSavingsPct)}% Savings. Adjust the sliders above to change your goals.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Apply Button */}
      <div className="border-t bg-background px-4 py-4">
        <div className="mx-auto max-w-4xl">
          <Button
            onClick={handleApply}
            className="w-full bg-green-600 text-white hover:bg-green-700"
            size="lg"
          >
            Update Goals
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl">Confirm Goal Changes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Please review your new target allocation goals before applying them:
              </p>
              
              {/* Changes Summary */}
              {currentPlan && (
                <div className="space-y-3 rounded-lg border bg-slate-50 p-4 dark:bg-slate-800">
                  {/* Needs */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Needs</h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Current Plan:</span>
                      <span className="font-semibold">{Math.round(currentPlan.needsPct * 100)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">New Plan:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">{targetNeedsPct.toFixed(1)}%</span>
                    </div>
                    {Math.abs(targetNeedsPct - currentPlan.needsPct * 100) > 0.1 && (
                      <div className="flex items-center justify-between text-sm border-t pt-2">
                        <span className="text-slate-600 dark:text-slate-400">Change:</span>
                        <span className={`font-semibold ${(targetNeedsPct - currentPlan.needsPct * 100) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {(targetNeedsPct - currentPlan.needsPct * 100) >= 0 ? '+' : ''}{(targetNeedsPct - currentPlan.needsPct * 100).toFixed(1)} pp
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Wants */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Wants</h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Current Plan:</span>
                      <span className="font-semibold">{Math.round(currentPlan.wantsPct * 100)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">New Plan:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">{targetWantsPct.toFixed(1)}%</span>
                    </div>
                    {Math.abs(targetWantsPct - currentPlan.wantsPct * 100) > 0.1 && (
                      <div className="flex items-center justify-between text-sm border-t pt-2">
                        <span className="text-slate-600 dark:text-slate-400">Change:</span>
                        <span className={`font-semibold ${(targetWantsPct - currentPlan.wantsPct * 100) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {(targetWantsPct - currentPlan.wantsPct * 100) >= 0 ? '+' : ''}{(targetWantsPct - currentPlan.wantsPct * 100).toFixed(1)} pp
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Savings */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Savings</h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Current Plan:</span>
                      <span className="font-semibold">{Math.round(currentPlan.savingsPct * 100)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">New Plan:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">{targetSavingsPct.toFixed(1)}%</span>
                    </div>
                    {Math.abs(targetSavingsPct - currentPlan.savingsPct * 100) > 0.1 && (
                      <div className="flex items-center justify-between text-sm border-t pt-2">
                        <span className="text-slate-600 dark:text-slate-400">Change:</span>
                        <span className={`font-semibold ${(targetSavingsPct - currentPlan.savingsPct * 100) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {(targetSavingsPct - currentPlan.savingsPct * 100) >= 0 ? '+' : ''}{(targetSavingsPct - currentPlan.savingsPct * 100).toFixed(1)} pp
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400">
                These changes will update your income allocation plan. The new plan will be applied immediately and will show in the Income tab.
              </p>

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
                  Confirm & Update Goals
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

