/**
 * Income Allocation Engine
 * 
 * Implements the Needs/Wants/Savings allocation framework with gradual adjustments
 * based on 3-month actual spending averages.
 */

export interface IncomeInputs {
  /** Paycheck or monthly net income in dollars */
  incomePeriod$: number;
  /** Target percentages for Needs/Wants/Savings (e.g., { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 }) */
  targets: { needsPct: number; wantsPct: number; savingsPct: number; };
  /** 3-month average actual percentages */
  actuals3m: { needsPct: number; wantsPct: number; savingsPct: number; };
  /** Maximum shift percentage per period (default: 0.04 = 4%) */
  shiftLimitPct?: number;
  /** If true, bypass the minimum wants floor (25%) to allow manual slider overrides */
  bypassWantsFloor?: boolean;
}

export interface IncomeAllocation {
  /** Allocated dollars for Needs */
  needs$: number;
  /** Allocated dollars for Wants */
  wants$: number;
  /** Allocated dollars for Savings */
  savings$: number;
  /** Notes about adjustments made (e.g., ["applied 2% shift from Wants→Savings"]) */
  notes: string[];
}

/**
 * Rounds a number to 2 decimal places
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Allocates income based on targets and 3-month actuals.
 * 
 * Rules:
 * 1. Start from 3-month actuals as baseline (especially for Needs - keep at actual short-term)
 * 2. If Savings < target, calculate gap and shift from Wants to Savings
 * 3. Shift amount = min(savings gap %, shift limit %) × income
 * 4. Shift happens regardless of whether Wants is above/below target
 * 5. Keep Needs at actual short-term; do not reduce below actuals
 * 6. Output dollars that sum to incomePeriod$; reconcile rounding on savings
 */
export function allocateIncome(i: IncomeInputs): IncomeAllocation {
  const { incomePeriod$, targets, actuals3m, shiftLimitPct = 0.04, bypassWantsFloor = false } = i;
  
  // Validate inputs
  const targetSum = targets.needsPct + targets.wantsPct + targets.savingsPct;
  if (Math.abs(targetSum - 1.0) > 0.001) {
    throw new Error(`Target percentages must sum to 1.0, got ${targetSum}`);
  }
  
  const actualSum = actuals3m.needsPct + actuals3m.wantsPct + actuals3m.savingsPct;
  if (Math.abs(actualSum - 1.0) > 0.001) {
    throw new Error(`Actual percentages must sum to 1.0, got ${actualSum}`);
  }
  
  // Convert percentages to dollars
  const targetNeeds$ = round2(incomePeriod$ * targets.needsPct);
  const targetWants$ = round2(incomePeriod$ * targets.wantsPct);
  const targetSavings$ = round2(incomePeriod$ * targets.savingsPct);
  
  const actualNeeds$ = round2(incomePeriod$ * actuals3m.needsPct);
  const actualWants$ = round2(incomePeriod$ * actuals3m.wantsPct);
  const actualSavings$ = round2(incomePeriod$ * actuals3m.savingsPct);
  
  const notes: string[] = [];
  
  // Start with actuals as baseline (especially for Needs - keep at actual short-term)
  let needs$ = actualNeeds$;
  let wants$ = actualWants$;
  let savings$ = actualSavings$;
  
  console.log('[Income Engine] Initial allocation from actuals3m:', {
    actualNeeds$,
    actualWants$,
    actualSavings$,
    actuals3m,
    needs$,
    wants$,
    savings$,
  });
  
  // Check if Savings is below target
  const savingsGap$ = targetSavings$ - actualSavings$;
  
  // Enforce minimum wants floor (at least 25% of income, or target wants if lower)
  // Unless bypassWantsFloor is true (for manual slider overrides)
  const minWants$ = bypassWantsFloor ? 0 : round2(Math.min(incomePeriod$ * 0.25, targetWants$));
  
  if (savingsGap$ > 0.01) { // Only adjust if gap is meaningful (> 1 cent)
    // Calculate shift amount: min(savings gap %, shift limit %)
    const savingsGapPct = round2(savingsGap$ / incomePeriod$);
    const shiftPct = Math.min(savingsGapPct, shiftLimitPct);
    const shiftAmount$ = round2(incomePeriod$ * shiftPct);
    
    if (shiftAmount$ > 0.01) {
      // Shift from Wants to Savings, but don't go below minimum wants floor
      const maxShiftFromWants$ = round2(Math.max(0, wants$ - minWants$));
      const actualShift$ = round2(Math.min(shiftAmount$, maxShiftFromWants$));
      
      wants$ = round2(wants$ - actualShift$);
      savings$ = round2(savings$ + actualShift$);
      
      if (actualShift$ > 0.01) {
        if (actualShift$ < shiftAmount$) {
          const remainingGapPct = round2((shiftAmount$ - actualShift$) / incomePeriod$);
          notes.push(`Applied ${round2(actualShift$ / incomePeriod$ * 100).toFixed(1)}% shift from Wants→Savings (limited by minimum wants floor). ${round2(remainingGapPct * 100).toFixed(1)}% gap remains.`);
        } else if (shiftPct < savingsGapPct) {
          const remainingGapPct = round2(savingsGapPct - shiftPct);
          notes.push(`Applied ${round2(shiftPct * 100).toFixed(1)}% shift from Wants→Savings (limited by shift limit). Gap of ${round2(remainingGapPct * 100).toFixed(1)}% remains.`);
        } else {
          notes.push(`Applied ${round2(shiftPct * 100).toFixed(1)}% shift from Wants→Savings. Savings target met.`);
        }
      }
    }
  } else if (savings$ >= targetSavings$) {
    // Savings is at or above target - no adjustment needed
    notes.push(`Savings at or above target`);
  }
  
  // Ensure wants doesn't go below minimum floor (in case actuals were already below)
  if (wants$ < minWants$) {
    const adjustment$ = round2(minWants$ - wants$);
    wants$ = minWants$;
    savings$ = round2(savings$ - adjustment$);
    if (adjustment$ > 0.01) {
      notes.push(`Adjusted Wants to minimum floor (${round2(minWants$ / incomePeriod$ * 100).toFixed(1)}% of income)`);
    }
  }
  
  // Reconcile rounding: ensure totals sum exactly to incomePeriod$
  const currentTotal = round2(needs$ + wants$ + savings$);
  const roundingDiff = round2(incomePeriod$ - currentTotal);
  
  if (Math.abs(roundingDiff) > 0.001) {
    // Adjust savings to account for rounding (as per spec: "reconcile rounding on savings")
    savings$ = round2(savings$ + roundingDiff);
  }
  
  // Final validation
  const finalTotal = round2(needs$ + wants$ + savings$);
  if (Math.abs(finalTotal - incomePeriod$) > 0.01) {
    throw new Error(`Allocation error: total ${finalTotal} does not equal income ${incomePeriod$}`);
  }
  
  return {
    needs$: round2(needs$),
    wants$: round2(wants$),
    savings$: round2(savings$),
    notes,
  };
}

