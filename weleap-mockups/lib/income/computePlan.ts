/**
 * Income Allocation Plan Computation
 * 
 * Computes NOW (actuals), GOAL (targets), and NEXT (recommended plan)
 * based on the Income Allocation Engine logic.
 */

export interface NWSState {
  needsPct: number; // 0–1
  wantsPct: number;
  savingsPct: number;
  income$: number;
}

export interface IncomePlanInputs {
  income$: number;
  actualNeedsPct: number;
  actualWantsPct: number;
  actualSavingsPct: number;
  targetNeedsPct: number;
  targetWantsPct: number;
  targetSavingsPct: number;
  shiftLimitPct?: number; // default 0.04
  needsBufferPct?: number; // default 0.03
  needsShiftCapPct?: number; // default 0.02
}

export interface IncomePlanResult {
  now: NWSState; // from actuals
  goal: NWSState; // from targets
  next: NWSState; // recommended plan
  notes: string[];
}

/**
 * Rounds a number to 2 decimal places
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Computes a recommended plan that preserves savings and adjusts wants/needs intelligently.
 * This is used for "This Plan" to ensure we don't recommend reducing savings.
 * 
 * Logic:
 * 1. Preserve savings at actuals level (don't reduce) - ALWAYS
 * 2. Keep needs close to actuals
 * 3. Wants is calculated as the remainder (will be reduced if current plan has inflated wants)
 */
export function computePreservingSavingsPlan(
  actuals: { needsPct: number; wantsPct: number; savingsPct: number },
  currentPlan: { needsPct: number; wantsPct: number; savingsPct: number } | null,
  income$: number
): NWSState {
  // Validate actuals sum to 1.0
  const actualsSum = round2(actuals.needsPct + actuals.wantsPct + actuals.savingsPct);
  if (Math.abs(actualsSum - 1.0) > 0.01) {
    console.error('[computePreservingSavingsPlan] ERROR: Actuals do not sum to 1.0!', {
      actuals,
      sum: actualsSum,
    });
    // Normalize actuals first
    const normalizedActuals = {
      needsPct: round2(actuals.needsPct / actualsSum),
      wantsPct: round2(actuals.wantsPct / actualsSum),
      savingsPct: round2(actuals.savingsPct / actualsSum),
    };
    console.warn('[computePreservingSavingsPlan] Normalized actuals:', normalizedActuals);
    // Recursively call with normalized actuals
    return computePreservingSavingsPlan(normalizedActuals, currentPlan, income$);
  }

  // SIMPLEST LOGIC: "This Plan" = actuals exactly
  // This preserves savings, needs, and wants exactly as they are in actuals
  // No adjustments, no reductions - just use actuals
  
  const result = {
    needsPct: round2(actuals.needsPct),
    wantsPct: round2(actuals.wantsPct),
    savingsPct: round2(actuals.savingsPct), // EXACTLY preserved
    income$,
  };
  
  // Validate
  const resultSum = round2(result.needsPct + result.wantsPct + result.savingsPct);
  if (Math.abs(resultSum - 1.0) > 0.0001) {
    console.warn('[computePreservingSavingsPlan] Result sum != 1.0, adjusting wants:', {
      result,
      sum: resultSum,
    });
    // Adjust wants to make sum = 1.0 (never touch savings)
    const diff = round2(1.0 - resultSum);
    result.wantsPct = round2(result.wantsPct + diff);
  }
  
  console.log('[computePreservingSavingsPlan] Result (using actuals exactly):', {
    actuals,
    currentPlan,
    result,
    savingsPreserved: Math.abs(result.savingsPct - actuals.savingsPct) < 0.0001,
    savingsDelta: (result.savingsPct - actuals.savingsPct) * 100,
    sum: round2(result.needsPct + result.wantsPct + result.savingsPct),
  });
  
  return result;
}

/**
 * Computes the recommended income allocation plan (NEXT) from actuals (NOW) and targets (GOAL).
 * 
 * Simple, clean logic:
 * 1. Start from actuals
 * 2. If savings is below target, shift from wants to savings (up to shift limit)
 * 3. Optionally shift from needs to savings if remaining gap (longer-term adjustment)
 * 4. Ensure sum = 1.0
 */
