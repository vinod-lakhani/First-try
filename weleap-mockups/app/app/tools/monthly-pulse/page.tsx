/**
 * Monthly Pulse Detail Page
 * 
 * Shows detailed breakdown of Needs, Wants, and Savings with all sub-categories.
 */

'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/feed/utils';
import { getPaychecksPerMonth } from '@/lib/onboarding/usePlanData';

export default function MonthlyPulsePage() {
  const router = useRouter();
  const state = useOnboardingStore();
  const planData = usePlanData();

  const income = state.income;
  const paychecksPerMonth = getPaychecksPerMonth(income?.payFrequency || 'biweekly');
  const monthlyIncome = planData ? planData.paycheckAmount * paychecksPerMonth : 0;

  // Get targets from riskConstraints or use defaults
  const targets = state.riskConstraints?.targets || {
    needsPct: 0.5,
    wantsPct: 0.3,
    savingsPct: 0.2,
  };

  // Normalize targets if they're in percentage format (50, 30, 20)
  const targetSum = targets.needsPct + targets.wantsPct + targets.savingsPct;
  const normalizedTargets = useMemo(() => {
    if (Math.abs(targetSum - 100) < 1 && Math.abs(targetSum - 1.0) > 0.1) {
      return {
        needsPct: targets.needsPct,
        wantsPct: targets.wantsPct,
        savingsPct: targets.savingsPct,
      };
    }
    return {
      needsPct: targets.needsPct * 100,
      wantsPct: targets.wantsPct * 100,
      savingsPct: targets.savingsPct * 100,
    };
  }, [targets, targetSum]);

  // Calculate breakdowns from plan categories - same as Income page
  const breakdowns = useMemo(() => {
    if (!planData) {
      return {
        needs: [],
        wants: [],
        savings: [],
      };
    }

    // For Needs: Break down essentials into individual fixed expenses, plus show debt minimums separately
    const needsList: Array<{ label: string; amount: number }> = [];
    
    // Add individual fixed expenses (essentials breakdown)
    if (state.fixedExpenses.length > 0) {
      state.fixedExpenses.forEach(exp => {
        needsList.push({
          label: exp.name,
          amount: exp.amount$,
        });
      });
    } else {
      // Fallback: show essentials category if no fixed expenses
      const essentialsCategory = planData.paycheckCategories.find(cat => cat.key === 'essentials');
      if (essentialsCategory) {
        needsList.push({
          label: essentialsCategory.label,
          amount: essentialsCategory.amount * paychecksPerMonth,
        });
      }
    }
    
    // Add debt minimums (show each debt separately)
    if (state.debts.length > 0) {
      state.debts.forEach(debt => {
        needsList.push({
          label: debt.name,
          amount: debt.minPayment$,
        });
      });
    } else {
      // Fallback: show debt minimums category if no debts
      const debtMinCategory = planData.paycheckCategories.find(cat => cat.key === 'debt_minimums');
      if (debtMinCategory) {
        needsList.push({
          label: debtMinCategory.label,
          amount: debtMinCategory.amount * paychecksPerMonth,
        });
      }
    }

    // Wants: Show fun_flexible category
    const wantsList = planData.paycheckCategories
      .filter(cat => cat.key === 'fun_flexible')
      .map(cat => ({
        label: cat.label,
        amount: cat.amount * paychecksPerMonth,
      }));

    // Savings: Break down into individual components
    const savingsList: Array<{ label: string; amount: number }> = [];
    
    // Get individual savings components
    const emergencyCategory = planData.paycheckCategories.find(cat => cat.key === 'emergency');
    const debtExtraCategory = planData.paycheckCategories.find(cat => cat.key === 'debt_extra');
    const longTermCategory = planData.paycheckCategories.find(cat => cat.key === 'long_term_investing');
    
    // Add Emergency Savings
    if (emergencyCategory) {
      savingsList.push({
        label: emergencyCategory.label,
        amount: emergencyCategory.amount * paychecksPerMonth,
      });
    }
    
    // Add Extra Debt Paydown
    if (debtExtraCategory) {
      savingsList.push({
        label: debtExtraCategory.label,
        amount: debtExtraCategory.amount * paychecksPerMonth,
      });
    }
    
    // Break down Long-Term Investing into components using subCategories
    if (longTermCategory && longTermCategory.subCategories) {
      longTermCategory.subCategories.forEach(subCat => {
        const monthlyAmount = subCat.amount * paychecksPerMonth;
        if (monthlyAmount > 0.01) {
          savingsList.push({
            label: subCat.label,
            amount: monthlyAmount,
          });
        }
      });
    } else if (longTermCategory) {
      savingsList.push({
        label: longTermCategory.label,
        amount: longTermCategory.amount * paychecksPerMonth,
      });
    }

    return {
      needs: needsList.sort((a, b) => b.amount - a.amount),
      wants: wantsList.sort((a, b) => b.amount - a.amount),
      savings: savingsList.sort((a, b) => b.amount - a.amount),
    };
  }, [planData, paychecksPerMonth, state.fixedExpenses, state.debts]);

  // Calculate totals
  const totalNeeds = breakdowns.needs.reduce((sum, item) => sum + item.amount, 0);
  const totalWants = breakdowns.wants.reduce((sum, item) => sum + item.amount, 0);
  const totalSavings = breakdowns.savings.reduce((sum, item) => sum + item.amount, 0);
  const totalIncome = totalNeeds + totalWants + totalSavings;

  const needsPct = totalIncome > 0 ? (totalNeeds / totalIncome) * 100 : 0;
  const wantsPct = totalIncome > 0 ? (totalWants / totalIncome) * 100 : 0;
  const savingsPct = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

  if (!planData) {
    return (
      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading monthly pulse...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine pulse headline
  const savingsDelta = totalSavings - (normalizedTargets.savingsPct / 100) * monthlyIncome;
  const pulseHeadline = savingsDelta >= 0
    ? `You're on track this month: +${formatCurrency(Math.abs(savingsDelta))} vs your savings plan.`
    : `You're behind by ${formatCurrency(Math.abs(savingsDelta))} on your savings this month.`;

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Monthly Pulse</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Detailed breakdown of your income allocation
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

          {/* Pulse Summary Card */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="text-xl">Monthly Pulse Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="font-medium text-slate-900 dark:text-white">
                {pulseHeadline}
              </p>

              {/* N/W/S Visualization */}
              <div className="space-y-3">
                {/* Needs */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400">Needs</span>
                    <span className="font-medium">
                      {formatPercent(needsPct)} ({formatCurrency(totalNeeds)})
                    </span>
                  </div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all"
                      style={{ width: `${needsPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Target: {formatPercent(normalizedTargets.needsPct)}
                  </p>
                </div>

                {/* Wants */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400">Wants</span>
                    <span className="font-medium">
                      {formatPercent(wantsPct)} ({formatCurrency(totalWants)})
                    </span>
                  </div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${wantsPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Target: {formatPercent(normalizedTargets.wantsPct)}
                  </p>
                </div>

                {/* Savings */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400">Savings</span>
                    <span className="font-medium">
                      {formatPercent(savingsPct)} ({formatCurrency(totalSavings)})
                    </span>
                  </div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${savingsPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Target: {formatPercent(normalizedTargets.savingsPct)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Needs Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Needs</CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Total: {formatCurrency(totalNeeds)} ({formatPercent(needsPct)})
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {breakdowns.needs.length > 0 ? (
                  breakdowns.needs.map((item) => {
                    const maxAmount = Math.max(...breakdowns.needs.map(e => e.amount), 1);
                    const widthPct = (item.amount / maxAmount) * 100;
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.label}</span>
                          <span className="font-semibold">{formatCurrency(item.amount)}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className="h-full bg-orange-500 transition-all"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-400">No needs categories</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Wants Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Wants</CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Total: {formatCurrency(totalWants)} ({formatPercent(wantsPct)})
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {breakdowns.wants.length > 0 ? (
                  breakdowns.wants.map((item) => {
                    const maxAmount = Math.max(...breakdowns.wants.map(e => e.amount), 1);
                    const widthPct = (item.amount / maxAmount) * 100;
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.label}</span>
                          <span className="font-semibold">{formatCurrency(item.amount)}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-400">No wants categories</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Savings Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Savings</CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Total: {formatCurrency(totalSavings)} ({formatPercent(savingsPct)})
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {breakdowns.savings.length > 0 ? (
                  breakdowns.savings.map((item) => {
                    const maxAmount = Math.max(...breakdowns.savings.map(s => s.amount), 1);
                    const widthPct = (item.amount / maxAmount) * 100;
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.label}</span>
                          <span className="font-semibold">{formatCurrency(item.amount)}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-400">No savings categories</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

