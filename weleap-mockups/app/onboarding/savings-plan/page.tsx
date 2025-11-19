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
import { allocateSavings, type SavingsInputs, type SavingsAllocation } from '@/lib/alloc/savings';
import { Info, Shield, CreditCard, TrendingUp, Building2, PiggyBank, HelpCircle } from 'lucide-react';

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

  const [savingsAlloc, setSavingsAlloc] = useState<SavingsAllocation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Local state for inputs
  const [match401kPerPaycheck, setMatch401kPerPaycheck] = useState<number>(
    safetyStrategy?.match401kPerPaycheck$ || 0
  );
  const [onIDR, setOnIDR] = useState<boolean>(safetyStrategy?.onIDR || false);
  const [iraRoom, setIraRoom] = useState<number>(safetyStrategy?.iraRoomThisYear$ || 7000);
  const [k401Room, setK401Room] = useState<number>(safetyStrategy?.k401RoomThisYear$ || 23000);
  const [liquidity, setLiquidity] = useState<'High' | 'Medium' | 'Low'>(
    safetyStrategy?.liquidity || 'Medium'
  );
  const [retirementFocus, setRetirementFocus] = useState<'High' | 'Medium' | 'Low'>(
    safetyStrategy?.retirementFocus || 'Medium'
  );

  // Get savings budget from paycheck plan
  const savingsBudget$ = useMemo(() => {
    return initialPaycheckPlan?.savings$ || 0;
  }, [initialPaycheckPlan]);

  // Calculate EF target and current balance
  const efTarget$ = useMemo(() => {
    if (!safetyStrategy?.efTargetMonths || fixedExpenses.length === 0) {
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
    return monthlyEssentials * safetyStrategy.efTargetMonths;
  }, [safetyStrategy, fixedExpenses]);

  const efBalance$ = useMemo(() => {
    return assets
      .filter((a) => a.type === 'cash' || a.type === 'savings')
      .reduce((sum, a) => sum + a.value$, 0);
  }, [assets]);

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
          matchNeedThisPeriod$: match401kPerPaycheck,
          incomeSingle$: income.incomeSingle$ || income.annualSalary$ || income.netIncome$ * 26,
          onIDR,
          liquidity,
          retirementFocus,
          iraRoomThisYear$: iraRoom,
          k401RoomThisYear$: k401Room,
        };

        const allocation = allocateSavings(inputs);
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
    highAprDebts,
    income,
    match401kPerPaycheck,
    onIDR,
    liquidity,
    retirementFocus,
    iraRoom,
    k401Room,
  ]);

  const handleContinue = () => {
    // Save inputs to store
    updateSafetyStrategy({
      match401kPerPaycheck$: match401kPerPaycheck,
      onIDR,
      iraRoomThisYear$: iraRoom,
      k401RoomThisYear$: k401Room,
      liquidity,
      retirementFocus,
    });
    setCurrentStep('plan-final');
    router.push('/onboarding/plan-final');
  };

  if (isGenerating) {
    return (
      <Card className="w-full">
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
        <CardContent className="py-12 text-center space-y-4">
          {savingsBudget$ <= 0 ? (
            <>
              <p className="text-red-600 dark:text-red-400 font-medium">
                Paycheck plan is required to generate savings allocation.
              </p>
              <Button
                onClick={() => router.push('/onboarding/paycheck-plan')}
                variant="outline"
              >
                Go to Paycheck Plan
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

  const categories: SavingsCategory[] = [
    {
      id: 'emergency',
      label: 'Emergency Fund',
      amount: savingsAlloc.ef$,
      percent: (savingsAlloc.ef$ / savingsBudget$) * 100,
      icon: <Shield className="h-5 w-5" />,
      description: 'Builds your safety net for unexpected expenses',
      color: '#10b981',
    },
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

  const totalAllocated = categories.reduce((sum, cat) => sum + cat.amount, 0);
  const remaining = savingsBudget$ - totalAllocated;

  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl sm:text-3xl font-bold">
          Your Savings Plan
        </CardTitle>
        <CardDescription className="text-base">
          Here's how we suggest allocating your ${savingsBudget$.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} savings budget. Adjust the settings below to optimize your allocation.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
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
                401(k) Employer Match (per paycheck)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 dark:text-slate-400">$</span>
                <input
                  id="match401k"
                  type="number"
                  min="0"
                  step="0.01"
                  value={match401kPerPaycheck}
                  onChange={(e) => setMatch401kPerPaycheck(parseFloat(e.target.value) || 0)}
                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Amount you need to contribute per paycheck to capture your full employer match
              </p>
            </div>

            {/* Student Loan IDR */}
            <div className="space-y-2">
              <label htmlFor="onIDR" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <HelpCircle className="h-4 w-4" />
                Student Loan IDR Plan
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="onIDR"
                  type="checkbox"
                  checked={onIDR}
                  onChange={(e) => setOnIDR(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  I'm on an Income-Driven Repayment plan
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Traditional 401(k) contributions can lower your AGI and reduce IDR payments
              </p>
            </div>

            {/* IRA Room */}
            <div className="space-y-2">
              <label htmlFor="iraRoom" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <TrendingUp className="h-4 w-4" />
                Remaining IRA Contribution Room (this year)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 dark:text-slate-400">$</span>
                <input
                  id="iraRoom"
                  type="number"
                  min="0"
                  step="100"
                  value={iraRoom}
                  onChange={(e) => setIraRoom(parseInt(e.target.value) || 0)}
                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                How much you can still contribute to IRA this year (max $7,000 for 2024)
              </p>
            </div>

            {/* 401(k) Room */}
            <div className="space-y-2">
              <label htmlFor="k401Room" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Building2 className="h-4 w-4" />
                Remaining 401(k) Contribution Room (this year, beyond match)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 dark:text-slate-400">$</span>
                <input
                  id="k401Room"
                  type="number"
                  min="0"
                  step="100"
                  value={k401Room}
                  onChange={(e) => setK401Room(parseInt(e.target.value) || 0)}
                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                How much you can still contribute to 401(k) beyond match (max $23,000 for 2024)
              </p>
            </div>

            {/* Liquidity Need */}
            <div className="space-y-2">
              <label htmlFor="liquidity" className="text-sm font-medium text-slate-700 dark:text-slate-300">Liquidity Need</label>
              <select
                id="liquidity"
                value={liquidity}
                onChange={(e) => setLiquidity(e.target.value as 'High' | 'Medium' | 'Low')}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              >
                <option value="High">High - Need access to funds soon</option>
                <option value="Medium">Medium - Some flexibility</option>
                <option value="Low">Low - Long-term focus</option>
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                How important is it to have quick access to your savings?
              </p>
            </div>

            {/* Retirement Focus */}
            <div className="space-y-2">
              <label htmlFor="retirementFocus" className="text-sm font-medium text-slate-700 dark:text-slate-300">Retirement Focus</label>
              <select
                id="retirementFocus"
                value={retirementFocus}
                onChange={(e) => setRetirementFocus(e.target.value as 'High' | 'Medium' | 'Low')}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              >
                <option value="High">High - Maximize retirement savings</option>
                <option value="Medium">Medium - Balanced approach</option>
                <option value="Low">Low - Focus on other goals</option>
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                How important is retirement savings vs. other financial goals?
              </p>
            </div>
          </div>
        </div>

        {/* Savings Categories */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Allocation Breakdown
          </h3>
          {categories.map((category) => (
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
                    })}
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
              })}
            </span>
          </div>
          {remaining > 0.01 && (
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Remaining</span>
              <span className="text-amber-600 dark:text-amber-400">
                ${remaining.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
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
  );
}
