/**
 * Monthly Plan Current - Read-only view of actual spending
 * 
 * Shows current monthly picture based on actuals from Plaid/expenses.
 */

'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, Home, Sparkles, PiggyBank, ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react';
import { OnboardingChat } from '@/components/onboarding/OnboardingChat';

export type MonthlyBucket = {
  label: string;         // "Needs" or "Wants"
  amount: number;        // in dollars
  percentOfIncome: number;
  breakdown: { label: string; amount: number; percentOfBucket: number }[];
};

export type MonthlyPlanCurrentProps = {
  income: number;        // monthly income
  needs: MonthlyBucket;
  wants: MonthlyBucket;
  savingsAmount: number; // income - (needs.amount + wants.amount)
  onContinue?: () => void;
};

const MonthlyPlanCurrent: React.FC<MonthlyPlanCurrentProps> = ({
  income,
  needs,
  wants,
  savingsAmount,
  onContinue,
}) => {
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);
  const expenses = needs.amount + wants.amount;

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatPercent = (percent: number) => {
    return `${percent.toFixed(1)}%`;
  };

  const toggleBucket = (bucketLabel: string) => {
    setExpandedBucket(expandedBucket === bucketLabel ? null : bucketLabel);
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center">
      <div className="w-full max-w-md sm:max-w-lg lg:max-w-xl px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-center text-slate-900 dark:text-white">
            Your Current Monthly Picture
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
            Here&apos;s how your money looks based on your recent activity. We&apos;ll use this as a starting point for your plan.
          </p>
        </div>

        {/* Income */}
        <Card className="rounded-2xl border p-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Income</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(income)} / month
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Estimated from your recent deposits.
              </p>
            </div>
          </div>
        </Card>

        {/* Expenses */}
        <Card className="rounded-2xl border p-4">
          <div className="space-y-4">
            {/* Expenses Header */}
            <div className="flex items-start gap-3">
              <div className="mt-1 h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center shrink-0">
                <ShoppingBag className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Expenses</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(expenses)} / month
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  What you&apos;re currently spending each month.
                </p>
              </div>
            </div>

            {/* Needs & Wants Pills */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
            {/* Needs Pill */}
            <button
              onClick={() => toggleBucket('Needs')}
              className="flex-1 min-w-[140px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">Needs</span>
                {expandedBucket === 'Needs' ? (
                  <ChevronUp className="h-4 w-4 text-slate-400 ml-auto" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400 ml-auto" />
                )}
              </div>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                {formatCurrency(needs.amount)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatPercent(needs.percentOfIncome)} of income
              </p>
            </button>

            {/* Wants Pill */}
            <button
              onClick={() => toggleBucket('Wants')}
              className="flex-1 min-w-[140px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full bg-purple-600"></div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">Wants</span>
                {expandedBucket === 'Wants' ? (
                  <ChevronUp className="h-4 w-4 text-slate-400 ml-auto" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400 ml-auto" />
                )}
              </div>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                {formatCurrency(wants.amount)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatPercent(wants.percentOfIncome)} of income
              </p>
                </button>
              </div>

              {/* Breakdown Tables */}
              {expandedBucket === 'Needs' && needs.breakdown.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 mt-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
                    Needs Breakdown
                  </p>
                  <div className="space-y-2">
                    {needs.breakdown.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                        <div className="text-right">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(item.amount)}
                          </span>
                          {needs.breakdown.length > 1 && (
                            <span className="ml-2 text-slate-500 dark:text-slate-400">
                              ({formatPercent(item.percentOfBucket)})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {expandedBucket === 'Wants' && wants.breakdown.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 mt-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
                    Wants Breakdown
                  </p>
                  <div className="space-y-2">
                    {wants.breakdown.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                        <div className="text-right">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(item.amount)}
                          </span>
                          {wants.breakdown.length > 1 && (
                            <span className="ml-2 text-slate-500 dark:text-slate-400">
                              ({formatPercent(item.percentOfBucket)})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Savings */}
        <Card className="rounded-2xl border p-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center shrink-0">
              <PiggyBank className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Savings (what&apos;s left)</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(savingsAmount)} / month
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                ({formatPercent((savingsAmount / income) * 100)} of income)
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                This is what&apos;s left after your expenses — including transfers to savings, investments, or just leftover cash.
              </p>
            </div>
          </div>
        </Card>

            {/* CTA Button */}
            <div className="pt-4">
              <Button 
                onClick={() => {
                  onContinue?.();
                }} 
                size="lg" 
                className="w-full"
              >
                Build My Monthly Plan
              </Button>
            </div>

            {/* Floating Ribbit Chat Button */}
            <OnboardingChat context="monthly-plan-current" />
          </div>
        </div>
      );
    };

    export default MonthlyPlanCurrent;

