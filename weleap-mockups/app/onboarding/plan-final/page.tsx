/**
 * Onboarding - Final Plan Page
 * 
 * Displays the comprehensive financial plan using all three engines.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { buildFinalPlanData, type FinalPlanData } from '@/lib/onboarding/plan';
import { 
  TrendingUp, 
  Shield, 
  Target, 
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { IncomeDistributionChart } from '@/components/charts/IncomeDistributionChart';

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

const categoryColors: Record<string, string> = {
  essentials: '#f97316', // orange (Fixed Expenses)
  debt_minimums: '#ef4444', // red
  debt_extra: '#f59e0b', // amber
  emergency: '#10b981', // green
  short_term_goals: '#8b5cf6', // purple
  long_term_investing: '#14b8a6', // teal (Savings)
  fun_flexible: '#3b82f6', // blue (Variable Expenses)
};

export default function PlanFinalPage() {
  const router = useRouter();
  const state = useOnboardingStore();
  const [planData, setPlanData] = useState<FinalPlanData | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const data = buildFinalPlanData(state);
      setPlanData(data);
      setError(null);
    } catch (err) {
      console.error('Failed to build final plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate plan');
    } finally {
      setIsGenerating(false);
    }
  }, [state]);

  const handleEnablePulse = () => {
    router.push('/onboarding/pulse');
  };

  const handleSkip = () => {
    router.push('/onboarding/pulse');
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

  if (error || !planData) {
    return (
      <Card className="w-full">
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-red-600 dark:text-red-400 font-medium">
            {error || 'Unable to generate plan. Please check your information.'}
          </p>
          <Button onClick={() => router.push('/onboarding/boost')} variant="outline">
            Go back to Boost Hub
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden">
      {/* SECTION 1 – Header Summary */}
      <Card className="min-w-0">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl sm:text-3xl font-bold">
            Your personalized financial plan is ready.
          </CardTitle>
          <CardDescription className="text-base space-y-1">
            <p>We've combined your income, bills, debts, and goals.</p>
            <p>Here's how your money can grow with a smarter allocation.</p>
          </CardDescription>
        </CardHeader>
      </Card>

      {/* SECTION 2 – Income Distribution */}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Income Distribution</CardTitle>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <div className="flex justify-center">
            <IncomeDistributionChart
              takeHomePay={planData.paycheckAmount}
              grossIncome={state.income?.grossIncome$ ? 
                state.income.grossIncome$ * getPaychecksPerMonth(state.income.payFrequency || 'biweekly') : 
                undefined
              }
              categories={planData.paycheckCategories.map((cat) => ({
                label: cat.label,
                amount: cat.amount,
                percent: cat.percent,
                color: categoryColors[cat.key] || '#6b7280',
                description: cat.why,
              }))}
              size={280}
            />
          </div>
          <div className="mt-6 space-y-1 text-sm text-slate-600 dark:text-slate-400">
            <p>This plan updates automatically if your income or spending changes.</p>
            <p>You can adjust categories anytime.</p>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 3 – Savings Strategy */}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Your Savings Path</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Emergency Fund Timeline */}
          <div className="rounded-lg border bg-white p-4 dark:bg-slate-800">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Emergency Fund Timeline
              </h3>
            </div>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
              You will reach a {planData.emergencyFund.monthsTarget}-month safety net in{' '}
              {planData.emergencyFund.monthsToTarget > 0
                ? `${planData.emergencyFund.monthsToTarget} months`
                : 'your current balance'}
              .
            </p>
            <div className="mb-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>
                ${planData.emergencyFund.current.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </span>
              <span>
                ${planData.emergencyFund.target.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${Math.min(100, (planData.emergencyFund.current / planData.emergencyFund.target) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Goal Funding */}
          {planData.goalsFunding.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-white">Goal Funding</h3>
              {planData.goalsFunding.map((goal) => (
                <div
                  key={goal.id}
                  className="rounded-lg border bg-white p-4 dark:bg-slate-800"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {goal.label}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        ${goal.amountPerPaycheck.toFixed(2)} per paycheck • Target: {goal.targetDateLabel}
                      </p>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${goal.progressPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Smart Insights */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <h3 className="mb-2 font-semibold text-blue-900 dark:text-blue-200">
              Smart Insights
            </h3>
            <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
              {planData.smartInsights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 4 – Debt Payoff Projection */}
      {planData.debts.length > 0 && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Your Debt Path</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {planData.totalInterestSaved && planData.totalInterestSaved > 0 && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
                <p className="text-sm font-medium text-green-900 dark:text-green-200">
                  Your strategy saves you ${planData.totalInterestSaved.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })} in future interest.
                </p>
              </div>
            )}
            <div className="space-y-2">
              {planData.debts.map((debt) => (
                <div
                  key={debt.id}
                  className="flex items-center justify-between rounded-lg border bg-white p-4 dark:bg-slate-800"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {debt.name}
                    </p>
                    {debt.apr !== null && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {debt.apr.toFixed(1)}% APR
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Paid off by {debt.payoffDateLabel}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 5 – Net Worth Projection */}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">How Your Net Worth Will Grow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Net Worth Chart */}
          <div className="overflow-x-auto rounded-lg border bg-white p-4 dark:bg-slate-800">
            <div className="min-w-0">
              <NetWorthChart
                labels={planData.netWorthChartData.labels}
                netWorth={planData.netWorthChartData.netWorth}
                assets={planData.netWorthChartData.assets}
                liabilities={planData.netWorthChartData.liabilities}
                height={400}
              />
            </div>
          </div>

          {/* Key Milestones */}
          <div className="grid grid-cols-2 gap-4 overflow-x-auto sm:grid-cols-4">
            {planData.netWorthProjection.map((projection) => (
              <div
                key={projection.label}
                className="rounded-lg border bg-white p-4 text-center dark:bg-slate-800"
              >
                <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                  {projection.label}
                </p>
                <p className={`text-2xl font-bold ${
                  projection.value >= 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  ${projection.value.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
            ))}
          </div>
          {planData.netWorthInsight && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {planData.netWorthInsight}
            </p>
          )}
        </CardContent>
      </Card>

      {/* SECTION 6 – Key Protection Settings */}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Your Safety Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {planData.protection.minCheckingBuffer !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Minimum checking buffer
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  ${planData.protection.minCheckingBuffer.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
            {planData.protection.minCashPct !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Minimum cash %
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {planData.protection.minCashPct}%
                </span>
              </div>
            )}
            {planData.protection.riskTolerance !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Risk tolerance
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {planData.protection.riskTolerance} / 5
                </span>
              </div>
            )}
            {planData.protection.timeHorizonLabel && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Time horizon
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {planData.protection.timeHorizonLabel}
                </span>
              </div>
            )}
            {planData.protection.debtStrategyLabel && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Debt strategy
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {planData.protection.debtStrategyLabel}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SECTION 7 – Final CTA */}
      <Card className="min-w-0 border-primary/20 bg-primary/5 dark:bg-primary/10">
        <CardContent className="pt-6">
          <div className="space-y-4 text-center">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Lock in this plan & stay on track automatically.
            </h3>
            <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <p>Weekly insights + smart recommendations.</p>
              <p>We'll notify you when it's time to take action.</p>
            </div>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
              <Button onClick={handleEnablePulse} size="lg" className="w-full sm:w-auto">
                Enable Pulse
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                onClick={handleSkip}
                variant="ghost"
                size="lg"
                className="w-full sm:w-auto"
              >
                Skip for now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dev Debug Section */}
      {process.env.NODE_ENV === 'development' && (
        <details className="rounded-lg border bg-slate-50 p-4 dark:bg-slate-800">
          <summary className="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-400">
            Debug: View Raw Data
          </summary>
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                FinalPlanData:
              </p>
              <pre className="max-h-96 overflow-auto rounded bg-slate-100 p-2 text-xs dark:bg-slate-900">
                {JSON.stringify(planData, null, 2)}
              </pre>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                OnboardingState:
              </p>
              <pre className="max-h-96 overflow-auto rounded bg-slate-100 p-2 text-xs dark:bg-slate-900">
                {JSON.stringify(state, null, 2)}
              </pre>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
