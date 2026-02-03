/**
 * Onboarding - Monthly Plan Step
 * 
 * Step 6: Display and allow adjustments to the monthly plan.
 * Always shows monthly amounts regardless of pay frequency.
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { generateInitialPaycheckPlanFromEngines } from '@/lib/onboarding/plan';
import type { PaycheckPlan } from '@/lib/onboarding/types';
import { Info } from 'lucide-react';
import { OnboardingChat } from '@/components/onboarding/OnboardingChat';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';

// Helper to get paychecks per month
function getPaychecksPerMonth(frequency: string): number {
  switch (frequency) {
    case 'weekly': return 4.33;
    case 'biweekly': return 2.17;
    case 'semimonthly': return 2;
    case 'monthly': return 1;
    default: return 2.17; // Default to biweekly
  }
}

// Helper to round to 2 decimal places
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const categoryInfo: Record<string, { why: string; color: string }> = {
  Needs: {
    why: 'Essential expenses like rent, utilities, and groceries that you need to cover.',
    color: '#3b82f6',
  },
  Wants: {
    why: 'Discretionary spending for fun, dining out, and lifestyle choices.',
    color: '#10b981',
  },
  Savings: {
    why: 'Money set aside for emergencies, debt payoff, retirement, and future goals.',
    color: '#8b5cf6',
  },
};

export default function MonthlyPlanPage() {
  const router = useRouter();
  const state = useOnboardingStore();
  const {
    income,
    initialPaycheckPlan,
    fixedExpenses,
    debts,
    riskConstraints,
    setInitialPaycheckPlan,
    setCurrentStep,
    plaidConnected,
  } = state;

  const [plan, setPlan] = useState<PaycheckPlan | undefined>(initialPaycheckPlan);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [hasUserAdjusted, setHasUserAdjusted] = useState(false);

  // Generate plan on mount only if it doesn't exist
  // Preserve user adjustments by using existing initialPaycheckPlan from store
  // BUT: If Plaid is connected, DON'T regenerate - buildFinalPlanData will handle Plaid data
  // If income changed (e.g., from Plaid), we should NOT regenerate here - let buildFinalPlanData handle it
  // IMPORTANT: Only run on mount or when income changes, NOT when initialPaycheckPlan changes (to preserve user adjustments)
  useEffect(() => {
    // Don't regenerate if user has manually adjusted the plan
    if (hasUserAdjusted) {
      return;
    }
    
    if (income?.netIncome$ && income.netIncome$ > 0) {
      const isPlaidConnected = plaidConnected;
      
      // If Plaid is connected, don't set initialPaycheckPlan - buildFinalPlanData will use actuals
      if (isPlaidConnected) {
        console.log('[MonthlyPlan] Plaid connected - not setting initialPaycheckPlan, buildFinalPlanData will use actuals');
        // Still show a plan for display, but don't set it as initialPaycheckPlan
        // We'll use buildFinalPlanData to get the plan
        setIsGenerating(true);
        try {
          const generated = generateInitialPaycheckPlanFromEngines(state);
          setPlan(generated);
          // DON'T call setInitialPaycheckPlan - let buildFinalPlanData handle Plaid data
        } catch (error) {
          console.error('Failed to generate plan:', error);
        } finally {
          setIsGenerating(false);
        }
        return;
      }
      
      // For manual entry (no Plaid), check if existing plan matches current income
      const currentIncome = income.netIncome$;
      const planIncome = initialPaycheckPlan 
        ? (initialPaycheckPlan.needs$ + initialPaycheckPlan.wants$ + initialPaycheckPlan.savings$)
        : 0;
      
      const incomeMatches = planIncome > 0 && Math.abs(currentIncome - planIncome) / Math.max(currentIncome, planIncome) < 0.01;
      
      // If plan exists AND income matches, use it (preserves user adjustments)
      if (initialPaycheckPlan && initialPaycheckPlan.needs$ > 0 && incomeMatches) {
        setPlan(initialPaycheckPlan);
        setIsGenerating(false);
        return;
      }
      
      // Regenerate if no plan exists OR income changed (manual entry path only)
      setIsGenerating(true);
      try {
        console.log('[MonthlyPlan] Regenerating plan (manual entry)', {
          hasExistingPlan: !!initialPaycheckPlan,
          currentIncome,
          planIncome,
          incomeMatches,
          reason: !initialPaycheckPlan ? 'no plan exists' : 'income changed',
        });
        const generated = generateInitialPaycheckPlanFromEngines(state);
        setPlan(generated);
        setInitialPaycheckPlan(generated);
      } catch (error) {
        console.error('Failed to generate plan:', error);
        // Plan will remain undefined, show error state
      } finally {
        setIsGenerating(false);
      }
    } else if (!income?.netIncome$) {
      // Income not set yet, but don't show error - user might be navigating back
      console.warn('Income not set, cannot generate plan yet');
    }
  }, [income?.netIncome$, income?.payFrequency, setInitialPaycheckPlan, plaidConnected, hasUserAdjusted]);

  const incomeAmount = income?.netIncome$ || 0; // per-paycheck
  const payFrequency = income?.payFrequency || 'biweekly';
  const paychecksPerMonth = getPaychecksPerMonth(payFrequency);
  const monthlyIncome = incomeAmount * paychecksPerMonth; // monthly

  // Calculate adjusted plan when user makes changes
  const adjustedPlan = useMemo(() => {
    if (!plan) return null;

    const categories = plan.categories || [];
    const totalPercentage = categories.reduce((sum, cat) => sum + (cat.percentage || 0), 0);

    // If percentages don't sum to 100%, normalize them
    if (Math.abs(totalPercentage - 100) > 0.1) {
      const normalized = categories.map((cat) => ({
        ...cat,
        percentage: (cat.percentage || 0) * (100 / totalPercentage),
        amount$: incomeAmount * ((cat.percentage || 0) * (100 / totalPercentage)) / 100,
      }));

      return {
        ...plan,
        needs$: normalized.find(c => c.name === 'Needs')?.amount$ || plan.needs$,
        wants$: normalized.find(c => c.name === 'Wants')?.amount$ || plan.wants$,
        savings$: normalized.find(c => c.name === 'Savings')?.amount$ || plan.savings$,
        categories: normalized,
      };
    }

    return plan;
  }, [plan, incomeAmount]);

  // Calculate breakdown components for each category - always in monthly amounts
  const categoryBreakdowns = useMemo(() => {
    const breakdowns: Record<string, Array<{ label: string; amount: number; percent: number }>> = {
      Needs: [],
      Wants: [],
      Savings: [],
    };

    // Get the actual Needs amount from the plan (per-paycheck) and convert to monthly
    const actualNeedsAmountPerPaycheck = adjustedPlan?.needs$ || plan?.needs$ || 0;
    const actualNeedsAmount = actualNeedsAmountPerPaycheck * paychecksPerMonth; // monthly

    // Calculate Needs breakdown from fixed expenses - always monthly
    const needsExpenses = fixedExpenses.filter((e) => e.category === 'needs' || !e.category);
    let needsExpensesTotal = 0;
    for (const expense of needsExpenses) {
      let monthlyAmount = expense.amount$;
      if (expense.frequency === 'weekly') monthlyAmount = expense.amount$ * 4.33;
      else if (expense.frequency === 'biweekly') monthlyAmount = expense.amount$ * 2.17;
      else if (expense.frequency === 'semimonthly') monthlyAmount = expense.amount$ * 2;
      else if (expense.frequency === 'yearly') monthlyAmount = expense.amount$ / 12;
      // If expense.frequency is 'monthly', monthlyAmount is already correct
      
      needsExpensesTotal += monthlyAmount;
      breakdowns.Needs.push({
        label: expense.name,
        amount: monthlyAmount,
        percent: 0, // Will calculate after
      });
    }

    // Add debt minimum payments to Needs - convert to monthly
    const totalDebtMinPayments$ = debts.reduce((sum, d) => sum + d.minPayment$, 0);
    if (totalDebtMinPayments$ > 0.01) {
      // Debt min payments are per-paycheck, convert to monthly
      const monthlyDebtMinPayments = totalDebtMinPayments$ * paychecksPerMonth;
      breakdowns.Needs.push({
        label: 'Debt Minimum Payments',
        amount: monthlyDebtMinPayments,
        percent: 0,
      });
      needsExpensesTotal += monthlyDebtMinPayments;
    }

    // Calculate the difference (this represents any additional needs allocation from the engine)
    const needsDifference = actualNeedsAmount - needsExpensesTotal;
    const hasEnteredExpenses = needsExpenses.length > 0 || debts.length > 0;
    
    if (needsDifference > 0.01 && hasEnteredExpenses) {
      breakdowns.Needs.push({
        label: 'Other Essential Expenses',
        amount: needsDifference,
        percent: 0,
      });
    }

    // Use actualNeedsAmount for percentage calculations
    const needsTotal = actualNeedsAmount;

    // Calculate Wants breakdown from fixed expenses - always monthly
    const wantsExpenses = fixedExpenses.filter((e) => e.category === 'wants');
    let wantsTotal = 0;
    for (const expense of wantsExpenses) {
      let monthlyAmount = expense.amount$;
      if (expense.frequency === 'weekly') monthlyAmount = expense.amount$ * 4.33;
      else if (expense.frequency === 'biweekly') monthlyAmount = expense.amount$ * 2.17;
      else if (expense.frequency === 'semimonthly') monthlyAmount = expense.amount$ * 2;
      else if (expense.frequency === 'yearly') monthlyAmount = expense.amount$ / 12;
      // If expense.frequency is 'monthly', monthlyAmount is already correct
      
      wantsTotal += monthlyAmount;
      breakdowns.Wants.push({
        label: expense.name,
        amount: monthlyAmount,
        percent: 0,
      });
    }

    // Calculate percentages for Needs breakdown
    if (needsTotal > 0 && breakdowns.Needs.length > 0) {
      const breakdownSum = breakdowns.Needs.reduce((sum, item) => sum + item.amount, 0);
      
      // If breakdown items sum to more than the total, scale them down
      if (breakdownSum > needsTotal + 0.01) {
        const scaleFactor = needsTotal / breakdownSum;
        breakdowns.Needs.forEach((item) => {
          item.amount = item.amount * scaleFactor;
        });
      }
      
      // Now calculate percentages based on the (possibly scaled) amounts
      breakdowns.Needs.forEach((item) => {
        item.percent = (item.amount / needsTotal) * 100;
      });
    }

    // Calculate percentages for Wants breakdown
    if (wantsTotal > 0) {
      breakdowns.Wants.forEach((item) => {
        item.percent = (item.amount / wantsTotal) * 100;
      });
    }

    // For Savings, show monthly amount
    if (plan?.savings$ && plan.savings$ > 0) {
      const monthlySavings = plan.savings$ * paychecksPerMonth;
      breakdowns.Savings.push({
        label: 'Total Savings Budget',
        amount: monthlySavings,
        percent: 100,
      });
    }

    return breakdowns;
  }, [fixedExpenses, debts, paychecksPerMonth, plan, adjustedPlan]);

  const handlePercentageChange = (categoryName: string, newPercentage: number) => {
    if (!plan || !adjustedPlan) return;

    const clampedPercentage = Math.max(0, Math.min(100, newPercentage));
    const categories = [...(adjustedPlan.categories || [])];
    
    const needsCat = categories.find(c => c.name === 'Needs');
    const wantsCat = categories.find(c => c.name === 'Wants');
    const savingsCat = categories.find(c => c.name === 'Savings');

    if (!needsCat || !wantsCat || !savingsCat) return;

    let updatedNeeds = needsCat.percentage || 0;
    let updatedWants = wantsCat.percentage || 0;
    let updatedSavings = savingsCat.percentage || 0;

    if (categoryName === 'Needs') {
      updatedNeeds = clampedPercentage;
      // When Needs changes, keep Wants the same and adjust Savings to be the remainder
      updatedSavings = Math.max(0, 100 - updatedNeeds - updatedWants);
      
      // If Savings would be negative, cap Wants instead
      if (updatedSavings < 0) {
        updatedSavings = 0;
        updatedWants = Math.max(0, 100 - updatedNeeds);
      }
    } else if (categoryName === 'Wants') {
      updatedWants = clampedPercentage;
      // When Wants changes, Savings is simply the remainder
      updatedSavings = Math.max(0, 100 - updatedNeeds - updatedWants);
      
      // If Savings would be negative, cap Wants instead
      if (updatedSavings < 0) {
        updatedSavings = 0;
        updatedWants = Math.max(0, 100 - updatedNeeds);
      }
    } else if (categoryName === 'Savings') {
      updatedSavings = clampedPercentage;
      // When Savings changes, keep Needs the same and adjust Wants to be the remainder
      updatedWants = Math.max(0, 100 - updatedNeeds - updatedSavings);
      
      // If Wants would be negative, cap Savings instead
      if (updatedWants < 0) {
        updatedWants = 0;
        updatedSavings = Math.max(0, 100 - updatedNeeds);
      }
    }
    
    // Ensure all values are properly rounded and sum to 100
    updatedNeeds = round2(updatedNeeds);
    updatedWants = round2(updatedWants);
    updatedSavings = round2(updatedSavings);
    
    // Reconcile any rounding differences
    const total = updatedNeeds + updatedWants + updatedSavings;
    if (Math.abs(total - 100) > 0.01) {
      const diff = 100 - total;
      updatedSavings = round2(updatedSavings + diff);
    }

    // Update category objects - keep per-paycheck amounts internally
    const updatedCategories = categories.map((cat) => {
      if (cat.name === 'Needs') {
        return {
          ...cat,
          percentage: updatedNeeds,
          amount$: incomeAmount * (updatedNeeds / 100),
        };
      } else if (cat.name === 'Wants') {
        return {
          ...cat,
          percentage: updatedWants,
          amount$: incomeAmount * (updatedWants / 100),
        };
      } else if (cat.name === 'Savings') {
        return {
          ...cat,
          percentage: updatedSavings,
          amount$: incomeAmount * (updatedSavings / 100),
        };
      }
      return cat;
    });

    const updatedPlan: PaycheckPlan = {
      needs$: incomeAmount * (updatedNeeds / 100),
      wants$: incomeAmount * (updatedWants / 100),
      savings$: incomeAmount * (updatedSavings / 100),
      categories: updatedCategories,
      notes: plan.notes,
    };

    setPlan(updatedPlan);
    setInitialPaycheckPlan(updatedPlan);
    setHasUserAdjusted(true); // Mark that user has manually adjusted the plan
  };

  const handleContinue = () => {
    if (adjustedPlan) {
      setInitialPaycheckPlan(adjustedPlan);
    }
    setCurrentStep('savings');
    // During onboarding stay in onboarding flow — go to savings-plan, not savings-allocator
    router.push('/onboarding/savings-plan');
  };

  if (isGenerating) {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-2">
          {/* Progress Bar */}
          <div className="pb-2">
            <OnboardingProgress />
          </div>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            Generating your personalized plan...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!plan || !adjustedPlan) {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-2">
          {/* Progress Bar */}
          <div className="pb-2">
            <OnboardingProgress />
          </div>
        </CardHeader>
        <CardContent className="py-12 text-center space-y-4">
          {!income || !income.netIncome$ || income.netIncome$ <= 0 ? (
            <>
              <p className="text-red-600 dark:text-red-400 font-medium">
                Income information is required to generate a plan.
              </p>
              <Button
                onClick={() => router.push('/onboarding/income')}
                variant="outline"
              >
                Go to Income Step
              </Button>
            </>
          ) : (
            <p className="text-red-600 dark:text-red-400">
              Unable to generate plan. Please check your income information.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const categories = adjustedPlan.categories || [];

  return (
    <>
    <Card className="w-full">
      <CardHeader className="space-y-2">
        {/* Progress Bar */}
        <div className="pb-2">
          <OnboardingProgress />
        </div>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl sm:text-3xl font-bold">
            Your Monthly Plan
          </CardTitle>
          <OnboardingChat context="monthly-plan" inline />
        </div>
        <CardDescription className="text-base">
          Here's how we suggest allocating your ${monthlyIncome.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} monthly income. Adjust as needed.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Plan Categories */}
        <div className="space-y-4">
          {categories.map((category) => {
            const info = categoryInfo[category.name] || {
              why: 'Allocated for this category.',
              color: '#6b7280',
            };

            const isHovered = hoveredCategory === category.name;
            const breakdown = categoryBreakdowns[category.name] || [];
            // Convert per-paycheck amount to monthly for display
            const monthlyAmount = category.amount$ * paychecksPerMonth;

            return (
              <div
                key={category.name}
                onMouseEnter={() => setHoveredCategory(category.name)}
                onMouseLeave={() => setHoveredCategory(null)}
                className={`rounded-lg border p-4 transition-all ${
                  isHovered
                    ? 'border-primary bg-primary/5 shadow-md dark:bg-primary/10'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: info.color }}
                    />
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {category.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      ${monthlyAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} /month
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {category.percentage?.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={category.percentage || 0}
                  onChange={(e) =>
                    handlePercentageChange(category.name, parseFloat(e.target.value))
                  }
                  className="mb-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 dark:bg-slate-700"
                  style={{
                    accentColor: info.color,
                  }}
                />

                {/* Why text */}
                <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{info.why}</p>
                </div>

                {/* Breakdown (shown on hover) */}
                {isHovered && breakdown.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                      Breakdown
                    </p>
                    {breakdown.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-700 dark:text-slate-300">
                          {item.label}
                        </span>
                        <div className="text-right">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            ${item.amount.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} /month
                          </span>
                          {breakdown.length > 1 && (
                            <span className="ml-2 text-slate-600 dark:text-slate-400">
                              ({item.percent.toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Total Validation */}
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Total Monthly Income
            </span>
            <span className="font-bold text-slate-900 dark:text-white">
              ${(categories.reduce((sum, c) => sum + c.amount$, 0) * paychecksPerMonth).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} /month
            </span>
          </div>
          {Math.abs(categories.reduce((sum, c) => sum + (c.percentage || 0), 0) - 100) > 0.1 && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Percentages should sum to 100%
            </p>
          )}
        </div>

        {/* Notes */}
        {adjustedPlan.notes && adjustedPlan.notes.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Plan Notes:
            </p>
            <ul className="mt-1 list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-300">
              {adjustedPlan.notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Continue Button */}
        <div className="pt-4">
          <Button onClick={handleContinue} size="lg" className="w-full">
            Continue to Savings Plan
          </Button>
        </div>
      </CardContent>
    </Card>
    </>
  );
}

