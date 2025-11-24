/**
 * Configurable Tool Demo Page - Configure Tab Only
 * 
 * This page demonstrates the configurable tool with the "Configure Your Own" tab.
 * Income distribution follows the savings-optimizer pattern exactly - using plan data as the single source of truth.
 */

'use client';

import { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { buildFinalPlanData, type FinalPlanData } from '@/lib/onboarding/plan';
import type { OnboardingState } from '@/lib/onboarding/types';
import { ConfigurableTool } from '@/components/tools/ConfigurableTool';
import { calculateScenarioStateFromSliders } from '@/lib/tools/calculateScenarioState';
import type { ToolConfig, ToolSlider } from '@/lib/tools/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, ChevronUp, ChevronDown, Check } from 'lucide-react';

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

// Create Configure Your Own config based on selected categories
function createConfigureYourOwnConfig(
  baselineState: OnboardingState,
  baselinePlanData: FinalPlanData | null,
  selectedCategories: string[]
): ToolConfig {
  if (!baselinePlanData || !baselinePlanData.paycheckCategories) {
    return {
      id: 'configure-your-own',
      title: 'Configure Your Own',
      description: 'Adjust selected categories to see impact on your financial plan',
      sliders: [],
      calculateScenarioState: ({ baselineState: state }) => ({ ...state }) as OnboardingState,
      chart: { type: 'net_worth' as const, title: 'Net Worth Impact', description: 'See how your changes impact your long-term wealth' },
      onApply: async () => {},
    };
  }

  const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
  const monthlyIncome = (baselineState.income?.netIncome$ || baselineState.income?.grossIncome$ || 0) * paychecksPerMonth;

  // Check if main categories are fully selected
  const needsFullySelected = selectedCategories.includes('essentials') && selectedCategories.includes('debt_minimums');
  const wantsFullySelected = selectedCategories.includes('fun_flexible');
  const allSavingsCategoryKeys = ['emergency', 'debt_extra', 'short_term_goals', 'long_term_investing', '401k_match', 'retirement_tax_advantaged', 'brokerage'];
  const savingsFullySelected = allSavingsCategoryKeys.every(key => selectedCategories.includes(key));

  // Build sliders based on selected categories
  const sliders: ToolSlider[] = selectedCategories
    .filter(key => {
      // If main category is fully selected, don't include individual subcategories
      if (needsFullySelected && (key === 'essentials' || key === 'debt_minimums')) return false;
      if (wantsFullySelected && key === 'fun_flexible') return false;
      if (savingsFullySelected && allSavingsCategoryKeys.includes(key)) return false;
      // Filter out third-layer items (expense_*, debt_* without main category prefixes)
      if (key.startsWith('expense_') || (key.startsWith('debt_') && !key.includes('debt_minimums') && !key.includes('debt_extra'))) return true;
      return true;
    })
    .map((categoryKey): ToolSlider | null => {
      // Handle main category selections (needs, wants, savings)
      if (needsFullySelected && (categoryKey === 'essentials' || categoryKey === 'debt_minimums')) {
        return null; // Will create a single 'needs' slider instead
      }
      if (wantsFullySelected && categoryKey === 'fun_flexible') {
        return null; // Will create a single 'wants' slider instead
      }
      if (savingsFullySelected && allSavingsCategoryKeys.includes(categoryKey)) {
        return null; // Will create a single 'savings' slider instead
      }

      // Find category in plan data
      const category = baselinePlanData.paycheckCategories.find((c: any) => c.key === categoryKey);
      if (!category) {
      // Handle third-layer items (individual expenses/debts)
      // These use dollar values, not percentages - delta will be added to Needs
      if (categoryKey.startsWith('expense_')) {
        const expenseId = categoryKey.replace('expense_', '');
        const expense = baselineState.fixedExpenses.find(e => e.id === expenseId);
        if (expense) {
          const monthlyAmount = expense.amount$;
          // Slider in dollars - reasonable range: 0 to 2x current amount, or up to monthly income
          const maxAmount = Math.max(monthlyAmount * 2, monthlyIncome * 0.5);
          return {
            id: categoryKey,
            label: expense.name,
            description: 'Individual expense',
            unit: '$',
            min: 0,
            max: maxAmount,
            step: 10,
            defaultValue: monthlyAmount,
            group: 'needs',
            parentCategory: 'essentials',
            formatValue: (value: number) => `$${value.toFixed(0)}`,
            formatDisplay: (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          };
        }
      } else if (categoryKey.startsWith('debt_') && !categoryKey.includes('debt_minimums') && !categoryKey.includes('debt_extra')) {
        const debtId = categoryKey.replace('debt_', '');
        const debt = baselineState.debts.find(d => d.id === debtId);
        if (debt) {
          const monthlyAmount = debt.minPayment$;
          // Slider in dollars - reasonable range: 0 to 2x current amount, or up to monthly income
          const maxAmount = Math.max(monthlyAmount * 2, monthlyIncome * 0.5);
          return {
            id: categoryKey,
            label: debt.name,
            description: 'Debt minimum payment',
            unit: '$',
            min: 0,
            max: maxAmount,
            step: 10,
            defaultValue: monthlyAmount,
            group: 'needs',
            parentCategory: 'debt_minimums',
            formatValue: (value: number) => `$${value.toFixed(0)}`,
            formatDisplay: (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          };
        }
      }
        return null;
      }

      const monthlyAmount = category.amount * paychecksPerMonth;
      const percentage = monthlyIncome > 0 ? (monthlyAmount / monthlyIncome) * 100 : 0;

      // Determine group
      let group: 'needs' | 'wants' | 'savings' = 'savings';
      if (categoryKey === 'essentials' || categoryKey === 'debt_minimums') {
        group = 'needs';
      } else if (categoryKey === 'fun_flexible') {
        group = 'wants';
      }

      return {
        id: categoryKey,
        label: category.label || categoryKey,
        description: category.why,
        unit: '%',
        min: 0,
        max: 100,
        step: 0.5,
        defaultValue: percentage,
        group,
      };
    })
    .filter((slider): slider is ToolSlider => slider !== null);

  // Add main category sliders if fully selected
  // Use the same calculation as income distribution bar chart - plan data only
  if (needsFullySelected) {
    const needsCategories = baselinePlanData.paycheckCategories.filter((c: any) => 
      c.key === 'essentials' || c.key === 'debt_minimums'
    );
    // Calculate monthly needs from plan data (same as income distribution bar chart)
    const monthlyNeeds = needsCategories.reduce((sum: number, c: any) => sum + (c.amount || 0), 0) * paychecksPerMonth;
    const needsPercentage = monthlyIncome > 0 ? (monthlyNeeds / monthlyIncome) * 100 : 0;
    
    sliders.unshift({
      id: 'needs',
      label: 'Needs',
      description: 'Adjust Needs allocation (Essentials & Bills + Debt Minimums)',
      unit: '%',
      min: 0,
      max: 100,
      step: 0.5,
      defaultValue: needsPercentage,
      group: 'needs',
    });
  }

  if (wantsFullySelected) {
    const wantsCategories = baselinePlanData.paycheckCategories.filter((c: any) => 
      c.key === 'fun_flexible'
    );
    // Calculate monthly wants from plan data (same as income distribution bar chart)
    const monthlyWants = wantsCategories.reduce((sum: number, c: any) => sum + (c.amount || 0), 0) * paychecksPerMonth;
    const wantsPercentage = monthlyIncome > 0 ? (monthlyWants / monthlyIncome) * 100 : 0;
    
    sliders.unshift({
      id: 'wants',
      label: 'Wants',
      description: 'Adjust Wants allocation (Fun & Flexible)',
      unit: '%',
      min: 0,
      max: 100,
      step: 0.5,
      defaultValue: wantsPercentage,
      group: 'wants',
    });
  }

  if (savingsFullySelected) {
    const savingsCategories = baselinePlanData.paycheckCategories.filter((c: any) => 
      allSavingsCategoryKeys.includes(c.key)
    );
    // Calculate monthly savings from plan data (same as income distribution bar chart)
    // IMPORTANT: Do NOT include subcategories in the sum - main category amount already represents the total
    const monthlySavings = savingsCategories.reduce((sum: number, c: any) => {
      // For savings categories: long_term_investing.amount already includes all subcategories
      return sum + (c.amount || 0);
    }, 0) * paychecksPerMonth;
    // Slider in dollars - reasonable range: 0 to monthly income
    const maxSavingsAmount = monthlyIncome;
    
    sliders.unshift({
      id: 'savings',
      label: 'Savings',
      description: 'Adjust Savings allocation',
      unit: '$',
      min: 0,
      max: maxSavingsAmount,
      step: 10,
      defaultValue: monthlySavings,
      group: 'savings',
      formatValue: (value: number) => `$${value.toFixed(0)}`,
      formatDisplay: (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    });
  }

  // Custom calculateScenarioState that handles dollar-value sliders for expenses/debts
  // This ensures that when rent (or any expense/debt) changes, we:
  // 1. Update the actual expense/debt amount in the state
  // 2. Recalculate Needs/Wants/Savings totals from updated dollar amounts
  // 3. Convert those totals to percentages based on monthly income
  // Dollar values should NEVER be treated as percentages
  const calculateScenarioState = ({ baselineState: state, sliderValues }: { baselineState: OnboardingState; sliderValues: Record<string, number> }): OnboardingState => {
    // Separate sliders into main category sliders (percentage-based) and expense/debt sliders (dollar-based)
    const mainCategorySliders = sliders.filter(s => s.id === 'needs' || s.id === 'wants' || s.id === 'savings');
    const expenseSliders = sliders.filter(s => s.id.startsWith('expense_'));
    const debtSliders = sliders.filter(s => s.id.startsWith('debt_') && !s.id.includes('debt_minimums') && !s.id.includes('debt_extra'));
    
    // Clone the state to avoid mutating the baseline
    const updatedState: OnboardingState = { ...state };
    
    // Step 1: Apply dollar-value changes to individual expenses/debts
    // Update expenses with dollar values (NOT percentages)
    if (expenseSliders.length > 0) {
      updatedState.fixedExpenses = state.fixedExpenses.map(expense => {
        const sliderId = `expense_${expense.id}`;
        const slider = expenseSliders.find(s => s.id === sliderId);
        if (slider && sliderValues[sliderId] !== undefined) {
          // sliderValues[sliderId] is in DOLLARS, not percentage
          const newAmount = sliderValues[sliderId];
          return { ...expense, amount$: newAmount };
        }
        return expense;
      });
    }
    
    // Update debts with dollar values (NOT percentages)
    if (debtSliders.length > 0) {
      updatedState.debts = state.debts.map(debt => {
        const sliderId = `debt_${debt.id}`;
        const slider = debtSliders.find(s => s.id === sliderId);
        if (slider && sliderValues[sliderId] !== undefined) {
          // sliderValues[sliderId] is in DOLLARS, not percentage
          const newAmount = sliderValues[sliderId];
          return { ...debt, minPayment$: newAmount };
        }
        return debt;
      });
    }
    
    // Step 2: Calculate monthly income
    const paychecksPerMonth = getPaychecksPerMonth(state.income?.payFrequency || 'biweekly');
    const monthlyIncome = (state.income?.netIncome$ || state.income?.grossIncome$ || 0) * paychecksPerMonth;
    
    // Step 3: Recalculate Needs/Wants/Savings totals from updated dollar amounts
    // CRITICAL: When only needs expenses change (like rent), preserve Wants and Savings baseline amounts
    // This ensures Wants doesn't drop to zero when we only adjust needs expenses
    
    // Needs: sum of needs expenses + all debt minimum payments (use updated amounts)
    const needsExpenses = updatedState.fixedExpenses
      .filter(exp => exp.category === 'needs' || !exp.category)
      .reduce((sum, exp) => sum + exp.amount$, 0);
    const debtMinPayments = updatedState.debts
      .reduce((sum, debt) => sum + debt.minPayment$, 0);
    const newMonthlyNeeds = needsExpenses + debtMinPayments;
    
    // CRITICAL: Get baseline amounts from PLAN DATA, not from actuals3m
    // actuals3m might not match the plan (e.g., if it was recalculated from expenses)
    // We need to preserve the actual dollar amounts from the baseline plan
    // Calculate baseline monthly amounts from baseline plan data (if available)
    let baselineMonthlyNeeds: number;
    let baselineMonthlyWants: number;
    let baselineMonthlySavings: number;
    
    // Try to get from baseline plan data first (source of truth)
    if (baselinePlanData && baselinePlanData.paycheckCategories) {
      const paychecksPerMonth = getPaychecksPerMonth(state.income?.payFrequency || 'biweekly');
      const needsCategories = baselinePlanData.paycheckCategories.filter((c: any) => 
        c.key === 'essentials' || c.key === 'debt_minimums'
      );
      const wantsCategories = baselinePlanData.paycheckCategories.filter((c: any) => 
        c.key === 'fun_flexible'
      );
      const savingsCategories = baselinePlanData.paycheckCategories.filter((c: any) => 
        c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra' ||
        c.key === 'short_term_goals' || c.key === '401k_match' || c.key === 'retirement_tax_advantaged' ||
        c.key === 'brokerage'
      );
      
      baselineMonthlyNeeds = needsCategories.reduce((sum: number, c: any) => sum + (c.amount || 0), 0) * paychecksPerMonth;
      baselineMonthlyWants = wantsCategories.reduce((sum: number, c: any) => sum + (c.amount || 0), 0) * paychecksPerMonth;
      baselineMonthlySavings = savingsCategories.reduce((sum: number, c: any) => sum + (c.amount || 0), 0) * paychecksPerMonth;
    } else {
      // Fallback to actuals3m if plan data not available
      const baselineActuals = state.riskConstraints?.actuals3m || {
        needsPct: 0.5,
        wantsPct: 0.3,
        savingsPct: 0.2,
      };
      baselineMonthlyNeeds = baselineActuals.needsPct * monthlyIncome;
      baselineMonthlyWants = baselineActuals.wantsPct * monthlyIncome;
      baselineMonthlySavings = baselineActuals.savingsPct * monthlyIncome;
    }
    
    console.log('[Configure Your Own] Baseline amounts from plan data:', {
      baselineMonthlyNeeds,
      baselineMonthlyWants,
      baselineMonthlySavings,
      monthlyIncome,
      wantsPct: (baselineMonthlyWants / monthlyIncome) * 100,
    });
    
    // Check which categories have dollar-based sliders (expenses/debts)
    const hasWantsDollarSliders = expenseSliders.some(s => {
      const expenseId = s.id.replace('expense_', '');
      const expense = updatedState.fixedExpenses.find(e => e.id === expenseId);
      return expense && expense.category === 'wants';
    });
    
    // Wants: use updated wants expenses if wants sliders exist, otherwise preserve baseline amount
    // CRITICAL: When only needs expenses change (like rent), preserve Wants at baseline dollar amount
    let newMonthlyWants: number;
    if (hasWantsDollarSliders) {
      // Wants sliders were adjusted - use updated wants expenses
      const wantsExpenses = updatedState.fixedExpenses
        .filter(exp => exp.category === 'wants')
        .reduce((sum, exp) => sum + exp.amount$, 0);
      newMonthlyWants = wantsExpenses;
    } else {
      // No wants sliders - preserve baseline wants amount (dollars) from actuals3m
      // This ensures Wants doesn't change when only Needs expenses (like rent) change
      newMonthlyWants = baselineMonthlyWants;
    }
    
    // Step 4: Check if main category sliders are set BEFORE calculating Savings as remainder
    // CRITICAL: Main category sliders take precedence - if they're set, use those values directly
    const needsSlider = mainCategorySliders.find(s => s.id === 'needs');
    const wantsSlider = mainCategorySliders.find(s => s.id === 'wants');
    const savingsSlider = mainCategorySliders.find(s => s.id === 'savings');
    
    // Check if main category sliders were explicitly changed (more than 0.1 from default)
    const needsSliderSet = needsSlider && sliderValues['needs'] !== undefined && 
      Math.abs(sliderValues['needs'] - (needsSlider.defaultValue || 0)) > (needsSlider.unit === '$' ? 10 : 0.1);
    const wantsSliderSet = wantsSlider && sliderValues['wants'] !== undefined && 
      Math.abs(sliderValues['wants'] - (wantsSlider.defaultValue || 0)) > (wantsSlider.unit === '$' ? 10 : 0.1);
    const savingsSliderSet = savingsSlider && sliderValues['savings'] !== undefined && 
      Math.abs(sliderValues['savings'] - (savingsSlider.defaultValue || 0)) > (savingsSlider.unit === '$' ? 10 : 0.1);
    
    // Step 5: Calculate monthly amounts - prioritize main category sliders if they're set
    let finalMonthlyNeeds = newMonthlyNeeds;
    let finalMonthlyWants = newMonthlyWants;
    let finalMonthlySavings: number;
    
    // If main category sliders are set, use those values (they take precedence)
    if (needsSliderSet && needsSlider && sliderValues['needs'] !== undefined) {
      if (needsSlider.unit === '$') {
        // Dollar-based slider - use the dollar amount directly
        finalMonthlyNeeds = sliderValues['needs'];
      } else if (needsSlider.unit === '%') {
        // Percentage-based slider - convert to dollars
        finalMonthlyNeeds = (sliderValues['needs'] / 100) * monthlyIncome;
      }
    }
    
    if (wantsSliderSet && wantsSlider && sliderValues['wants'] !== undefined) {
      if (wantsSlider.unit === '$') {
        // Dollar-based slider - use the dollar amount directly
        finalMonthlyWants = sliderValues['wants'];
      } else if (wantsSlider.unit === '%') {
        // Percentage-based slider - convert to dollars
        finalMonthlyWants = (sliderValues['wants'] / 100) * monthlyIncome;
      }
    }
    
    if (savingsSliderSet && savingsSlider && sliderValues['savings'] !== undefined) {
      if (savingsSlider.unit === '$') {
        // Dollar-based slider - use the dollar amount directly
        finalMonthlySavings = sliderValues['savings'];
      } else if (savingsSlider.unit === '%') {
        // Percentage-based slider - convert to dollars
        finalMonthlySavings = (sliderValues['savings'] / 100) * monthlyIncome;
      } else {
        // Fallback: calculate as remainder
        finalMonthlySavings = Math.max(0, monthlyIncome - finalMonthlyNeeds - finalMonthlyWants);
      }
    } else {
      // Savings slider not set - calculate as remainder
      finalMonthlySavings = Math.max(0, monthlyIncome - finalMonthlyNeeds - finalMonthlyWants);
    }
    
    // Step 6: Convert dollar totals to percentages and normalize
    let finalNeedsPct = monthlyIncome > 0 ? finalMonthlyNeeds / monthlyIncome : 0;
    let finalWantsPct = monthlyIncome > 0 ? finalMonthlyWants / monthlyIncome : 0;
    let finalSavingsPct = monthlyIncome > 0 ? finalMonthlySavings / monthlyIncome : 0;
    
    // Step 7: Normalize to ensure they sum to exactly 1.0
    // CRITICAL: When only dollar-based subcategory sliders change (like rent), preserve Wants and adjust Savings as remainder
    // Only normalize if main category sliders are explicitly set
    const total = finalNeedsPct + finalWantsPct + finalSavingsPct;
    
    // Check if any expense/debt sliders were changed (this means we're adjusting subcategories, not main categories)
    const hasExpenseOrDebtSliders = expenseSliders.length > 0 || debtSliders.length > 0;
    const anyExpenseDebtChanged = hasExpenseOrDebtSliders && (
      expenseSliders.some(s => {
        const expenseId = s.id.replace('expense_', '');
        const expense = state.fixedExpenses.find(e => e.id === expenseId);
        if (!expense) return false;
        const currentValue = sliderValues[s.id];
        if (currentValue === undefined) return false;
        return Math.abs(currentValue - expense.amount$) > 1; // Changed by more than $1
      }) ||
      debtSliders.some(s => {
        const debtId = s.id.replace('debt_', '');
        const debt = state.debts.find(d => d.id === debtId);
        if (!debt) return false;
        const currentValue = sliderValues[s.id];
        if (currentValue === undefined) return false;
        return Math.abs(currentValue - debt.minPayment$) > 1; // Changed by more than $1
      })
    );
    
    // If only expense/debt sliders changed (and no main category sliders are set), 
    // preserve Wants at baseline dollar amount and adjust Savings as remainder
    if (anyExpenseDebtChanged && !needsSliderSet && !wantsSliderSet && !savingsSliderSet) {
      // CRITICAL: When rent increases, Needs increases by that amount, Wants stays the same (dollar amount),
      // and Savings decreases by that amount
      // Recalculate Savings as remainder to ensure exact sum
      finalMonthlySavings = Math.max(0, monthlyIncome - finalMonthlyNeeds - finalMonthlyWants);
      // Recalculate percentages from updated dollar amounts (NOT from normalized percentages)
      finalNeedsPct = monthlyIncome > 0 ? finalMonthlyNeeds / monthlyIncome : 0;
      finalWantsPct = monthlyIncome > 0 ? finalMonthlyWants / monthlyIncome : 0;
      finalSavingsPct = monthlyIncome > 0 ? finalMonthlySavings / monthlyIncome : 0;
      
      // CRITICAL: Ensure these percentages are used (don't normalize further)
      // Skip the normalization logic below for this case
    } else if (total > 0.001 && Math.abs(total - 1.0) > 0.001) {
      // Main category sliders are involved - normalize accordingly
      if (savingsSliderSet && !needsSliderSet && !wantsSliderSet) {
        // Savings is set - adjust Needs and Wants proportionally to fit
        const remaining = 1.0 - finalSavingsPct;
        const needsWantsTotal = finalNeedsPct + finalWantsPct;
        if (needsWantsTotal > 0) {
          finalNeedsPct = (finalNeedsPct / needsWantsTotal) * remaining;
          finalWantsPct = (finalWantsPct / needsWantsTotal) * remaining;
        } else {
          // If no needs/wants, split evenly
          finalNeedsPct = remaining / 2;
          finalWantsPct = remaining / 2;
        }
      } else if (needsSliderSet && !savingsSliderSet) {
        // Needs is set - adjust Savings as remainder (preserve Wants if not set)
        finalSavingsPct = Math.max(0, Math.min(1.0, 1.0 - finalNeedsPct - finalWantsPct));
      } else if (wantsSliderSet && !savingsSliderSet) {
        // Wants is set - adjust Savings as remainder (preserve Needs if not set)
        finalSavingsPct = Math.max(0, Math.min(1.0, 1.0 - finalNeedsPct - finalWantsPct));
      } else {
        // Default: adjust Savings as remainder (preserves Needs and Wants)
        finalSavingsPct = Math.max(0, Math.min(1.0, 1.0 - finalNeedsPct - finalWantsPct));
      }
    }
    
    // Final validation to ensure exact sum of 1.0
    // CRITICAL: If only expense/debt sliders changed, we already calculated correctly above
    // For all other cases, normalize as needed
    if (!anyExpenseDebtChanged || needsSliderSet || wantsSliderSet || savingsSliderSet) {
      if (!savingsSliderSet && !anyExpenseDebtChanged) {
        // Savings not explicitly set and no expense/debt changes - adjust as remainder
        finalSavingsPct = Math.max(0, Math.min(1.0, 1.0 - finalNeedsPct - finalWantsPct));
      } else if (savingsSliderSet && !needsSliderSet && !wantsSliderSet && !anyExpenseDebtChanged) {
        // Savings is set, but Needs and Wants are not - adjust them proportionally
        const remaining = 1.0 - finalSavingsPct;
        const needsWantsTotal = finalNeedsPct + finalWantsPct;
        if (needsWantsTotal > 0) {
          finalNeedsPct = (finalNeedsPct / needsWantsTotal) * remaining;
          finalWantsPct = (finalWantsPct / needsWantsTotal) * remaining;
        } else {
          // If no needs/wants, split evenly
          finalNeedsPct = remaining / 2;
          finalWantsPct = remaining / 2;
        }
      }
    }
    
    // Step 8: Return updated state with new percentages
    // CRITICAL: Set both targets and actuals3m to the SAME values to prevent allocateIncome from adjusting
    // When targets == actuals3m, allocateIncome will keep them the same (no shifts)
    // This ensures Wants stays at its preserved baseline when only rent changes
    // Ensure exact sum of 1.0 (fix floating point precision)
    const finalSum = finalNeedsPct + finalWantsPct + finalSavingsPct;
    let finalNeedsPctFinal = finalNeedsPct;
    let finalWantsPctFinal = finalWantsPct;
    let finalSavingsPctFinal = finalSavingsPct;
    
    if (Math.abs(finalSum - 1.0) > 0.0001) {
      // Adjust Savings as remainder to preserve Needs and Wants
      finalSavingsPctFinal = Math.max(0, Math.min(1.0, 1.0 - finalNeedsPctFinal - finalWantsPctFinal));
    }
    
    // CRITICAL: Round to 6 decimal places to avoid floating point precision issues
    // that might cause buildFinalPlanData to reject our actuals3m
    finalNeedsPctFinal = Math.round(finalNeedsPctFinal * 1000000) / 1000000;
    finalWantsPctFinal = Math.round(finalWantsPctFinal * 1000000) / 1000000;
    finalSavingsPctFinal = Math.round(finalSavingsPctFinal * 1000000) / 1000000;
    
    // Final validation - ensure exact sum of 1.0
    const validatedSum = finalNeedsPctFinal + finalWantsPctFinal + finalSavingsPctFinal;
    if (Math.abs(validatedSum - 1.0) > 0.000001) {
      // Force exact sum by adjusting savings
      finalSavingsPctFinal = 1.0 - finalNeedsPctFinal - finalWantsPctFinal;
    }
    
    console.log('[Configure Your Own] Setting actuals3m to preserve Wants:', {
      anyExpenseDebtChanged,
      needsSliderSet,
      wantsSliderSet,
      savingsSliderSet,
      baselineMonthlyWants,
      finalMonthlyWants,
      finalWantsPctFinal: finalWantsPctFinal * 100,
      finalNeedsPctFinal: finalNeedsPctFinal * 100,
      finalSavingsPctFinal: finalSavingsPctFinal * 100,
      sum: (finalNeedsPctFinal + finalWantsPctFinal + finalSavingsPctFinal) * 100,
      targets: {
        needsPct: finalNeedsPctFinal,
        wantsPct: finalWantsPctFinal,
        savingsPct: finalSavingsPctFinal,
      },
      actuals3m: {
        needsPct: finalNeedsPctFinal,
        wantsPct: finalWantsPctFinal,
        savingsPct: finalSavingsPctFinal,
      },
    });
    
    return {
      ...updatedState,
      initialPaycheckPlan: undefined, // Clear to force recalculation
      riskConstraints: updatedState.riskConstraints ? {
        ...updatedState.riskConstraints,
        targets: {
          needsPct: finalNeedsPctFinal,
          wantsPct: finalWantsPctFinal,
          savingsPct: finalSavingsPctFinal,
        },
        actuals3m: {
          needsPct: finalNeedsPctFinal,
          wantsPct: finalWantsPctFinal,
          savingsPct: finalSavingsPctFinal,
        },
        bypassWantsFloor: true, // Critical: bypass wants floor to preserve manual adjustments
      } : {
        targets: {
          needsPct: finalNeedsPctFinal,
          wantsPct: finalWantsPctFinal,
          savingsPct: finalSavingsPctFinal,
        },
        actuals3m: {
          needsPct: finalNeedsPctFinal,
          wantsPct: finalWantsPctFinal,
          savingsPct: finalSavingsPctFinal,
        },
        bypassWantsFloor: true, // Critical: bypass wants floor to preserve manual adjustments
        shiftLimitPct: 0.04,
      },
    };
  };

  return {
    id: 'configure-your-own',
    title: 'Configure Your Own',
    description: 'Adjust selected categories to see impact on your financial plan',
    sliders,
    calculateScenarioState,
    chart: {
      type: 'net_worth',
      title: 'Net Worth Impact',
      description: 'See how your changes impact your long-term wealth',
    },
    onApply: async ({ sliderValues, scenarioState, baselineState }) => {
      // Update store with new allocations - use the store from useOnboardingStore
      const store = useOnboardingStore.getState();
      
      // Also update individual expenses/debts if they were changed
      const expenseSliders = sliders.filter(s => s.id.startsWith('expense_'));
      const debtSliders = sliders.filter(s => s.id.startsWith('debt_') && !s.id.includes('debt_minimums') && !s.id.includes('debt_extra'));
      
      if (expenseSliders.length > 0 || debtSliders.length > 0) {
        // Update individual expenses/debts in the store
        if (store.setFixedExpenses) {
          store.setFixedExpenses(scenarioState.fixedExpenses);
        }
        if (store.setDebts && debtSliders.length > 0) {
          store.setDebts(scenarioState.debts);
        }
      }
      
      if (store.updateRiskConstraints) {
        store.updateRiskConstraints({
          actuals3m: scenarioState.riskConstraints?.actuals3m || {
            needsPct: 0,
            wantsPct: 0,
            savingsPct: 0,
          },
        });
      }
      if (store.setInitialPaycheckPlan) {
        store.setInitialPaycheckPlan(undefined as any);
      }
      console.log('[Configure Your Own] Applied changes:', sliderValues);
    },
  };
}

function ConfigurableToolDemoContent() {
  const router = useRouter();
  const baselineState = useOnboardingStore();
  const baselinePlanData = usePlanData();

  // Category selection state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    needs: false,
    wants: false,
    savings: false,
  });
  const [expandedSubItems, setExpandedSubItems] = useState<Record<string, boolean>>({});
  const [isCategorySelectorExpanded, setIsCategorySelectorExpanded] = useState<boolean>(true);
  const [currentSliderValues, setCurrentSliderValues] = useState<Record<string, number>>({});

  // Create config based on selected categories
  const config = useMemo(() => {
    if (!baselinePlanData) {
      return {
        id: 'configure-your-own',
        title: 'Configure Your Own',
        description: 'Adjust selected categories to see impact on your financial plan',
        sliders: [],
        calculateScenarioState: ({ baselineState: state }) => ({ ...state }) as OnboardingState,
        chart: { type: 'net_worth' as const, title: 'Net Worth Impact', description: 'See how your changes impact your long-term wealth' },
        onApply: async () => {},
      } as ToolConfig;
    }
    return createConfigureYourOwnConfig(baselineState, baselinePlanData, selectedCategories);
  }, [baselineState, baselinePlanData, selectedCategories]);

  // Calculate scenario plan data for income distribution (using sliders)
  const scenarioPlanDataForDistribution = useMemo(() => {
    if (!baselinePlanData || !config.sliders || config.sliders.length === 0) {
      return null;
    }
    
    if (Object.keys(currentSliderValues).length === 0) {
      return null; // Use baseline until sliders are initialized
    }
    
    try {
      // Get current slider values (use current values, fallback to defaults)
      const sliderValuesForScenario: Record<string, number> = {};
      config.sliders.forEach(slider => {
        sliderValuesForScenario[slider.id] = currentSliderValues[slider.id] ?? slider.defaultValue;
      });
      
      // Calculate scenario state from slider values
      const scenarioState = config.calculateScenarioState({
        baselineState,
        sliderValues: sliderValuesForScenario,
      });
      
      // Build plan data from scenario state
      // This already handles dollar-based sliders correctly (calculateScenarioState updated expenses,
      // and buildFinalPlanData recalculates percentages from those updated expenses)
      const plan = buildFinalPlanData(scenarioState);
      
      // CRITICAL: Check if we have dollar-based sliders (expense/debt sliders)
      // Dollar-based sliders should NOT be included in percentage scaling logic
      // They are already handled correctly in calculateScenarioState -> buildFinalPlanData
      const hasDollarBasedSliders = config.sliders.some(s => 
        s.id.startsWith('expense_') || (s.id.startsWith('debt_') && !s.id.includes('debt_minimums') && !s.id.includes('debt_extra'))
      );
      
      // If we have dollar-based sliders, skip scaling - the plan is already correct
      // buildFinalPlanData already recalculated percentages from updated dollar amounts
      if (hasDollarBasedSliders) {
        return plan;
      }
      
      // For percentage-based sliders only, scale plan data to match slider values
      // Only scale categories that have sliders - preserve baseline for categories without sliders
      const hasGroupedSliders = config.sliders.some(s => s.group === 'needs' || s.group === 'wants' || s.group === 'savings');
      const hasSliderChanges = Object.keys(currentSliderValues).length > 0 && 
        config.sliders.some(s => {
          const currentValue = currentSliderValues[s.id] ?? s.defaultValue;
          return Math.abs(currentValue - s.defaultValue) > 0.1; // Only scale if slider changed by more than 0.1%
        });
      
      if (hasGroupedSliders && hasSliderChanges) {
        const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
        const monthlyIncome = plan.paycheckAmount * paychecksPerMonth;
        
        // CRITICAL: Separate percentage-based sliders (main categories) from dollar-based sliders (expenses/debts)
        // Dollar-based sliders (expense_*, debt_*) should NOT be included in percentage scaling
        // They are already handled in calculateScenarioState which updates expenses directly
        // buildFinalPlanData will recalculate percentages from updated expenses
        
        // Only include MAIN CATEGORY sliders (needs, wants, savings) that are percentage-based
        // NOT expense/debt sliders which are dollar-based
        const needsSliders = config.sliders.filter(s => 
          s.group === 'needs' && (s.id === 'needs' || s.id === 'wants' || s.id === 'savings')
        );
        const wantsSliders = config.sliders.filter(s => 
          s.group === 'wants' && (s.id === 'needs' || s.id === 'wants' || s.id === 'savings')
        );
        const savingsSliders = config.sliders.filter(s => 
          s.group === 'savings' && (s.id === 'needs' || s.id === 'wants' || s.id === 'savings')
        );
        
        // Check if we have dollar-based sliders (expense/debt sliders)
        // If so, skip the scaling logic - buildFinalPlanData already handled it correctly
        const hasDollarBasedSliders = config.sliders.some(s => 
          s.id.startsWith('expense_') || (s.id.startsWith('debt_') && !s.id.includes('debt_minimums') && !s.id.includes('debt_extra'))
        );
        
        // If we have dollar-based sliders, don't scale - the plan data from buildFinalPlanData is already correct
        // because calculateScenarioState updated the expenses, and buildFinalPlanData recalculated percentages
        if (hasDollarBasedSliders && needsSliders.length === 0 && wantsSliders.length === 0 && savingsSliders.length === 0) {
          // Only dollar-based sliders exist, no percentage-based sliders
          // The plan data from buildFinalPlanData is already correct - return it as-is
          return plan;
        }
        
        // Get baseline percentages for categories without sliders (preserve current plan)
        const baselineNeedsCategories = baselinePlanData.paycheckCategories.filter((c: any) => 
          c.key === 'essentials' || c.key === 'debt_minimums'
        );
        const baselineWantsCategories = baselinePlanData.paycheckCategories.filter((c: any) => 
          c.key === 'fun_flexible'
        );
        const baselineSavingsCategories = baselinePlanData.paycheckCategories.filter((c: any) => 
          c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra' ||
          c.key === 'short_term_goals' || c.key === '401k_match' || c.key === 'retirement_tax_advantaged' ||
          c.key === 'brokerage'
        );
        
        const baselineNeedsMonthly = baselineNeedsCategories.reduce((sum: number, c: any) => sum + (c.amount || 0), 0) * paychecksPerMonth;
        const baselineWantsMonthly = baselineWantsCategories.reduce((sum: number, c: any) => sum + (c.amount || 0), 0) * paychecksPerMonth;
        const baselineSavingsMonthly = baselineSavingsCategories.reduce((sum: number, c: any) => sum + (c.amount || 0), 0) * paychecksPerMonth;
        
        // Use slider values ONLY for main category sliders (percentage-based)
        // Dollar-based sliders are already reflected in plan via updated expenses
        const needsPct = needsSliders.length > 0
          ? needsSliders.reduce((sum, s) => sum + (sliderValuesForScenario[s.id] ?? s.defaultValue), 0)
          : (baselineNeedsMonthly / monthlyIncome) * 100;
        
        const wantsPct = wantsSliders.length > 0
          ? wantsSliders.reduce((sum, s) => sum + (sliderValuesForScenario[s.id] ?? s.defaultValue), 0)
          : (baselineWantsMonthly / monthlyIncome) * 100;
        
        const savingsPct = savingsSliders.length > 0
          ? savingsSliders.reduce((sum, s) => sum + (sliderValuesForScenario[s.id] ?? s.defaultValue), 0)
          : (baselineSavingsMonthly / monthlyIncome) * 100;
        
        const targetNeedsMonthly = (needsPct / 100) * monthlyIncome;
        const targetWantsMonthly = (wantsPct / 100) * monthlyIncome;
        const targetSavingsMonthly = (savingsPct / 100) * monthlyIncome;
        
        const targetNeedsPerPaycheck = targetNeedsMonthly / paychecksPerMonth;
        const targetWantsPerPaycheck = targetWantsMonthly / paychecksPerMonth;
        const targetSavingsPerPaycheck = targetSavingsMonthly / paychecksPerMonth;
        
        // Scale categories to match slider values - only scale categories that have sliders
        const needsIndexes = plan.paycheckCategories
          .map((cat, idx) => ({ cat, idx }))
          .filter(({ cat }) => (cat.key as string) === 'essentials' || (cat.key as string) === 'debt_minimums');
        const wantsIndexes = plan.paycheckCategories
          .map((cat, idx) => ({ cat, idx }))
          .filter(({ cat }) => (cat.key as string) === 'fun_flexible');
        const savingsIndexes = plan.paycheckCategories
          .map((cat, idx) => ({ cat, idx }))
          .filter(({ cat }) => {
            const key = cat.key as string;
            return key === 'emergency' || key === 'long_term_investing' || key === 'debt_extra' ||
              key === 'short_term_goals' || key === '401k_match' || key === 'retirement_tax_advantaged' ||
              key === 'brokerage';
          });
        
        const sumAmounts = (entries: { cat: typeof plan.paycheckCategories[number] }[]) =>
          entries.reduce((sum, { cat }) => sum + cat.amount, 0);
        
        const scaleAndUpdate = (
          entries: { cat: typeof plan.paycheckCategories[number]; idx: number }[],
          targetPerPaycheck: number
        ) => {
          const current = sumAmounts(entries);
          const scale = current > 0 ? targetPerPaycheck / current : 0;
          entries.forEach(({ cat, idx }) => {
            const newAmount = scale > 0 ? cat.amount * scale : 0;
            plan.paycheckCategories[idx] = {
              ...cat,
              amount: newAmount,
              percent: (newAmount / plan.paycheckAmount) * 100,
            };
          });
        };
        
        // Only scale categories that have sliders - preserve baseline for others
        if (needsSliders.length > 0) {
          scaleAndUpdate(needsIndexes, targetNeedsPerPaycheck);
        }
        if (wantsSliders.length > 0) {
          scaleAndUpdate(wantsIndexes, targetWantsPerPaycheck);
        }
        if (savingsSliders.length > 0) {
          scaleAndUpdate(savingsIndexes, targetSavingsPerPaycheck);
        }
      }
      
      return plan;
    } catch (error) {
      console.error('[Configurable Demo] Error calculating scenario plan for distribution:', error);
      return null;
    }
  }, [baselinePlanData, baselineState, config, currentSliderValues]);

  // Calculate income distribution - SINGLE SOURCE OF TRUTH: plan data only (savings-optimizer pattern)
  const incomeDistribution = useMemo(() => {
    const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
    const monthlyIncome = (baselineState.income?.netIncome$ || baselineState.income?.grossIncome$ || 0) * paychecksPerMonth;
    
    if (!monthlyIncome || monthlyIncome <= 0) {
      return null;
    }
    
    // Use scenario plan data only if we have slider changes, otherwise use baseline
    // This is the SINGLE SOURCE OF TRUTH - plan data already reflects slider values
    const hasSliderChanges = Object.keys(currentSliderValues).length > 0 && 
      config.sliders.some(s => {
        const currentValue = currentSliderValues[s.id];
        if (currentValue === undefined) return false;
        // For dollar-based sliders, use $10 threshold; for percentage-based, use 0.1%
        const threshold = s.unit === '$' ? 10 : 0.1;
        return Math.abs(currentValue - s.defaultValue) > threshold;
      });
    const planToUse = (hasSliderChanges && scenarioPlanDataForDistribution) ? scenarioPlanDataForDistribution : baselinePlanData;
    if (!planToUse || !planToUse.paycheckCategories || planToUse.paycheckCategories.length === 0) {
      return null;
    }
    
    // Calculate from plan data only (all paycheck categories are per-paycheck)
    const needsCategories = planToUse.paycheckCategories.filter((c: any) => 
      c.key === 'essentials' || c.key === 'debt_minimums'
    );
    const wantsCategories = planToUse.paycheckCategories.filter((c: any) => 
      c.key === 'fun_flexible'
    );
    const savingsCategories = planToUse.paycheckCategories.filter((c: any) => 
      c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra' ||
      c.key === 'short_term_goals' || c.key === '401k_match' || c.key === 'retirement_tax_advantaged' ||
      c.key === 'brokerage'
    );

    // Sum monthly amounts from plan data (amounts are per-paycheck, multiply by paychecksPerMonth)
    // IMPORTANT: Do NOT include subcategories in the sum - main category amount already represents the total
    const monthlyNeeds = needsCategories.reduce((sum: number, c: any) => {
      // Only sum the main category amount, not subcategories
      return sum + (c.amount || 0);
    }, 0) * paychecksPerMonth;
    const monthlyWants = wantsCategories.reduce((sum: number, c: any) => {
      // Only sum the main category amount, not subcategories
      return sum + (c.amount || 0);
    }, 0) * paychecksPerMonth;
    const monthlySavings = savingsCategories.reduce((sum: number, c: any) => {
      // For savings, include subcategories only for long_term_investing
      // Other categories' amounts already represent the total
      let amount = c.amount || 0;
      if (c.key === 'long_term_investing' && c.subCategories) {
        // long_term_investing amount already includes subcategories, don't double-count
        // The main amount IS the sum of subcategories in plan.ts
        amount = c.amount || 0;
      }
      return sum + amount;
    }, 0) * paychecksPerMonth;

    // Calculate percentages from actual amounts and monthly income
    const needsPct = monthlyIncome > 0 ? (monthlyNeeds / monthlyIncome) * 100 : 0;
    const wantsPct = monthlyIncome > 0 ? (monthlyWants / monthlyIncome) * 100 : 0;
    const savingsPct = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;

    return {
      monthlyNeeds,
      monthlyWants,
      monthlySavings,
      needsPct,
      wantsPct,
      savingsPct,
    };
  }, [scenarioPlanDataForDistribution, baselinePlanData, baselineState.income?.payFrequency, baselineState.income?.netIncome$, baselineState.income?.grossIncome$, currentSliderValues, config.sliders]);

  // Track previous income distribution to detect changes
  const prevIncomeDistributionRef = useRef<{ needsPct: number; wantsPct: number; savingsPct: number } | null>(null);

  // Sync main category sliders (both percentage and dollar-based) with income distribution when dollar-based subcategory sliders change
  // This ensures that when rent (dollar-based) changes, the Savings slider updates to reflect the new value
  useEffect(() => {
    if (!incomeDistribution || !config.sliders || config.sliders.length === 0) {
      if (incomeDistribution) {
        prevIncomeDistributionRef.current = incomeDistribution;
      }
      return;
    }

    // Get main category sliders (needs, wants, savings) - can be either percentage or dollar-based
    // NOT dollar-based subcategory sliders (expense_*, debt_*)
    const mainCategorySliders = config.sliders.filter(s => 
      s.id === 'needs' || s.id === 'wants' || s.id === 'savings'
    );

    if (mainCategorySliders.length === 0) {
      if (incomeDistribution) {
        prevIncomeDistributionRef.current = incomeDistribution;
      }
      return; // No main category sliders to update
    }

    // Check if dollar-based subcategory sliders exist - only auto-update main category sliders if subcategory sliders exist
    const hasDollarBasedSubcategorySliders = config.sliders.some(s => 
      s.id.startsWith('expense_') || (s.id.startsWith('debt_') && !s.id.includes('debt_minimums') && !s.id.includes('debt_extra'))
    );

    if (!hasDollarBasedSubcategorySliders) {
      // No dollar-based subcategory sliders, don't auto-update main category sliders (user controls them)
      if (incomeDistribution) {
        prevIncomeDistributionRef.current = incomeDistribution;
      }
      return;
    }

    // Only update if income distribution actually changed (not just on initial render)
    const prevDist = prevIncomeDistributionRef.current;
    if (!prevDist) {
      // Initial render - store current distribution
      prevIncomeDistributionRef.current = incomeDistribution;
      return;
    }

    // Check if any percentage changed significantly
    const needsChanged = Math.abs(prevDist.needsPct - incomeDistribution.needsPct) > 0.1;
    const wantsChanged = Math.abs(prevDist.wantsPct - incomeDistribution.wantsPct) > 0.1;
    const savingsChanged = Math.abs(prevDist.savingsPct - incomeDistribution.savingsPct) > 0.1;

    if (!needsChanged && !wantsChanged && !savingsChanged) {
      // No significant change, skip update
      prevIncomeDistributionRef.current = incomeDistribution;
      return;
    }

    // Calculate monthly income for dollar conversions
    const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
    const monthlyIncome = (baselineState.income?.netIncome$ || baselineState.income?.grossIncome$ || 0) * paychecksPerMonth;

    // Get the corresponding values from income distribution and convert to slider units
    // Batch all slider updates together
    setCurrentSliderValues(prev => {
      const newSliderValues: Record<string, number> = { ...prev };
      let hasChanges = false;

      mainCategorySliders.forEach(slider => {
        const currentValue = prev[slider.id] ?? slider.defaultValue;
        let newValue: number;
        let categoryChanged = false;
        
        if (slider.id === 'needs') {
          categoryChanged = needsChanged;
          if (slider.unit === '%') {
            // Percentage-based slider - use percentage directly
            newValue = incomeDistribution.needsPct;
          } else if (slider.unit === '$') {
            // Dollar-based slider - use monthly dollar amount directly
            newValue = incomeDistribution.monthlyNeeds;
          } else {
            return; // Skip unknown unit
          }
        } else if (slider.id === 'wants') {
          categoryChanged = wantsChanged;
          if (slider.unit === '%') {
            // Percentage-based slider - use percentage directly
            newValue = incomeDistribution.wantsPct;
          } else if (slider.unit === '$') {
            // Dollar-based slider - use monthly dollar amount directly
            newValue = incomeDistribution.monthlyWants;
          } else {
            return; // Skip unknown unit
          }
        } else if (slider.id === 'savings') {
          categoryChanged = savingsChanged;
          if (slider.unit === '%') {
            // Percentage-based slider - use percentage directly
            newValue = incomeDistribution.savingsPct;
          } else if (slider.unit === '$') {
            // Dollar-based slider - use monthly dollar amount directly
            newValue = incomeDistribution.monthlySavings;
          } else {
            return; // Skip unknown unit
          }
        } else {
          return; // Skip unknown slider
        }

        // CRITICAL: When dollar-based subcategory sliders change (like rent), 
        // update ALL main category sliders to match income distribution (source of truth)
        // Don't skip if category didn't change - always sync all sliders when subcategory sliders exist
        // This ensures sliders always reflect the calculated values from income distribution

        // Constrain to slider's min/max
        newValue = Math.max(slider.min, Math.min(slider.max, newValue));

        // Always update to match income distribution (when subcategory sliders exist)
        // Only skip if the value hasn't changed significantly (to avoid unnecessary re-renders)
        const threshold = slider.unit === '$' ? 10 : 0.1; // $10 for dollar, 0.1% for percentage
        if (Math.abs(newValue - currentValue) > threshold) {
          newSliderValues[slider.id] = newValue;
          hasChanges = true;
        }
      });

      // Only update if there are actual changes
      return hasChanges ? newSliderValues : prev;
    });

    // Update ref to track current income distribution
    prevIncomeDistributionRef.current = incomeDistribution;
  }, [incomeDistribution, config.sliders, baselineState.income?.payFrequency, baselineState.income?.netIncome$, baselineState.income?.grossIncome$]); // Don't include currentSliderValues to avoid infinite loop

  // Calculate baseline allocation (always from baselinePlanData, never changes)
  const baselineIncomeDistribution = useMemo(() => {
    const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
    const monthlyIncome = (baselineState.income?.netIncome$ || baselineState.income?.grossIncome$ || 0) * paychecksPerMonth;
    
    if (!monthlyIncome || monthlyIncome <= 0 || !baselinePlanData || !baselinePlanData.paycheckCategories || baselinePlanData.paycheckCategories.length === 0) {
      return null;
    }
    
    // Calculate from baseline plan data only (current plan)
    const needsCategories = baselinePlanData.paycheckCategories.filter((c: any) => 
      c.key === 'essentials' || c.key === 'debt_minimums'
    );
    const wantsCategories = baselinePlanData.paycheckCategories.filter((c: any) => 
      c.key === 'fun_flexible'
    );
    const savingsCategories = baselinePlanData.paycheckCategories.filter((c: any) => 
      c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra' ||
      c.key === 'short_term_goals' || c.key === '401k_match' || c.key === 'retirement_tax_advantaged' ||
      c.key === 'brokerage'
    );

    const monthlyNeeds = needsCategories.reduce((sum: number, c: any) => sum + (c.amount || 0), 0) * paychecksPerMonth;
    const monthlyWants = wantsCategories.reduce((sum: number, c: any) => sum + (c.amount || 0), 0) * paychecksPerMonth;
    const monthlySavings = savingsCategories.reduce((sum: number, c: any) => sum + (c.amount || 0), 0) * paychecksPerMonth;

    const needsPct = monthlyIncome > 0 ? (monthlyNeeds / monthlyIncome) * 100 : 0;
    const wantsPct = monthlyIncome > 0 ? (monthlyWants / monthlyIncome) * 100 : 0;
    const savingsPct = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;

    return {
      needsPct,
      wantsPct,
      savingsPct,
    };
  }, [baselinePlanData, baselineState.income?.payFrequency, baselineState.income?.netIncome$, baselineState.income?.grossIncome$]);

  // Conditional return after all hooks
  if (!baselinePlanData) {
    return (
      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading optimizer...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Helper functions for category selection
  const toggleCategory = (categoryKey: string) => {
    if (selectedCategories.includes(categoryKey)) {
      setSelectedCategories(selectedCategories.filter(k => k !== categoryKey));
    } else {
      setSelectedCategories([...selectedCategories, categoryKey]);
    }
  };

  const toggleSubcategory = (subcategoryKey: string) => {
    if (selectedCategories.includes(subcategoryKey)) {
      setSelectedCategories(selectedCategories.filter(k => k !== subcategoryKey));
    } else {
      setSelectedCategories([...selectedCategories, subcategoryKey]);
    }
  };

  const isCategorySelected = (categoryKey: string) => {
    return selectedCategories.includes(categoryKey);
  };

  const isSubcategorySelected = (subcategoryKey: string) => {
    return selectedCategories.includes(subcategoryKey);
  };

  // Get categories for display
  const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
  const needsCategories = baselinePlanData.paycheckCategories.filter((c: any) => 
    c.key === 'essentials' || c.key === 'debt_minimums'
  );
  const wantsCategories = baselinePlanData.paycheckCategories.filter((c: any) => 
    c.key === 'fun_flexible'
  );
  const allSavingsCategoryKeys = ['emergency', 'debt_extra', 'short_term_goals', 'long_term_investing', '401k_match', 'retirement_tax_advantaged', 'brokerage'];
  const savingsCategories = baselinePlanData.paycheckCategories.filter((c: any) => 
    allSavingsCategoryKeys.includes(c.key)
  );

  // Calculate totals from actual expenses/debts (already in monthly terms)
  let needsTotal = 0;
  const needsExpenses = baselineState.fixedExpenses
    .filter(exp => exp.category === 'needs' || !exp.category)
    .reduce((sum, exp) => sum + exp.amount$, 0);
  const debtMinPayments = baselineState.debts
    .reduce((sum, debt) => sum + debt.minPayment$, 0);
  needsTotal = needsExpenses + debtMinPayments;
  if (needsTotal === 0) {
    needsTotal = needsCategories.reduce((sum: number, c: any) => sum + (c.amount || 0), 0) * paychecksPerMonth;
  }
  
  const wantsTotal = wantsCategories.reduce((sum: number, c: any) => sum + (c.amount || 0), 0) * paychecksPerMonth;
  const savingsTotal = savingsCategories.reduce((sum: number, c: any) => sum + (c.amount || 0), 0) * paychecksPerMonth;

  const { monthlyNeeds, monthlyWants, monthlySavings, needsPct, wantsPct, savingsPct } = incomeDistribution || {
    monthlyNeeds: 0,
    monthlyWants: 0,
    monthlySavings: 0,
    needsPct: 0,
    wantsPct: 0,
    savingsPct: 0,
  };

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      {/* Income Distribution Chart - Always at the top */}
      {incomeDistribution && (
        <div className="border-b bg-slate-50 px-4 py-4 dark:bg-slate-900">
          <div className="mx-auto max-w-lg space-y-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white">Income Distribution</h2>
              <ArrowRight className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            {/* Horizontal Bar Chart */}
            <div className="h-8 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="flex h-full">
                <div
                  className="bg-orange-500"
                  style={{ width: `${Math.max(0, Math.min(100, needsPct))}%` }}
                />
                <div
                  className="bg-blue-400"
                  style={{ width: `${Math.max(0, Math.min(100, wantsPct))}%` }}
                />
                <div
                  className="bg-green-400"
                  style={{ width: `${Math.max(0, Math.min(100, savingsPct))}%` }}
                />
              </div>
            </div>
            {/* Legend */}
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-orange-500"></div>
                  <span className="text-slate-700 dark:text-slate-300">Needs {needsPct.toFixed(1)}%</span>
                </div>
                <span className="font-medium text-slate-900 dark:text-white">
                  ${(monthlyNeeds / 1000).toFixed(1)}K
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-400"></div>
                  <span className="text-slate-700 dark:text-slate-300">Wants {wantsPct.toFixed(1)}%</span>
                </div>
                <span className="font-medium text-slate-900 dark:text-white">
                  ${(monthlyWants / 1000).toFixed(1)}K
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-400"></div>
                  <span className="text-slate-700 dark:text-slate-300">Savings {savingsPct.toFixed(1)}%</span>
                </div>
                <span className="font-medium text-slate-900 dark:text-white">
                  ${(monthlySavings / 1000).toFixed(1)}K
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Selector */}
      {baselinePlanData && (
        <div className="border-b bg-slate-50 px-4 py-4 dark:bg-slate-900">
          <div className="mx-auto max-w-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-900 dark:text-white">
                How you choose to split up your paycheck. Click to add categories you want to edit.
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCategorySelectorExpanded(!isCategorySelectorExpanded)}
                className="h-7 px-2"
              >
                {isCategorySelectorExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {isCategorySelectorExpanded && (
              <div className="space-y-2">
                {/* Needs Card */}
                <Card>
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => setExpandedSections({ ...expandedSections, needs: !expandedSections.needs })}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const bothSelected = isCategorySelected('essentials') && isCategorySelected('debt_minimums');
                            if (bothSelected) {
                              setSelectedCategories(prev => prev.filter(k => k !== 'essentials' && k !== 'debt_minimums'));
                            } else {
                              const newCategories = [...selectedCategories];
                              if (!newCategories.includes('essentials')) newCategories.push('essentials');
                              if (!newCategories.includes('debt_minimums')) newCategories.push('debt_minimums');
                              setSelectedCategories(newCategories);
                            }
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-300 transition-colors hover:border-slate-400 dark:border-slate-600 dark:hover:border-slate-500"
                        >
                          {(isCategorySelected('essentials') && isCategorySelected('debt_minimums')) && (
                            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                          )}
                        </button>
                        <div>
                          <CardTitle className="text-base">Needs</CardTitle>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            ${needsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      {expandedSections.needs ? (
                        <ChevronUp className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedSections.needs && (
                    <CardContent className="space-y-2 pt-0">
                      {needsCategories.map((cat: any) => {
                        // Calculate monthly amount from actual expenses/debts if they exist
                        let monthlyAmount: number;
                        if (cat.key === 'essentials') {
                          const subItems = baselineState.fixedExpenses
                            .filter(exp => exp.category === 'needs' || !exp.category)
                            .map(exp => ({
                              key: `expense_${exp.id}`,
                              label: exp.name,
                              amount: exp.amount$,
                            }));
                          monthlyAmount = subItems.length > 0
                            ? subItems.reduce((sum, item) => sum + item.amount, 0)
                            : cat.amount * paychecksPerMonth;
                        } else if (cat.key === 'debt_minimums') {
                          const subItems = baselineState.debts.map(debt => ({
                            key: `debt_${debt.id}`,
                            label: debt.name,
                            amount: debt.minPayment$,
                          }));
                          monthlyAmount = subItems.length > 0
                            ? subItems.reduce((sum, item) => sum + item.amount, 0)
                            : cat.amount * paychecksPerMonth;
                        } else {
                          monthlyAmount = cat.amount * paychecksPerMonth;
                        }

                        const isSelected = isCategorySelected(cat.key);
                        
                        // Get sub-items (third layer)
                        let subItems: Array<{ key: string; label: string; amount: number }> = [];
                        if (cat.key === 'essentials') {
                          if (baselineState.fixedExpenses.length > 0) {
                            subItems = baselineState.fixedExpenses
                              .filter(exp => exp.category === 'needs' || !exp.category)
                              .map(exp => ({
                                key: `expense_${exp.id}`,
                                label: exp.name,
                                amount: exp.amount$,
                              }));
                          }
                        } else if (cat.key === 'debt_minimums') {
                          if (baselineState.debts.length > 0) {
                            subItems = baselineState.debts.map(debt => ({
                              key: `debt_${debt.id}`,
                              label: debt.name,
                              amount: debt.minPayment$,
                            }));
                          }
                        }
                        
                        const hasSubItems = subItems.length > 0;
                        const isSubItemsExpanded = expandedSubItems[cat.key] || false;
                        
                        return (
                          <div key={cat.key} className="space-y-1">
                            {/* Category row */}
                            <div className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => toggleCategory(cat.key)}
                                  className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-300 transition-colors hover:border-slate-400 dark:border-slate-600 dark:hover:border-slate-500"
                                >
                                  {isSelected && (
                                    <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                  )}
                                </button>
                                <span className="text-sm text-slate-700 dark:text-slate-300">{cat.label}</span>
                                {hasSubItems && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedSubItems((prev: Record<string, boolean>) => ({ ...prev, [cat.key]: !prev[cat.key] }));
                                    }}
                                    className="ml-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                  >
                                    {isSubItemsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  </button>
                                )}
                              </div>
                              <span className="text-sm font-medium text-slate-900 dark:text-white">
                                ${monthlyAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            
                            {/* Third layer: Individual expenses/debts */}
                            {hasSubItems && isSubItemsExpanded && (
                              <div className="ml-8 space-y-1">
                                {subItems.map((item) => {
                                  const isItemSelected = isSubcategorySelected(item.key);
                                  return (
                                    <div
                                      key={item.key}
                                      className="flex items-center justify-between rounded-md px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    >
                                      <div className="flex items-center gap-3">
                                        <button
                                          onClick={() => toggleSubcategory(item.key)}
                                          className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-slate-300 transition-colors hover:border-slate-400 dark:border-slate-600 dark:hover:border-slate-500"
                                        >
                                          {isItemSelected && (
                                            <Check className="h-2.5 w-2.5 text-green-600 dark:text-green-400" />
                                          )}
                                        </button>
                                        <span className="text-xs text-slate-600 dark:text-slate-400">{item.label}</span>
                                      </div>
                                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                        ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  )}
                </Card>

                {/* Wants Card */}
                <Card>
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => setExpandedSections({ ...expandedSections, wants: !expandedSections.wants })}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCategory('fun_flexible');
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-300 transition-colors hover:border-slate-400 dark:border-slate-600 dark:hover:border-slate-500"
                        >
                          {isCategorySelected('fun_flexible') && (
                            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                          )}
                        </button>
                        <div>
                          <CardTitle className="text-base">Wants</CardTitle>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            ${wantsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      {expandedSections.wants ? (
                        <ChevronUp className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedSections.wants && (
                    <CardContent className="pt-0">
                      {wantsCategories.map((cat: any) => {
                        const monthlyAmount = cat.amount * paychecksPerMonth;
                        const isSelected = isCategorySelected(cat.key);
                        return (
                          <div key={cat.key} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => toggleCategory(cat.key)}
                                className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-300 transition-colors hover:border-slate-400 dark:border-slate-600 dark:hover:border-slate-500"
                              >
                                {isSelected && (
                                  <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                )}
                              </button>
                              <span className="text-sm text-slate-700 dark:text-slate-300">{cat.label}</span>
                            </div>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              ${monthlyAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        );
                      })}
                    </CardContent>
                  )}
                </Card>

                {/* Savings Card */}
                <Card>
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => setExpandedSections({ ...expandedSections, savings: !expandedSections.savings })}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const allSavingsSelected = allSavingsCategoryKeys.every(key => isCategorySelected(key));
                            if (allSavingsSelected) {
                              setSelectedCategories(prev => prev.filter(k => !allSavingsCategoryKeys.includes(k)));
                            } else {
                              const newCategories = [...selectedCategories];
                              allSavingsCategoryKeys.forEach(key => {
                                if (!newCategories.includes(key)) newCategories.push(key);
                              });
                              setSelectedCategories(newCategories);
                            }
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-300 transition-colors hover:border-slate-400 dark:border-slate-600 dark:hover:border-slate-500"
                        >
                          {allSavingsCategoryKeys.every(key => isCategorySelected(key)) && (
                            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                          )}
                        </button>
                        <div>
                          <CardTitle className="text-base">Savings</CardTitle>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            ${savingsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      {expandedSections.savings ? (
                        <ChevronUp className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedSections.savings && (
                    <CardContent className="space-y-2 pt-0">
                      {savingsCategories.map((cat: any) => {
                        const monthlyAmount = cat.amount * paychecksPerMonth;
                        const isSelected = isCategorySelected(cat.key);
                        return (
                          <div key={cat.key} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => toggleCategory(cat.key)}
                                className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-300 transition-colors hover:border-slate-400 dark:border-slate-600 dark:hover:border-slate-500"
                              >
                                {isSelected && (
                                  <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                )}
                              </button>
                              <span className="text-sm text-slate-700 dark:text-slate-300">{cat.label}</span>
                            </div>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              ${monthlyAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        );
                      })}
                    </CardContent>
                  )}
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Render the configurable tool */}
      <div className="flex-1 overflow-y-auto">
        <ConfigurableTool 
          config={config} 
          onSliderValuesChange={setCurrentSliderValues}
          incomeDistribution={incomeDistribution ? {
            needsPct: incomeDistribution.needsPct,
            wantsPct: incomeDistribution.wantsPct,
            savingsPct: incomeDistribution.savingsPct,
          } : null}
          baselineIncomeDistribution={baselineIncomeDistribution ? {
            needsPct: baselineIncomeDistribution.needsPct,
            wantsPct: baselineIncomeDistribution.wantsPct,
            savingsPct: baselineIncomeDistribution.savingsPct,
          } : null}
        />
      </div>
    </div>
  );
}

export default function ConfigurableDemoPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    }>
      <ConfigurableToolDemoContent />
    </Suspense>
  );
}
