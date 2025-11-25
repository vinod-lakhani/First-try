/**
 * Feed Tab
 * 
 * Personalized financial insights, actionable nudges, and recommendations.
 */

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { buildFeed } from '@/lib/feed/buildFeed';
import type { UserSnapshot, TransactionsSection, FeedTransaction } from '@/lib/feed/types';
import { FeedCardRenderer } from '@/components/feed/cards';
import { TransactionsSection as TransactionsSectionComponent } from '@/components/feed/TransactionsSection';
import type { FeedCard } from '@/lib/feed/types';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Bell, AlertCircle, Sparkles, BookOpen } from 'lucide-react';

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

  // Build feed cards - we only need the Pulse card from buildFeed
  const feedCards = useMemo(() => {
    if (!userSnapshot) return [];
    const allCards = buildFeed(userSnapshot);
    // Only extract the pulse card (first card)
    return allCards.filter(card => card.type === 'pulse');
  }, [userSnapshot]);

  // Create representative feed examples (2 from each category)
  const representativeCards = useMemo((): FeedCard[] => {
    const now = new Date().toISOString();
    
    return [
      // 1. Notifications (2 examples)
      {
        id: 'notification-1',
        type: 'notification',
        priority: 2,
        createdAt: now,
        title: 'New paycheck detected',
        body: 'We noticed a new deposit of $2,341 from Tesla, Inc.',
        metadata: {
          category: 'income',
          timestamp: now,
        },
      },
      {
        id: 'notification-2',
        type: 'notification',
        priority: 2,
        createdAt: now,
        title: 'Goal progress update',
        body: "You're 22% of the way toward your $5,000 emergency fund.",
        metadata: {
          category: 'goals',
          timestamp: now,
        },
      },
      
      // 2. Alerts (2 examples)
      {
        id: 'alert-1',
        type: 'alert',
        priority: 1,
        createdAt: now,
        title: 'Upcoming bill due in 3 days',
        body: 'Your Capital One payment of $142.38 is due soon.',
        ctaLabel: 'View bill details',
        ctaAction: {
          kind: 'open_view',
          payload: { view: 'bills' },
        },
        metadata: {
          severity: 'high',
          category: 'bills',
        },
      },
      {
        id: 'alert-2',
        type: 'alert',
        priority: 1,
        createdAt: now,
        title: 'Low account balance',
        body: 'Your checking account balance is below $200.',
        ctaLabel: 'Review budget',
        ctaAction: {
          kind: 'open_view',
          payload: { view: 'cashflow' },
        },
        metadata: {
          severity: 'high',
          category: 'balance',
        },
      },
      
      // 3. Recommendations (2 examples)
      {
        id: 'recommendation-1',
        type: 'recommendation',
        priority: 2,
        createdAt: now,
        title: "Let's review your savings allocation",
        body: "Your savings distribution may not match your goals. Tap to review and optimize.",
        ctaLabel: 'Review allocation',
        ctaAction: {
          kind: 'open_optimizer',
          payload: { tool: 'savings_allocator' },
        },
        metadata: {
          category: 'savings',
          impact: 'Optimize savings distribution',
        },
      },
      {
        id: 'recommendation-2',
        type: 'recommendation',
        priority: 2,
        createdAt: now,
        title: 'Move $60 to savings?',
        body: 'You spent less than usual on dining this week. Tap to transfer $60 into your savings.',
        ctaLabel: 'Move to savings',
        ctaAction: {
          kind: 'open_optimizer',
          payload: { tool: 'savings_allocator' },
        },
        metadata: {
          category: 'savings',
          impact: 'Extra savings opportunity',
        },
      },
      
      // 4. Informational Content (2 examples)
      {
        id: 'informational-1',
        type: 'informational',
        priority: 3,
        createdAt: now,
        title: 'Needs vs. Wants',
        body: 'Understanding your spending helps you optimize your financial plan.',
        ctaLabel: 'Learn more',
        ctaAction: {
          kind: 'show_education',
          payload: { topic: 'needs_vs_wants' },
        },
        metadata: {
          topic: 'Needs vs. Wants',
          category: 'spending',
        },
      },
      {
        id: 'informational-2',
        type: 'informational',
        priority: 3,
        createdAt: now,
        title: 'Savings philosophy',
        body: 'Small consistent changes beat strict budgeting.',
        ctaLabel: 'Learn more',
        ctaAction: {
          kind: 'show_education',
          payload: { topic: 'savings_philosophy' },
        },
        metadata: {
          topic: 'Savings philosophy',
          category: 'savings',
        },
      },
    ];
  }, []);

  // Group cards by category
  const cardsByCategory = useMemo(() => {
    const grouped: Record<string, FeedCard[]> = {
      notifications: [],
      alerts: [],
      recommendations: [],
      informational: [],
    };

    representativeCards.forEach((card) => {
      if (card.type === 'notification') {
        grouped.notifications.push(card);
      } else if (card.type === 'alert') {
        grouped.alerts.push(card);
      } else if (card.type === 'recommendation') {
        grouped.recommendations.push(card);
      } else if (card.type === 'informational') {
        grouped.informational.push(card);
      }
    });

    return grouped;
  }, [representativeCards]);

  // State for collapsed/expanded categories (all expanded by default)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    notifications: true,
    alerts: true,
    recommendations: true,
    informational: true,
  });

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

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

  // Get the pulse card (should be the only one from buildFeed now)
  const pulseCard = feedCards.find(card => card.type === 'pulse');

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-4">
          {/* Monthly Pulse - Always at the top (if available) */}
          {pulseCard && (
            <FeedCardRenderer
              key={pulseCard.id}
              card={pulseCard}
              onAction={handleCardAction}
            />
          )}

          {/* Show loading message if no pulse card but still show representative cards */}
          {!pulseCard && !planData && (
            <p className="text-center text-slate-600 dark:text-slate-400">
              Loading your feed...
            </p>
          )}

          {/* Representative Feed Cards - Grouped by category with collapse/expand */}
          
          {/* Notifications Category */}
          {cardsByCategory.notifications.length > 0 && (
            <CategorySection
              title="Notifications"
              icon={<Bell className="h-5 w-5" />}
              count={cardsByCategory.notifications.length}
              isExpanded={expandedCategories.notifications}
              onToggle={() => toggleCategory('notifications')}
            >
              {expandedCategories.notifications &&
                cardsByCategory.notifications.map((card) => (
                  <FeedCardRenderer
                    key={card.id}
                    card={card}
                    onAction={handleCardAction}
                  />
                ))
              }
            </CategorySection>
          )}

          {/* Alerts Category */}
          {cardsByCategory.alerts.length > 0 && (
            <CategorySection
              title="Alerts"
              icon={<AlertCircle className="h-5 w-5" />}
              count={cardsByCategory.alerts.length}
              isExpanded={expandedCategories.alerts}
              onToggle={() => toggleCategory('alerts')}
            >
              {expandedCategories.alerts &&
                cardsByCategory.alerts.map((card) => (
                  <FeedCardRenderer
                    key={card.id}
                    card={card}
                    onAction={handleCardAction}
                  />
                ))
              }
            </CategorySection>
          )}

          {/* Recommendations Category */}
          {cardsByCategory.recommendations.length > 0 && (
            <CategorySection
              title="Recommendations"
              icon={<Sparkles className="h-5 w-5" />}
              count={cardsByCategory.recommendations.length}
              isExpanded={expandedCategories.recommendations}
              onToggle={() => toggleCategory('recommendations')}
            >
              {expandedCategories.recommendations &&
                cardsByCategory.recommendations.map((card) => (
                  <FeedCardRenderer
                    key={card.id}
                    card={card}
                    onAction={handleCardAction}
                  />
                ))
              }
            </CategorySection>
          )}

          {/* Informational Category */}
          {cardsByCategory.informational.length > 0 && (
            <CategorySection
              title="Informational"
              icon={<BookOpen className="h-5 w-5" />}
              count={cardsByCategory.informational.length}
              isExpanded={expandedCategories.informational}
              onToggle={() => toggleCategory('informational')}
            >
              {expandedCategories.informational &&
                cardsByCategory.informational.map((card) => (
                  <FeedCardRenderer
                    key={card.id}
                    card={card}
                    onAction={handleCardAction}
                  />
                ))
              }
            </CategorySection>
          )}

          {/* Transactions - Always at the bottom */}
          <TransactionsSectionComponent data={mockTransactions} />
        </div>
      </div>
    </div>
  );
}

// Category Section Component with Collapse/Expand
interface CategorySectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CategorySection({ title, icon, count, isExpanded, onToggle, children }: CategorySectionProps) {
  return (
    <div className="space-y-2">
      {/* Category Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between rounded-lg bg-black dark:bg-black px-4 py-2.5 hover:bg-slate-900 dark:hover:bg-slate-900 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-white">
            {icon}
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-white">
              {title}
            </h3>
            <p className="text-xs text-slate-300">
              {count} {count === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>
        <div className="text-white">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Category Content */}
      {isExpanded && (
        <div className="space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}
