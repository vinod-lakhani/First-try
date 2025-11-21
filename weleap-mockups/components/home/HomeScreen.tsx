/**
 * Home Screen Component
 * 
 * Monthly snapshot dashboard showing pulse, insights, net worth, and goals.
 */

'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import type { HomeScreenData } from '@/lib/home/types';
import { formatCurrency, formatPercent } from '@/lib/feed/utils';
import { NetWorthSparkline } from './NetWorthSparkline';

interface HomeScreenProps {
  data: HomeScreenData;
}

export function HomeScreen({ data }: HomeScreenProps) {
  const router = useRouter();

  const { summary, insights, netWorth, goals } = data;

  // Determine pulse headline
  const savingsDelta = summary.savings$ - summary.plannedSavings$;
  const pulseHeadline = savingsDelta >= 0
    ? `You're on track this month: +${formatCurrency(Math.abs(savingsDelta))} vs your savings plan.`
    : `You're behind by ${formatCurrency(Math.abs(savingsDelta))} on your savings this month.`;

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

                {/* Savings */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400">Savings</span>
                    <span className="font-medium">
                      {formatPercent((summary.savings$ / summary.income$) * 100)} ({formatCurrency(summary.savings$)})
                    </span>
                  </div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${(summary.savings$ / summary.income$) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Target: {formatPercent(summary.targetSavingsPct)}
                  </p>
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
              <NetWorthSparkline data={netWorth.history} />
              <Button
                onClick={() => router.push('/app/tools/savings-optimizer')}
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
                onClick={() => router.push('/app/tools/savings-optimizer')}
                variant="outline"
                className="h-auto flex-col items-start p-4"
              >
                <span className="font-semibold mb-1">Optimize my savings</span>
                <span className="text-xs text-slate-600 dark:text-slate-400 text-left">
                  Adjust your monthly savings rate
                </span>
              </Button>
              <Button
                onClick={() => router.push('/app/tools/savings-allocator')}
                variant="outline"
                className="h-auto flex-col items-start p-4"
              >
                <span className="font-semibold mb-1">Improve savings mix</span>
                <span className="text-xs text-slate-600 dark:text-slate-400 text-left">
                  Rebalance EF, debt, retirement
                </span>
              </Button>
              <Button
                onClick={() => router.push('/onboarding/boost/bills')}
                variant="outline"
                className="h-auto flex-col items-start p-4"
              >
                <span className="font-semibold mb-1">Check fixed expenses</span>
                <span className="text-xs text-slate-600 dark:text-slate-400 text-left">
                  See how rent affects your plan
                </span>
              </Button>
              <Button
                onClick={() => router.push('/app/tools/net-worth-analyzer')}
                variant="outline"
                className="h-auto flex-col items-start p-4"
              >
                <span className="font-semibold mb-1">Try a what-if scenario</span>
                <span className="text-xs text-slate-600 dark:text-slate-400 text-left">
                  Play with income and savings
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

