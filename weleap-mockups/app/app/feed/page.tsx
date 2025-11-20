/**
 * Feed Tab
 * 
 * Personalized financial insights, actionable nudges, and recommendations.
 */

'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { buildFeed } from '@/lib/feed/buildFeed';
import type { UserSnapshot } from '@/lib/feed/types';
import { FeedCardRenderer } from '@/components/feed/cards';
import type { FeedCard } from '@/lib/feed/types';

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

export default function FeedPage() {
  const router = useRouter();
  const state = useOnboardingStore();
  const planData = usePlanData();

  // Build user snapshot from plan data
  const userSnapshot = useMemo((): UserSnapshot | null => {
    if (!planData || !state.income) return null;

    const paychecksPerMonth = getPaychecksPerMonth(state.income.payFrequency || 'biweekly');
    const monthlyIncome = planData.paycheckAmount * paychecksPerMonth;

    // Calculate N/W/S from paycheck categories
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

    const needsPct = (monthlyNeeds / monthlyIncome) * 100;
    const wantsPct = (monthlyWants / monthlyIncome) * 100;
    const savingsPct = (monthlySavings / monthlyIncome) * 100;

    // Get targets from riskConstraints or use defaults
    const targets = state.riskConstraints?.targets || {
      needsPct: 50,
      wantsPct: 30,
      savingsPct: 20,
    };
    const targetNeedsPct = targets.needsPct * 100;
    const targetWantsPct = targets.wantsPct * 100;
    const targetSavingsPct = targets.savingsPct * 100;

    // Get savings allocation
    const efCategory = planData.paycheckCategories.find(c => c.key === 'emergency');
    const debtExtraCategory = planData.paycheckCategories.find(c => c.key === 'debt_extra');
    const longTermCategory = planData.paycheckCategories.find(c => c.key === 'long_term_investing');

    const efMonthly = (efCategory?.amount || 0) * paychecksPerMonth;
    const highAprDebtMonthly = (debtExtraCategory?.amount || 0) * paychecksPerMonth;
    
    // Extract subcategories from long-term investing
    const match401kSub = longTermCategory?.subCategories?.find(s => s.key === '401k_match');
    const retirementSub = longTermCategory?.subCategories?.find(s => s.key === 'retirement_tax_advantaged');
    const brokerageSub = longTermCategory?.subCategories?.find(s => s.key === 'brokerage');

    const match401kMonthly = (match401kSub?.amount || 0) * paychecksPerMonth;
    const retirementTaxAdvMonthly = (retirementSub?.amount || 0) * paychecksPerMonth;
    const brokerageMonthly = (brokerageSub?.amount || 0) * paychecksPerMonth;

    // Get high-APR debts
    const highAprDebts = state.debts
      .filter(d => d.aprPct && d.aprPct > 10)
      .map(d => ({
        name: d.name,
        balance$: d.balance$,
        apr: d.aprPct || 0,
        minPayment$: d.minPayment$,
        monthlyInterest$: (d.balance$ * (d.aprPct || 0) / 100) / 12,
      }));

    // Calculate current balance (mock - in real app, this would come from Plaid)
    // Use cash assets as a proxy for checking/savings balance
    const currentBalance = state.assets
      .filter(a => a.type === 'cash')
      .reduce((sum, a) => sum + a.value$, 0);

    // Calculate upcoming bills (mock - in real app, this would come from Plaid)
    const upcomingBills = state.fixedExpenses
      .reduce((sum, e) => sum + e.amount$, 0);

    return {
      monthlyIncome$: monthlyIncome,
      needsPct,
      wantsPct,
      savingsPct,
      targetNeedsPct,
      targetWantsPct,
      targetSavingsPct,
      efCurrent$: planData.emergencyFund.current,
      efTarget$: planData.emergencyFund.target,
      efMonthly$: efMonthly,
      highAprDebt$: highAprDebtMonthly,
      match401k$: match401kMonthly,
      retirementTaxAdv$: retirementTaxAdvMonthly,
      brokerage$: brokerageMonthly,
      highAprDebts,
      currentBalance$: currentBalance,
      upcomingBills$: upcomingBills,
      goals: planData.goalsFunding.map(g => ({
        id: g.id,
        label: g.label,
        progressPct: g.progressPct,
      })),
      savingsStreakMonths: 3, // Mock - in real app, this would be calculated from history
    };
  }, [planData, state]);

  // Build feed cards
  const feedCards = useMemo(() => {
    if (!userSnapshot) return [];
    return buildFeed(userSnapshot);
  }, [userSnapshot]);

  // Handle card actions
  const handleCardAction = (action: FeedCard['ctaAction']) => {
    if (!action) return;

    switch (action.kind) {
      case 'open_optimizer':
        const { tool, ...params } = action.payload || {};
        if (tool === 'income_allocator') {
          router.push('/app/tools/income-allocator');
        } else if (tool === 'savings_allocator') {
          router.push('/app/tools/savings-allocator');
        } else if (tool === 'savings_optimizer') {
          router.push('/app/tools/savings-optimizer');
        } else if (tool === 'net_worth_analyzer') {
          router.push(`/app/tools/net-worth-analyzer?scenario=${params.scenario || 'rent'}`);
        }
        break;
      
      case 'open_view':
        // Handle opening different views
        console.log('Open view:', action.payload);
        break;
      
      case 'apply_plan':
        // Handle applying plan changes
        console.log('Apply plan:', action.payload);
        // In a real implementation, this would update the plan via the store
        break;
      
      case 'show_education':
        // Handle showing education content
        console.log('Show education:', action.payload);
        break;
    }
  };

  if (!planData || !userSnapshot) {
    return (
      <div className="flex min-h-[calc(100vh-73px)] flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto w-full max-w-lg">
            <p className="text-center text-slate-600 dark:text-slate-400">
              Loading your feed...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-4">
          {feedCards.length === 0 ? (
            <p className="text-center text-slate-600 dark:text-slate-400">
              No feed items available. Complete your onboarding to see personalized insights.
            </p>
          ) : (
            feedCards.map((card) => (
              <FeedCardRenderer
                key={card.id}
                card={card}
                onAction={handleCardAction}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
