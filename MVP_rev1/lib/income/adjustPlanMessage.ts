/**
 * Deterministic "Adjust Plan" message composer for chat-led flow.
 * Produces consistent Current vs Proposed messaging grounded in last month actuals.
 */

import type { IncomeAllocationSnapshot } from './incomeAllocationLifecycle';

export function formatCurrency(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function computeLastMonthSavingsActual(netIncomeMonthly: number, lastMonthTotalSpend: number): number {
  return Math.max(0, netIncomeMonthly - lastMonthTotalSpend);
}

export type MessageBlock =
  | { type: 'text'; value: string }
  | { type: 'compare'; leftLabel: string; leftValue: string; rightLabel: string; rightValue: string; noChange?: boolean }
  | { type: 'bullets'; items: string[] }
  | { type: 'question'; value: string }
  | { type: 'actions'; actions: Array<{ id: 'apply' | 'ask' | 'keep'; label: string }> };

export interface AdjustPlanMessage {
  key: string;
  blocks: MessageBlock[];
}

export function buildAdjustPlanMessage(snapshot: IncomeAllocationSnapshot, proposedSavingsOverride?: number): AdjustPlanMessage {
  const { state, income, actuals, plan, deltas, period } = snapshot;
  const nextMonth = period.nextMonth_label ?? 'next month';
  const currentPlanSavings = plan.currentPlan?.plannedSavings ?? 0;
  const recommendedSavings = proposedSavingsOverride != null ? proposedSavingsOverride : plan.recommendedPlan.plannedSavings;
  const current = formatCurrency(currentPlanSavings);
  const proposed = formatCurrency(recommendedSavings);
  const delta = recommendedSavings - currentPlanSavings;
  const deltaAbs = formatCurrency(Math.abs(delta));

  const lastMonthTotalSpend = actuals.lastMonth?.totalSpend ?? actuals.last3m_avg.totalSpend;
  const lastMonthSavingsActual = computeLastMonthSavingsActual(income.netIncomeMonthly, lastMonthTotalSpend);
  const savingsVsPlan = plan.currentPlan
    ? lastMonthSavingsActual - plan.currentPlan.plannedSavings
    : 0;

  const key = `adjust_${state}_${currentPlanSavings}_${recommendedSavings}`;

  if (state === 'FIRST_TIME') {
    return {
      key,
      blocks: [
        { type: 'text', value: `Before we adjust anything, let's set a starting plan.` },
        { type: 'compare', leftLabel: 'Current plan', leftValue: 'No plan yet', rightLabel: `Proposed for ${nextMonth}`, rightValue: `${proposed}/mo` },
        { type: 'bullets', items: ['This is based on your last 3 months of actual spending.'] },
        { type: 'question', value: 'Want to set this as your plan, or ask a question first?' },
        { type: 'actions', actions: [{ id: 'apply', label: 'Apply' }, { id: 'ask', label: 'Ask a question' }, { id: 'keep', label: 'Keep my plan' }] },
      ],
    };
  }

  if (state === 'ON_TRACK') {
    const noChange = Math.abs(delta) < 1;
    return {
      key,
      blocks: [
        { type: 'text', value: `Want to adjust your plan for ${nextMonth}? You're currently doing great — here's what would change if we tweak it.` },
        { type: 'compare', leftLabel: 'Current plan', leftValue: `Save ${current}/mo`, rightLabel: `Proposed for ${nextMonth}`, rightValue: noChange ? 'No change' : `Save ${proposed}/mo`, noChange },
        { type: 'bullets', items: [
          `Last month you saved ${formatCurrency(lastMonthSavingsActual)}, right in line with your plan.`,
          'This change is optional — we can keep things as-is if you prefer.',
        ] },
        { type: 'question', value: `Want me to apply this for ${nextMonth}, or do you want to ask a question first?` },
        { type: 'actions', actions: [{ id: 'apply', label: 'Apply' }, { id: 'ask', label: 'Ask a question' }, { id: 'keep', label: 'Keep my plan' }] },
      ],
    };
  }

  if (state === 'OVERSAVED') {
    return {
      key,
      blocks: [
        { type: 'text', value: `Nice — you had extra room last month. Here's what I'd set for ${nextMonth} if you want to lock that in.` },
        { type: 'compare', leftLabel: 'Current plan', leftValue: `Save ${current}/mo`, rightLabel: `Proposed for ${nextMonth}`, rightValue: `Save ${proposed}/mo` },
        { type: 'bullets', items: [
          `Last month you saved ${formatCurrency(lastMonthSavingsActual)}, which is ${formatCurrency(savingsVsPlan)} more than planned.`,
          'This keeps your lifestyle the same — it just locks the extra into savings.',
        ] },
        { type: 'question', value: `Apply this for ${nextMonth}, or want to tweak the amount?` },
        { type: 'actions', actions: [{ id: 'apply', label: 'Apply' }, { id: 'ask', label: 'Ask a question' }, { id: 'keep', label: 'Keep my plan' }] },
      ],
    };
  }

  // UNDERSAVED — user overspent, savings fell short. We propose stepping savings back up toward target (4% shift).
  const overspendAmount = Math.abs(savingsVsPlan);
  return {
    key,
    blocks: [
      { type: 'text', value: `Last month was tighter — you overspent by ${formatCurrency(overspendAmount)}, so savings came up short. Here's a small step back toward your target.` },
      { type: 'compare', leftLabel: 'Current plan', leftValue: `Save ${current}/mo`, rightLabel: `Proposed for ${nextMonth}`, rightValue: `Save ${proposed}/mo` },
      { type: 'bullets', items: [
        `You overspent by ${formatCurrency(overspendAmount)} → savings fell short of your target.`,
        `We're suggesting you cut spending by about 4% next month. That moves savings from ${formatCurrency(lastMonthSavingsActual)} toward ${formatCurrency(proposed)} — one step closer to ${current}.`,
      ] },
      { type: 'question', value: `Want me to apply this for ${nextMonth}, or ask a question first?` },
      { type: 'actions', actions: [{ id: 'apply', label: 'Apply' }, { id: 'ask', label: 'Ask a question' }, { id: 'keep', label: 'Keep my plan' }] },
    ],
  };
}
