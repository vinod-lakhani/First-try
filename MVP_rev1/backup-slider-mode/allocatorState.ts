/**
 * Savings Allocator state model: VALIDATED vs PROPOSAL mode.
 *
 * - currentPlan = last applied plan (persisted)
 * - proposedPlan = draft the user is reviewing (computed)
 * - VALIDATED mode = currentPlan deepEquals proposedPlan
 * - PROPOSAL mode = currentPlan differs from proposedPlan
 */

export interface SavingsPlanSnapshot {
  ef$: number;
  debt$: number;
  match401k$: number;
  hsa$: number;
  retirementTaxAdv$: number;
  brokerage$: number;
  monthlySavings: number;
}

export interface SavingsOverrides {
  efDelta?: number;
  debtDelta?: number;
  retirementExtraDelta?: number;
  brokerageDelta?: number;
}

const EPSILON = 0.01;

export function deepEqualPlans(a: SavingsPlanSnapshot, b: SavingsPlanSnapshot): boolean {
  if (!a || !b) return false;
  return (
    Math.abs((a.ef$ ?? 0) - (b.ef$ ?? 0)) < EPSILON &&
    Math.abs((a.debt$ ?? 0) - (b.debt$ ?? 0)) < EPSILON &&
    Math.abs((a.match401k$ ?? 0) - (b.match401k$ ?? 0)) < EPSILON &&
    Math.abs((a.hsa$ ?? 0) - (b.hsa$ ?? 0)) < EPSILON &&
    Math.abs((a.retirementTaxAdv$ ?? 0) - (b.retirementTaxAdv$ ?? 0)) < EPSILON &&
    Math.abs((a.brokerage$ ?? 0) - (b.brokerage$ ?? 0)) < EPSILON
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Apply user overrides to current plan and rebalance.
 * - Reducing a category frees cash → add to brokerage (or retirement if reducing brokerage)
 * - Increasing a category needs cash → take from brokerage, then retirement, ef, debt
 */
export function applyOverridesAndRebalance(
  current: SavingsPlanSnapshot,
  overrides: SavingsOverrides,
  budget: number
): SavingsPlanSnapshot {
  const hasAny =
    (overrides.efDelta ?? 0) !== 0 ||
    (overrides.debtDelta ?? 0) !== 0 ||
    (overrides.retirementExtraDelta ?? 0) !== 0 ||
    (overrides.brokerageDelta ?? 0) !== 0;
  if (!hasAny) return { ...current };

  let ef$ = round2(Math.max(0, (current.ef$ ?? 0) + (overrides.efDelta ?? 0)));
  let debt$ = round2(Math.max(0, (current.debt$ ?? 0) + (overrides.debtDelta ?? 0)));
  let retirementTaxAdv$ = round2(Math.max(0, (current.retirementTaxAdv$ ?? 0) + (overrides.retirementExtraDelta ?? 0)));
  let brokerage$ = round2(Math.max(0, (current.brokerage$ ?? 0) + (overrides.brokerageDelta ?? 0)));

  const total = ef$ + debt$ + retirementTaxAdv$ + brokerage$;
  let diff = round2(budget - total);

  if (Math.abs(diff) < EPSILON) {
    return {
      ...current,
      ef$,
      debt$,
      retirementTaxAdv$,
      brokerage$,
      monthlySavings: budget,
    };
  }

  if (diff > 0) {
    brokerage$ = round2(brokerage$ + diff);
  } else {
    let take = round2(Math.abs(diff));
    if (brokerage$ >= take) {
      brokerage$ = round2(brokerage$ - take);
    } else {
      take = round2(take - brokerage$);
      brokerage$ = 0;
      if (retirementTaxAdv$ >= take) {
        retirementTaxAdv$ = round2(retirementTaxAdv$ - take);
      } else {
        take = round2(take - retirementTaxAdv$);
        retirementTaxAdv$ = 0;
        if (ef$ >= take) {
          ef$ = round2(ef$ - take);
        } else {
          take = round2(take - ef$);
          ef$ = 0;
          debt$ = round2(Math.max(0, debt$ - take));
        }
      }
    }
  }

  const monthlySavings = round2(ef$ + debt$ + retirementTaxAdv$ + brokerage$);
  return {
    ...current,
    ef$,
    debt$,
    retirementTaxAdv$,
    brokerage$,
    monthlySavings,
  };
}

export type AllocatorMode = 'VALIDATED' | 'PROPOSAL';

export function getAllocatorMode(
  currentPlan: SavingsPlanSnapshot,
  proposedPlan: SavingsPlanSnapshot
): AllocatorMode {
  return deepEqualPlans(currentPlan, proposedPlan) ? 'VALIDATED' : 'PROPOSAL';
}
