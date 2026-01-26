/**
 * Custom hook for accessing plan data
 * 
 * This ensures all pages use the same source of truth for plan calculations.
 * It automatically recalculates when relevant state changes.
 */

import { useEffect, useState, useMemo } from 'react';
import { useOnboardingStore } from './store';
import { buildFinalPlanData, type FinalPlanData } from './plan';

/**
 * Hook to get the current plan data
 * 
 * This hook ensures consistent plan data across all pages by:
 * 1. Always using the latest state from the store
 * 2. Recalculating when any relevant state property changes
 * 3. Providing a single source of truth for plan calculations
 */
export function usePlanData(): FinalPlanData | null {
  // Subscribe to all relevant state properties using Zustand selectors
  // This ensures we detect changes when Plaid replaces the income object or updates expenses
  const income = useOnboardingStore((state) => state.income);
  const fixedExpenses = useOnboardingStore((state) => state.fixedExpenses);
  const debts = useOnboardingStore((state) => state.debts);
  const assets = useOnboardingStore((state) => state.assets);
  const goals = useOnboardingStore((state) => state.goals);
  // Use a deep selector to ensure we detect changes to nested properties
  const riskConstraints = useOnboardingStore((state) => state.riskConstraints);
  // Also watch targets and actuals3m directly to ensure changes are detected
  const riskConstraintsTargets = useOnboardingStore((state) => state.riskConstraints?.targets);
  const riskConstraintsActuals3m = useOnboardingStore((state) => state.riskConstraints?.actuals3m);
  const safetyStrategy = useOnboardingStore((state) => state.safetyStrategy);
  const payrollContributions = useOnboardingStore((state) => state.payrollContributions);
  const initialPaycheckPlan = useOnboardingStore((state) => state.initialPaycheckPlan);
  const plaidConnected = useOnboardingStore((state) => state.plaidConnected);
  
  const [planData, setPlanData] = useState<FinalPlanData | null>(null);

  // Recalculate plan whenever relevant state changes
  useEffect(() => {
    const state = useOnboardingStore.getState();
    try {
      const data = buildFinalPlanData(state);
      setPlanData(data);
    } catch (err) {
      console.error('[usePlanData] Failed to build plan data:', err);
      setPlanData(null);
    }
  }, [
    // Watch all relevant state properties - Zustand will trigger when these change
    income,
    fixedExpenses,
    debts,
    assets,
    goals,
    riskConstraints,
    riskConstraintsTargets, // Watch targets directly to detect changes
    riskConstraintsActuals3m, // Watch actuals3m directly to detect changes
    safetyStrategy,
    payrollContributions, // Watch payroll contributions so plan recalculates when 401k/HSA changes
    initialPaycheckPlan,
    plaidConnected, // Also watch plaidConnected to detect when Plaid data is loaded
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

