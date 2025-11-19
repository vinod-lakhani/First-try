/**
 * Onboarding - Snapshot Step
 * 
 * Step 4: Display financial snapshot based on Plaid data or income estimate.
 */

'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';

export default function SnapshotPage() {
  const router = useRouter();
  const {
    income,
    plaidConnected,
    assets,
    debts,
    fixedExpenses,
    baselineNetWorth,
    moneyPersona,
    setBaselineNetWorth,
    setMoneyPersona,
    setCurrentStep,
  } = useOnboardingStore();

  // Calculate net worth if we have Plaid data
  const calculatedNetWorth = useMemo(() => {
    if (!plaidConnected || assets.length === 0) return null;
    
    const totalAssets = assets.reduce((sum, asset) => sum + asset.value$, 0);
    const totalDebts = debts.reduce((sum, debt) => sum + debt.balance$, 0);
    return totalAssets - totalDebts;
  }, [plaidConnected, assets, debts]);

  // Calculate top spending categories
  const topCategories = useMemo(() => {
    if (!plaidConnected || fixedExpenses.length === 0) return [];
    
    const categoryTotals = fixedExpenses.reduce((acc, expense) => {
      const category = expense.category || 'other';
      acc[category] = (acc[category] || 0) + expense.amount$;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [plaidConnected, fixedExpenses]);

  // Determine money persona
  const determineMoneyPersona = (): string => {
    if (!plaidConnected || assets.length === 0 || debts.length === 0) {
      return 'The Starter';
    }
    
    const totalDebts = debts.reduce((sum, debt) => sum + debt.balance$, 0);
    const highAprDebts = debts.filter(d => d.isHighApr).length;
    const totalAssets = assets.reduce((sum, asset) => sum + asset.value$, 0);
    const netWorth = calculatedNetWorth || 0;
    
    if (highAprDebts > 0 && netWorth < 0) {
      return 'The Overloaded Juggler';
    }
    if (totalDebts > totalAssets * 0.5) {
      return 'The Debt Warrior';
    }
    if (netWorth > 50000) {
      return 'The Builder';
    }
    if (netWorth < 0) {
      return 'The Rebounder';
    }
    return 'The Balanced';
  };

  // Store net worth and persona on mount/update
  useEffect(() => {
    if (calculatedNetWorth !== null && plaidConnected) {
      const currentNetWorth = baselineNetWorth?.netWorthAtYears?.[0];
      if (currentNetWorth !== calculatedNetWorth) {
        setBaselineNetWorth({
          netWorthAtYears: { 0: calculatedNetWorth },
        });
      }
    }
    
    if (!moneyPersona) {
      const persona = determineMoneyPersona();
      setMoneyPersona(persona);
    }
  }, [calculatedNetWorth, plaidConnected, baselineNetWorth, moneyPersona, setBaselineNetWorth, setMoneyPersona]);

  const handleContinue = () => {
    setCurrentStep('goal');
    router.push('/onboarding/goal');
  };

  const currentPersona = moneyPersona || determineMoneyPersona();
  const netWorth = calculatedNetWorth ?? (income ? income.netIncome$ * 2 : 0);
  const lastPaycheck = income?.netIncome$ || 0;
  const snapshotDescription = plaidConnected
    ? 'Here\'s what we found from your accounts.'
    : 'Based on your income estimate.';

  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl sm:text-3xl font-bold">
          Your Money Snapshot
        </CardTitle>
        <CardDescription className="text-base">
          {snapshotDescription}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="rounded-lg border bg-gradient-to-br from-slate-50 to-slate-100 p-6 dark:from-slate-800 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Net Worth
              </p>
              <p className={`text-3xl font-bold ${
                netWorth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {netWorth >= 0 ? '+' : ''}${netWorth.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            {netWorth >= 0 ? (
              <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
            ) : (
              <TrendingDown className="h-8 w-8 text-red-600 dark:text-red-400" />
            )}
          </div>
        </div>

        {lastPaycheck > 0 && (
          <div className="rounded-lg border bg-white p-4 dark:bg-slate-800">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-slate-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Last Paycheck
                </p>
                <p className="text-xl font-semibold text-slate-900 dark:text-white">
                  ${lastPaycheck.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {plaidConnected && topCategories.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Top Spending Categories
            </h3>
            <div className="space-y-2">
              {topCategories.map((cat, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border bg-white p-3 dark:bg-slate-800"
                >
                  <span className="text-sm font-medium capitalize text-slate-700 dark:text-slate-300">
                    {cat.category}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    ${cat.amount.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-primary/5 p-4 dark:bg-primary/10">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Your Money Persona
              </p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {currentPersona}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Button onClick={handleContinue} size="lg" className="w-full">
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

