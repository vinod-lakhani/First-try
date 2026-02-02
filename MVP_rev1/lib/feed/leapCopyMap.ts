/**
 * Leap copy and CTA mapping — single source of truth for user-facing Leap cards.
 * Placeholders in subtitleTemplate are replaced by formatters (e.g. {emergencyFundMonths}).
 * Later we will enrich payload with specific impact fields (monthly contribution, match gap, delta savings).
 */

import type { LeapType } from './leapTypes';

export interface LeapCopy {
  title: string;
  subtitleTemplate: string;
  primaryCtaLabel: string;
  secondaryCtaLabel?: string;
  icon?: string;
  tone?: 'urgent' | 'opportunity' | 'neutral' | 'gentle';
}

export const LEAP_COPY: Record<LeapType, LeapCopy> = {
  // ─── Income Lifecycle ─────────────────────────────────────────────────────
  FIRST_INCOME_PLAN_NEEDED: {
    title: 'Set your first income plan',
    subtitleTemplate: "Let's calibrate how your paycheck should work for you.",
    primaryCtaLabel: 'Start calibration',
    secondaryCtaLabel: 'Why this?',
    tone: 'opportunity',
  },
  MONTH_CLOSED_REVIEW_INCOME_PLAN: {
    title: 'Review last month',
    subtitleTemplate: "Your last month settled — let's see how you did.",
    primaryCtaLabel: 'Review plan',
    secondaryCtaLabel: 'See details',
    tone: 'neutral',
  },
  INCOME_DRIFT_DETECTED: {
    title: 'Adjust your income plan',
    subtitleTemplate: "Your actual spending drifted from plan. Let's rebalance.",
    primaryCtaLabel: 'Adjust plan',
    secondaryCtaLabel: 'See why',
    tone: 'gentle',
  },
  
  // ─── Savings Stack ────────────────────────────────────────────────────────
  MISSING_EMPLOYER_MATCH: {
    title: 'Grab your free employer match',
    subtitleTemplate: "You're leaving money on the table — let's fix that.",
    primaryCtaLabel: 'Fix my 401(k)',
    secondaryCtaLabel: 'Why this?',
    tone: 'opportunity',
  },
  EMERGENCY_FUND_GAP: {
    title: 'Build your emergency fund',
    subtitleTemplate: "You're at {emergencyFundMonths} months — target is {emergencyFundTargetMonths}.",
    primaryCtaLabel: 'Start savings plan',
    secondaryCtaLabel: 'Why this?',
    tone: 'opportunity',
  },
  HSA_OPPORTUNITY: {
    title: 'Maximize your HSA',
    subtitleTemplate: 'Triple tax advantage — this can reduce taxes and grow wealth.',
    primaryCtaLabel: 'Update HSA plan',
    secondaryCtaLabel: 'Why this?',
    tone: 'opportunity',
  },
  HIGH_APR_DEBT_PRIORITY: {
    title: 'Pay down high-interest debt faster',
    subtitleTemplate: 'High APR debt is a guaranteed drag — let\'s prioritize it.',
    primaryCtaLabel: 'Set payoff plan',
    secondaryCtaLabel: 'See options',
    tone: 'urgent',
  },
  
  // ─── Cash Optimization ────────────────────────────────────────────────────
  SURPLUS_CASH_AVAILABLE: {
    title: 'Put extra cash to work',
    subtitleTemplate: "You have room above your buffer. Want to sweep it automatically?",
    primaryCtaLabel: 'Set up sweeps',
    secondaryCtaLabel: 'Details',
    tone: 'opportunity',
  },
  CASH_RISK_DETECTED: {
    title: "Heads up: cash could get tight",
    subtitleTemplate: "I can help you avoid a shortfall by adjusting this month's plan.",
    primaryCtaLabel: 'Protect my cash',
    secondaryCtaLabel: 'See why',
    tone: 'urgent',
  },
  
  // ─── Legacy (backward compatibility) ──────────────────────────────────────
  PAYCHECK_REBALANCE_AVAILABLE: {
    title: 'Optimize this paycheck',
    subtitleTemplate: "I can shift {deltaSavings}/mo into savings without touching essentials.",
    primaryCtaLabel: 'Apply adjustment',
    secondaryCtaLabel: 'See breakdown',
    tone: 'opportunity',
  },
  SAVINGS_DRIFT_DETECTED: {
    title: "You're under-saving right now",
    subtitleTemplate: "Let's rebalance so you stay on track without feeling squeezed.",
    primaryCtaLabel: 'Rebalance plan',
    secondaryCtaLabel: 'See why',
    tone: 'gentle',
  },
  EMPLOYER_MATCH_NOT_MET: {
    title: 'Grab your free employer match',
    subtitleTemplate: "You're leaving about {employerMatchGap}/mo on the table.",
    primaryCtaLabel: 'Fix my 401(k)',
    secondaryCtaLabel: 'Why this?',
    tone: 'opportunity',
  },
  HSA_RECOMMENDATION_PENDING: {
    title: 'Maximize your HSA (triple tax advantage)',
    subtitleTemplate: 'This can reduce taxes and grow long-term wealth.',
    primaryCtaLabel: 'Update HSA plan',
    secondaryCtaLabel: 'Why this?',
    tone: 'opportunity',
  },
  HIGH_APR_DEBT_PRESENT: {
    title: 'Pay down high-interest debt faster',
    subtitleTemplate: 'High APR debt is a guaranteed drag — let\'s prioritize it.',
    primaryCtaLabel: 'Set payoff plan',
    secondaryCtaLabel: 'See options',
    tone: 'urgent',
  },
  SURPLUS_CASH_DETECTED: {
    title: 'Put extra cash to work',
    subtitleTemplate: "You have room above your buffer. Want to sweep it automatically?",
    primaryCtaLabel: 'Set up sweeps',
    secondaryCtaLabel: 'Details',
    tone: 'opportunity',
  },
  
  // ─── Meta ─────────────────────────────────────────────────────────────────
  UNIMPLEMENTED_RECOMMENDATION: {
    title: 'Want to revisit this?',
    subtitleTemplate: "We suggested this earlier — it can still help.",
    primaryCtaLabel: 'Continue',
    secondaryCtaLabel: 'Not now',
    tone: 'gentle',
  },
};

export function getLeapCopy(leapType: LeapType): LeapCopy {
  return LEAP_COPY[leapType] ?? {
    title: leapType.replace(/_/g, ' ').toLowerCase(),
    subtitleTemplate: 'Take a look when you\'re ready.',
    primaryCtaLabel: 'Open tool',
    secondaryCtaLabel: 'Details',
    tone: 'neutral',
  };
}
