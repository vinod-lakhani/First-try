/**
 * Home Screen Component
 * 
 * Monthly snapshot dashboard showing pulse, insights, net worth, and goals.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingUp, TrendingDown, PiggyBank, Target, ChevronDown, ChevronUp } from 'lucide-react';
import type { HomeScreenData } from '@/lib/home/types';
import { formatCurrency, formatPercent } from '@/lib/feed/utils';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { getPaychecksPerMonth, usePlanData } from '@/lib/onboarding/usePlanData';
import { calculateSavingsBreakdown } from '@/lib/utils/savingsCalculations';

interface HomeScreenProps {
  data: HomeScreenData;
}

export function HomeScreen({ data }: HomeScreenProps) {
  const router = useRouter();
  const state = useOnboardingStore();
  const [savingsExpanded, setSavingsExpanded] = useState(false);
  const planData = usePlanData(); // Get plan data for consistent calculation

  const { summary, insights, netWorth, goals } = data;

  // Use centralized savings calculation for consistency
  const paychecksPerMonth = getPaychecksPerMonth(state.income?.payFrequency || 'monthly');
  const payrollContributions = state.payrollContributions;
  const income = state.income;
  
  // Calculate monthly needs and wants from plan categories
  const monthlyNeeds = planData && planData.paycheckCategories
    ? planData.paycheckCategories
        .filter(c => c.key === 'essentials' || c.key === 'debt_minimums')
        .reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth
    : 0;
  
  const monthlyWants = planData && planData.paycheckCategories
    ? planData.paycheckCategories
        .filter(c => c.key === 'fun_flexible')
        .reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth
    : 0;
  
  // Use centralized calculation function
  const savingsBreakdown = calculateSavingsBreakdown(income, payrollContributions, monthlyNeeds, monthlyWants);
  
  const observedCashSavingsMTD = savingsBreakdown.cashSavingsMTD;
  const expectedPayrollSavingsMTD = savingsBreakdown.payrollSavingsMTD;
  const expectedMatchMTD = savingsBreakdown.employerMatchMTD;
  const totalSavingsMTD = savingsBreakdown.totalSavingsMTD;
  
  // Debug: Log calculation to verify consistency
  console.log('[HomeScreen] Savings Breakdown:', savingsBreakdown);

  // Calculate targets
  const targetCashSavingsMTD = summary.plannedSavings$; // For now, use planned savings as target for cash
  const targetPayrollSavingsMTD = expectedPayrollSavingsMTD; // Target equals expected
  const targetMatchMTD = expectedMatchMTD; // Target equals expected match
  const targetTotalSavingsMTD = targetCashSavingsMTD + targetPayrollSavingsMTD + targetMatchMTD;

  // Determine pulse headline - compare Total Savings vs Total Savings Target
  const deltaVsPlan = totalSavingsMTD - targetTotalSavingsMTD;
  const pulseHeadline = deltaVsPlan >= 0
    ? `You're on track this month: +${formatCurrency(Math.abs(deltaVsPlan))} vs your savings plan.`
    : `You're behind by ${formatCurrency(Math.abs(deltaVsPlan))} on your savings this month.`;

  const handleAction = (action: typeof insights[0]['ctaAction']) => {
    if (!action) return;

    switch (action.kind) {
      case 'open_optimizer':
        const { tool, focus } = action.payload || {};
        if (tool === 'savings_optimizer') {
          router.push('/app/tools/savings-optimizer');
        } else if (tool === 'savings_allocator') {
          router.push('/app/tools/savings-allocator');
        }
        break;
      case 'open_feed':
        router.push('/app/feed');
        break;
      case 'open_goal':
        // Handle goal opening
        break;
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
          {/* 1. Monthly Pulse Summary */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="text-xl">Monthly Pulse</CardTitle>
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
                      {formatPercent((summary.needs$ / summary.income$) * 100)} ({formatCurrency(summary.needs$)})
                    </span>
                  </div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all"
                      style={{ width: `${(summary.needs$ / summary.income$) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Target: {formatPercent(summary.targetNeedsPct)}
                  </p>
                </div>

                {/* Wants */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400">Wants</span>
                    <span className="font-medium">
                      {formatPercent((summary.wants$ / summary.income$) * 100)} ({formatCurrency(summary.wants$)})
                    </span>
                  </div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${(summary.wants$ / summary.income$) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Target: {formatPercent(summary.targetWantsPct)}
                  </p>
                </div>

                {/* Savings - Expandable */}
                <div>
                  <button
                    onClick={() => setSavingsExpanded(!savingsExpanded)}
                    className="w-full"
                  >
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 dark:text-slate-400">Savings</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {formatPercent((totalSavingsMTD / summary.income$) * 100)} ({formatCurrency(totalSavingsMTD)})
                        </span>
                        {savingsExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${Math.min((totalSavingsMTD / summary.income$) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Target: {formatPercent(summary.targetSavingsPct)}
                    </p>
                  </button>

                  {/* Savings Breakdown */}
                  {savingsExpanded && (
                    <div className="mt-3 space-y-2 pl-2 border-l-2 border-green-200 dark:border-green-800">
                      {/* Cash Savings (Post-tax) */}
                      <div className="text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Cash savings (Post-tax):</span>
                          <span className="font-medium text-slate-900 dark:text-white">
                            {formatCurrency(observedCashSavingsMTD)}
                          </span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 italic">observed</div>
                      </div>

                      {/* Payroll Savings (Pre-tax) */}
                      {expectedPayrollSavingsMTD > 0 && (
                        <div className="text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">Payroll savings (Pre-tax):</span>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {formatCurrency(expectedPayrollSavingsMTD)}
                            </span>
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 italic">estimated</div>
                        </div>
                      )}

                      {/* Employer Match */}
                      {expectedMatchMTD > 0 && (
                        <div className="text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">Employer match:</span>
                            <span className="font-medium text-green-600 dark:text-green-400">
                              +{formatCurrency(expectedMatchMTD)}
                            </span>
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 italic">estimated</div>
                        </div>
                      )}

                      {/* Total Savings */}
                      <div className="text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between font-semibold">
                          <span className="text-slate-700 dark:text-slate-300">Total Savings (Cash + Payroll + Match):</span>
                          <span className="text-slate-900 dark:text-white">
                            {formatCurrency(totalSavingsMTD)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={() => router.push('/app/tools/monthly-pulse')}
                variant="outline"
                className="w-full"
              >
                View full Monthly Pulse
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* 2. Top 3 Insights */}
          {insights.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Top Insights
              </h2>
              {insights.map((insight) => (
                <Card key={insight.id} className="border border-slate-200 dark:border-slate-700">
                  <CardContent className="pt-4">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                      {insight.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                      {insight.body}
                    </p>
                    {insight.ctaLabel && insight.ctaAction && (
                      <Button
                        onClick={() => handleAction(insight.ctaAction)}
                        variant="ghost"
                        size="sm"
                      >
                        {insight.ctaLabel}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 3. Net Worth Snapshot */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Net Worth</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(netWorth.currentNetWorth$)}
                </span>
                <div className={`flex items-center gap-1 ${netWorth.deltaVsLastMonth$ >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {netWorth.deltaVsLastMonth$ >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium">
                    {netWorth.deltaVsLastMonth$ >= 0 ? '+' : ''}
                    {formatCurrency(netWorth.deltaVsLastMonth$)} vs last month
                  </span>
                </div>
              </div>
              <Button
                onClick={() => router.push('/app/tools/net-worth-viewer')}
                variant="outline"
                className="w-full"
              >
                Open Net Worth View
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* 4. Quick Actions */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => router.push('/app/tools/savings-helper')}
                variant="outline"
                className="h-auto !flex-col !items-start p-4 !whitespace-normal"
              >
                <div className="flex items-start gap-2 mb-1.5 w-full min-w-0">
                  <PiggyBank className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="font-semibold text-left leading-tight text-sm min-w-0 flex-1 break-words overflow-wrap-anywhere">Help me figure out how much I can save?</span>
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400 text-left w-full">
                  Adjust your monthly savings rate
                </span>
              </Button>
              <Button
                onClick={() => router.push('/app/tools/savings-allocator')}
                variant="outline"
                className="h-auto !flex-col !items-start p-4 !whitespace-normal"
              >
                <div className="flex items-start gap-2 mb-1.5 w-full min-w-0">
                  <Target className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <span className="font-semibold text-left leading-tight text-sm min-w-0 flex-1 break-words overflow-wrap-anywhere">Help me figure out what to do with my savings?</span>
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400 text-left w-full">
                  Rebalance EF, debt, retirement
                </span>
              </Button>
            </div>
          </div>

          {/* 5. Monthly Goals Progress */}
          {goals.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Monthly Goals
              </h2>
              {goals.map((goal) => {
                const progressPct = goal.target$ > 0 
                  ? (goal.current$ / goal.target$) * 100 
                  : 0;
                const isDebt = goal.target$ === 0;

                return (
                  <Card key={goal.id} className="border border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {goal.label}
                          </h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {isDebt 
                              ? `${formatCurrency(goal.current$)} left`
                              : `${formatCurrency(goal.current$)} / ${formatCurrency(goal.target$)}`
                            }
                            {goal.contributedThisMonth$ > 0 && (
                              <span className="ml-2 text-green-600 dark:text-green-400">
                                +{formatCurrency(goal.contributedThisMonth$)} this month
                              </span>
                            )}
                          </p>
                        </div>
                        {!isDebt && (
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                            {formatPercent(progressPct)}
                          </span>
                        )}
                      </div>
                      {!isDebt && (
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${Math.min(progressPct, 100)}%` }}
                          />
                        </div>
                      )}
                      <Button
                        onClick={() => {
                          if (goal.id === 'goal-ef') {
                            router.push('/app/tools/savings-allocator');
                          } else if (goal.id === 'goal-debt') {
                            router.push('/app/tools/savings-allocator');
                          } else {
                            // For monthly savings goal, open savings optimizer
                            router.push('/app/tools/savings-optimizer');
                          }
                        }}
                        variant="ghost"
                        size="sm"
                      >
                        Boost this goal
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* 6. Link to Feed */}
          <Card className="border border-slate-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <Button
                onClick={() => router.push('/app/feed')}
                variant="outline"
                className="w-full"
              >
                See all insights and notifications
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

