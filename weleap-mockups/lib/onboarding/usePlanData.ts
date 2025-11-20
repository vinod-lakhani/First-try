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
  const riskConstraints = useOnboardingStore((state) => state.riskConstraints);
  const safetyStrategy = useOnboardingStore((state) => state.safetyStrategy);
  const initialPaycheckPlan = useOnboardingStore((state) => state.initialPaycheckPlan);
  const plaidConnected = useOnboardingStore((state) => state.plaidConnected);
  
  const [planData, setPlanData] = useState<FinalPlanData | null>(null);

  // Recalculate plan whenever relevant state changes
  useEffect(() => {
    const state = useOnboardingStore.getState();
    // Calculate fixedExpensesTotal to verify it's updating
    const fixedExpensesTotal = state.fixedExpenses.reduce((sum, e) => sum + e.amount$, 0);
    console.log('[usePlanData] Recalculating plan', {
      income: state.income?.netIncome$,
      grossIncome: state.income?.grossIncome$,
      payFrequency: state.income?.payFrequency,
      fixedExpensesCount: state.fixedExpenses.length,
      fixedExpensesTotal: fixedExpensesTotal.toFixed(2),
      fixedExpensesDetails: state.fixedExpenses.map(e => ({
        name: e.name,
        amount$: e.amount$,
        frequency: e.frequency,
      })),
      debtsCount: state.debts.length,
      hasInitialPaycheckPlan: !!state.initialPaycheckPlan,
      plaidConnected: state.plaidConnected,
      initialPaycheckPlanNeeds$: state.initialPaycheckPlan?.needs$,
      initialPaycheckPlanWants$: state.initialPaycheckPlan?.wants$,
      initialPaycheckPlanSavings$: state.initialPaycheckPlan?.savings$,
    });
    try {
      const data = buildFinalPlanData(state);
      const paychecksPerMonth = getPaychecksPerMonth(state.income?.payFrequency || 'biweekly');
      const needsCategories = data.paycheckCategories.filter(c => c.key === 'essentials' || c.key === 'debt_minimums');
      const wantsCategories = data.paycheckCategories.filter(c => c.key === 'fun_flexible');
      const savingsCategories = data.paycheckCategories.filter(c => c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra');
      console.log('[usePlanData] Plan calculated', {
        paycheckAmount: data.paycheckAmount,
        categoriesCount: data.paycheckCategories.length,
        monthlyNeeds: needsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth,
        monthlyWants: wantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth,
        monthlySavings: savingsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth,
      });
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
    safetyStrategy,
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

