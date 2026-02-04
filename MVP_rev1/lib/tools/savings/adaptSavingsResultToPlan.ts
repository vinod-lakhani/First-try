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
 * Engine's match401k$ = employee contribution (to capture match). Employer match derived via options.employerMatchEst.
 */
export function adaptSavingsResultToPlan(savingsResult: SavingsAllocation, options?: {
  postTaxAllocationMonthly?: number;
  preTax401kMonthlyEst?: number;
  hsaMonthlyEst?: number;
  employerMatchEst?: number;
}): ProposedPlan {
  const steps: PlanStep[] = [];
  const assumptions: string[] = savingsResult.notes.slice(0, 5);
  const employee401k = savingsResult.match401k$;
  const employerMatch = options?.employerMatchEst ?? 0;

  if (employee401k > 0) {
    steps.push({
      id: '401k_contrib',
      type: '401k_contrib',
      label: '401(k) contribution',
      amountMonthly: employee401k,
      note: 'Pre-tax',
    });
  }
  if (employerMatch > 0) {
    steps.push({
      id: 'match',
      type: '401k_match',
      label: '401(k) employer match',
      amountMonthly: employerMatch,
      note: 'Employer contribution',
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
      label: 'Roth IRA (tax-advantaged)',
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
  // Total = user allocation (post-tax + 401k + HSA) + employer match (so "Total savings" includes match)
  const totalMonthly =
    postTaxTotal +
    (options?.preTax401kMonthlyEst ?? employee401k) +
    (options?.hsaMonthlyEst ?? savingsResult.hsa$) +
    employerMatch;

  const keyMetricValue = totalMonthly > 0 ? formatMoney(totalMonthly) + '/mo' : '—';
  return {
    steps: steps.slice(0, 8),
    totals: {
      postTaxAllocationMonthly: options?.postTaxAllocationMonthly ?? postTaxTotal,
      preTax401kMonthlyEst: options?.preTax401kMonthlyEst ?? employee401k,
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
 * preTax401k$ = employee 401k contribution, match401k$ = employer match.
 */
export function adaptUIAllocationToPlan(ui: {
  ef$: number;
  highAprDebt$: number;
  retirementTaxAdv$: number;
  brokerage$: number;
  preTax401k$?: number;
  match401k$?: number;
  hsa$?: number;
  postTaxAllocationMonthly?: number;
}): ProposedPlan {
  const steps: PlanStep[] = [];
  if ((ui.preTax401k$ ?? 0) > 0) {
    steps.push({ id: '401k_contrib', type: '401k_contrib', label: '401(k) contribution', amountMonthly: ui.preTax401k$!, note: 'Pre-tax' });
  }
  if ((ui.match401k$ ?? 0) > 0) {
    steps.push({ id: 'match', type: '401k_match', label: '401(k) employer match', amountMonthly: ui.match401k$!, note: 'Employer contribution' });
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
    steps.push({ id: 'retirement', type: 'retirement', label: 'Roth IRA (tax-advantaged)', amountMonthly: ui.retirementTaxAdv$ });
  }
  if (ui.brokerage$ > 0) {
    steps.push({ id: 'brokerage', type: 'brokerage', label: 'Brokerage', amountMonthly: ui.brokerage$ });
  }

  const postTax = ui.ef$ + ui.highAprDebt$ + ui.retirementTaxAdv$ + ui.brokerage$;
  const total = postTax + (ui.preTax401k$ ?? 0) + (ui.match401k$ ?? 0) + (ui.hsa$ ?? 0);
  return {
    steps: steps.slice(0, 8),
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
