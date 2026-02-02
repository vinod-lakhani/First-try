/**
 * Adapts SavingsAllocation (engine output) or UI allocation to ProposedPlan.
 * Must NOT invent numbers — use only values from the given result/state.
 */

import type { SavingsAllocation } from '@/lib/alloc/savings';
import type { ProposedPlan, PlanStep } from './types';

function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

/**
 * Adapts engine output to ProposedPlan. Uses only values present in savingsResult.
 */
export function adaptSavingsResultToPlan(savingsResult: SavingsAllocation, options?: {
  postTaxAllocationMonthly?: number;
  preTax401kMonthlyEst?: number;
  hsaMonthlyEst?: number;
}): ProposedPlan {
  const steps: PlanStep[] = [];
  const assumptions: string[] = savingsResult.notes.slice(0, 5);

  if (savingsResult.match401k$ > 0) {
    steps.push({
      id: 'match',
      type: '401k_match',
      label: '401(k) employer match',
      amountMonthly: savingsResult.match401k$,
      note: 'Pre-tax',
    });
  }
  if (savingsResult.hsa$ > 0) {
    steps.push({
      id: 'hsa',
      type: 'hsa',
      label: 'HSA',
      amountMonthly: savingsResult.hsa$,
      note: 'Pre-tax',
    });
  }
  if (savingsResult.ef$ > 0) {
    steps.push({
      id: 'ef',
      type: 'emergency',
      label: 'Emergency fund',
      amountMonthly: savingsResult.ef$,
    });
  }
  if (savingsResult.highAprDebt$ > 0) {
    steps.push({
      id: 'debt',
      type: 'debt',
      label: 'High-APR debt paydown',
      amountMonthly: savingsResult.highAprDebt$,
    });
  }
  if (savingsResult.retirementTaxAdv$ > 0) {
    steps.push({
      id: 'retirement',
      type: 'retirement',
      label: 'Retirement (tax-advantaged)',
      amountMonthly: savingsResult.retirementTaxAdv$,
    });
  }
  if (savingsResult.brokerage$ > 0) {
    steps.push({
      id: 'brokerage',
      type: 'brokerage',
      label: 'Brokerage',
      amountMonthly: savingsResult.brokerage$,
    });
  }

  const postTaxTotal =
    savingsResult.ef$ +
    savingsResult.highAprDebt$ +
    savingsResult.retirementTaxAdv$ +
    savingsResult.brokerage$;
  const totalMonthly =
    postTaxTotal +
    (options?.preTax401kMonthlyEst ?? 0) +
    (options?.hsaMonthlyEst ?? 0) +
    savingsResult.match401k$ +
    savingsResult.hsa$;

  const keyMetricValue = totalMonthly > 0 ? formatMoney(totalMonthly) + '/mo' : '—';
  return {
    steps: steps.slice(0, 5),
    totals: {
      postTaxAllocationMonthly: options?.postTaxAllocationMonthly ?? postTaxTotal,
      preTax401kMonthlyEst: options?.preTax401kMonthlyEst ?? savingsResult.match401k$,
      hsaMonthlyEst: options?.hsaMonthlyEst ?? savingsResult.hsa$,
    },
    assumptions: assumptions.slice(0, 5),
    warnings: [],
    keyMetric: { label: 'Total savings', value: keyMetricValue },
  };
}

/**
 * Builds ProposedPlan from UI allocation (ef$, highAprDebt$, etc.) when user has edited sliders.
 * Uses only provided numbers — no invention.
 */
export function adaptUIAllocationToPlan(ui: {
  ef$: number;
  highAprDebt$: number;
  retirementTaxAdv$: number;
  brokerage$: number;
  match401k$?: number;
  hsa$?: number;
  postTaxAllocationMonthly?: number;
}): ProposedPlan {
  const steps: PlanStep[] = [];
  if ((ui.match401k$ ?? 0) > 0) {
    steps.push({ id: 'match', type: '401k_match', label: '401(k) match', amountMonthly: ui.match401k$, note: 'Pre-tax' });
  }
  if ((ui.hsa$ ?? 0) > 0) {
    steps.push({ id: 'hsa', type: 'hsa', label: 'HSA', amountMonthly: ui.hsa$, note: 'Pre-tax' });
  }
  if (ui.ef$ > 0) {
    steps.push({ id: 'ef', type: 'emergency', label: 'Emergency fund', amountMonthly: ui.ef$ });
  }
  if (ui.highAprDebt$ > 0) {
    steps.push({ id: 'debt', type: 'debt', label: 'High-APR debt', amountMonthly: ui.highAprDebt$ });
  }
  if (ui.retirementTaxAdv$ > 0) {
    steps.push({ id: 'retirement', type: 'retirement', label: 'Retirement', amountMonthly: ui.retirementTaxAdv$ });
  }
  if (ui.brokerage$ > 0) {
    steps.push({ id: 'brokerage', type: 'brokerage', label: 'Brokerage', amountMonthly: ui.brokerage$ });
  }

  const postTax = ui.ef$ + ui.highAprDebt$ + ui.retirementTaxAdv$ + ui.brokerage$;
  const total = postTax + (ui.match401k$ ?? 0) + (ui.hsa$ ?? 0);
  return {
    steps: steps.slice(0, 5),
    totals: {
      postTaxAllocationMonthly: ui.postTaxAllocationMonthly ?? postTax,
      preTax401kMonthlyEst: ui.match401k$,
      hsaMonthlyEst: ui.hsa$,
    },
    assumptions: [],
    warnings: [],
    keyMetric: { label: 'Total savings', value: total > 0 ? formatMoney(total) + '/mo' : '—' },
  };
}
