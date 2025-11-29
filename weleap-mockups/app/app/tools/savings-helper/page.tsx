/**
 * Savings Helper Tool
 * 
 * Combines Income Allocator and Savings Optimizer to help users understand
 * how much they can save. Shows three bar graphs comparing actuals, current plan,
 * and recommended distribution, plus interactive sliders to adjust Needs/Wants.
 */

'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { buildFinalPlanData, type FinalPlanData } from '@/lib/onboarding/plan';
import { computeIncomePlan } from '@/lib/income/computePlan';
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

function SavingsHelperContent() {
  const router = useRouter();
  const baselineState = useOnboardingStore();
  
  // Get baseline plan data - must call hooks unconditionally
  const baselinePlanData = usePlanData();

  // Calculate monthly income - must be computed before any conditional returns
  const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
  const monthlyIncome = baselinePlanData?.paycheckAmount ? baselinePlanData.paycheckAmount * paychecksPerMonth : 0;

  // All hooks must be called unconditionally, before any early returns
  // Get actuals from 3 months (actuals3m) - this is the first bar graph
  // CRITICAL: This MUST reflect ACTUAL 3-month average spending from expenses, NOT the current plan
  // Always calculate from expenses to ensure accuracy - never use stored values
  const actuals3m = useMemo(() => {
    // ALWAYS calculate from actual expenses to ensure we get the true 3-month average
    // IGNORE stored actuals3m - it may contain incorrect values from the current plan
    console.log('[Savings Helper] Calculating actuals3m from expenses (ignoring stored values)', {
      fixedExpensesCount: baselineState.fixedExpenses.length,
      debtsCount: baselineState.debts.length,
    });
    const incomeAmount = baselineState.income?.netIncome$ || baselineState.income?.grossIncome$ || 0;
    const payFrequency = baselineState.income?.payFrequency || 'biweekly';
    const incomePeriod$ = incomeAmount;
    
    // Calculate monthly income
    const monthlyIncomeCalc = incomeAmount * paychecksPerMonth;
    
    if (!monthlyIncomeCalc || monthlyIncomeCalc <= 0) {
      return { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 };
    }
    
    // Calculate from actual expenses
    let needsTotal = 0;
    let wantsTotal = 0;
    
    // Add expenses
    for (const expense of baselineState.fixedExpenses) {
      let monthlyAmount = expense.amount$;
      // Convert to monthly if needed
      if (expense.frequency === 'weekly') {
        monthlyAmount = expense.amount$ * 4.33;
      } else if (expense.frequency === 'biweekly') {
        monthlyAmount = expense.amount$ * 2.17;
      } else if (expense.frequency === 'semimonthly') {
        monthlyAmount = expense.amount$ * 2;
      } else if (expense.frequency === 'yearly') {
        monthlyAmount = expense.amount$ / 12;
      }
      
      if (expense.category === 'needs') {
        needsTotal += monthlyAmount;
      } else if (expense.category === 'wants') {
        wantsTotal += monthlyAmount;
      } else {
        // Default to needs if category not specified
        needsTotal += monthlyAmount;
      }
    }
    
    // Add debt minimum payments to needs
    if (baselineState.debts && baselineState.debts.length > 0) {
      const totalDebtMinPayments$ = baselineState.debts.reduce((sum, d) => sum + d.minPayment$, 0);
      // Debt payments are per-paycheck, convert to monthly
      const monthlyDebtMinPayments = totalDebtMinPayments$ * paychecksPerMonth;
      needsTotal += monthlyDebtMinPayments;
    }
    
    // Calculate percentages from actual expenses
    const needsPct = Math.max(needsTotal / monthlyIncomeCalc, 0);
    const wantsPct = Math.max(wantsTotal / monthlyIncomeCalc, 0);
    const savingsPct = Math.max((monthlyIncomeCalc - needsTotal - wantsTotal) / monthlyIncomeCalc, 0);
    
    // Validate and normalize
    const sum = needsPct + wantsPct + savingsPct;
    if (sum <= 0 || !isFinite(sum) || sum > 1.01) {
      // If calculation fails, use default fallback
      return { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 };
    }
    
    // Normalize to sum to 1.0
    if (Math.abs(sum - 1.0) > 0.001) {
      return {
        needsPct: needsPct / sum,
        wantsPct: wantsPct / sum,
        savingsPct: savingsPct / sum,
      };
    }
    
    return {
      needsPct,
      wantsPct,
      savingsPct,
    };
  }, [baselineState.fixedExpenses, baselineState.debts, baselineState.income, paychecksPerMonth]);

  // Current plan distribution (baseline plan) - this is the second bar graph
  const currentPlan = useMemo(() => {
    if (!baselinePlanData || !baselinePlanData.paycheckCategories) {
      return { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 };
    }
    const needsCategories = baselinePlanData.paycheckCategories.filter(c => 
      c.key === 'essentials' || c.key === 'debt_minimums'
    );
    const wantsCategories = baselinePlanData.paycheckCategories.filter(c => 
      c.key === 'fun_flexible'
    );
    const savingsCategories = baselinePlanData.paycheckCategories.filter(c => 
      c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
    );
    const monthlyNeeds = needsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
    const monthlyWants = wantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
    const monthlySavings = savingsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
    const total = monthlyNeeds + monthlyWants + monthlySavings;
    if (total > 0) {
      return {
        needsPct: monthlyNeeds / total,
        wantsPct: monthlyWants / total,
        savingsPct: monthlySavings / total,
      };
    }
    return { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 };
  }, [baselinePlanData, paychecksPerMonth]);

  // Get targets for recommended distribution
  // Use saved targets if they exist, otherwise default to standard 50/30/20
  const savedTargets = baselineState.riskConstraints?.targets;
  // Normalize shiftLimitPct: convert from percentage (4.0) to decimal (0.04) if needed
  let shiftLimitPct = baselineState.riskConstraints?.shiftLimitPct || 0.04;
  if (shiftLimitPct > 1) {
    shiftLimitPct = shiftLimitPct / 100; // Convert 4.0 to 0.04
  }

  // Recommended plan should optimize toward standard target (50/30/20) to show improvement opportunity
  // Saved targets represent user preferences, but recommended should show optimal allocation
  const standardTargets = {
    needsPct: 0.5,
    wantsPct: 0.3,
    savingsPct: 0.2,
  };

  // Calculate recommended distribution using computeIncomePlan - this is the third bar graph
  // Recommended plan starts from CURRENT PLAN and adjusts toward standard targets (50/30/20)
  const recommendedPlan = useMemo(() => {
    if (!baselinePlanData || monthlyIncome === 0) {
      return { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 };
    }
    try {
      console.log('[Savings Helper] Computing recommended plan:', {
        currentPlan: {
          needs: currentPlan.needsPct * 100,
          wants: currentPlan.wantsPct * 100,
          savings: currentPlan.savingsPct * 100,
        },
        standardTargets: {
          needs: standardTargets.needsPct * 100,
          wants: standardTargets.wantsPct * 100,
          savings: standardTargets.savingsPct * 100,
        },
        shiftLimitPct: shiftLimitPct * 100,
        savingsGap: (standardTargets.savingsPct - currentPlan.savingsPct) * 100,
      });
      
      const result = computeIncomePlan({
        income$: monthlyIncome,
        actualNeedsPct: currentPlan.needsPct,
        actualWantsPct: currentPlan.wantsPct,
        actualSavingsPct: currentPlan.savingsPct,
        targetNeedsPct: standardTargets.needsPct,
        targetWantsPct: standardTargets.wantsPct,
        targetSavingsPct: standardTargets.savingsPct,
        shiftLimitPct,
      });
      
      console.log('[Savings Helper] computeIncomePlan result:', {
        next: {
          needs: result.next.needsPct * 100,
          wants: result.next.wantsPct * 100,
          savings: result.next.savingsPct * 100,
        },
        actualShift: (result.next.savingsPct - currentPlan.savingsPct) * 100,
        shiftLimit: shiftLimitPct * 100,
        notes: result.notes,
      });
      
      const recommended = {
        needsPct: result.next.needsPct,
        wantsPct: result.next.wantsPct,
        savingsPct: result.next.savingsPct,
      };
      
      // CRITICAL: Verify shift limit is respected and enforce it if violated
      const actualShift = recommended.savingsPct - currentPlan.savingsPct;
      
      // Always enforce shift limit - cap if exceeded
      if (actualShift > shiftLimitPct + 0.001) {
        console.error('[Savings Helper] ERROR: Recommended plan violates shift limit! Capping...', {
          currentPlan: {
            needs: currentPlan.needsPct * 100,
            wants: currentPlan.wantsPct * 100,
            savings: currentPlan.savingsPct * 100,
          },
          recommendedBeforeCap: {
            needs: recommended.needsPct * 100,
            wants: recommended.wantsPct * 100,
            savings: recommended.savingsPct * 100,
          },
          actualShift: actualShift * 100,
          shiftLimitPct: shiftLimitPct * 100,
          standardTargets: {
            needs: standardTargets.needsPct * 100,
            wants: standardTargets.wantsPct * 100,
            savings: standardTargets.savingsPct * 100,
          },
        });
        
        // Force cap at shift limit: savings can only increase by shiftLimitPct
        const cappedSavingsPct = Math.min(
          currentPlan.savingsPct + shiftLimitPct, // Max allowed savings
          standardTargets.savingsPct // But don't exceed target
        );
        const cappedWantsPct = Math.max(0, currentPlan.wantsPct - (cappedSavingsPct - currentPlan.savingsPct));
        const cappedNeedsPct = currentPlan.needsPct; // Keep needs fixed
        
        // Normalize to ensure sum = 1.0
        const sum = cappedNeedsPct + cappedWantsPct + cappedSavingsPct;
        let finalNeeds = cappedNeedsPct;
        let finalWants = cappedWantsPct;
        let finalSavings = cappedSavingsPct;
        
        if (Math.abs(sum - 1.0) > 0.001) {
          const diff = 1.0 - sum;
          // Adjust wants to make sum = 1.0
          finalWants = Math.max(0, cappedWantsPct + diff);
        }
        
        const cappedRecommended = {
          needsPct: finalNeeds,
          wantsPct: finalWants,
          savingsPct: finalSavings,
        };
        
        console.log('[Savings Helper] Capped recommended plan to respect shift limit:', {
          cappedRecommended: {
            needs: cappedRecommended.needsPct * 100,
            wants: cappedRecommended.wantsPct * 100,
            savings: cappedRecommended.savingsPct * 100,
          },
          actualShiftAfterCap: (cappedRecommended.savingsPct - currentPlan.savingsPct) * 100,
          shiftLimit: shiftLimitPct * 100,
        });
        
        return cappedRecommended;
      }
      
      return recommended;
    } catch (error) {
      console.error('[Savings Helper] Error computing recommended plan:', error);
      return currentPlan;
    }
  }, [currentPlan, shiftLimitPct, monthlyIncome, baselinePlanData]);

  // Slider state - initialize with recommended plan
  const [needsPct, setNeedsPct] = useState(recommendedPlan.needsPct * 100);
  const [wantsPct, setWantsPct] = useState(recommendedPlan.wantsPct * 100);
  const [savingsPct, setSavingsPct] = useState(recommendedPlan.savingsPct * 100);

  // Update sliders when recommended plan changes
  useEffect(() => {
    setNeedsPct(recommendedPlan.needsPct * 100);
    setWantsPct(recommendedPlan.wantsPct * 100);
    setSavingsPct(recommendedPlan.savingsPct * 100);
  }, [recommendedPlan]);

  // Build scenario state with adjusted percentages
  const scenarioState = useMemo((): OnboardingState => {
    const actuals3mNeedsPct = needsPct / 100;
    const actuals3mWantsPct = wantsPct / 100;
    const actuals3mSavingsPct = savingsPct / 100;
    const targetsFromSliders = {
      needsPct: actuals3mNeedsPct,
      wantsPct: actuals3mWantsPct,
      savingsPct: actuals3mSavingsPct,
    };
    
    return {
      ...baselineState,
      fixedExpenses: [...baselineState.fixedExpenses],
      plaidConnected: baselineState.plaidConnected,
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
      initialPaycheckPlan: undefined,
    };
  }, [baselineState, needsPct, wantsPct, savingsPct]);

  // Calculate scenario plan data
  const scenarioPlanData = useMemo(() => {
    if (!baselinePlanData || !scenarioState) return null;
    try {
      const plan = buildFinalPlanData(scenarioState);
      const scenarioPaychecksPerMonth = getPaychecksPerMonth(scenarioState.income?.payFrequency || 'biweekly');
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
      
      return plan;
    } catch (err) {
      console.error('[Savings Helper] Scenario plan data error:', err);
      return baselinePlanData;
    }
  }, [scenarioState, baselinePlanData, needsPct, wantsPct, monthlyIncome]);

  // Calculate income distribution from scenario plan - MUST be before early returns
  const incomeDistribution = useMemo(() => {
    const planToUse = scenarioPlanData || baselinePlanData;
    if (!planToUse) {
      return {
        monthlyNeeds: 0,
        monthlyWants: 0,
        monthlySavings: 0,
        needsPct: 0,
        wantsPct: 0,
        savingsPct: 0,
      };
    }

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

    return {
      monthlyNeeds,
      monthlyWants,
      monthlySavings,
      needsPct: calculatedNeedsPct,
      wantsPct: calculatedWantsPct,
      savingsPct: calculatedSavingsPct,
    };
  }, [scenarioPlanData, baselinePlanData, paychecksPerMonth]);

  // Calculate confirmation dialog values - use actual plan data values (MUST be before early returns)
  const confirmationValues = useMemo(() => {
    if (!baselinePlanData || !scenarioPlanData || !incomeDistribution) return null;
    
    // Calculate baseline income distribution
    const baselinePaychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
    const baselineNeedsCategories = baselinePlanData.paycheckCategories.filter(c => 
      c.key === 'essentials' || c.key === 'debt_minimums'
    );
    const baselineWantsCategories = baselinePlanData.paycheckCategories.filter(c => 
      c.key === 'fun_flexible'
    );
    const baselineSavingsCategories = baselinePlanData.paycheckCategories.filter(c => 
      c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
    );
    const baselineMonthlyNeeds = baselineNeedsCategories.reduce((sum, c) => sum + c.amount, 0) * baselinePaychecksPerMonth;
    const baselineMonthlyWants = baselineWantsCategories.reduce((sum, c) => sum + c.amount, 0) * baselinePaychecksPerMonth;
    const baselineMonthlySavings = baselineSavingsCategories.reduce((sum, c) => sum + c.amount, 0) * baselinePaychecksPerMonth;
    
    // Use actual values from scenario plan data (incomeDistribution) vs baseline
    const needsDelta = incomeDistribution.monthlyNeeds - baselineMonthlyNeeds;
    const wantsDelta = incomeDistribution.monthlyWants - baselineMonthlyWants;
    const savingsDelta = incomeDistribution.monthlySavings - baselineMonthlySavings;
    
    // Calculate percentage changes (use monthlyIncome for both current and new since income doesn't change)
    const totalMonthlyIncome = monthlyIncome || (baselineMonthlyNeeds + baselineMonthlyWants + baselineMonthlySavings);
    const needsPctCurrent = totalMonthlyIncome > 0 ? (baselineMonthlyNeeds / totalMonthlyIncome) * 100 : 0;
    const wantsPctCurrent = totalMonthlyIncome > 0 ? (baselineMonthlyWants / totalMonthlyIncome) * 100 : 0;
    const savingsPctCurrent = totalMonthlyIncome > 0 ? (baselineMonthlySavings / totalMonthlyIncome) * 100 : 0;
    
    const needsPctNew = totalMonthlyIncome > 0 ? (incomeDistribution.monthlyNeeds / totalMonthlyIncome) * 100 : 0;
    const wantsPctNew = totalMonthlyIncome > 0 ? (incomeDistribution.monthlyWants / totalMonthlyIncome) * 100 : 0;
    const savingsPctNew = totalMonthlyIncome > 0 ? (incomeDistribution.monthlySavings / totalMonthlyIncome) * 100 : 0;
    
    // Calculate net worth projection changes
    const netWorthChanges = scenarioPlanData.netWorthProjection.map((projection) => {
      const baselineValue = baselinePlanData.netWorthProjection.find(p => p.label === projection.label)?.value || 0;
      const scenarioValue = projection.value;
      const delta = scenarioValue - baselineValue;
      return {
        label: projection.label,
        current: baselineValue,
        new: scenarioValue,
        delta,
      };
    });
    
    return {
      needs: {
        current: baselineMonthlyNeeds,
        new: incomeDistribution.monthlyNeeds,
        delta: needsDelta,
        currentPct: needsPctCurrent,
        newPct: needsPctNew,
      },
      wants: {
        current: baselineMonthlyWants,
        new: incomeDistribution.monthlyWants,
        delta: wantsDelta,
        currentPct: wantsPctCurrent,
        newPct: wantsPctNew,
      },
      savings: {
        current: baselineMonthlySavings,
        new: incomeDistribution.monthlySavings,
        delta: savingsDelta,
        currentPct: savingsPctCurrent,
        newPct: savingsPctNew,
      },
      netWorth: netWorthChanges,
    };
  }, [baselinePlanData, scenarioPlanData, incomeDistribution, monthlyIncome, baselineState.income?.payFrequency]);

  // All remaining hooks MUST be called before any early returns
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Calculate derived values (not hooks, but need to be before early returns)
  const originalNeedsPct = currentPlan.needsPct * 100;
  const originalWantsPct = currentPlan.wantsPct * 100;
  const hasChanged = Math.abs(needsPct - originalNeedsPct) > 0.1 || Math.abs(wantsPct - originalWantsPct) > 0.1;

  // Early return after ALL hooks have been called
  if (!baselinePlanData) {
    return (
      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading savings helper...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!scenarioPlanData) {
    return (
      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading scenario data...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { monthlyNeeds, monthlyWants, monthlySavings } = incomeDistribution;

  // Helper to render a bar graph
  const renderBarGraph = (
    label: string,
    distribution: { needsPct: number; wantsPct: number; savingsPct: number },
    income: number
  ) => {
    const needsAmount = income * distribution.needsPct;
    const wantsAmount = income * distribution.wantsPct;
    const savingsAmount = income * distribution.savingsPct;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {label}
          </span>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            ${income.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
          </span>
        </div>
        <div className="flex h-12 w-full overflow-hidden rounded-lg border-2 border-slate-200 dark:border-slate-700">
          <div
            className="bg-orange-500"
            style={{ width: `${distribution.needsPct * 100}%` }}
            title={`Needs: ${(distribution.needsPct * 100).toFixed(1)}%`}
          />
          <div
            className="bg-blue-400"
            style={{ width: `${distribution.wantsPct * 100}%` }}
            title={`Wants: ${(distribution.wantsPct * 100).toFixed(1)}%`}
          />
          <div
            className="bg-green-400"
            style={{ width: `${distribution.savingsPct * 100}%` }}
            title={`Savings: ${(distribution.savingsPct * 100).toFixed(1)}%`}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="mb-1 h-2 w-full rounded bg-orange-500" />
            <div className="font-medium">Needs: ${(needsAmount / 1000).toFixed(1)}K</div>
            <div className="text-slate-600 dark:text-slate-400">{(distribution.needsPct * 100).toFixed(1)}%</div>
          </div>
          <div>
            <div className="mb-1 h-2 w-full rounded bg-blue-400" />
            <div className="font-medium">Wants: ${(wantsAmount / 1000).toFixed(1)}K</div>
            <div className="text-slate-600 dark:text-slate-400">{(distribution.wantsPct * 100).toFixed(1)}%</div>
          </div>
          <div>
            <div className="mb-1 h-2 w-full rounded bg-green-400" />
            <div className="font-medium">Savings: ${(savingsAmount / 1000).toFixed(1)}K</div>
            <div className="text-slate-600 dark:text-slate-400">{(distribution.savingsPct * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>
    );
  };

  const handleApply = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmApply = () => {
    // Save the user's chosen distribution as both targets AND actuals3m
    // This ensures the engine treats it as the final distribution (no shifting)
    // The engine checks if targets == actuals3m and returns as-is (see income.ts line 97-122)
    const savedDistribution = {
      needsPct: needsPct / 100,
      wantsPct: wantsPct / 100,
      savingsPct: savingsPct / 100,
    };
    
    if (baselineState.riskConstraints) {
      // Update both targets and actuals3m to the same values
      // Set bypassWantsFloor=true to preserve exact values without normalization
      baselineState.updateRiskConstraints({
        targets: savedDistribution,
        actuals3m: savedDistribution, // Set to match targets so engine returns as-is
        bypassWantsFloor: true, // Preserve exact values
      });
    } else {
      // If riskConstraints doesn't exist, create it with the saved distribution
      baselineState.setRiskConstraints({
        targets: savedDistribution,
        actuals3m: savedDistribution, // Set to match targets so engine returns as-is
        shiftLimitPct: 0.04,
        bypassWantsFloor: true, // Preserve exact values
      });
    }
    
    // Clear the initial paycheck plan to force recalculation
    baselineState.setInitialPaycheckPlan(undefined as any);
    setShowConfirmDialog(false);
    router.push('/app/home');
  };

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">How Much Can You Save?</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-8 w-8"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Three Bar Graphs */}
          <Card>
            <CardHeader>
              <CardTitle>Income Distribution Comparison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderBarGraph('Past 3 Months Average', actuals3m, monthlyIncome)}
              {renderBarGraph('Current Plan', currentPlan, monthlyIncome)}
              {renderBarGraph('Recommended Plan', recommendedPlan, monthlyIncome)}
            </CardContent>
          </Card>

          {/* Needs/Wants Sliders */}
          <Card>
            <CardHeader>
              <CardTitle>Adjust Your Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Needs Slider */}
              <div>
                <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Needs</h3>
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
                        setWantsPct(newWantsPct);
                        setSavingsPct(newSavingsPct);
                      }}
                      min={0}
                      max={100}
                      step={0.5}
                      className="w-full"
                    />
                  </div>
                  <div className="rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
                    <div className="text-right text-lg font-semibold">
                      ${monthlyNeeds.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                    </div>
                  </div>
                </div>
              </div>

              {/* Wants Slider */}
              <div>
                <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Wants</h3>
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
                        setNeedsPct(newNeedsPct);
                        setSavingsPct(newSavingsPct);
                      }}
                      min={0}
                      max={100}
                      step={0.5}
                      className="w-full"
                    />
                  </div>
                  <div className="rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
                    <div className="text-right text-lg font-semibold">
                      ${monthlyWants.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                    </div>
                  </div>
                </div>
              </div>

              {/* Savings (calculated automatically) */}
              <div>
                <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Savings</h3>
                <div className="rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
                  <div className="text-right text-lg font-semibold">
                    ${monthlySavings.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                  </div>
                  <div className="mt-1 text-right text-sm text-slate-600 dark:text-slate-400">
                    {savingsPct.toFixed(1)}% of income
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Net Worth Projection */}
          <Card>
            <CardHeader>
              <CardTitle>Wealth Accumulation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto rounded-lg border bg-white p-4 dark:bg-slate-800">
                <div className="min-w-0">
                  <NetWorthChart
                    key={`savings-helper-${needsPct}-${wantsPct}`}
                    labels={scenarioPlanData.netWorthChartData.labels}
                    netWorth={scenarioPlanData.netWorthChartData.netWorth}
                    assets={scenarioPlanData.netWorthChartData.assets}
                    liabilities={scenarioPlanData.netWorthChartData.liabilities}
                    baselineNetWorth={hasChanged ? baselinePlanData.netWorthChartData.netWorth : undefined}
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
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Apply Button */}
      <div className="border-t bg-background px-4 py-4">
        <div className="mx-auto max-w-lg">
          <Button
            onClick={handleApply}
            className="w-full bg-green-600 text-white hover:bg-green-700"
            size="lg"
          >
            Apply This Plan
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && confirmationValues && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-md shadow-xl my-8">
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
                    <span className="font-semibold">${confirmationValues.needs.current.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month ({confirmationValues.needs.currentPct.toFixed(1)}%)</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">New:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">${confirmationValues.needs.new.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month ({confirmationValues.needs.newPct.toFixed(1)}%)</span>
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
                    <span className="font-semibold">${confirmationValues.wants.current.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month ({confirmationValues.wants.currentPct.toFixed(1)}%)</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">New:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">${confirmationValues.wants.new.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month ({confirmationValues.wants.newPct.toFixed(1)}%)</span>
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
                    <span className="font-semibold">${confirmationValues.savings.current.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month ({confirmationValues.savings.currentPct.toFixed(1)}%)</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">New:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">${confirmationValues.savings.new.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month ({confirmationValues.savings.newPct.toFixed(1)}%)</span>
                  </div>
                  <div className="flex items-center justify-between text-sm border-t pt-2">
                    <span className="text-slate-600 dark:text-slate-400">Change:</span>
                    <span className={`font-semibold ${confirmationValues.savings.delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {confirmationValues.savings.delta >= 0 ? '+' : ''}${confirmationValues.savings.delta.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                    </span>
                  </div>
                </div>

                {/* Net Worth Impact */}
                {confirmationValues.netWorth && confirmationValues.netWorth.length > 0 && (
                  <div className="space-y-2 pt-3 border-t">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Net Worth Impact</h3>
                    {confirmationValues.netWorth.map((item) => {
                      if (Math.abs(item.delta) < 1) return null; // Skip if no meaningful change
                      return (
                        <div key={item.label} className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">{item.label}:</span>
                          <span className={`font-semibold ${item.delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {item.delta >= 0 ? '+' : ''}${item.delta.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
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

export default function SavingsHelperPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading savings helper...
            </p>
          </CardContent>
        </Card>
      </div>
    }>
      <SavingsHelperContent />
    </Suspense>
  );
}

