/**
 * Onboarding - Plan Preview Step
 * 
 * Step 6: Display and allow adjustments to the initial paycheck plan.
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

export default function PlanPreviewPage() {
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
  } = state;

  const [plan, setPlan] = useState<PaycheckPlan | undefined>(initialPaycheckPlan);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Generate plan on mount only if it doesn't exist
  // Preserve user adjustments by using existing initialPaycheckPlan from store
  useEffect(() => {
    if (income?.netIncome$ && income.netIncome$ > 0) {
      // If plan already exists in store, use it (preserves user adjustments)
      if (initialPaycheckPlan && initialPaycheckPlan.needs$ > 0) {
        setPlan(initialPaycheckPlan);
        setIsGenerating(false);
        return;
      }
      
      // Only regenerate if no plan exists yet (first time)
      setIsGenerating(true);
      try {
        const generated = generateInitialPaycheckPlanFromEngines(
          useOnboardingStore.getState()
        );
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
  }, [income?.netIncome$, income?.payFrequency, initialPaycheckPlan, setInitialPaycheckPlan]);

  const incomeAmount = income?.netIncome$ || 0;
  const payFrequency = income?.payFrequency || 'biweekly';
  const paychecksPerMonth = getPaychecksPerMonth(payFrequency);

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

  // Calculate breakdown components for each category
  const categoryBreakdowns = useMemo(() => {
    const breakdowns: Record<string, Array<{ label: string; amount: number; percent: number }>> = {
      Needs: [],
      Wants: [],
      Savings: [],
    };

    // Get the actual Needs amount from the plan (this is what the engine calculated)
    const actualNeedsAmount = adjustedPlan?.needs$ || plan?.needs$ || 0;

    // Calculate Needs breakdown from fixed expenses
    const needsExpenses = fixedExpenses.filter((e) => e.category === 'needs' || !e.category);
    let needsExpensesTotal = 0;
    for (const expense of needsExpenses) {
      let monthlyAmount = expense.amount$;
      if (expense.frequency === 'weekly') monthlyAmount = expense.amount$ * 4.33;
      else if (expense.frequency === 'biweekly') monthlyAmount = expense.amount$ * 2.17;
      else if (expense.frequency === 'semimonthly') monthlyAmount = expense.amount$ * 2;
      else if (expense.frequency === 'yearly') monthlyAmount = expense.amount$ / 12;
      
      const perPaycheck = monthlyAmount / paychecksPerMonth;
      needsExpensesTotal += perPaycheck;
      breakdowns.Needs.push({
        label: expense.name,
        amount: perPaycheck,
        percent: 0, // Will calculate after
      });
    }

    // Add debt minimum payments to Needs
    const totalDebtMinPayments$ = debts.reduce((sum, d) => sum + d.minPayment$, 0);
    if (totalDebtMinPayments$ > 0.01) {
      breakdowns.Needs.push({
        label: 'Debt Minimum Payments',
        amount: totalDebtMinPayments$,
        percent: 0,
      });
      needsExpensesTotal += totalDebtMinPayments$;
    }

    // Calculate the difference (this represents any additional needs allocation from the engine)
    // Only show "Other Essential Expenses" if the user has entered some expenses
    // This prevents showing confusing "Other" items when the user hasn't entered anything
    // The "Other" category represents expenses that aren't explicitly tracked but are part of the Needs allocation
    const needsDifference = actualNeedsAmount - needsExpensesTotal;
    const hasEnteredExpenses = needsExpenses.length > 0 || debts.length > 0;
    
    // Only show "Other Essential Expenses" if:
    // 1. The difference is POSITIVE (meaning there's room for other expenses beyond what was entered)
    // 2. The difference is meaningful (> $0.01)
    // 3. The user has entered at least some expenses (so we know what's "other")
    // If the difference is negative, it means entered expenses exceed the allocation, so don't show "Other"
    if (needsDifference > 0.01 && hasEnteredExpenses) {
      breakdowns.Needs.push({
        label: 'Other Essential Expenses',
        amount: needsDifference,
        percent: 0,
      });
    }

    // Use actualNeedsAmount for percentage calculations
    const needsTotal = actualNeedsAmount;

    // Calculate Wants breakdown from fixed expenses
    const wantsExpenses = fixedExpenses.filter((e) => e.category === 'wants');
    let wantsTotal = 0;
    for (const expense of wantsExpenses) {
      let monthlyAmount = expense.amount$;
      if (expense.frequency === 'weekly') monthlyAmount = expense.amount$ * 4.33;
      else if (expense.frequency === 'biweekly') monthlyAmount = expense.amount$ * 2.17;
      else if (expense.frequency === 'semimonthly') monthlyAmount = expense.amount$ * 2;
      else if (expense.frequency === 'yearly') monthlyAmount = expense.amount$ / 12;
      
      const perPaycheck = monthlyAmount / paychecksPerMonth;
      wantsTotal += perPaycheck;
      breakdowns.Wants.push({
        label: expense.name,
        amount: perPaycheck,
        percent: 0,
      });
    }

    // Calculate percentages for Needs breakdown
    // First, ensure breakdown items sum to exactly needsTotal
    // If they exceed it, scale them down proportionally
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

    // For Savings, we can show a simple breakdown if we have the plan
    // This will be more detailed on the savings plan page
    if (plan?.savings$ && plan.savings$ > 0) {
      breakdowns.Savings.push({
        label: 'Total Savings Budget',
        amount: plan.savings$,
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
      // When Needs changes, adjust Wants and Savings proportionally
      updatedNeeds = clampedPercentage;
      const remainingPercentage = 100 - updatedNeeds;
      const otherTotal = updatedWants + updatedSavings;
      
      if (otherTotal > 0 && remainingPercentage > 0) {
        // Maintain the ratio between Wants and Savings
        const wantsRatio = updatedWants / otherTotal;
        const savingsRatio = updatedSavings / otherTotal;
        
        updatedWants = remainingPercentage * wantsRatio;
        updatedSavings = remainingPercentage * savingsRatio;
      } else {
        // If otherTotal is 0, split remaining equally
        updatedWants = remainingPercentage / 2;
        updatedSavings = remainingPercentage / 2;
      }
    } else if (categoryName === 'Wants') {
      // When Wants changes, adjust only Savings (Needs stays fixed)
      updatedWants = clampedPercentage;
      updatedSavings = 100 - updatedNeeds - updatedWants;
      
      // Ensure Savings doesn't go negative
      if (updatedSavings < 0) {
        updatedSavings = 0;
        updatedWants = 100 - updatedNeeds;
      }
    } else if (categoryName === 'Savings') {
      // When Savings changes, adjust only Wants (Needs stays fixed)
      updatedSavings = clampedPercentage;
      updatedWants = 100 - updatedNeeds - updatedSavings;
      
      // Ensure Wants doesn't go negative
      if (updatedWants < 0) {
        updatedWants = 0;
        updatedSavings = 100 - updatedNeeds;
      }
    }

    // Update category objects
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
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl sm:text-3xl font-bold">
          Your Paycheck Plan
        </CardTitle>
        <CardDescription className="text-base">
          Here's how we suggest allocating your ${incomeAmount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} paycheck. Adjust as needed.
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
                      ${category.amount$.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
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
                            })}
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
              Total
            </span>
            <span className="font-bold text-slate-900 dark:text-white">
              ${categories.reduce((sum, c) => sum + c.amount$, 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
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
  );
}

