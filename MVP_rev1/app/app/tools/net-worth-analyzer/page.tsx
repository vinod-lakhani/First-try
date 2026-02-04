/**
 * Net Worth Analyzer
 * 
 * Allows users to explore scenarios (rent, savings, debt) and compare
 * baseline vs scenario outcomes using the allocation engines.
 */

'use client';

import { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { buildFinalPlanData, type FinalPlanData } from '@/lib/onboarding/plan';
import type { OnboardingState, FixedExpense } from '@/lib/onboarding/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { X, ArrowRight } from 'lucide-react';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { FinancialSidekick } from '../../components/FinancialSidekick';

// Helper to get paychecks per month
function getPaychecksPerMonth(frequency: string): number {
  switch (frequency) {
    case 'weekly': return 4.33;
    case 'biweekly': return 2.17;
    case 'semimonthly': return 2;
    case 'monthly': return 1;
    default: return 2.17;
  }
}

// Helper to calculate monthly basics from fixed expenses
function calculateMonthlyBasics(expenses: OnboardingState['fixedExpenses']): number {
  return expenses.reduce((sum, e) => {
    let monthly = e.amount$;
    if (e.frequency === 'weekly') monthly = e.amount$ * 4.33;
    else if (e.frequency === 'biweekly') monthly = e.amount$ * 2.17;
    else if (e.frequency === 'semimonthly') monthly = e.amount$ * 2;
    else if (e.frequency === 'yearly') monthly = e.amount$ / 12;
    return sum + monthly;
  }, 0);
}

// Use buildFinalPlanData to get consistent data structure

function NetWorthAnalyzerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenario = searchParams?.get('scenario') || 'rent';
  const baselineState = useOnboardingStore();
  
  // Use centralized hook for baseline plan data - ensures consistency with other pages
  const baselinePlanDataFromHook = usePlanData();

  // Scenario inputs
  const [rentAmount, setRentAmount] = useState(0);
  const [originalRentAmount, setOriginalRentAmount] = useState<number | null>(null); // Store original rent
  const [extraSavings, setExtraSavings] = useState(200);
  const [selectedDebtId, setSelectedDebtId] = useState<string>('');
  const [extraDebtPayment, setExtraDebtPayment] = useState(100);

  // Initialize debt selection
  useEffect(() => {
    if (scenario === 'debt_extra' && baselineState.debts.length > 0) {
      setSelectedDebtId(baselineState.debts[0].id);
    }
  }, [scenario, baselineState]);

  // Build scenario state - this recalculates when rentAmount changes
  const scenarioState = useMemo((): OnboardingState => {
    console.log('[Rent Optimizer] Building scenarioState', { 
      scenario, 
      rentAmount,
      baselinePlaidConnected: baselineState.plaidConnected,
      baselineHasInitialPaycheckPlan: !!baselineState.initialPaycheckPlan,
      baselineFixedExpensesCount: baselineState.fixedExpenses.length,
    });
    
    // Create a new state object with updated fixedExpenses
    // IMPORTANT: Clear actuals3m AND initialPaycheckPlan so buildFinalPlanData recalculates from fixedExpenses
    // CRITICAL: Preserve plaidConnected flag so buildFinalPlanData knows to use actuals
    const state: OnboardingState = {
      ...baselineState,
      fixedExpenses: [...baselineState.fixedExpenses],
      initialPaycheckPlan: undefined, // Clear so it recalculates from expenses
      plaidConnected: baselineState.plaidConnected, // Explicitly preserve Plaid connection status
      riskConstraints: baselineState.riskConstraints ? {
        ...baselineState.riskConstraints,
        actuals3m: undefined, // Force recalculation from expenses
      } : undefined,
    };
    
    console.log('[Rent Optimizer] ScenarioState created', {
      plaidConnected: state.plaidConnected,
      hasInitialPaycheckPlan: !!state.initialPaycheckPlan,
      fixedExpensesCount: state.fixedExpenses.length,
    });
    
    if (scenario === 'rent') {
      // Find or create rent expense
      const rentExpense = state.fixedExpenses.find(e => 
        e.name.toLowerCase().includes('rent') || 
        e.name.toLowerCase().includes('housing') ||
        e.name.toLowerCase().includes('mortgage')
      );
      
      const monthlyAmount = rentAmount;
      
      if (rentExpense) {
        // If rentAmount is 0, remove the rent expense
        if (rentAmount === 0) {
          state.fixedExpenses = state.fixedExpenses.filter(e => e.id !== rentExpense.id);
          console.log('[Rent Optimizer] Removed rent expense', { 
            id: rentExpense.id,
            removedAmount: rentExpense.amount$,
            removedFrequency: rentExpense.frequency
          });
        } else {
        // Update existing rent expense
        // All expenses are stored as monthly (single source of truth)
        // rentAmount is already in monthly terms, so just set it directly
        const updatedExpense: FixedExpense = { 
          ...rentExpense, 
          amount$: monthlyAmount,  // monthlyAmount is already monthly
          frequency: 'monthly' as const     // Ensure frequency is monthly
        };
        
        state.fixedExpenses = state.fixedExpenses.map(e => 
          e.id === rentExpense.id ? updatedExpense : e
        );
        
        // Calculate total after update for verification
        // All expenses should be stored as monthly (single source of truth)
        const totalAfterUpdate = state.fixedExpenses.reduce((sum, e) => sum + e.amount$, 0);
        const totalBeforeUpdate = baselineState.fixedExpenses.reduce((sum, e) => sum + e.amount$, 0);
        
        console.log('[Rent Optimizer] Updated rent expense', { 
          id: rentExpense.id, 
          oldAmount: rentExpense.amount$, 
          oldFrequency: rentExpense.frequency,
          newAmount: updatedExpense.amount$,
          newFrequency: updatedExpense.frequency,
          monthlyAmount,
          totalBeforeUpdate,
          totalAfterUpdate,
          fixedExpensesDetails: state.fixedExpenses.map(e => ({
            name: e.name,
            amount$: e.amount$, // Already monthly
            frequency: e.frequency,
          }))
        });
        }
      } else if (rentAmount > 0) {
        // Add rent expense if it doesn't exist and rentAmount > 0
        // All expenses are stored as monthly (single source of truth)
        const newRentExpense: FixedExpense = {
          id: 'rent-optimization',
          name: 'Rent',
          amount$: monthlyAmount,  // monthlyAmount is already monthly
          frequency: 'monthly' as const,    // Always monthly
          category: 'needs',
        };
        state.fixedExpenses = [...state.fixedExpenses, newRentExpense];
        console.log('[Rent Optimizer] Added new rent expense', { monthlyAmount });
      }
      // If rentAmount is 0 and no rent expense exists, do nothing (rent already removed or never existed)
    } else if (scenario === 'save_more') {
      // Increase savings by reducing wants
      if (state.riskConstraints) {
        const currentSavingsPct = state.riskConstraints.actuals3m?.savingsPct || 0.2;
        const newSavingsPct = Math.min(0.5, currentSavingsPct + (extraSavings / (state.income?.netIncome$ || state.income?.grossIncome$ || 1) / getPaychecksPerMonth(state.income?.payFrequency || 'biweekly')));
        const adjustment = newSavingsPct - currentSavingsPct;
        state.riskConstraints = {
          ...state.riskConstraints,
          actuals3m: {
            needsPct: state.riskConstraints.actuals3m?.needsPct || 0.5,
            wantsPct: (state.riskConstraints.actuals3m?.wantsPct || 0.3) - adjustment,
            savingsPct: newSavingsPct,
          },
        };
      }
    } else if (scenario === 'debt_extra' && selectedDebtId) {
      // Add extra payment to selected debt
      const debt = state.debts.find(d => d.id === selectedDebtId);
      if (debt) {
        state.debts = state.debts.map(d => 
          d.id === selectedDebtId 
            ? { ...d, isHighApr: true, minPayment$: d.minPayment$ + extraDebtPayment }
            : d
        );
      }
    }

    return state;
  }, [baselineState, scenario, rentAmount, extraSavings, selectedDebtId, extraDebtPayment]);

  // Use baseline plan data from centralized hook - ensures consistency with other pages
  // This ensures we're using the same plan data as the income and home pages
  const baselinePlanData = baselinePlanDataFromHook;

  // Initialize rent from baseline plan data (essentials category includes rent)
  // Use a ref to track if we've initialized to avoid re-running
  const rentInitializedRef = useRef(false);
  
  useEffect(() => {
    // Only initialize once when scenario is 'rent' and we have baseline data
    // Only initialize if rentAmount is still 0 (hasn't been set yet)
    if (scenario === 'rent' && baselinePlanData && !rentInitializedRef.current && rentAmount === 0) {
      rentInitializedRef.current = true;
      
      // Try to find actual rent expense first for accuracy
      const rentExpense = baselineState.fixedExpenses.find(e => 
        e.name.toLowerCase().includes('rent') || 
        e.name.toLowerCase().includes('housing') ||
        e.name.toLowerCase().includes('mortgage')
      );
      
      if (rentExpense) {
        // All expenses should be stored as monthly (single source of truth)
        // Just use amount$ directly - it should already be monthly
        const rentMonthly = rentExpense.amount$;
        const roundedMonthly = Math.round(rentMonthly);
        setRentAmount(roundedMonthly);
        setOriginalRentAmount(roundedMonthly); // Store original rent
        console.log('[Rent Optimizer] Initialized rent from expense', { 
          roundedMonthly, 
          amount$: rentExpense.amount$,
          frequency: rentExpense.frequency,
          rentExpense
        });
      } else {
        // Fallback: Get rent from essentials category in the plan
        // The essentials category includes rent, so we can estimate rent from it
        const essentialsCategory = baselinePlanData.paycheckCategories.find(c => c.key === 'essentials');
        if (essentialsCategory) {
          const payFrequency = baselineState.income?.payFrequency || 'biweekly';
          const paychecksPerMonth = getPaychecksPerMonth(payFrequency);
          const monthlyEssentials = essentialsCategory.amount * paychecksPerMonth;
          // Estimate rent as ~60% of essentials (typical ratio)
          const estimatedRent = Math.round(monthlyEssentials * 0.6);
          setRentAmount(estimatedRent);
          setOriginalRentAmount(estimatedRent); // Store original rent
          console.log('[Rent Optimizer] Initialized rent from essentials estimate', { estimatedRent, monthlyEssentials });
        }
      }
    }
    
    // Reset initialization flag if scenario changes
    if (scenario !== 'rent') {
      rentInitializedRef.current = false;
    }
  }, [scenario, baselinePlanData, baselineState.fixedExpenses]); // Remove rentAmount from dependencies to prevent re-initialization

  // Always calculate scenario plan data - this will recalculate when scenarioState changes
  const scenarioPlanData = useMemo(() => {
    // All expenses should be stored as monthly (single source of truth)
    console.log('[Rent Optimizer] Recalculating scenarioPlanData', { 
      scenario, 
      rentAmount,
      fixedExpensesCount: scenarioState.fixedExpenses.length,
      fixedExpensesTotal: scenarioState.fixedExpenses.reduce((sum, e) => sum + e.amount$, 0) // Already monthly
    });
    
    try {
      console.log('[Rent Optimizer] Calling buildFinalPlanData with scenarioState', {
        plaidConnected: scenarioState.plaidConnected,
        hasInitialPaycheckPlan: !!scenarioState.initialPaycheckPlan,
        fixedExpensesCount: scenarioState.fixedExpenses.length,
        debtsCount: scenarioState.debts.length,
        income: scenarioState.income?.netIncome$,
      });
      
      const plan = buildFinalPlanData(scenarioState);
      
      // Debug: log the calculated values
      const needsCategories = plan.paycheckCategories.filter(c => c.key === 'essentials' || c.key === 'debt_minimums');
      const wantsCategories = plan.paycheckCategories.filter(c => c.key === 'fun_flexible');
      const savingsCategories = plan.paycheckCategories.filter(c => c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra');
      
      const paychecksPerMonth = getPaychecksPerMonth(scenarioState.income?.payFrequency || 'biweekly');
      const monthlyNeeds = needsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
      const monthlyWants = wantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
      const monthlySavings = savingsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
      
      console.log('[Rent Optimizer] Scenario plan calculated', {
        rentAmount,
        monthlyNeeds: monthlyNeeds.toFixed(2),
        monthlyWants: monthlyWants.toFixed(2),
        monthlySavings: monthlySavings.toFixed(2),
        needsCategories: needsCategories.map(c => ({ key: c.key, amount: c.amount, label: c.label })),
        savingsCategories: savingsCategories.map(c => ({ key: c.key, amount: c.amount, label: c.label })),
      });
      
      return plan;
    } catch (err) {
      console.error('[Rent Optimizer] Scenario plan data error:', err);
      return baselinePlanData; // Fallback to baseline on error
    }
  }, [scenarioState, baselinePlanData, scenario, rentAmount]);

  const handleConfirmApply = () => {
    // Apply scenario changes to store
    if (scenario === 'rent') {
      const rentExpense = baselineState.fixedExpenses.find(e => 
        e.name.toLowerCase().includes('rent') || e.name.toLowerCase().includes('housing')
      );
      if (rentExpense) {
        // All expenses should be stored as monthly (single source of truth)
        // rentAmount is already in monthly terms
        const monthlyAmount = rentAmount;
        if (rentAmount === 0) {
          // Remove rent expense if amount is 0
          baselineState.removeFixedExpense(rentExpense.id);
        } else {
          // Update with monthly amount and frequency
          baselineState.updateFixedExpense(rentExpense.id, { 
            amount$: monthlyAmount,
            frequency: 'monthly',
          });
        }
      } else if (rentAmount > 0) {
        // Add rent expense if it doesn't exist
        // All expenses should be stored as monthly (single source of truth)
        baselineState.addFixedExpense({
          id: `rent-${Date.now()}`,
          name: 'Rent',
          amount$: rentAmount, // rentAmount is already monthly
          frequency: 'monthly',
          category: 'needs',
        });
      }
      // Clear initialPaycheckPlan to force recalculation from updated fixedExpenses
      baselineState.setInitialPaycheckPlan(undefined as any);
    } else if (scenario === 'save_more') {
      // Update actuals3m to reflect higher savings
      if (baselineState.riskConstraints) {
        const currentSavingsPct = baselineState.riskConstraints.actuals3m?.savingsPct || 0.2;
        const incomePeriod$ = baselineState.income?.netIncome$ || baselineState.income?.grossIncome$ || 0;
        const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
        const newSavingsPct = Math.min(0.5, currentSavingsPct + (extraSavings / (incomePeriod$ * paychecksPerMonth)));
        const adjustment = newSavingsPct - currentSavingsPct;
        baselineState.updateRiskConstraints({
          actuals3m: {
            needsPct: baselineState.riskConstraints.actuals3m?.needsPct || 0.5,
            wantsPct: (baselineState.riskConstraints.actuals3m?.wantsPct || 0.3) - adjustment,
            savingsPct: newSavingsPct,
          },
        });
      }
      // Clear initialPaycheckPlan to force recalculation
      baselineState.setInitialPaycheckPlan(undefined);
    } else if (scenario === 'debt_extra' && selectedDebtId) {
      const debt = baselineState.debts.find(d => d.id === selectedDebtId);
      if (debt) {
        baselineState.updateDebt(selectedDebtId, {
          minPayment$: debt.minPayment$ + extraDebtPayment,
          isHighApr: true,
        });
      }
      // Clear initialPaycheckPlan to force recalculation
      baselineState.setInitialPaycheckPlan(undefined);
    }

    // Rebuild plan (this will be recalculated when income tab reads the updated state)
    try {
      buildFinalPlanData(baselineState);
    } catch (err) {
      console.error('Failed to rebuild plan:', err);
    }

    // Close dialog and navigate back to home
    setShowConfirmDialog(false);
    router.push('/app/home');
  };

  const handleApply = () => {
    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  // Calculate income distribution from scenario plan data (updates dynamically as rent changes)
  // MUST be called before any conditional returns to maintain hook order
  // Only use scenarioPlanData if rent has actually changed from original
  const incomeDistribution = useMemo(() => {
    // Always use scenarioPlanData for rent scenario to show dynamic updates in bar chart
    // For other scenarios, use baseline if no significant change
    const rentHasChanged = scenario === 'rent' && originalRentAmount !== null && Math.abs(rentAmount - originalRentAmount) > 1;
    const planToUse = (scenario === 'rent' && scenarioPlanData) ? scenarioPlanData : (rentHasChanged && scenarioPlanData ? scenarioPlanData : baselinePlanData);
    
    if (!planToUse) {
      console.warn('[Rent Optimizer] No plan data available, using empty distribution');
      return {
        monthlyNeeds: 0,
        monthlyWants: 0,
        monthlySavings: 0,
        needsPct: 0,
        wantsPct: 0,
        savingsPct: 0,
      };
    }
    
    const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
    
    // Get income distribution from plan data - shows modified values as rent changes
    // Needs = essentials + debt_minimums
    const needsCategories = planToUse.paycheckCategories.filter(c => 
      c.key === 'essentials' || c.key === 'debt_minimums'
    );
    // Wants = fun_flexible
    const wantsCategories = planToUse.paycheckCategories.filter(c => 
      c.key === 'fun_flexible'
    );
    // Savings = emergency + long_term_investing + debt_extra
    const savingsCategories = planToUse.paycheckCategories.filter(c => 
      c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
    );

    // Calculate monthly amounts (paycheckCategories.amount is per-paycheck)
    const needsPerPaycheck = needsCategories.reduce((sum, c) => sum + c.amount, 0);
    const wantsPerPaycheck = wantsCategories.reduce((sum, c) => sum + c.amount, 0);
    const savingsPerPaycheck = savingsCategories.reduce((sum, c) => sum + c.amount, 0);
    
    const monthlyNeeds = needsPerPaycheck * paychecksPerMonth;
    const monthlyWants = wantsPerPaycheck * paychecksPerMonth;
    const monthlySavings = savingsPerPaycheck * paychecksPerMonth;
    const monthlyTotal = monthlyNeeds + monthlyWants + monthlySavings;

    // Calculate percentages based on total (updates dynamically as rent changes)
    const needsPct = monthlyTotal > 0 ? (monthlyNeeds / monthlyTotal) * 100 : 0;
    const wantsPct = monthlyTotal > 0 ? (monthlyWants / monthlyTotal) * 100 : 0;
    const savingsPct = monthlyTotal > 0 ? (monthlySavings / monthlyTotal) * 100 : 0;

    console.log('[Rent Optimizer] Income distribution calculated', {
      scenario,
      rentAmount,
      originalRentAmount,
      usingBaseline: planToUse === baselinePlanData,
      paychecksPerMonth,
      needsPerPaycheck,
      wantsPerPaycheck,
      savingsPerPaycheck,
      monthlyNeeds: monthlyNeeds.toFixed(2),
      monthlyWants: monthlyWants.toFixed(2),
      monthlySavings: monthlySavings.toFixed(2),
      monthlyTotal: monthlyTotal.toFixed(2),
      needsPct: needsPct.toFixed(1),
      wantsPct: wantsPct.toFixed(1),
      savingsPct: savingsPct.toFixed(1),
      paycheckCategories: planToUse.paycheckCategories.map(c => ({ 
        key: c.key, 
        amount: c.amount, 
        label: c.label,
        monthly: (c.amount * paychecksPerMonth).toFixed(2)
      }))
    });

    return {
      monthlyNeeds,
      monthlyWants,
      monthlySavings,
      needsPct,
      wantsPct,
      savingsPct,
    };
  }, [scenarioPlanData, baselinePlanData, baselineState.income?.payFrequency, scenario, rentAmount]);

  const { monthlyNeeds, monthlyWants, monthlySavings, needsPct, wantsPct, savingsPct } = incomeDistribution;

  // Determine if we should show baseline vs modified plan
  const rentHasChanged = scenario === 'rent' && originalRentAmount !== null && Math.abs(rentAmount - originalRentAmount) > 1;

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Calculate baseline values for comparison (moved before useMemo that uses it)
  const baselineIncomeDistribution = useMemo(() => {
    if (!baselinePlanData) return null;
    const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
    const needsCategories = baselinePlanData.paycheckCategories.filter(c => 
      c.key === 'essentials' || c.key === 'debt_minimums'
    );
    const wantsCategories = baselinePlanData.paycheckCategories.filter(c => 
      c.key === 'fun_flexible'
    );
    const savingsCategories = baselinePlanData.paycheckCategories.filter(c => 
      c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
    );
    return {
      monthlyNeeds: needsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth,
      monthlyWants: wantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth,
      monthlySavings: savingsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth,
    };
  }, [baselinePlanData, baselineState.income?.payFrequency]);

  // Get baseline rent amount
  const baselineRentAmount = useMemo(() => {
    if (scenario !== 'rent' || !originalRentAmount) return null;
    return originalRentAmount;
  }, [scenario, originalRentAmount]);

  // Calculate confirmation dialog values - direct relationship for rent optimizer
  const confirmationValues = useMemo(() => {
    if (scenario !== 'rent' || !baselineRentAmount || !baselineIncomeDistribution) return null;
    
    const rentDelta = rentAmount - baselineRentAmount;
    
    return {
      rent: {
        current: baselineRentAmount,
        new: rentAmount,
        delta: rentDelta,
      },
      needs: {
        current: baselineIncomeDistribution.monthlyNeeds,
        new: baselineIncomeDistribution.monthlyNeeds + rentDelta,
        delta: rentDelta, // Needs goes up by same amount as rent
      },
      wants: {
        current: baselineIncomeDistribution.monthlyWants,
        new: baselineIncomeDistribution.monthlyWants,
        delta: 0, // Wants doesn't change
      },
      savings: {
        current: baselineIncomeDistribution.monthlySavings,
        new: baselineIncomeDistribution.monthlySavings - rentDelta,
        delta: -rentDelta, // Savings goes down by same amount as rent goes up
      },
    };
  }, [scenario, baselineRentAmount, rentAmount, baselineIncomeDistribution]);

  // Calculate comparison values: Current Plan vs Modified Plan (based on current rent slider)
  const comparisonValues = useMemo(() => {
    if (scenario !== 'rent' || !baselinePlanData || !scenarioPlanData) return null;

    const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');

    // Current Plan (baseline)
    const currentNeedsCategories = baselinePlanData.paycheckCategories.filter(c => 
      c.key === 'essentials' || c.key === 'debt_minimums'
    );
    const currentSavingsCategories = baselinePlanData.paycheckCategories.filter(c => 
      c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
    );
    const currentNeeds = currentNeedsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
    const currentSavings = currentSavingsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;

    // Modified Plan (scenario with current rent slider value)
    const modifiedNeedsCategories = scenarioPlanData.paycheckCategories.filter(c => 
      c.key === 'essentials' || c.key === 'debt_minimums'
    );
    const modifiedSavingsCategories = scenarioPlanData.paycheckCategories.filter(c => 
      c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
    );
    const modifiedNeeds = modifiedNeedsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
    const modifiedSavings = modifiedSavingsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;

    console.log('[Rent Optimizer] Comparison values calculated', {
      rentAmount,
      originalRentAmount,
      currentNeeds,
      currentSavings,
      modifiedNeeds,
      modifiedSavings,
      needsDelta: modifiedNeeds - currentNeeds,
      savingsDelta: modifiedSavings - currentSavings,
    });

    return {
      current: { needs: currentNeeds, savings: currentSavings },
      modified: { needs: modifiedNeeds, savings: modifiedSavings },
    };
  }, [scenario, baselinePlanData, scenarioPlanData, baselineState.income?.payFrequency, rentAmount, originalRentAmount]);

  // Scenario titles - moved after all hooks
  const scenarioTitles: Record<string, { title: string; buttonText: string }> = {
    rent: {
      title: 'Rent Optimization',
      buttonText: 'Implement Rent Optimization',
    },
    save_more: {
      title: 'Savings Optimization',
      buttonText: 'Implement Savings Optimization',
    },
    debt_extra: {
      title: 'Debt Payoff Optimization',
      buttonText: 'Implement Debt Payoff Optimization',
    },
  };

  const scenarioInfo = scenarioTitles[scenario] || scenarioTitles.rent;

  // Early return check - must be AFTER all hooks
  if (!baselinePlanData || !scenarioPlanData) {
    return (
      <div className="container mx-auto flex min-h-screen items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading analyzer...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{scenarioInfo.title}</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="h-8 w-8"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Income Distribution */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">Income Distribution</h2>
            <ArrowRight className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </div>
          <div className="rounded-lg border bg-white p-4 dark:bg-slate-800">
            {/* Horizontal Bar Chart */}
            <div className="mb-4 h-8 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="flex h-full">
                <div
                  className="bg-orange-500"
                  style={{ width: `${needsPct}%` }}
                />
                <div
                  className="bg-blue-400"
                  style={{ width: `${wantsPct}%` }}
                />
                <div
                  className="bg-green-400"
                  style={{ width: `${savingsPct}%` }}
                />
              </div>
            </div>
            {/* Legend */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full bg-orange-500"></div>
                <span>Needs ${(monthlyNeeds / 1000).toFixed(1)}K</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full bg-blue-400"></div>
                <span>Wants ${(monthlyWants / 1000).toFixed(1)}K</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full bg-green-400"></div>
                <span>Savings ${(monthlySavings / 1000).toFixed(1)}K</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rent Section */}
        {scenario === 'rent' && (
          <div className="mb-6">
            <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Rent</h2>
            <div className="space-y-4">
              {/* Slider with Original Rent Indicator */}
              <div className="relative">
                <Slider
                  value={[rentAmount]}
                  onValueChange={([value]) => setRentAmount(value)}
                  min={0}
                  max={5000}
                  step={50}
                  className="w-full"
                />
                {/* Original Rent Indicator Line */}
                {originalRentAmount !== null && originalRentAmount > 0 && (
                  <div
                    className="absolute top-0 h-6 w-0.5 -translate-x-0.5 border-l-2 border-dashed border-slate-400 dark:border-slate-500"
                    style={{
                      left: `${(originalRentAmount / 5000) * 100}%`,
                    }}
                    title={`Original Rent: $${originalRentAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                  />
                )}
              </div>
              {/* Original Rent Label */}
              {originalRentAmount !== null && originalRentAmount > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="h-0.5 w-8 border-t-2 border-dashed border-slate-400 dark:border-slate-500"></div>
                  <span>Original Rent: ${originalRentAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
              )}
              {/* Input Field */}
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
                  <input
                    type="number"
                    value={rentAmount.toFixed(2)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setRentAmount(Math.max(0, Math.min(5000, val)));
                    }}
                    className="w-full bg-transparent text-right text-lg font-semibold outline-none"
                  />
                </div>
                {rentAmount > 0 && (
                  <button
                    onClick={() => setRentAmount(0)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {/* Comparison Display: Current Plan vs Modified Plan */}
              {comparisonValues && (
                <div className="rounded-lg border bg-slate-50 p-4 dark:bg-slate-800/50">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Comparison</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">Current Plan</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-700 dark:text-slate-300">Needs:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            ${comparisonValues.current.needs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-700 dark:text-slate-300">Savings:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            ${comparisonValues.current.savings.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">Modified Plan</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-700 dark:text-slate-300">Needs:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            ${comparisonValues.modified.needs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-700 dark:text-slate-300">Savings:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            ${comparisonValues.modified.savings.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wealth Accumulation - Use same chart as plan-final */}
        <Card>
          <CardHeader>
            <CardTitle>Wealth Accumulation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Net Worth Chart - show baseline and scenario only if rent changed */}
            <div className="overflow-x-auto rounded-lg border bg-white p-4 dark:bg-slate-800">
              <div className="min-w-0">
                <NetWorthChart
                  key={`net-worth-${rentAmount}`}
                  labels={(rentHasChanged ? scenarioPlanData : baselinePlanData).netWorthChartData.labels}
                  netWorth={(rentHasChanged ? scenarioPlanData : baselinePlanData).netWorthChartData.netWorth}
                  assets={(rentHasChanged ? scenarioPlanData : baselinePlanData).netWorthChartData.assets}
                  liabilities={(rentHasChanged ? scenarioPlanData : baselinePlanData).netWorthChartData.liabilities}
                  baselineNetWorth={rentHasChanged ? baselinePlanData.netWorthChartData.netWorth : undefined}
                  height={400}
                />
              </div>
            </div>

            {/* Key Milestones - always show scenario values with delta from baseline */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {scenarioPlanData.netWorthProjection.map((projection) => {
                const baselineValue = baselinePlanData.netWorthProjection.find(p => p.label === projection.label)?.value || 0;
                const scenarioValue = projection.value;
                const delta = scenarioValue - baselineValue;
                const showDelta = rentHasChanged && Math.abs(delta) > 1;
                
                return (
                  <div
                    key={projection.label}
                    className="rounded-lg border bg-white p-4 text-center dark:bg-slate-800"
                  >
                    <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {projection.label}
                    </p>
                    <p className={`text-2xl font-bold ${
                      scenarioValue >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      ${scenarioValue.toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </p>
                    {showDelta && (
                      <p className={`mt-1 text-xs font-medium ${
                        delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {delta >= 0 ? '+' : ''}${delta.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })} vs Current
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Final Value Recommendation */}
            {scenarioPlanData.netWorthProjection.length > 0 && (
              <div className="text-right">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Rec. ${(scenarioPlanData.netWorthProjection[scenarioPlanData.netWorthProjection.length - 1].value / 1000000).toFixed(2)}M
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
        </div>
      </div>

      {/* Implement Button - Below and Centered */}
      <div className="border-t bg-background px-4 py-4">
        <div className="mx-auto max-w-lg space-y-4">
          <Button
            onClick={handleApply}
            className="w-full bg-green-600 text-white hover:bg-green-700"
            size="lg"
          >
            {scenarioInfo.buttonText}
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl">Confirm Changes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Please review the changes before applying them to your plan:
              </p>
              
              {/* Changes Summary */}
              {confirmationValues && (
                <div className="space-y-3 rounded-lg border bg-slate-50 p-4 dark:bg-slate-800">
                  {/* Rent */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Rent</h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Current:</span>
                      <span className="font-semibold">${confirmationValues.rent.current.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">New:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">${confirmationValues.rent.new.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                    </div>
                    <div className="flex items-center justify-between text-sm border-t pt-2">
                      <span className="text-slate-600 dark:text-slate-400">Change:</span>
                      <span className={`font-semibold ${confirmationValues.rent.delta >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {confirmationValues.rent.delta >= 0 ? '+' : ''}${confirmationValues.rent.delta.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                      </span>
                    </div>
                  </div>

                  {/* Needs */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Needs</h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Current:</span>
                      <span className="font-semibold">${confirmationValues.needs.current.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">New:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">${confirmationValues.needs.new.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                    </div>
                    <div className="flex items-center justify-between text-sm border-t pt-2">
                      <span className="text-slate-600 dark:text-slate-400">Change:</span>
                      <span className={`font-semibold ${confirmationValues.needs.delta >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {confirmationValues.needs.delta >= 0 ? '+' : ''}${confirmationValues.needs.delta.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                      </span>
                    </div>
                  </div>

                  {/* Wants */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Wants</h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Current:</span>
                      <span className="font-semibold">${confirmationValues.wants.current.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">New:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">${confirmationValues.wants.new.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                    </div>
                    <div className="flex items-center justify-between text-sm border-t pt-2">
                      <span className="text-slate-600 dark:text-slate-400">Change:</span>
                      <span className={`font-semibold ${confirmationValues.wants.delta >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {confirmationValues.wants.delta >= 0 ? '+' : ''}${confirmationValues.wants.delta.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                      </span>
                    </div>
                  </div>

                  {/* Savings */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Savings</h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Current:</span>
                      <span className="font-semibold">${confirmationValues.savings.current.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">New:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">${confirmationValues.savings.new.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                    </div>
                    <div className="flex items-center justify-between text-sm border-t pt-2">
                      <span className="text-slate-600 dark:text-slate-400">Change:</span>
                      <span className={`font-semibold ${confirmationValues.savings.delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {confirmationValues.savings.delta >= 0 ? '+' : ''}${confirmationValues.savings.delta.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmApply}
                  className="flex-1 bg-green-600 text-white hover:bg-green-700"
                >
                  Confirm & Apply
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function NetWorthAnalyzerPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading analyzer...
            </p>
          </CardContent>
        </Card>
      </div>
    }>
      <NetWorthAnalyzerContent />
    </Suspense>
  );
}
