/**
 * Savings Optimizer Allocation
 * 
 * Implements slider-based savings allocation with guardrails and warnings.
 * Allows users to redistribute savings across buckets while respecting
 * mandatory floors (e.g., employer match) and caps (e.g., EF gap, debt balance).
 */

import { round2 } from './income';

export interface SavingsOptimizerInputs {
  /** Total monthly savings budget */
  savingsBudget$: number;
  /** Emergency fund target */
  efTarget$: number;
  /** Current emergency fund balance */
  efBalance$: number;
  /** High-APR debts (APR > 10%) */
  highAprDebts: Array<{ balance$: number; aprPct: number }>;
  /** Dollars needed this period to capture full employer match */
  matchNeedThisPeriod$: number;
  /** Slider values (0-100 representing percentage weights) */
  sliders: {
    ef: number;        // 0-40% of savings
    debt: number;     // 0-40% of savings
    retirementMatch: number;  // 0-100% but with floor
    retirementExtra: number; // 0-100% of remaining
    brokerage: number; // 0-100% of remaining
  };
}

export interface SavingsOptimizerOutput {
  /** Dollars allocated to emergency fund */
  ef$: number;
  /** Dollars allocated to high-APR debt */
  highAprDebt$: number;
  /** Dollars allocated to 401(k) for employer match */
  match401k$: number;
  /** Dollars allocated to tax-advantaged retirement accounts (beyond match) */
  retirementTaxAdv$: number;
  /** Dollars allocated to taxable brokerage */
  brokerage$: number;
  /** Warnings about inefficient choices */
  warnings: string[];
  /** Notes about allocation decisions */
  notes: string[];
}

/**
 * Allocates savings budget based on slider preferences with guardrails.
 */
