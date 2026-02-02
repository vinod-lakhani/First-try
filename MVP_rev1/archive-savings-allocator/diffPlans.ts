/**
 * Diffs two ProposedPlans for confirmation modal.
 * Compare only top-level categories; max 5 lines. Deterministic and readable.
 */

import type { ProposedPlan } from './types';

function fmt(n: number | undefined): string {
  if (n === undefined || n === null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function stepTotal(plan: ProposedPlan): number {
  return plan.steps.reduce((s, step) => s + (step.amountMonthly ?? 0), 0);
}

export interface PlanDiffItem {
  label: string;
  from: string;
  to: string;
}

/**
 * Returns an array of diff items (max 5). Only includes categories that differ.
 */
export function diffPlans(confirmedPlan: ProposedPlan | null, proposedPlan: ProposedPlan): PlanDiffItem[] {
  const diffs: PlanDiffItem[] = [];

  if (!confirmedPlan) {
    // First-time apply: show key totals or steps
    const total = proposedPlan.totals.postTaxAllocationMonthly ?? stepTotal(proposedPlan);
    if (total > 0) {
      diffs.push({ label: 'Total post-tax allocation', from: '—', to: fmt(total) + '/mo' });
    }
    if ((proposedPlan.totals.preTax401kMonthlyEst ?? 0) > 0) {
      diffs.push({ label: 'Pre-tax 401(k) (est.)', from: '—', to: fmt(proposedPlan.totals.preTax401kMonthlyEst) + '/mo' });
    }
    if ((proposedPlan.totals.hsaMonthlyEst ?? 0) > 0) {
      diffs.push({ label: 'HSA (est.)', from: '—', to: fmt(proposedPlan.totals.hsaMonthlyEst) + '/mo' });
    }
    return diffs.slice(0, 5);
  }

  const keyMetricFrom = confirmedPlan.keyMetric?.value ?? '—';
  const keyMetricTo = proposedPlan.keyMetric?.value ?? '—';
  if (keyMetricFrom !== keyMetricTo) {
    diffs.push({ label: confirmedPlan.keyMetric?.label ?? 'Key metric', from: keyMetricFrom, to: keyMetricTo });
  }

  const totalFrom = confirmedPlan.totals.postTaxAllocationMonthly ?? stepTotal(confirmedPlan);
  const totalTo = proposedPlan.totals.postTaxAllocationMonthly ?? stepTotal(proposedPlan);
  if (Math.abs(totalFrom - totalTo) > 0.5) {
    diffs.push({ label: 'Post-tax allocation', from: fmt(totalFrom) + '/mo', to: fmt(totalTo) + '/mo' });
  }

  const preTaxFrom = confirmedPlan.totals.preTax401kMonthlyEst ?? 0;
  const preTaxTo = proposedPlan.totals.preTax401kMonthlyEst ?? 0;
  if (Math.abs(preTaxFrom - preTaxTo) > 0.5) {
    diffs.push({ label: 'Pre-tax 401(k) (est.)', from: fmt(preTaxFrom) + '/mo', to: fmt(preTaxTo) + '/mo' });
  }

  const hsaFrom = confirmedPlan.totals.hsaMonthlyEst ?? 0;
  const hsaTo = proposedPlan.totals.hsaMonthlyEst ?? 0;
  if (Math.abs(hsaFrom - hsaTo) > 0.5) {
    diffs.push({ label: 'HSA (est.)', from: fmt(hsaFrom) + '/mo', to: fmt(hsaTo) + '/mo' });
  }

  // Compare step-by-step for same ids
  const confirmedSteps = new Map(confirmedPlan.steps.map((s) => [s.id, s.amountMonthly ?? 0]));
  for (const step of proposedPlan.steps.slice(0, 5)) {
    const fromVal = confirmedSteps.get(step.id) ?? 0;
    const toVal = step.amountMonthly ?? 0;
    if (Math.abs(fromVal - toVal) > 0.5) {
      diffs.push({ label: step.label, from: fmt(fromVal) + '/mo', to: fmt(toVal) + '/mo' });
    }
  }

  return diffs.slice(0, 5);
}
