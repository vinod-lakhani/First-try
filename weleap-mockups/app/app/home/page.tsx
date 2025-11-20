/**
 * Home Tab
 * 
 * Monthly pulse summary and notifications.
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import type { FinalPlanData } from '@/lib/onboarding/plan';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, AlertTriangle, CheckCircle2, Settings } from 'lucide-react';

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

export default function HomePage() {
  const state = useOnboardingStore();
  const planData = usePlanData(); // Use centralized hook for consistency
  const [showPulse, setShowPulse] = useState(false);

  // Calculate progress percentages and breakdowns
  // Show all individual subcategories, not lumped together
  const progressData = useMemo(() => {
    if (!planData) return null;

    const paychecksPerMonth = getPaychecksPerMonth(state.income?.payFrequency || 'biweekly');

    // Calculate totals first
    const needsCategories = planData.paycheckCategories.filter(c => 
      c.key === 'essentials' || c.key === 'debt_minimums'
    );
    const wantsCategories = planData.paycheckCategories.filter(c => 
      c.key === 'fun_flexible'
    );
    const savingsCategories = planData.paycheckCategories.filter(c => 
      c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
    );

    const monthlyNeeds = needsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
    const monthlyWants = wantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
    const monthlySavings = savingsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
    const monthlyTotal = monthlyNeeds + monthlyWants + monthlySavings;

    // Calculate percentages (assuming we're tracking actual vs planned)
    // For now, using mock data - in real app, this would come from transaction tracking
    const needsPct = 46; // Mock: 46% of planned
    const wantsPct = 65; // Mock: 65% of planned (overspent)
    const savingsPct = 29; // Mock: 29% of planned (undersaved)

    const safePercent = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);

    // Break down Needs into individual fixed expenses and debts
    const needsBreakdown: Array<{ label: string; amount: number; percent: number }> = [];
    
    // Add individual fixed expenses (essentials breakdown)
    // All expenses should be stored as monthly (single source of truth)
    // Show actual expenses from store - no scaling
    if (state.fixedExpenses.length > 0) {
      state.fixedExpenses.forEach(exp => {
        needsBreakdown.push({
          label: exp.name,
          amount: exp.amount$, // amount$ is already monthly
          percent: safePercent(exp.amount$, monthlyNeeds),
        });
      });
    } else {
      // Fallback: show essentials category if no fixed expenses
      const essentialsCategory = planData.paycheckCategories.find(cat => cat.key === 'essentials');
      if (essentialsCategory) {
        needsBreakdown.push({
          label: essentialsCategory.label,
          amount: essentialsCategory.amount * paychecksPerMonth,
          percent: safePercent(essentialsCategory.amount * paychecksPerMonth, monthlyNeeds),
        });
      }
    }
    
    // Add individual debt minimums
    // Debts should have minPayment$ in monthly terms (single source of truth)
    if (state.debts.length > 0) {
      state.debts.forEach(debt => {
        needsBreakdown.push({
          label: debt.name,
          amount: debt.minPayment$, // minPayment$ should already be monthly
          percent: safePercent(debt.minPayment$, monthlyNeeds),
        });
      });
    } else {
      // Fallback: show debt minimums category if no debts
      const debtMinCategory = planData.paycheckCategories.find(cat => cat.key === 'debt_minimums');
      if (debtMinCategory) {
        needsBreakdown.push({
          label: debtMinCategory.label,
          amount: debtMinCategory.amount * paychecksPerMonth,
          percent: safePercent(debtMinCategory.amount * paychecksPerMonth, monthlyNeeds),
        });
      }
    }

    // Wants: Already individual (fun_flexible)
    const wantsBreakdown = wantsCategories.map(c => {
      const amount = c.amount * paychecksPerMonth;
      return {
        label: c.label,
        amount,
        percent: monthlyWants > 0 ? (amount / monthlyWants) * 100 : 0,
      };
    });

    // Savings: Break down into individual components
    const savingsBreakdown: Array<{ label: string; amount: number; percent: number }> = [];
    
    // Get individual savings components directly from plan data
    const emergencyCategory = planData.paycheckCategories.find(cat => cat.key === 'emergency');
    const debtExtraCategory = planData.paycheckCategories.find(cat => cat.key === 'debt_extra');
    const longTermCategory = planData.paycheckCategories.find(cat => cat.key === 'long_term_investing');
    
    // Add Emergency Savings
    if (emergencyCategory) {
      const amount = emergencyCategory.amount * paychecksPerMonth;
      savingsBreakdown.push({
        label: emergencyCategory.label,
        amount,
        percent: monthlySavings > 0 ? (amount / monthlySavings) * 100 : 0,
      });
    }
    
    // Add Extra Debt Paydown
    if (debtExtraCategory) {
      const amount = debtExtraCategory.amount * paychecksPerMonth;
      savingsBreakdown.push({
        label: debtExtraCategory.label,
        amount,
        percent: monthlySavings > 0 ? (amount / monthlySavings) * 100 : 0,
      });
    }
    
    // Break down Long-Term Investing into components using subCategories
    if (longTermCategory?.subCategories?.length) {
      longTermCategory.subCategories.forEach(subCat => {
        const amount = subCat.amount * paychecksPerMonth;
        if (amount > 0.01) {
          savingsBreakdown.push({
            label: subCat.label,
            amount,
            percent: monthlySavings > 0 ? (amount / monthlySavings) * 100 : 0,
          });
        }
      });
    } else if (longTermCategory) {
      const amount = longTermCategory.amount * paychecksPerMonth;
      savingsBreakdown.push({
        label: longTermCategory.label,
        amount,
        percent: monthlySavings > 0 ? (amount / monthlySavings) * 100 : 0,
      });
    }

    return {
      needsPct,
      wantsPct,
      savingsPct,
      monthlyNeeds,
      monthlyWants,
      monthlySavings,
      needsCategories: needsBreakdown.sort((a, b) => b.amount - a.amount),
      wantsCategories: wantsBreakdown,
      savingsCategories: savingsBreakdown.sort((a, b) => b.amount - a.amount),
    };
  }, [planData, state.fixedExpenses, state.debts, state.income]);

  useEffect(() => {
    if (progressData) {
      console.log('[Home Monthly Pulse] Totals', [{
        monthlyNeeds: progressData.monthlyNeeds,
        monthlyWants: progressData.monthlyWants,
        monthlySavings: progressData.monthlySavings,
        needsPct: progressData.needsPct,
        wantsPct: progressData.wantsPct,
        savingsPct: progressData.savingsPct,
      }]);
      console.log('[Home Monthly Pulse] Savings Breakdown', [progressData.savingsCategories]);
    }
  }, [progressData]);

  if (!planData || !progressData) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading your monthly pulse...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      {/* Monthly Pulse Content - Flattened */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto w-full max-w-lg space-y-4">
          {/* Monthly Pulse Card */}
          <Card className="w-full">
            <CardContent className="space-y-4 p-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Monthly Pulse</h2>
              </div>

              {/* Progress Bars */}
              <div className="space-y-3">
                {/* Needs */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium">Needs</span>
                    <span className="font-semibold">{progressData.needsPct}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full bg-orange-500 transition-all"
                      style={{ width: `${progressData.needsPct}%` }}
                    />
                  </div>
                  {/* Needs Subcategories - Compact */}
                  {progressData.needsCategories.length > 0 && (
                    <div className="mt-1.5 space-y-0.5 pl-2">
                      {progressData.needsCategories.map((cat) => (
                        <div key={cat.label} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                          <span className="truncate">{cat.label}</span>
                          <span className="ml-2 shrink-0">${cat.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({cat.percent.toFixed(1)}%)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Wants */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium">Wants</span>
                    <span className="font-semibold">{progressData.wantsPct}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${progressData.wantsPct}%` }}
                    />
                  </div>
                  {/* Wants Subcategories - Compact */}
                  {progressData.wantsCategories.length > 0 && (
                    <div className="mt-1.5 space-y-0.5 pl-2">
                      {progressData.wantsCategories.map((cat) => (
                        <div key={cat.label} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                          <span className="truncate">{cat.label}</span>
                          <span className="ml-2 shrink-0">${cat.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({cat.percent.toFixed(1)}%)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Savings */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium">Savings</span>
                    <span className="font-semibold">{progressData.savingsPct}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${progressData.savingsPct}%` }}
                    />
                  </div>
                  {/* Savings Subcategories - Compact */}
                  {progressData.savingsCategories.length > 0 && (
                    <div className="mt-1.5 space-y-0.5 pl-2">
                      {progressData.savingsCategories.map((cat) => (
                        <div key={cat.label} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                          <span className="truncate">{cat.label}</span>
                          <span className="ml-2 shrink-0">${cat.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({cat.percent.toFixed(1)}%)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Notification Cards */}
              <div className="space-y-3">
                {/* Warning Card */}
                <div className="flex items-start gap-2 rounded-lg bg-orange-50 p-2 dark:bg-orange-900/20">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
                  <p className="text-xs text-slate-900 dark:text-white">
                    Overspent Wants by $158 and Saved $248 less than planned
                  </p>
                </div>

                {/* Success Card */}
                <div className="flex items-start gap-2 rounded-lg bg-green-50 p-2 dark:bg-green-900/20">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                  <p className="text-xs text-slate-900 dark:text-white">
                    To show Success, confirmation, or completion of a smart recipe
                  </p>
                </div>

                {/* General Notification Card */}
                <div className="flex items-start gap-2 rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                  <Settings className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-400" />
                  <p className="text-xs text-slate-900 dark:text-white">
                    Use when the user needs to update something or as a general notification
                  </p>
                </div>
              </div>

              {/* Pagination Dots */}
              <div className="flex justify-center gap-1.5">
                {[1, 2, 3, 4, 5].map((dot) => (
                  <div
                    key={dot}
                    className={`h-1.5 w-1.5 rounded-full ${
                      dot === 1
                        ? 'bg-slate-900 dark:bg-slate-100'
                        : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Net Worth Growth Notification Card - Below Monthly Pulse */}
          <Card className="bg-green-50 dark:bg-green-900/20">
            <CardContent className="flex items-center gap-2 p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
              <p className="text-xs text-slate-900 dark:text-white">
                You&apos;re on track for $10K net worth growth this year. Want to push to $12K?
              </p>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Monthly Pulse Modal (for other pages if needed) */}
      {showPulse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-xl font-bold">Monthly Pulse</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPulse(false)}
                className="h-8 w-8"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <CardContent className="space-y-6 p-4">
              {/* Progress Bars */}
              <div className="space-y-4">
                {/* Needs */}
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium">Needs</span>
                    <span className="font-semibold">{progressData.needsPct}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full bg-orange-500 transition-all"
                      style={{ width: `${progressData.needsPct}%` }}
                    />
                  </div>
                </div>

                {/* Wants */}
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium">Wants</span>
                    <span className="font-semibold">{progressData.wantsPct}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${progressData.wantsPct}%` }}
                    />
                  </div>
                </div>

                {/* Savings */}
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium">Savings</span>
                    <span className="font-semibold">{progressData.savingsPct}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${progressData.savingsPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Notification Cards */}
              <div className="space-y-3">
                {/* Warning Card */}
                <div className="flex items-start gap-3 rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400" />
                  <p className="text-sm text-slate-900 dark:text-white">
                    Overspent Wants by $158 and Saved $248 less than planned
                  </p>
                </div>

                {/* Success Card */}
                <div className="flex items-start gap-3 rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                  <p className="text-sm text-slate-900 dark:text-white">
                    To show Success, confirmation, or completion of a smart recipe
                  </p>
                </div>

                {/* General Notification Card */}
                <div className="flex items-start gap-3 rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
                  <Settings className="h-5 w-5 shrink-0 text-slate-600 dark:text-slate-400" />
                  <p className="text-sm text-slate-900 dark:text-white">
                    Use when the user needs to update something or as a general notification
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <Button
                onClick={() => setShowPulse(false)}
                className="w-full bg-green-600 text-white hover:bg-green-700"
              >
                Close View
              </Button>

              {/* Pagination Dots */}
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((dot) => (
                  <div
                    key={dot}
                    className={`h-2 w-2 rounded-full ${
                      dot === 1
                        ? 'bg-slate-900 dark:bg-slate-100'
                        : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
