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
import type { UserSnapshot, TransactionsSection, FeedTransaction } from '@/lib/feed/types';
import { FeedCardRenderer } from '@/components/feed/cards';
import { TransactionsSection as TransactionsSectionComponent } from '@/components/feed/TransactionsSection';
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

  // TODO: Replace with real data from Plaid transaction APIs via backend
  // Static transaction data created once to avoid regeneration and improve performance
  const mockTransactions = useMemo((): TransactionsSection => {
    // Create dates relative to a fixed base time to avoid recalculation
    const baseTime = Date.now();
    
    return {
      bankTransactions: [
        {
          id: 'bank-feed-0',
          accountKind: 'bank' as const,
          accountName: 'Chase Checking',
          merchant: 'Amazon',
          amount$: -125.50,
          date: new Date(baseTime - 0 * 24 * 60 * 60 * 1000).toISOString(),
          category: 'Shopping',
        },
        {
          id: 'bank-feed-1',
          accountKind: 'bank' as const,
          accountName: 'Wells Fargo Savings',
          merchant: 'Starbucks',
          amount$: -8.75,
          date: new Date(baseTime - 1 * 24 * 60 * 60 * 1000).toISOString(),
          category: 'Food & Drink',
        },
        {
          id: 'bank-feed-2',
          accountKind: 'bank' as const,
          accountName: 'Chase Checking',
          merchant: 'Whole Foods',
          amount$: -89.32,
          date: new Date(baseTime - 2 * 24 * 60 * 60 * 1000).toISOString(),
          category: 'Groceries',
        },
        {
          id: 'bank-feed-3',
          accountKind: 'bank' as const,
          accountName: 'Wells Fargo Savings',
          merchant: 'Uber',
          amount$: -24.50,
          date: new Date(baseTime - 3 * 24 * 60 * 60 * 1000).toISOString(),
          category: 'Transportation',
        },
        {
          id: 'bank-feed-4',
          accountKind: 'bank' as const,
          accountName: 'Chase Checking',
          merchant: 'Spotify',
          amount$: -9.99,
          date: new Date(baseTime - 4 * 24 * 60 * 60 * 1000).toISOString(),
          category: 'Entertainment',
        },
      ],
      creditCardTransactions: [
        {
          id: 'cc-feed-0',
          accountKind: 'credit_card' as const,
          accountName: 'Chase Sapphire',
          merchant: 'Restaurant',
          amount$: -85.20,
          date: new Date(baseTime - 0 * 24 * 60 * 60 * 1000).toISOString(),
          category: 'Dining',
        },
        {
          id: 'cc-feed-1',
          accountKind: 'credit_card' as const,
          accountName: 'Amex Gold',
          merchant: 'Airbnb',
          amount$: -325.00,
          date: new Date(baseTime - 1 * 24 * 60 * 60 * 1000).toISOString(),
          category: 'Travel',
        },
        {
          id: 'cc-feed-2',
          accountKind: 'credit_card' as const,
          accountName: 'Chase Sapphire',
          merchant: 'Delta Airlines',
          amount$: -450.00,
          date: new Date(baseTime - 2 * 24 * 60 * 60 * 1000).toISOString(),
          category: 'Travel',
        },
        {
          id: 'cc-feed-3',
          accountKind: 'credit_card' as const,
          accountName: 'Amex Gold',
          merchant: 'Best Buy',
          amount$: -199.99,
          date: new Date(baseTime - 3 * 24 * 60 * 60 * 1000).toISOString(),
          category: 'Electronics',
        },
      ],
    };
  }, []);

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
        const { view } = action.payload || {};
        if (view === 'pulse') {
          router.push('/app/tools/monthly-pulse');
        } else if (view === 'debt') {
          router.push('/app/tools/savings-allocator');
        } else {
          console.log('Open view:', action.payload);
        }
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

  // Separate cards by priority for better layout
  const highPriorityCards = feedCards.filter(card => card.priority <= 2);
  const mediumPriorityCards = feedCards.filter(card => card.priority === 3);
  const lowPriorityCards = feedCards.filter(card => card.priority >= 4);

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-4">
          {feedCards.length === 0 ? (
            <p className="text-center text-slate-600 dark:text-slate-400">
              No feed items available. Complete your onboarding to see personalized insights.
            </p>
          ) : (
            <>
              {/* High Priority Cards (Alerts, Actions) */}
              {highPriorityCards.map((card) => (
                <FeedCardRenderer
                  key={card.id}
                  card={card}
                  onAction={handleCardAction}
                />
              ))}

              {/* Recent Activity Section - placed after high-priority cards */}
              <TransactionsSectionComponent data={mockTransactions} />

              {/* Medium Priority Cards (Progress, Opportunities) */}
              {mediumPriorityCards.map((card) => (
                <FeedCardRenderer
                  key={card.id}
                  card={card}
                  onAction={handleCardAction}
                />
              ))}

              {/* Low Priority Cards (Education, Weekly Summary) */}
              {lowPriorityCards.map((card) => (
                <FeedCardRenderer
                  key={card.id}
                  card={card}
                  onAction={handleCardAction}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
