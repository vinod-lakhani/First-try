/**
 * Feed Builder
 * 
 * Generates feed cards based on user snapshot data.
 */

import type {
  FeedCard,
  FeedCardType,
  UserSnapshot,
  PulseCardMetadata,
  AlertSavingsGapMetadata,
  AlertDebtHighAprMetadata,
  ActionIncomeShiftMetadata,
  ActionSavingsRateMetadata,
  ProgressEfMetadata,
  ProgressDebtMetadata,
  OppRentOptimizerMetadata,
  EducationMetadata,
} from './types';

/**
 * Builds feed cards from user snapshot
 */
export function buildFeed(snapshot: UserSnapshot): FeedCard[] {
  const cards: FeedCard[] = [];
  const now = new Date().toISOString();

  // 1. Always add Pulse card at top (priority 1)
  const pulseCard: FeedCard = {
    id: 'pulse-1',
    type: 'pulse',
    priority: 1,
    createdAt: now,
    title: 'Monthly Pulse',
    body: generatePulseBody(snapshot),
    ctaLabel: 'View full Monthly Pulse',
    ctaAction: {
      kind: 'open_view',
      payload: { view: 'pulse' },
    },
    metadata: {
      needsPct: snapshot.needsPct,
      wantsPct: snapshot.wantsPct,
      savingsPct: snapshot.savingsPct,
      targetNeedsPct: snapshot.targetNeedsPct,
      targetWantsPct: snapshot.targetWantsPct,
      targetSavingsPct: snapshot.targetSavingsPct,
      savingsDelta$: (snapshot.savingsPct - snapshot.targetSavingsPct) * snapshot.monthlyIncome$ / 100,
      monthlyIncome$: snapshot.monthlyIncome$,
    } as PulseCardMetadata,
  };
  cards.push(pulseCard);

  // 2. Critical Alerts (priority 1)
  
  // Savings gap alert
  const savingsGap = snapshot.targetSavingsPct - snapshot.savingsPct;
  if (savingsGap > 3) {
    const suggestedShift = Math.min(savingsGap - 1, 5); // Cap at 5pp shift
    const monthlyImpact = (suggestedShift / 100) * snapshot.monthlyIncome$;
    
    cards.push({
      id: 'alert-savings-gap-1',
      type: 'alert_savings_gap',
      priority: 1,
      createdAt: now,
      title: "You're below your savings target",
      body: `You saved ${snapshot.savingsPct.toFixed(0)}% of income this month (target: ${snapshot.targetSavingsPct.toFixed(0)}%). I can shift ${suggestedShift.toFixed(1)}% from Wants → Savings next month within your comfort limit.`,
      ctaLabel: 'Adjust next month\'s plan',
      ctaAction: {
        kind: 'open_optimizer',
        payload: { tool: 'income_allocator', preset: { shiftPct: suggestedShift } },
      },
      metadata: {
        actualSavingsPct: snapshot.savingsPct,
        targetSavingsPct: snapshot.targetSavingsPct,
        gapPct: savingsGap,
        suggestedShiftPct: suggestedShift,
        monthlyImpact$: monthlyImpact,
      } as AlertSavingsGapMetadata,
    });
  }

  // High-APR debt alert
  const highAprDebt = snapshot.highAprDebts.find(d => d.apr > 10);
  if (highAprDebt) {
    const suggestedExtra = Math.min(snapshot.monthlyIncome$ * 0.1, 200); // 10% of income or $200 max
    const monthsToPayoff = Math.ceil(highAprDebt.balance$ / (highAprDebt.minPayment$ + suggestedExtra));
    const interestSaved = highAprDebt.monthlyInterest$ * monthsToPayoff * 0.5; // Rough estimate
    
    cards.push({
      id: 'alert-debt-high-apr-1',
      type: 'alert_debt_high_apr',
      priority: 1,
      createdAt: now,
      title: 'Your credit card interest is costing you',
      body: `You paid $${highAprDebt.monthlyInterest$.toFixed(0)} in interest this month at ${highAprDebt.apr.toFixed(0)}% APR. Redirecting $${suggestedExtra.toFixed(0)}/month from Wants could eliminate this in ${monthsToPayoff} months and save ~$${interestSaved.toFixed(0)} in interest.`,
      ctaLabel: 'Optimize debt payoff',
      ctaAction: {
        kind: 'open_optimizer',
        payload: { tool: 'savings_allocator', focus: 'debt' },
      },
      metadata: {
        debtName: highAprDebt.name,
        apr: highAprDebt.apr,
        monthlyInterest$: highAprDebt.monthlyInterest$,
        suggestedExtraPayment$: suggestedExtra,
        monthsToPayoff,
        interestSaved$: interestSaved,
      } as AlertDebtHighAprMetadata,
    });
  }

  // Cash flow risk alert
  const projectedBalance = snapshot.currentBalance$ - snapshot.upcomingBills$;
  if (projectedBalance < 0) {
    cards.push({
      id: 'alert-cashflow-risk-1',
      type: 'alert_cashflow_risk',
      priority: 1,
      createdAt: now,
      title: 'You may run out of cash this month',
      body: `Based on upcoming bills, your balance could go negative around the 27th.`,
      ctaLabel: 'See plan to avoid this',
      ctaAction: {
        kind: 'open_view',
        payload: { view: 'cashflow' },
      },
      metadata: {
        projectedLowBalance$: projectedBalance,
        projectedLowDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        upcomingBills$: snapshot.upcomingBills$,
      },
    });
  }

  // 3. Actionable Planning Cards (priority 2)
  
  // Income shift suggestion (if savings is close but not quite there)
  if (savingsGap > 0 && savingsGap <= 3) {
    const shiftPct = Math.min(savingsGap, 2);
    const monthlyImpact = (shiftPct / 100) * snapshot.monthlyIncome$;
    
    cards.push({
      id: 'action-income-shift-1',
      type: 'action_income_shift',
      priority: 2,
      createdAt: now,
      title: `Shift ${shiftPct.toFixed(1)}% from Wants to Savings?`,
      body: `This moves you from ${snapshot.savingsPct.toFixed(0)}% → ${(snapshot.savingsPct + shiftPct).toFixed(0)}% savings this month (about $${monthlyImpact.toFixed(0)}).`,
      ctaLabel: 'Apply to next paycheck',
      ctaAction: {
        kind: 'apply_plan',
        payload: { shiftPct, from: 'wants', to: 'savings' },
      },
      metadata: {
        fromCategory: 'wants',
        toCategory: 'savings',
        shiftPct,
        monthlyImpact$: monthlyImpact,
      } as ActionIncomeShiftMetadata,
    });
  }

  // Savings rate boost
  if (snapshot.savingsPct < 20) {
    const suggestedRate = Math.min(snapshot.savingsPct + 5, 25);
    const monthlyIncrease = ((suggestedRate - snapshot.savingsPct) / 100) * snapshot.monthlyIncome$;
    const netWorthImpact = monthlyIncrease * 12 * 20 * 0.07; // Rough 7% annual return over 20 years
    
    cards.push({
      id: 'action-savings-rate-1',
      type: 'action_savings_rate',
      priority: 2,
      createdAt: now,
      title: `Boost your savings rate to ${suggestedRate.toFixed(0)}%`,
      body: `Increasing savings by $${monthlyIncrease.toFixed(0)}/month could add $${netWorthImpact.toFixed(0)} to your net worth over 20 years.`,
      ctaLabel: 'Try this plan',
      ctaAction: {
        kind: 'open_optimizer',
        payload: { tool: 'savings_optimizer', targetRate: suggestedRate },
      },
      metadata: {
        currentRate: snapshot.savingsPct,
        suggestedRate,
        monthlyIncrease$: monthlyIncrease,
        netWorthImpact20yr$: netWorthImpact,
      } as ActionSavingsRateMetadata,
    });
  }

  // 4. Opportunities & Optimizations (priority 3)
  
  // Rent optimizer opportunity
  const currentRent = snapshot.monthlyIncome$ * 0.3; // Assume 30% on rent
  const suggestedRent = currentRent * 0.85; // 15% reduction
  const monthlySavings = currentRent - suggestedRent;
  const netWorthImpact = monthlySavings * 12 * 20 * 0.07;
  
  cards.push({
    id: 'opp-rent-optimizer-1',
    type: 'opp_rent_optimizer',
    priority: 3,
    createdAt: now,
    title: 'What if your rent were $400 lower?',
    body: `You'd free up $${monthlySavings.toFixed(0)}/month for savings. That's about +$${netWorthImpact.toFixed(0)} in projected net worth over 20 years.`,
    ctaLabel: 'Simulate rent changes',
    ctaAction: {
      kind: 'open_optimizer',
      payload: { tool: 'net_worth_analyzer', scenario: 'rent' },
    },
    metadata: {
      currentRent$: currentRent,
      suggestedRent$: suggestedRent,
      monthlySavings$: monthlySavings,
      netWorthImpact20yr$: netWorthImpact,
    } as OppRentOptimizerMetadata,
  });

  // 5. Goal & Progress Cards (priority 3)
  
  // Emergency fund progress
  if (snapshot.efTarget$ > 0) {
    const progressPct = (snapshot.efCurrent$ / snapshot.efTarget$) * 100;
    const monthsToTarget = snapshot.efMonthly$ > 0 
      ? Math.ceil((snapshot.efTarget$ - snapshot.efCurrent$) / snapshot.efMonthly$)
      : 999;
    
    cards.push({
      id: 'progress-ef-1',
      type: 'progress_ef',
      priority: 3,
      createdAt: now,
      title: `You're ${progressPct.toFixed(0)}% to your emergency fund target`,
      body: `You have $${snapshot.efCurrent$.toFixed(0)} saved toward your $${snapshot.efTarget$.toFixed(0)} goal. At this pace, you'll hit it in about ${monthsToTarget} months.`,
      ctaLabel: 'Boost this goal',
      ctaAction: {
        kind: 'open_optimizer',
        payload: { tool: 'savings_allocator', focus: 'emergency_fund' },
      },
      metadata: {
        current$: snapshot.efCurrent$,
        target$: snapshot.efTarget$,
        progressPct,
        monthsToTarget,
        monthlyContribution$: snapshot.efMonthly$,
      } as ProgressEfMetadata,
    });
  }

  // Debt progress
  if (highAprDebt && snapshot.highAprDebt$ > 0) {
    const paidThisMonth = snapshot.highAprDebt$;
    const monthsToPayoff = Math.ceil(highAprDebt.balance$ / (highAprDebt.minPayment$ + paidThisMonth));
    
    cards.push({
      id: 'progress-debt-1',
      type: 'progress_debt',
      priority: 3,
      createdAt: now,
      title: 'Nice work on your debt payoff',
      body: `You paid down $${paidThisMonth.toFixed(0)} in high-interest debt this month. Stay at this pace and you'll be debt-free in ${monthsToPayoff} months.`,
      ctaLabel: 'See debt plan',
      ctaAction: {
        kind: 'open_view',
        payload: { view: 'debt' },
      },
      metadata: {
        debtName: highAprDebt.name,
        paidThisMonth$: paidThisMonth,
        remainingBalance$: highAprDebt.balance$,
        monthsToPayoff,
      } as ProgressDebtMetadata,
    });
  }

  // Savings streak
  if (snapshot.savingsStreakMonths && snapshot.savingsStreakMonths >= 3) {
    cards.push({
      id: 'progress-savings-streak-1',
      type: 'progress_savings_streak',
      priority: 3,
      createdAt: now,
      title: `${snapshot.savingsStreakMonths}-month savings streak`,
      body: `You've hit your savings target ${snapshot.savingsStreakMonths} months in a row.`,
      ctaLabel: undefined,
      ctaAction: undefined,
      metadata: {
        streakMonths: snapshot.savingsStreakMonths,
        targetMet: true,
      },
    });
  }

  // 6. Education Cards (priority 5)
  const educationTopics = [
    {
      topic: 'Tax drag',
      explanation: 'Tax drag is the reduction in investment returns due to taxes on dividends and capital gains. Tax-advantaged accounts like 401(k)s and IRAs can help minimize this.',
    },
    {
      topic: 'Emergency fund priority',
      explanation: 'An emergency fund should come before investing because it protects you from high-interest debt and provides financial stability during unexpected events.',
    },
    {
      topic: 'Roth vs Traditional',
      explanation: 'Roth accounts are taxed now but grow tax-free. Traditional accounts are tax-deferred. Choose Roth if you expect higher taxes in retirement.',
    },
  ];
  
  // Add one education card
  const educationTopic = educationTopics[Math.floor(Math.random() * educationTopics.length)];
  cards.push({
    id: 'education-1',
    type: 'education',
    priority: 5,
    createdAt: now,
    title: `What is ${educationTopic.topic}?`,
    body: educationTopic.explanation,
    ctaLabel: 'Learn more',
    ctaAction: {
      kind: 'show_education',
      payload: { topic: educationTopic.topic },
    },
    metadata: {
      topic: educationTopic.topic,
      explanation: educationTopic.explanation,
    } as EducationMetadata,
  });

  // Sort cards by priority, then by date (newest first)
  cards.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return cards;
}

/**
 * Generates pulse card body text
 */
function generatePulseBody(snapshot: UserSnapshot): string {
  const savingsDelta = (snapshot.savingsPct - snapshot.targetSavingsPct) * snapshot.monthlyIncome$ / 100;
  const savingsDeltaAbs = Math.abs(savingsDelta);
  
  if (Math.abs(savingsDelta) < 10) {
    return `You're on track to save $${(snapshot.savingsPct * snapshot.monthlyIncome$ / 100).toFixed(0)} this month (${savingsDelta >= 0 ? '+' : ''}$${savingsDeltaAbs.toFixed(0)} vs plan).`;
  }
  
  return `Needs are ${snapshot.needsPct.toFixed(0)}% (target: ${snapshot.targetNeedsPct.toFixed(0)}%), Wants ${snapshot.wantsPct.toFixed(0)}%, Savings ${snapshot.savingsPct.toFixed(0)}%.`;
}