export function computeIncomePlan(inputs: IncomePlanInputs): IncomePlanResult {
  const {
    income$,
    actualNeedsPct,
    actualWantsPct,
    actualSavingsPct,
    targetNeedsPct,
    targetWantsPct,
    targetSavingsPct,
    shiftLimitPct: rawShiftLimitPct = 0.04,
    needsBufferPct = 0.03,
    needsShiftCapPct = 0.02,
  } = inputs;
  
  // Normalize shiftLimitPct: convert from percentage (4.0) to decimal (0.04) if needed
  // CRITICAL: shiftLimitPct must be in decimal format (0.04 = 4%) for calculations
  let shiftLimitPct = rawShiftLimitPct;
  if (shiftLimitPct > 1) {
    shiftLimitPct = shiftLimitPct / 100; // Convert 4.0 to 0.04
  }

  const notes: string[] = [];

  // Validate inputs sum to ~1.0
  const actualSum = actualNeedsPct + actualWantsPct + actualSavingsPct;
  const targetSum = targetNeedsPct + targetWantsPct + targetSavingsPct;
  
  if (Math.abs(actualSum - 1.0) > 0.01) {
    throw new Error(`Actual percentages must sum to 1.0, got ${actualSum}`);
  }
  if (Math.abs(targetSum - 1.0) > 0.01) {
    throw new Error(`Target percentages must sum to 1.0, got ${targetSum}`);
  }

  // Calculate maximum allowed savings (hard limit) - this can NEVER be exceeded
  const maxAllowedSavingsPct = round2(actualSavingsPct + shiftLimitPct);
  
  // Start from actuals
  let R_N = actualNeedsPct;
  let R_W = actualWantsPct;
  let R_S = actualSavingsPct;

  // Helper function to cap savings and ensure it never exceeds the limit
  const capSavingsToLimit = () => {
    if (R_S > maxAllowedSavingsPct + 0.0001) {
      const excess = R_S - maxAllowedSavingsPct;
      R_S = maxAllowedSavingsPct;
      R_W = round2(R_W + excess);
    }
  };

  // Step 1: Shift from Wants to Savings if savings is below target
  // CRITICAL: Shift is constrained by shiftLimitPct (default 4%) to prevent drastic changes
  // The shift limit ensures we don't recommend more than 4% shift per period
  const gap_S = targetSavingsPct - actualSavingsPct;

  if (gap_S > 0.001) {
    // Calculate shift amount: min(gap, available wants, shift limit)
    // The shift limit (typically 4% = 0.04) is the maximum allowed shift
    const maxAvailableFromW = actualWantsPct;
    // CRITICAL: Never shift more than shiftLimitPct, even if gap is larger
    const shift_ws_pct = Math.min(gap_S, maxAvailableFromW, shiftLimitPct);
    
    // Double-check: ensure shift never exceeds limit (defensive check)
    if (shift_ws_pct > shiftLimitPct + 0.0001) {
      throw new Error(`Shift amount ${shift_ws_pct} exceeds shift limit ${shiftLimitPct}`);
    }
    
    if (shift_ws_pct > 0.001) {
      R_S = round2(R_S + shift_ws_pct);
      R_W = round2(R_W - shift_ws_pct);
      
      // Immediately cap if we exceeded the limit
      capSavingsToLimit();
      
      notes.push(
        `Shifted ${round2(shift_ws_pct * 100).toFixed(1)}% of income from Wants to Savings to reach target (limited by ${round2(shiftLimitPct * 100).toFixed(0)}% shift limit).`
      );
    }
  }

  // Step 2: Optional shift from Needs to Savings (longer-term adjustment)
  // CRITICAL: Total shift from Steps 1 and 2 combined must not exceed shiftLimitPct (4%)
  const remainingGap_S = Math.max(0, targetSavingsPct - R_S);
  const shiftUsedSoFar = R_S - actualSavingsPct; // Amount shifted in Step 1
  
  if (remainingGap_S > 0.001 && shiftUsedSoFar < shiftLimitPct) {
    const maxFromN = Math.max(0, actualNeedsPct - (targetNeedsPct + needsBufferPct));
    // Calculate remaining shift budget: shiftLimitPct minus what we already shifted in Step 1
    const remainingShiftBudget = Math.max(0, shiftLimitPct - shiftUsedSoFar);
    
    const shift_ns_pct = Math.min(
      remainingGap_S,
      maxFromN,
      remainingShiftBudget, // Ensure total shift (Step 1 + Step 2) doesn't exceed shiftLimitPct
      needsShiftCapPct
    );
    
    if (shift_ns_pct > 0.001) {
      R_S = round2(R_S + shift_ns_pct);
      R_N = round2(R_N - shift_ns_pct);
      
      // Immediately cap if we exceeded the limit
      capSavingsToLimit();
      
      notes.push(
        `Applied small ${round2(shift_ns_pct * 100).toFixed(1)}% shift from Needs to Savings as a longer-term lifestyle adjustment suggestion.`
      );
    }
  }
  
  // Step 3: Final cap check before normalization (ensure savings never exceeds limit)
  capSavingsToLimit();
  
  // Step 4: ABSOLUTE FINAL CAP - lock savings and never change it again
  // This ensures that no matter what happens during normalization, savings stays within limit
  const currentShift = R_S - actualSavingsPct;
  if (currentShift > shiftLimitPct + 0.0001) {
    R_S = round2(actualSavingsPct + shiftLimitPct); // Force exact cap
  }
  const lockedSavings = R_S; // Lock it - this is the maximum allowed savings
  
  // Step 5: Normalize to ensure sum = 1.0 (WITH SAVINGS LOCKED)
  // Calculate wants as remainder: 1.0 - needs - savings
  R_W = Math.max(0, round2(1.0 - R_N - lockedSavings));
  
  // If wants went negative, needs + savings > 1.0 - adjust needs to fit
  if (R_W < 0.0001) {
    R_W = 0;
    const maxNeeds = Math.max(0, round2(1.0 - lockedSavings));
    if (R_N > maxNeeds + 0.0001) {
      R_N = maxNeeds;
    }
    // Recalculate wants after adjusting needs
    R_W = Math.max(0, round2(1.0 - R_N - lockedSavings));
  }
  
  // Restore locked savings (critical - must never change)
  R_S = lockedSavings;
  
  // Final sum check - adjust wants only (never touch savings or needs)
  const finalSum = R_N + R_W + R_S;
  if (Math.abs(finalSum - 1.0) > 0.001) {
    const finalDiff = round2(1.0 - finalSum);
    // Only adjust wants - never savings (locked) or needs (should stay fixed)
    R_W = Math.max(0, round2(R_W + finalDiff));
    // If wants can't absorb all the difference, we have an edge case
    // In this case, adjust needs slightly to maintain sum = 1.0
    if (Math.abs(R_N + R_W + R_S - 1.0) > 0.001) {
      R_N = Math.max(0, round2(1.0 - R_W - R_S));
      R_W = Math.max(0, round2(1.0 - R_N - R_S));
    }
  }
  
  // CRITICAL: Ensure savings is still locked (should never change, but verify)
  R_S = lockedSavings;

  // Build result
  const now: NWSState = {
    needsPct: actualNeedsPct,
    wantsPct: actualWantsPct,
    savingsPct: actualSavingsPct,
    income$,
  };

  const goal: NWSState = {
    needsPct: targetNeedsPct,
    wantsPct: targetWantsPct,
    savingsPct: targetSavingsPct,
    income$,
  };

  // Ensure savings never exceeds limit even after rounding
  const maxAllowedSavingsFinal = round2(actualSavingsPct + shiftLimitPct);
  let finalSavingsPct = Math.min(round2(R_S), maxAllowedSavingsFinal);
  let finalNeedsPct = round2(R_N);
  let finalWantsPct = round2(R_W);
  
  // If we had to cap savings, adjust wants to maintain sum = 1.0
  if (finalSavingsPct < round2(R_S)) {
    const excess = round2(R_S) - finalSavingsPct;
    finalWantsPct = Math.max(0, round2(finalWantsPct + excess));
  }
  
  // Ensure sum = 1.0
  const finalSumCheck = finalNeedsPct + finalWantsPct + finalSavingsPct;
  if (Math.abs(finalSumCheck - 1.0) > 0.001) {
    const diff = round2(1.0 - finalSumCheck);
    finalWantsPct = Math.max(0, round2(finalWantsPct + diff));
    // If wants can't absorb, adjust needs
    if (Math.abs(finalNeedsPct + finalWantsPct + finalSavingsPct - 1.0) > 0.001) {
      finalNeedsPct = Math.max(0, round2(1.0 - finalWantsPct - finalSavingsPct));
      finalWantsPct = Math.max(0, round2(1.0 - finalNeedsPct - finalSavingsPct));
    }
  }
  
  const next: NWSState = {
    needsPct: finalNeedsPct,
    wantsPct: finalWantsPct,
    savingsPct: finalSavingsPct, // Ensure it never exceeds limit even after rounding
    income$,
  };
  
  // Final verification (should always pass now, but verify for safety)
  const finalShift = next.savingsPct - actualSavingsPct;
  if (finalShift > shiftLimitPct + 0.0001) {
    // This should be extremely rare now, but handle it if it occurs
    if (finalShift > shiftLimitPct + 0.01) {
      // Only warn if significantly over limit (more than rounding error)
      console.warn('[computeIncomePlan] Shift limit exceeded - forcing cap', {
        resultSavings: next.savingsPct * 100,
        actualSavings: actualSavingsPct * 100,
        shift: finalShift * 100,
        limit: shiftLimitPct * 100,
      });
    }
    // Return with forced cap
    next.savingsPct = round2(actualSavingsPct + shiftLimitPct);
    next.wantsPct = Math.max(0, round2(1.0 - next.needsPct - next.savingsPct));
    next.needsPct = Math.max(0, round2(1.0 - next.wantsPct - next.savingsPct));
  }

  // Add summary note (use final capped savings for delta calculation)
  const savingsDelta = round2((finalSavingsPct - actualSavingsPct) * 100);
  const savingsDelta$ = round2((finalSavingsPct - actualSavingsPct) * income$);
  
  if (Math.abs(savingsDelta) > 0.1) {
    notes.push(
      `This ${savingsDelta >= 0 ? '+' : ''}${savingsDelta.toFixed(1)}% increase in monthly savings (${savingsDelta$ >= 0 ? '+' : ''}$${Math.abs(savingsDelta$).toFixed(2)}) moves you toward your goal.`
    );
  }

  return {
    now,
    goal,
    next,
    notes,
  };
}