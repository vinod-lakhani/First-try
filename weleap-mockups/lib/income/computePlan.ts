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
  next: NWSState; // recommended plan R_N/R_W/R_S
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
    shiftLimitPct = 0.04,
    needsBufferPct = 0.03,
    needsShiftCapPct = 0.02,
  } = inputs;

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

  // Step 1: Start from actuals
  let R_N = actualNeedsPct;
  let R_W = actualWantsPct;
  let R_S = actualSavingsPct;

  // Step 2: Focus on Savings Gap
  const gap_S = targetSavingsPct - actualSavingsPct;

  if (gap_S > 0) {
    // Calculate how much Wants is above its target
    const maxFromW = Math.max(0, actualWantsPct - targetWantsPct);
    
    // Candidate shift from Wants to Savings
    const shift_ws_pct = Math.min(gap_S, maxFromW, shiftLimitPct);
    
    if (shift_ws_pct > 0.001) {
      R_S = round2(R_S + shift_ws_pct);
      R_W = round2(R_W - shift_ws_pct);
      
      notes.push(
        `Shifted ${round2(shift_ws_pct * 100).toFixed(1)}% of income from Wants to Savings within ${round2(shiftLimitPct * 100).toFixed(0)}% shift limit.`
      );
    }
  } else if (gap_S <= 0) {
    notes.push('Savings is already at or above target. No upward shift needed.');
  }

  // Step 3: Optional Needs → Savings shift (longer-term nudge)
  const remainingGap_S = Math.max(0, targetSavingsPct - R_S);
  
  if (remainingGap_S > 0.001) {
    // Calculate how much Needs is above target + buffer
    const maxFromN = Math.max(0, actualNeedsPct - (targetNeedsPct + needsBufferPct));
    
    // Remaining shift budget after Wants→Savings
    const remainingShiftBudget = shiftLimitPct - (R_S - actualSavingsPct);
    
    // Candidate shift from Needs to Savings
    const shift_ns_pct = Math.min(
      remainingGap_S,
      maxFromN,
      remainingShiftBudget,
      needsShiftCapPct
    );
    
    if (shift_ns_pct > 0.001) {
      R_S = round2(R_S + shift_ns_pct);
      R_N = round2(R_N - shift_ns_pct);
      
      notes.push(
        `Applied small ${round2(shift_ns_pct * 100).toFixed(1)}% shift from Needs to Savings as a longer-term lifestyle adjustment suggestion.`
      );
    }
  }

  // Step 4: Normalize to ensure sum = 1.0
  const sumR = R_N + R_W + R_S;
  if (Math.abs(sumR - 1.0) > 0.001) {
    R_N = round2(R_N / sumR);
    R_W = round2(R_W / sumR);
    R_S = round2(R_S / sumR);
  }

  // Convert to dollars
  let needs$ = round2(income$ * R_N);
  let wants$ = round2(income$ * R_W);
  let savings$ = round2(income$ * R_S);

  // Reconcile rounding: ensure totals sum exactly to income$
  const currentTotal = round2(needs$ + wants$ + savings$);
  const roundingDiff = round2(income$ - currentTotal);
  
  if (Math.abs(roundingDiff) > 0.001) {
    savings$ = round2(savings$ + roundingDiff);
  }

  // Final validation
  const finalTotal = round2(needs$ + wants$ + savings$);
  if (Math.abs(finalTotal - income$) > 0.01) {
    throw new Error(`Allocation error: total ${finalTotal} does not equal income ${income$}`);
  }

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

  const next: NWSState = {
    needsPct: R_N,
    wantsPct: R_W,
    savingsPct: R_S,
    income$,
  };

  // Add summary note
  const savingsDelta = round2((R_S - actualSavingsPct) * 100);
  const savingsDelta$ = round2(savings$ - (income$ * actualSavingsPct));
  
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

