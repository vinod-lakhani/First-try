/**
 * Custom hook for accessing plan data
 *
 * Single source of truth: Income, Feed, Monthly Pulse, etc. all use this hook.
 * When Savings Allocator "Confirm & Apply" runs, it updates safetyStrategy.customSavingsAllocation
 * in the store; this hook subscribes to safetyStrategy and recalculates via buildFinalPlanData(state),
 * so the updated plan is reflected everywhere.
 */

import { useEffect, useState, useMemo } from 'react';
import { useOnboardingStore } from './store';
import { buildFinalPlanData, type FinalPlanData, type BuildFinalPlanDataOptions } from './plan';

export interface UsePlanDataOptions {
  /** When true, "current plan" is derived from current user state (expenses, income) only — not from 3-month average (actuals3m). */
  useCurrentStateActuals?: boolean;
}

/**
 * Hook to get the current plan data
 * 
 * This hook ensures consistent plan data across all pages by:
 * 1. Always using the latest state from the store
 * 2. Recalculating when any relevant state property changes
 * 3. Providing a single source of truth for plan calculations
 *
 * Use options.useCurrentStateActuals: true when the baseline must reflect the user's current plan in state (e.g. Savings Allocator "current plan"), not a 3-month average.
 */
export function usePlanData(options?: UsePlanDataOptions): FinalPlanData | null {
  const useCurrentStateActuals = options?.useCurrentStateActuals === true;
  // Subscribe to all relevant state properties using Zustand selectors
  const income = useOnboardingStore((state) => state.income);
  const fixedExpenses = useOnboardingStore((state) => state.fixedExpenses);
  const debts = useOnboardingStore((state) => state.debts);
  const assets = useOnboardingStore((state) => state.assets);
  const goals = useOnboardingStore((state) => state.goals);
  const riskConstraints = useOnboardingStore((state) => state.riskConstraints);
  const riskConstraintsTargets = useOnboardingStore((state) => state.riskConstraints?.targets);
  const riskConstraintsActuals3m = useOnboardingStore((state) => state.riskConstraints?.actuals3m);
  const safetyStrategy = useOnboardingStore((state) => state.safetyStrategy);
  // CRITICAL: Subscribe specifically to customSavingsAllocation to ensure plan recalculates when it changes
  const customSavingsAllocation = useOnboardingStore((state) => state.safetyStrategy?.customSavingsAllocation);
  const payrollContributions = useOnboardingStore((state) => state.payrollContributions);
  const initialPaycheckPlan = useOnboardingStore((state) => state.initialPaycheckPlan);
  const plaidConnected = useOnboardingStore((state) => state.plaidConnected);
  // Bumped by invalidatePlan() when user confirms savings allocation so we always recalc
  const planInvalidationKey = useOnboardingStore((state) => (state as { planInvalidationKey?: number }).planInvalidationKey ?? 0);
  // Serialize targets/actuals3m so plan recalc triggers when savings-helper (or any tool) updates user state
  const riskConstraintsKey = typeof riskConstraints?.targets === 'object' && typeof riskConstraints?.actuals3m === 'object'
    ? JSON.stringify(riskConstraints.targets) + '|' + JSON.stringify(riskConstraints.actuals3m) + '|' + (riskConstraints.bypassWantsFloor ? '1' : '0')
    : '';
  // Serialize customSavingsAllocation so plan recalc triggers when it changes
  const customSavingsAllocationKey = customSavingsAllocation 
    ? JSON.stringify(customSavingsAllocation)
    : '';

  const [planData, setPlanData] = useState<FinalPlanData | null>(null);

  // Recalculate plan whenever relevant state changes (including planInvalidationKey after Confirm & Apply)
  useEffect(() => {
    const state = useOnboardingStore.getState();
    try {
      const buildOptions: BuildFinalPlanDataOptions | undefined = useCurrentStateActuals
        ? { useCurrentStateActuals: true }
        : undefined;
      const data = buildFinalPlanData(state, buildOptions);
      setPlanData(data);
    } catch (err) {
      console.error('[usePlanData] Failed to build plan data:', err);
      setPlanData(null);
    }
  }, [
    income,
    fixedExpenses,
    debts,
    assets,
    goals,
    riskConstraints,
    riskConstraintsTargets,
    riskConstraintsActuals3m,
    riskConstraintsKey,
    useCurrentStateActuals,
    safetyStrategy,
    customSavingsAllocation,
    customSavingsAllocationKey,
    payrollContributions,
    initialPaycheckPlan,
    plaidConnected,
    planInvalidationKey,
  ]);

  return planData;
}

/**
 * Helper to get paychecks per month from frequency
 */
export function getPaychecksPerMonth(frequency: string): number {
  switch (frequency) {
    case 'weekly': return 4.33;
    case 'biweekly': return 2.17;
    case 'semimonthly': return 2;
    case 'monthly': return 1;
    default: return 2.17;
  }
}

/**
 * Convert per-paycheck amounts to monthly
 */
export function toMonthly(amount: number, payFrequency: string): number {
  return amount * getPaychecksPerMonth(payFrequency);
}

