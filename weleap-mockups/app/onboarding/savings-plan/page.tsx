/**
 * Onboarding - Savings Plan Step
 * 
 * Displays and allows adjustments to the savings allocation using the savings allocation engine.
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { allocateSavings, type SavingsInputs, type SavingsAllocation } from '@/lib/alloc/savings';
import { Info, Shield, CreditCard, TrendingUp, Building2, PiggyBank } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { OnboardingChat } from '@/components/onboarding/OnboardingChat';
import { getPaychecksPerMonth } from '@/lib/onboarding/usePlanData';

interface SavingsCategory {
  id: string;
  label: string;
  amount: number;
  percent: number;
  icon: React.ReactNode;
  description: string;
  color: string;
}

export default function SavingsPlanPage() {
  const router = useRouter();
  const state = useOnboardingStore();
  const {
    income,
    initialPaycheckPlan,
    fixedExpenses,
    debts,
    assets,
    safetyStrategy,
    riskConstraints,
    setCurrentStep,
    updateSafetyStrategy,
  } = state;

  // Use planData (from buildFinalPlanData) instead of initialPaycheckPlan
  // This works for both Plaid-connected and manual entry flows
  const planData = usePlanData();

  const [savingsAlloc, setSavingsAlloc] = useState<SavingsAllocation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Local state for inputs
  const [match401kPerMonth, setMatch401kPerMonth] = useState<number>(
    safetyStrategy?.match401kPerMonth$ || 0
  );
  const [efTargetMonths, setEfTargetMonths] = useState<number>(
    safetyStrategy?.efTargetMonths || 3
  );
  const [efAllocationPct, setEfAllocationPct] = useState<number>(0);
  const [hasAdjustedEfSlider, setHasAdjustedEfSlider] = useState<boolean>(false);

  // Get savings budget from planData (preferred) or initialPaycheckPlan (fallback)
  // Convert per-paycheck to monthly
  const savingsBudget$ = useMemo(() => {
    let perPaycheckSavings = 0;
    
    // Prefer planData (works for Plaid-connected flow)
    if (planData && planData.paycheckCategories) {
      // Sum all savings categories from planData
      const savingsCategories = planData.paycheckCategories.filter((cat: any) => 
        cat.key === 'emergency' || cat.key === 'long_term_investing' || cat.key === 'debt_extra' ||
        cat.key === 'short_term_goals' || cat.key === '401k_match' || cat.key === 'retirement_tax_advantaged' ||
        cat.key === 'brokerage'
      );
      perPaycheckSavings = savingsCategories.reduce((sum: number, cat: any) => sum + (cat.amount || 0), 0);
    } 
    // Fallback to initialPaycheckPlan (for manual entry flow)
    else if (initialPaycheckPlan?.savings$) {
      perPaycheckSavings = initialPaycheckPlan.savings$;
    }
    
    if (perPaycheckSavings === 0) return 0;
    
    // Convert per-paycheck to monthly
    const paychecksPerMonth = getPaychecksPerMonth(income?.payFrequency || 'biweekly');
    return perPaycheckSavings * paychecksPerMonth;
  }, [planData, initialPaycheckPlan, income?.payFrequency]);

  // Calculate EF target and current balance
  const efTarget$ = useMemo(() => {
    if (!efTargetMonths || fixedExpenses.length === 0) {
      return 0;
    }
    const monthlyEssentials = fixedExpenses
      .filter((e) => e.category === 'needs' || !e.category)
      .reduce((sum, exp) => {
        let monthly = exp.amount$;
        if (exp.frequency === 'weekly') monthly = exp.amount$ * 4.33;
        else if (exp.frequency === 'biweekly') monthly = exp.amount$ * 2.17;
        else if (exp.frequency === 'semimonthly') monthly = exp.amount$ * 2;
        else if (exp.frequency === 'yearly') monthly = exp.amount$ / 12;
        return sum + monthly;
      }, 0);
    return monthlyEssentials * efTargetMonths;
  }, [efTargetMonths, fixedExpenses]);

  const efBalance$ = useMemo(() => {
    return assets
      .filter((a) => a.type === 'cash')
      .reduce((sum, a) => sum + a.value$, 0);
  }, [assets]);
  
  const efGap$ = useMemo(() => Math.max(0, efTarget$ - efBalance$), [efTarget$, efBalance$]);

  // Get high-APR debts
  const highAprDebts = useMemo(() => {
    return debts
      .filter((d) => d.aprPct > 10 && d.balance$ > 0)
      .map((d) => ({
        balance$: d.balance$,
        aprPct: d.aprPct,
      }));
  }, [debts]);

  // Generate savings allocation when inputs change
  useEffect(() => {
    if (savingsBudget$ > 0 && income) {
      setIsGenerating(true);
      try {
        const inputs: SavingsInputs = {
          savingsBudget$,
          efTarget$,
          efBalance$,
          highAprDebts,
          matchNeedThisPeriod$: match401kPerMonth,
          incomeSingle$: income.incomeSingle$ || income.annualSalary$ || income.netIncome$ * 26,
        };

        const allocation = allocateSavings(inputs);
        
        // Initialize EF allocation percentage from the calculated allocation if user hasn't adjusted
        if (!hasAdjustedEfSlider) {
          setEfAllocationPct((allocation.ef$ / savingsBudget$) * 100);
        }
        
        // Override EF allocation with slider value if user has adjusted it
        if (hasAdjustedEfSlider) {
          const efAmount = Math.min(
            (efAllocationPct / 100) * savingsBudget$,
            efGap$ > 0 ? efGap$ : savingsBudget$ * 0.4 // Cap at gap or 40% of budget
          );
          
          // Redistribute the difference to other categories proportionally
          const originalEf = allocation.ef$;
          const difference = efAmount - originalEf;
          allocation.ef$ = efAmount;
          
          const otherTotal = allocation.highAprDebt$ + allocation.retirementTaxAdv$ + allocation.brokerage$;
          
          if (otherTotal > 0 && Math.abs(difference) > 0.01) {
            const scale = (otherTotal - difference) / otherTotal;
            allocation.highAprDebt$ = Math.max(0, allocation.highAprDebt$ * scale);
            allocation.retirementTaxAdv$ = Math.max(0, allocation.retirementTaxAdv$ * scale);
            allocation.brokerage$ = Math.max(0, allocation.brokerage$ * scale);
          } else if (difference > 0 && otherTotal > 0) {
            // If EF increased, reduce other categories proportionally
            const scale = (otherTotal - difference) / otherTotal;
            allocation.highAprDebt$ = Math.max(0, allocation.highAprDebt$ * scale);
            allocation.retirementTaxAdv$ = Math.max(0, allocation.retirementTaxAdv$ * scale);
            allocation.brokerage$ = Math.max(0, allocation.brokerage$ * scale);
          } else if (difference < 0) {
            // If EF decreased, add to brokerage
            allocation.brokerage$ = allocation.brokerage$ - difference;
          }
        }
        
        setSavingsAlloc(allocation);
      } catch (error) {
        console.error('Failed to generate savings allocation:', error);
      } finally {
        setIsGenerating(false);
      }
    }
  }, [
    savingsBudget$,
    efTarget$,
    efBalance$,
    efGap$,
    highAprDebts,
    income,
    match401kPerMonth,
    efAllocationPct,
    hasAdjustedEfSlider,
  ]);

  const handleContinue = () => {
    // Save inputs to store
    updateSafetyStrategy({
      match401kPerMonth$: match401kPerMonth,
      efTargetMonths,
    });
    setCurrentStep('plan-final');
    router.push('/onboarding/plan-final');
  };

  if (isGenerating) {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl sm:text-3xl font-bold">
              Your Savings Plan
            </CardTitle>
            <OnboardingChat context="savings-plan" inline />
          </div>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            Generating your savings allocation...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!savingsAlloc) {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl sm:text-3xl font-bold">
              Your Savings Plan
            </CardTitle>
            <OnboardingChat context="savings-plan" inline />
          </div>
        </CardHeader>
        <CardContent className="py-12 text-center space-y-4">
          {savingsBudget$ <= 0 ? (
            <>
              <p className="text-red-600 dark:text-red-400 font-medium">
                Monthly plan is required to generate savings allocation.
              </p>
              <Button
                onClick={() => router.push('/onboarding/monthly-plan')}
                variant="outline"
              >
                Go to Monthly Plan
              </Button>
            </>
          ) : (
            <p className="text-slate-600 dark:text-slate-400">
              Unable to generate savings allocation. Please check your information.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Emergency fund category - always show, even if 0
  const emergencyCategory: SavingsCategory = {
      id: 'emergency',
      label: 'Emergency Fund',
      amount: savingsAlloc.ef$,
      percent: (savingsAlloc.ef$ / savingsBudget$) * 100,
      icon: <Shield className="h-5 w-5" />,
      description: 'Builds your safety net for unexpected expenses',
      color: '#10b981',
  };

  // Other categories - filter out zero amounts
  const otherCategories: SavingsCategory[] = [
    {
      id: 'debt',
      label: 'High-APR Debt Paydown',
      amount: savingsAlloc.highAprDebt$,
      percent: (savingsAlloc.highAprDebt$ / savingsBudget$) * 100,
      icon: <CreditCard className="h-5 w-5" />,
      description: 'Accelerates debt payoff and saves on interest',
      color: '#f59e0b',
    },
    {
      id: 'match',
      label: '401(k) Employer Match',
      amount: savingsAlloc.match401k$,
      percent: (savingsAlloc.match401k$ / savingsBudget$) * 100,
      icon: <Building2 className="h-5 w-5" />,
      description: 'Captures free money from your employer',
      color: '#3b82f6',
    },
    {
      id: 'retirement',
      label: 'Retirement Accounts',
      amount: savingsAlloc.retirementTaxAdv$,
      percent: (savingsAlloc.retirementTaxAdv$ / savingsBudget$) * 100,
      icon: <TrendingUp className="h-5 w-5" />,
      description: `Tax-advantaged ${savingsAlloc.routing.acctType} accounts for long-term growth`,
      color: '#8b5cf6',
    },
    {
      id: 'brokerage',
      label: 'Taxable Brokerage',
      amount: savingsAlloc.brokerage$,
      percent: (savingsAlloc.brokerage$ / savingsBudget$) * 100,
      icon: <PiggyBank className="h-5 w-5" />,
      description: 'Flexible investing for medium-term goals',
      color: '#14b8a6',
    },
  ].filter((cat) => cat.amount > 0.01); // Only show categories with meaningful amounts

  const categories = [emergencyCategory, ...otherCategories];

  const totalAllocated = categories.reduce((sum, cat) => sum + cat.amount, 0);
  const remaining = savingsBudget$ - totalAllocated;

  return (
    <>
    <Card className="w-full min-w-0 max-w-full overflow-x-hidden">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl sm:text-3xl font-bold">
            Your Savings Plan
          </CardTitle>
          <OnboardingChat context="savings-plan" inline />
        </div>
        <CardDescription className="text-base">
          Here's how we suggest allocating your ${savingsBudget$.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} /month savings budget. Adjust the settings below to optimize your allocation.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 overflow-x-hidden">
        {/* Input Section */}
        <div className="rounded-lg border bg-slate-50 p-4 dark:bg-slate-800">
          <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
            Retirement & Investment Settings
          </h3>
          <div className="space-y-4">
            {/* 401(k) Match */}
            <div className="space-y-2">
              <label htmlFor="match401k" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Building2 className="h-4 w-4" />
                401(k) Employer Match (per month)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 dark:text-slate-400">$</span>
                <input
                  id="match401k"
                  type="number"
                  min="0"
                  step="0.01"
                  value={match401kPerMonth}
                  onChange={(e) => setMatch401kPerMonth(parseFloat(e.target.value) || 0)}
                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Amount you need to contribute per paycheck to capture your full employer match
              </p>
            </div>

          </div>
        </div>

        {/* Savings Categories */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Allocation Breakdown
          </h3>
          
          {/* Emergency Fund Section with Slider */}
          {(() => {
            const efCategory = emergencyCategory;
            // Use slider value if user has adjusted it, otherwise use actual allocation
            const currentEfPct = hasAdjustedEfSlider ? efAllocationPct : (savingsAlloc.ef$ / savingsBudget$) * 100;
            const efAllocationAmount = (currentEfPct / 100) * savingsBudget$;
            const efCap = Math.min(savingsBudget$ * 0.4, efGap$ > 0 ? efGap$ : savingsBudget$);
            const maxPct = (efCap / savingsBudget$) * 100;
            
            return (
              <div className="rounded-lg border-2 border-green-200 bg-white p-4 dark:border-green-800 dark:bg-slate-800">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="rounded-lg p-2"
                      style={{ backgroundColor: `${efCategory.color}20` }}
                    >
                      <div style={{ color: efCategory.color }}>{efCategory.icon}</div>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {efCategory.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      ${efAllocationAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} /month
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {currentEfPct.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* EF Status: Current Balance and Target */}
                <div className="mb-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-700">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-slate-600 dark:text-slate-400">Current Balance</div>
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">
                        ${efBalance$.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Target</span>
                        <select
                          value={efTargetMonths}
                          onChange={(e) => {
                            const months = parseInt(e.target.value);
                            setEfTargetMonths(months);
                            updateSafetyStrategy({ efTargetMonths: months });
                          }}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="3">3 months</option>
                          <option value="6">6 months</option>
                        </select>
                      </div>
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">
                        ${efTarget$.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </div>
                      {efGap$ > 0 && (
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          ${efGap$.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })} remaining
                        </div>
                      )}
                      {efGap$ <= 0 && (
                        <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                          Target reached! ✓
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Slider */}
                <div className="mb-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Monthly Allocation (% of savings budget)
                    </span>
                    <span className="text-sm font-semibold">{currentEfPct.toFixed(1)}%</span>
                  </div>
                  <Slider
                    value={[currentEfPct]}
                    onValueChange={([value]) => {
                      setEfAllocationPct(Math.min(value, maxPct));
                      setHasAdjustedEfSlider(true);
                    }}
                    min={0}
                    max={maxPct}
                    step={0.5}
                    className="w-full"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {efGap$ > 0 
                      ? `Recommended: ${Math.min(40, (efGap$ / savingsBudget$) * 100).toFixed(1)}% to reach target`
                      : 'Target reached - excess allocation will go to other categories'}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${currentEfPct}%`,
                      backgroundColor: efCategory.color,
                    }}
                  />
                </div>

                {/* Description */}
                <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{efCategory.description}</p>
                </div>
              </div>
            );
          })()}
          
          {/* Other Categories */}
          {otherCategories.map((category) => (
            <div
              key={category.id}
              className="rounded-lg border bg-white p-4 dark:bg-slate-800"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="rounded-lg p-2"
                    style={{ backgroundColor: `${category.color}20` }}
                  >
                    <div style={{ color: category.color }}>{category.icon}</div>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {category.label}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    ${category.amount.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} /month
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {category.percent.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${category.percent}%`,
                    backgroundColor: category.color,
                  }}
                />
              </div>

              {/* Description */}
              <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{category.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Total Validation */}
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Total Allocated
            </span>
            <span className="font-bold text-slate-900 dark:text-white">
              ${totalAllocated.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} /month
            </span>
          </div>
          {remaining > 0.01 && (
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Remaining</span>
              <span className="text-amber-600 dark:text-amber-400">
                ${remaining.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} /month
              </span>
            </div>
          )}
        </div>

        {/* Notes */}
        {savingsAlloc.notes && savingsAlloc.notes.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Allocation Notes:
            </p>
            <ul className="mt-1 list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-300">
              {savingsAlloc.notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Routing Info */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Account Strategy: {savingsAlloc.routing.acctType} priority
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Retirement: {savingsAlloc.routing.splitRetirePct.toFixed(0)}% | Brokerage:{' '}
            {savingsAlloc.routing.splitBrokerPct.toFixed(0)}%
          </p>
        </div>

        {/* Continue Button */}
        <div className="pt-4">
          <Button onClick={handleContinue} size="lg" className="w-full">
            View Final Plan
          </Button>
        </div>
      </CardContent>
    </Card>
    </>
  );
}
