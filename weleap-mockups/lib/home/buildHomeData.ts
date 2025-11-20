/**
 * Home Screen Data Builder
 * 
 * Builds HomeScreenData from plan data and user state.
 */

import type {
  HomeScreenData,
  MonthlySummary,
  MonthlyInsight,
  NetWorthSnapshot,
  MonthlyGoalProgress,
} from './types';
import type { FinalPlanData } from '@/lib/onboarding/plan';
import type { OnboardingState } from '@/lib/onboarding/types';

/**
 * Builds home screen data from plan data and state
 */
export function buildHomeData(
  planData: FinalPlanData,
  state: OnboardingState
): HomeScreenData {
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

  const paychecksPerMonth = getPaychecksPerMonth(state.income?.payFrequency || 'biweekly');
  const monthlyIncome = planData.paycheckAmount * paychecksPerMonth;

  // Calculate monthly N/W/S
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

  // Get targets
  const targets = state.riskConstraints?.targets || {
    needsPct: 0.5,
    wantsPct: 0.3,
    savingsPct: 0.2,
  };
  const targetNeedsPct = targets.needsPct * 100;
  const targetWantsPct = targets.wantsPct * 100;
  const targetSavingsPct = targets.savingsPct * 100;
  const plannedSavings$ = (targets.savingsPct * monthlyIncome);

  // Build monthly summary
  const summary: MonthlySummary = {
    income$: monthlyIncome,
    needs$: monthlyNeeds,
    wants$: monthlyWants,
    savings$: monthlySavings,
    targetNeedsPct,
    targetWantsPct,
    targetSavingsPct,
    plannedSavings$,
  };

  // Build insights (top 3)
  const insights: MonthlyInsight[] = [];

  // Insight 1: Savings gap or win
  const savingsDelta = monthlySavings - plannedSavings$;
  if (Math.abs(savingsDelta) > 10) {
    insights.push({
      id: 'insight-savings',
      title: savingsDelta > 0 
        ? `You're ahead by $${Math.abs(savingsDelta).toFixed(0)} on savings`
        : `You're behind by $${Math.abs(savingsDelta).toFixed(0)} on savings`,
      body: savingsDelta > 0
        ? `You saved $${monthlySavings.toFixed(0)} so far; you're $${Math.abs(savingsDelta).toFixed(0)} ahead of your $${plannedSavings$.toFixed(0)} target.`
        : `You saved $${monthlySavings.toFixed(0)} so far; you're $${Math.abs(savingsDelta).toFixed(0)} behind your $${plannedSavings$.toFixed(0)} target.`,
      ctaLabel: savingsDelta < 0 ? 'Fix this' : undefined,
      ctaAction: savingsDelta < 0 ? {
        kind: 'open_optimizer',
        payload: { tool: 'savings_optimizer' },
      } : undefined,
    });
  }

  // Insight 2: Needs too high
  const needsPct = (monthlyNeeds / monthlyIncome) * 100;
  if (needsPct > targetNeedsPct + 5) {
    insights.push({
      id: 'insight-needs-high',
      title: 'Needs are above target',
      body: `Your needs are ${needsPct.toFixed(0)}% of income (target: ${targetNeedsPct.toFixed(0)}%). This limits your ability to grow savings.`,
      ctaLabel: 'See details',
      ctaAction: {
        kind: 'open_feed',
        payload: { filter: 'needs' },
      },
    });
  }

  // Insight 3: Emergency fund progress
  const efProgress = (planData.emergencyFund.current / planData.emergencyFund.target) * 100;
  if (efProgress > 50 && efProgress < 100) {
    insights.push({
      id: 'insight-ef-progress',
      title: 'Emergency fund is making progress',
      body: `Your EF is ${efProgress.toFixed(0)}% funded. You're ${planData.emergencyFund.monthsToTarget} months away from your target.`,
      ctaLabel: 'Boost this goal',
      ctaAction: {
        kind: 'open_optimizer',
        payload: { tool: 'savings_allocator', focus: 'emergency_fund' },
      },
    });
  }

  // Build net worth snapshot
  const netWorthHistory = planData.netWorthChartData.netWorth.slice(-12); // Last 12 months
  const currentNetWorth = netWorthHistory[netWorthHistory.length - 1] || 0;
  const lastMonthNetWorth = netWorthHistory[netWorthHistory.length - 2] || currentNetWorth;
  const deltaVsLastMonth = currentNetWorth - lastMonthNetWorth;

  const netWorth: NetWorthSnapshot = {
    currentNetWorth$: currentNetWorth,
    deltaVsLastMonth$: deltaVsLastMonth,
    history: netWorthHistory.map((value, index) => ({
      month: `Month ${index + 1}`,
      value$: value,
    })),
  };

  // Build goals progress
  const goals: MonthlyGoalProgress[] = [];

  // Emergency fund goal
  const efMonthly = planData.paycheckCategories
    .find(c => c.key === 'emergency')?.amount || 0;
  goals.push({
    id: 'goal-ef',
    label: 'Emergency Fund',
    current$: planData.emergencyFund.current,
    target$: planData.emergencyFund.target,
    contributedThisMonth$: efMonthly * paychecksPerMonth,
  });

  // Debt goal (if high APR debt exists)
  const debtExtra = planData.paycheckCategories
    .find(c => c.key === 'debt_extra')?.amount || 0;
  const highAprDebt = state.debts.find(d => d.aprPct && d.aprPct > 10);
  if (highAprDebt) {
    goals.push({
      id: 'goal-debt',
      label: 'High-Interest Debt',
      current$: highAprDebt.balance$,
      target$: 0,
      contributedThisMonth$: debtExtra * paychecksPerMonth,
    });
  }

  // Savings goal
  goals.push({
    id: 'goal-savings',
    label: 'Monthly Savings',
    current$: monthlySavings,
    target$: plannedSavings$,
    contributedThisMonth$: monthlySavings,
  });

  return {
    summary,
    insights: insights.slice(0, 3), // Top 3 only
    netWorth,
    goals,
  };
}