export function allocateSavingsFromSliders(
  inputs: SavingsOptimizerInputs
): SavingsOptimizerOutput {
  const {
    savingsBudget$,
    efTarget$,
    efBalance$,
    highAprDebts,
    matchNeedThisPeriod$,
    sliders,
  } = inputs;

  const warnings: string[] = [];
  const notes: string[] = [];

  // Step 1: Compute Mandatory Floors
  const floorMatch$ = round2(Math.min(matchNeedThisPeriod$, savingsBudget$));
  if (matchNeedThisPeriod$ > savingsBudget$) {
    warnings.push(
      `Your savings budget ($${savingsBudget$.toFixed(2)}) is too low to capture your full employer match ($${matchNeedThisPeriod$.toFixed(2)}). Consider increasing your savings allocation.`
    );
  }

  // Step 2: Compute EF & Debt Caps
  const efGap$ = round2(Math.max(0, efTarget$ - efBalance$));
  const efSliderMax$ = round2(savingsBudget$ * 0.40); // 40% cap
  const efCap$ = round2(Math.min(efGap$, efSliderMax$));

  const totalDebtBalance$ = round2(
    highAprDebts.reduce((sum, debt) => sum + debt.balance$, 0)
  );
  const debtSliderMax$ = round2(savingsBudget$ * 0.40); // 40% cap
  const debtCap$ = round2(Math.min(totalDebtBalance$, debtSliderMax$));

  // Step 3: Determine Flexible Pool
  const mandatory$ = floorMatch$;
  const flex$ = round2(Math.max(0, savingsBudget$ - mandatory$));

  // Step 4: Normalize Slider Weights
  // Weights for EF, Debt, Retirement Extra, Brokerage within flexible pool
  const sliderSum = sliders.ef + sliders.debt + sliders.retirementExtra + sliders.brokerage;
  
  // Handle edge case: all sliders at 0
  if (sliderSum === 0) {
    // Default equal distribution
    const w_EF = 0.25;
    const w_D = 0.25;
    const w_Rx = 0.25;
    const w_B = 0.25;
    
    notes.push('All sliders at 0, using equal distribution');
    
    // Step 5: Allocate to EF & Debt with Caps
    const efAlloc$ = round2(Math.min(w_EF * flex$, efCap$));
    const debtAlloc$ = round2(Math.min(w_D * flex$, debtCap$));
    
    // Step 6: Recompute Remaining Flex
    const flexAfterSafety$ = round2(flex$ - efAlloc$ - debtAlloc$);
    
    // Step 7: Allocate Remaining Flex to Retirement Extra & Brokerage
    const w_Rx_norm = w_Rx / (w_Rx + w_B);
    const w_B_norm = w_B / (w_Rx + w_B);
    
    const retExtraAlloc$ = round2(w_Rx_norm * flexAfterSafety$);
    const brokerageAlloc$ = round2(w_B_norm * flexAfterSafety$);
    
    // Step 8: Add Mandatory Match
    const retMatchAlloc$ = floorMatch$;
    
    // Step 9: Reconciliation
    const total = round2(efAlloc$ + debtAlloc$ + retMatchAlloc$ + retExtraAlloc$ + brokerageAlloc$);
    const diff = round2(savingsBudget$ - total);
    
    // Push any rounding difference into brokerage
    const finalBrokerage$ = round2(brokerageAlloc$ + diff);
    
    return {
      ef$: efAlloc$,
      highAprDebt$: debtAlloc$,
      match401k$: retMatchAlloc$,
      retirementTaxAdv$: retExtraAlloc$,
      brokerage$: finalBrokerage$,
      warnings,
      notes,
    };
  }
  
  const w_EF = sliderSum > 0 ? sliders.ef / sliderSum : 0;
  const w_D = sliderSum > 0 ? sliders.debt / sliderSum : 0;
  const w_Rx = sliderSum > 0 ? sliders.retirementExtra / sliderSum : 0;
  const w_B = sliderSum > 0 ? sliders.brokerage / sliderSum : 0;

  // Step 5: Allocate to EF & Debt with Caps
  const efAlloc$ = round2(Math.min(w_EF * flex$, efCap$));
  const debtAlloc$ = round2(Math.min(w_D * flex$, debtCap$));

  // Warn if user tried to allocate more than cap allows
  if (w_EF * flex$ > efCap$ && efCap$ > 0) {
    notes.push(
      `Emergency fund allocation capped at $${efCap$.toFixed(2)} (remaining gap) instead of $${(w_EF * flex$).toFixed(2)}`
    );
  }
  if (w_D * flex$ > debtCap$ && debtCap$ > 0) {
    notes.push(
      `Debt paydown allocation capped at $${debtCap$.toFixed(2)} (remaining balance) instead of $${(w_D * flex$).toFixed(2)}`
    );
  }

  // Step 6: Recompute Remaining Flex
  const flexAfterSafety$ = round2(flex$ - efAlloc$ - debtAlloc$);

  // Step 7: Allocate Remaining Flex to Retirement Extra & Brokerage
  const w_Rx_norm = (w_Rx + w_B) > 0 ? w_Rx / (w_Rx + w_B) : 0.5;
  const w_B_norm = (w_Rx + w_B) > 0 ? w_B / (w_Rx + w_B) : 0.5;

  const retExtraAlloc$ = round2(w_Rx_norm * flexAfterSafety$);
  const brokerageAlloc$ = round2(w_B_norm * flexAfterSafety$);

  // Step 8: Add Mandatory Match
  const retMatchAlloc$ = floorMatch$;

  // Guardrails: Warn on inefficient choices
  if (sliders.retirementMatch === 0 && matchNeedThisPeriod$ > 0) {
    warnings.push(
      `We kept $${floorMatch$.toFixed(2)} in Retirement — Match to capture your full employer match. Reducing this would mean leaving free money on the table.`
    );
  }

  if (sliders.debt === 0 && totalDebtBalance$ > 0) {
    warnings.push(
      `You have $${totalDebtBalance$.toFixed(2)} in high-APR debt. Consider allocating some savings to pay it down faster.`
    );
  }

  if (sliders.brokerage > 80 && sliders.retirementMatch < 50 && matchNeedThisPeriod$ > 0) {
    warnings.push(
      `You're prioritizing brokerage over retirement match. Redirecting match dollars to brokerage would reduce your long-term net worth because you'd miss out on free match money.`
    );
  }

  // Step 9: Reconciliation
  const total = round2(efAlloc$ + debtAlloc$ + retMatchAlloc$ + retExtraAlloc$ + brokerageAlloc$);
  const diff = round2(savingsBudget$ - total);

  // Push any rounding difference into brokerage
  const finalBrokerage$ = round2(brokerageAlloc$ + diff);

  notes.push(
    `Allocated $${efAlloc$.toFixed(2)} to EF, $${debtAlloc$.toFixed(2)} to debt, $${retMatchAlloc$.toFixed(2)} to match, $${retExtraAlloc$.toFixed(2)} to retirement extra, $${finalBrokerage$.toFixed(2)} to brokerage`
  );

  return {
    ef$: efAlloc$,
    highAprDebt$: debtAlloc$,
    match401k$: retMatchAlloc$,
    retirementTaxAdv$: retExtraAlloc$,
    brokerage$: finalBrokerage$,
    warnings,
    notes,
  };
}

