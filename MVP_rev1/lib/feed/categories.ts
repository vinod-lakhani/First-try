/**
 * Feed category mapping for Financial Sidekick framework.
 * Order: 1. Next Leaps  2. Risk Alerts  3. Clarity Notifications  4. Sidekick Insights
 */

import type { FeedCardType } from './types';

export type FeedCategory = 'leaps' | 'risk_alerts' | 'clarity' | 'insights';

/** Display labels for each category */
export const FEED_CATEGORY_LABELS: Record<FeedCategory, string> = {
  leaps: 'Next Leaps',
  risk_alerts: 'Risk Alerts',
  clarity: 'Clarity Notifications',
  insights: 'Sidekick Insights',
};

/** Sort order: lower = higher in feed */
const CATEGORY_ORDER: Record<FeedCategory, number> = {
  leaps: 0,
  risk_alerts: 1,
  clarity: 2,
  insights: 3,
};

/** Map card type to category */
const TYPE_TO_CATEGORY: Partial<Record<FeedCardType, FeedCategory>> = {
  // Next Leaps (action recommendations)
  action_income_shift: 'leaps',
  action_savings_rate: 'leaps',
  action_savings_allocation: 'leaps',
  opp_rent_optimizer: 'leaps',
  opp_savings_allocator: 'leaps',
  opp_side_income: 'leaps',
  // Risk Alerts
  alert_savings_gap: 'risk_alerts',
  alert_debt_high_apr: 'risk_alerts',
  alert_cashflow_risk: 'risk_alerts',
  alert: 'risk_alerts',
  // Clarity Notifications
  notification: 'clarity',
  progress_ef: 'clarity',
  progress_debt: 'clarity',
  progress_savings_streak: 'clarity',
  // Sidekick Insights (education)
  education: 'insights',
  informational: 'insights',
  recommendation: 'leaps', // recommendations = Leaps in spec
};

export function getCategoryForCardType(type: FeedCardType): FeedCategory {
  return TYPE_TO_CATEGORY[type] ?? 'clarity';
}

export function getCategorySortOrder(category: FeedCategory): number {
  return CATEGORY_ORDER[category];
}

export function sortFeedCardsByCategory<T extends { type: FeedCardType }>(cards: T[]): T[] {
  return [...cards].sort((a, b) => {
    const catA = getCategoryForCardType(a.type);
    const catB = getCategoryForCardType(b.type);
    const orderA = CATEGORY_ORDER[catA];
    const orderB = CATEGORY_ORDER[catB];
    if (orderA !== orderB) return orderA - orderB;
    return 0;
  });
}
