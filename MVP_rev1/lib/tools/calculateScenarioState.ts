/**
 * Standardized Scenario State Calculation
 * 
 * This function provides a unified way to calculate scenario state from slider values.
 * All tabs should use this same logic - only the slider configuration should differ.
 */

import type { OnboardingState } from '@/lib/onboarding/types';
import type { ToolSlider } from './types';

/**
 * Standardized function to calculate scenario state from slider values.
 * This is the ONLY calculation logic - all tabs use this same function.
 * 
 * The difference between tabs should only be:
 * - Which sliders are shown (slider configuration)
 * - How sliders are grouped (needs/wants/savings)
 * 
 * The calculation logic is always the same:
 * 1. Sum up slider values by group (needs/wants/savings)
 * 2. Convert to decimal percentages (0-1 range)
 * 3. Normalize to sum to 1.0
 * 4. Update actuals3m and targets in riskConstraints
 */
export function calculateScenarioStateFromSliders(
  baselineState: OnboardingState,
  sliderValues: Record<string, number>,
  sliders: ToolSlider[]
): OnboardingState {
  // Group sliders by their group property
  const needsSliders = sliders.filter(s => s.group === 'needs');
  const wantsSliders = sliders.filter(s => s.group === 'wants');
  const savingsSliders = sliders.filter(s => s.group === 'savings');
  
  // Get baseline percentages from state (for categories without sliders)
  const baselineActuals = baselineState.riskConstraints?.actuals3m || {
    needsPct: 0.5,
    wantsPct: 0.3,
    savingsPct: 0.2,
  };
  
  // Sum up slider values by group (as percentages 0-100)
  // If no sliders exist for a group, use baseline percentage
  const needsPct = needsSliders.length > 0
    ? needsSliders.reduce((sum, s) => {
        const value = sliderValues[s.id] ?? s.defaultValue ?? 0;
        return sum + value;
      }, 0)
    : baselineActuals.needsPct * 100;
  
  const wantsPct = wantsSliders.length > 0
    ? wantsSliders.reduce((sum, s) => {
        const value = sliderValues[s.id] ?? s.defaultValue ?? 0;
        return sum + value;
      }, 0)
    : baselineActuals.wantsPct * 100;
  
  const savingsPct = savingsSliders.length > 0
    ? savingsSliders.reduce((sum, s) => {
        const value = sliderValues[s.id] ?? s.defaultValue ?? 0;
        return sum + value;
      }, 0)
    : baselineActuals.savingsPct * 100;
  
  // Convert to decimal percentages (0-1 range)
  let needsDecimal = needsPct / 100;
  let wantsDecimal = wantsPct / 100;
  let savingsDecimal = savingsPct / 100;
  
  // Always normalize to ensure they sum to exactly 1.0 (required by allocateIncome)
  // This is critical - allocateIncome will throw an error if sum is not 1.0
  const total = needsDecimal + wantsDecimal + savingsDecimal;
  
  if (total > 0.001) {
    // Always normalize to sum to 1.0
    needsDecimal = needsDecimal / total;
    wantsDecimal = wantsDecimal / total;
    savingsDecimal = savingsDecimal / total;
  } else {
    // If total is zero or very small, use baseline values (should already sum to 1.0)
    needsDecimal = baselineActuals.needsPct;
    wantsDecimal = baselineActuals.wantsPct;
    savingsDecimal = baselineActuals.savingsPct;
  }
  
  // Final step: ensure they sum to exactly 1.0 (fix any floating point precision issues)
  // Use savings as remainder to guarantee exact sum
  savingsDecimal = Math.max(0, Math.min(1.0, 1.0 - needsDecimal - wantsDecimal));
  
  // Final validation to ensure exact sum (within 0.0001 tolerance)
  const finalSum = needsDecimal + wantsDecimal + savingsDecimal;
  if (Math.abs(finalSum - 1.0) > 0.0001) {
    // Force exact sum by setting savings as remainder
    needsDecimal = Math.max(0, Math.min(1.0, needsDecimal));
    wantsDecimal = Math.max(0, Math.min(1.0, wantsDecimal));
    savingsDecimal = Math.max(0, Math.min(1.0, 1.0 - needsDecimal - wantsDecimal));
  }
  
  // Update state with standardized logic
  return {
    ...baselineState,
    initialPaycheckPlan: undefined, // Clear to force recalculation from actuals3m
    riskConstraints: baselineState.riskConstraints ? {
      ...baselineState.riskConstraints,
      targets: {
        needsPct: needsDecimal,
        wantsPct: wantsDecimal,
        savingsPct: savingsDecimal,
      },
      actuals3m: {
        needsPct: needsDecimal,
        wantsPct: wantsDecimal,
        savingsPct: savingsDecimal,
      },
      bypassWantsFloor: true, // Allow sliders to override the 25% wants floor
    } : {
      targets: {
        needsPct: needsDecimal,
        wantsPct: wantsDecimal,
        savingsPct: savingsDecimal,
      },
      actuals3m: {
        needsPct: needsDecimal,
        wantsPct: wantsDecimal,
        savingsPct: savingsDecimal,
      },
      bypassWantsFloor: true, // Allow sliders to override the 25% wants floor
      shiftLimitPct: 0.04, // Default shift limit
    },
  };
}
