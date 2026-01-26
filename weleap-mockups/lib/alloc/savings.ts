/**
 * Savings Allocation Engine
 * 
 * Implements priority-based savings allocation across emergency fund, high-interest debt,
 * employer match, retirement accounts, and taxable brokerage.
 */

import { round2 } from './income';

export type LiquidityLevel = "High" | "Medium" | "Low";
export type RetirementFocus = "High" | "Medium" | "Low";

export interface SavingsInputs {
  /** Dollars available for the Savings bucket this period */
  savingsBudget$: number;
  /** Target emergency fund amount in dollars */
  efTarget$: number;
  /** Current emergency fund balance */
  efBalance$: number;
  /** High-APR debts (APR > 10%) */
  highAprDebts: Array<{ balance$: number; aprPct: number }>;
  /** Dollars needed this period to capture full employer match */
  matchNeedThisPeriod$: number;
  /** Single filer income for Roth vs Traditional decision */
  incomeSingle$: number;
  /** Whether user is on Income-Driven Repayment for student loans */
  onIDR?: boolean;
  /** Liquidity need level */
  liquidity?: LiquidityLevel;
  /** Retirement focus level */
  retirementFocus?: RetirementFocus;
  /** Remaining IRA contribution room this year */
  iraRoomThisYear$?: number;
  /** Remaining 401(k) contribution room this year (beyond match) */
  k401RoomThisYear$?: number;
  /** Whether user is eligible for HSA (has HDHP) */
  hsaEligible?: boolean;
  /** HSA coverage type: self, family, or unknown */
  hsaCoverageType?: "self" | "family" | "unknown";
  /** Current HSA contribution per month (if contributing) */
  currentHSAMonthly$?: number;
  /** Remaining HSA contribution room this year (annual cap - current contributions) */
  hsaRoomThisYear$?: number;
  /** Whether user is tax-efficiency focused or has high medical spend (for HSA recommendation) */
  prioritizeHSA?: boolean;
}

export interface SavingsAllocation {
  /** Dollars allocated to emergency fund */
  ef$: number;
  /** Dollars allocated to high-APR debt */
  highAprDebt$: number;
  /** Dollars allocated to 401(k) for employer match */
  match401k$: number;
  /** Dollars allocated to HSA (if eligible) */
  hsa$: number;
  /** Dollars allocated to tax-advantaged retirement accounts */
  retirementTaxAdv$: number;
  /** Dollars allocated to taxable brokerage */
  brokerage$: number;
  /** Routing information */
  routing: {
    acctType: "Roth" | "Traditional401k";
    splitRetirePct: number;
    splitBrokerPct: number;
  };
  /** Notes about allocation decisions */
  notes: string[];
}

/**
 * Determines the split percentage between retirement and brokerage
 * based on liquidity need and retirement focus.
 * 
 * Returns [retirementPct, brokeragePct] as percentages (0-1)
 */
function getLiquidityRetirementSplit(
  liquidity: LiquidityLevel,
  retirementFocus: RetirementFocus
): [number, number] {
  // Matrix: [Liquidity][Retirement] = [retirement%, brokerage%]
  const matrix: Record<LiquidityLevel, Record<RetirementFocus, [number, number]>> = {
    High: {
      High: [0.30, 0.70],    // High liquidity, high retirement focus
      Medium: [0.20, 0.80],
      Low: [0.10, 0.90],
    },
    Medium: {
      High: [0.70, 0.30],    // Medium liquidity, high retirement focus
      Medium: [0.50, 0.50],
      Low: [0.30, 0.70],
    },
    Low: {
      High: [0.90, 0.10],    // Low liquidity, high retirement focus
      Medium: [0.70, 0.30],
      Low: [0.50, 0.50],
    },
  };
  
  return matrix[liquidity][retirementFocus];
}

/**
 * Determines account type preference (Roth vs Traditional 401k)
 * based on income and IDR status.
 */
function chooseAccountType(
  incomeSingle$: number,
  onIDR: boolean
): "Roth" | "Traditional401k" {
  // IDR override: Traditional 401k to lower AGI and reduce loan payments
  if (onIDR) {
    return "Traditional401k";
  }
  
  // Simplified rule: < $190k → Roth, >= $190k → Traditional 401k
  if (incomeSingle$ < 190000) {
    return "Roth";
  }
  
  return "Traditional401k";
}

/**
 * Allocates savings budget across emergency fund, debt, match, HSA, retirement, and brokerage.
 * 
 * Priority order (Savings Stack):
 * 1. 401(k) Match (capture employer match)
 * 2. HSA (if eligible, fund HSA)
 * 3. Emergency Fund (up to 40% of budget or EF gap)
 * 4. High-APR Debt (up to 40% of remaining or debt balance)
 * 5. Choose account type (Roth vs Traditional401k)
 * 6. Split remaining between retirement and brokerage
 * 7. Route retirement dollars to IRA first, then 401(k), spill to brokerage
 */
export function allocateSavings(s: SavingsInputs): SavingsAllocation {
  const {
    savingsBudget$,
    efTarget$,
    efBalance$,
    highAprDebts,
    matchNeedThisPeriod$,
    incomeSingle$,
    onIDR = false,
    liquidity = 'Medium',
    retirementFocus = 'Medium',
    iraRoomThisYear$ = 7000,
    k401RoomThisYear$ = 23000,
    hsaEligible = false,
    hsaCoverageType = "unknown",
    currentHSAMonthly$ = 0,
    hsaRoomThisYear$ = 0,
    prioritizeHSA = false,
  } = s;
  
  const notes: string[] = [];
  let remaining$ = round2(savingsBudget$);
  
  // Step 1: 401(k) Match (capture employer match first)
  const matchAlloc$ = round2(Math.min(matchNeedThisPeriod$, remaining$));
  remaining$ = round2(remaining$ - matchAlloc$);
  
  if (matchAlloc$ > 0) {
    notes.push(`Allocated $${matchAlloc$.toFixed(2)} to 401(k) for employer match`);
  }
  if (matchNeedThisPeriod$ > 0 && matchAlloc$ < matchNeedThisPeriod$) {
    notes.push(`Warning: Could not fully capture match (need $${matchNeedThisPeriod$.toFixed(2)})`);
  }
  
  // Step 2: HSA (if eligible)
  let hsaAlloc$ = 0;
  if (hsaEligible && hsaRoomThisYear$ > 0) {
    // Calculate recommended HSA amount
    // MVP: Baseline $50-200/month, or more if prioritizeHSA
    const baselineHSA$ = prioritizeHSA ? 200 : 100; // $100/month baseline, $200 if prioritizing
    const monthsRemainingInYear = 12; // Simplified - could calculate actual months remaining
    const remainingHsaRoomMonthly$ = hsaRoomThisYear$ / monthsRemainingInYear;
    
    // Clamp recommendation to remaining room
    const recommendedHsaMonthly$ = round2(Math.min(baselineHSA$, remainingHsaRoomMonthly$));
    
    // Allocate from remaining budget
    hsaAlloc$ = round2(Math.min(recommendedHsaMonthly$, remaining$));
    remaining$ = round2(remaining$ - hsaAlloc$);
    
    if (hsaAlloc$ > 0) {
      notes.push(`Allocated $${hsaAlloc$.toFixed(2)} to HSA (${hsaCoverageType} coverage)`);
    }
    if (remainingHsaRoomMonthly$ <= 0) {
      notes.push(`HSA maxed for this year - routing additional dollars to next stack item`);
    }
  } else if (hsaEligible && hsaRoomThisYear$ <= 0) {
    notes.push(`HSA maxed for this year`);
  }
  
  // Step 3: Emergency Fund
  const efGap$ = round2(Math.max(0, efTarget$ - efBalance$));
  const efCap$ = round2(savingsBudget$ * 0.40);
  const efAlloc$ = round2(Math.min(efGap$, efCap$, remaining$));
  remaining$ = round2(remaining$ - efAlloc$);
  
  if (efAlloc$ > 0) {
    notes.push(`Allocated $${efAlloc$.toFixed(2)} to emergency fund`);
  }
  if (efGap$ > 0 && efAlloc$ < efGap$) {
    notes.push(`EF gap partially filled (${efAlloc$.toFixed(2)}/${efGap$.toFixed(2)})`);
  }
  
  // Step 4: High-APR Debt
  const totalDebtBalance$ = round2(
    highAprDebts.reduce((sum, debt) => sum + debt.balance$, 0)
  );
  const debtCap$ = round2((savingsBudget$ - efAlloc$) * 0.40);
  const debtAlloc$ = round2(Math.min(totalDebtBalance$, debtCap$, remaining$));
  remaining$ = round2(remaining$ - debtAlloc$);
  
  if (debtAlloc$ > 0) {
    notes.push(`Allocated $${debtAlloc$.toFixed(2)} to high-APR debt`);
  }
  if (totalDebtBalance$ > 0 && debtAlloc$ < totalDebtBalance$) {
    notes.push(`High-APR debt partially paid (${debtAlloc$.toFixed(2)}/${totalDebtBalance$.toFixed(2)})`);
  }
  
  // Step 4: Choose account type
  const acctType = chooseAccountType(incomeSingle$, onIDR);
  if (onIDR) {
    notes.push(`IDR detected: using Traditional 401(k) to lower AGI`);
  } else if (incomeSingle$ < 190000) {
    notes.push(`Income < $190k: prioritizing Roth accounts`);
  } else {
    notes.push(`Income >= $190k: prioritizing Traditional 401(k)`);
  }
  
  // Step 5: Split remaining between retirement and brokerage
  const [retirePct, brokerPct] = getLiquidityRetirementSplit(liquidity, retirementFocus);
  const retirementBudget$ = round2(remaining$ * retirePct);
  const brokerageBudget$ = round2(remaining$ * brokerPct);
  
  notes.push(
    `Split remaining: ${(retirePct * 100).toFixed(0)}% retirement, ${(brokerPct * 100).toFixed(0)}% brokerage`
  );
  
  // Step 6: Route retirement dollars to IRA first, then 401(k), spill to brokerage
  let retirementTaxAdv$ = 0;
  let brokerageFromRetirement$ = 0;
  
  if (retirementBudget$ > 0) {
    // Try IRA first
    const iraAlloc$ = round2(Math.min(retirementBudget$, iraRoomThisYear$));
    retirementTaxAdv$ = round2(retirementTaxAdv$ + iraAlloc$);
    let retirementRemaining$ = round2(retirementBudget$ - iraAlloc$);
    
    if (iraAlloc$ > 0) {
      notes.push(`Routing $${iraAlloc$.toFixed(2)} to ${acctType} IRA`);
    }
    
    // Then 401(k) beyond match
    if (retirementRemaining$ > 0 && k401RoomThisYear$ > 0) {
      const k401Alloc$ = round2(Math.min(retirementRemaining$, k401RoomThisYear$));
      retirementTaxAdv$ = round2(retirementTaxAdv$ + k401Alloc$);
      retirementRemaining$ = round2(retirementRemaining$ - k401Alloc$);
      
      if (k401Alloc$ > 0) {
        notes.push(`Routing $${k401Alloc$.toFixed(2)} to ${acctType} 401(k) beyond match`);
      }
    }
    
    // Spill excess to brokerage
    if (retirementRemaining$ > 0.01) {
      brokerageFromRetirement$ = round2(retirementRemaining$);
      notes.push(
        `Retirement accounts full: routing $${brokerageFromRetirement$.toFixed(2)} excess to brokerage`
      );
    }
  }
  
  // Total brokerage = direct brokerage allocation + spillover from retirement
  const totalBrokerage$ = round2(brokerageBudget$ + brokerageFromRetirement$);
  
  // Reconcile rounding
  const currentTotal = round2(
    efAlloc$ + debtAlloc$ + matchAlloc$ + hsaAlloc$ + retirementTaxAdv$ + totalBrokerage$
  );
  const roundingDiff = round2(savingsBudget$ - currentTotal);
  
  if (Math.abs(roundingDiff) > 0.001) {
    // Adjust brokerage for rounding
    const finalBrokerage$ = round2(totalBrokerage$ + roundingDiff);
    
    // Final validation
    const finalTotal = round2(
      efAlloc$ + debtAlloc$ + matchAlloc$ + hsaAlloc$ + retirementTaxAdv$ + finalBrokerage$
    );
    
    if (Math.abs(finalTotal - savingsBudget$) > 0.01) {
      throw new Error(
        `Allocation error: total ${finalTotal} does not equal budget ${savingsBudget$}`
      );
    }
    
    return {
      ef$: round2(efAlloc$),
      highAprDebt$: round2(debtAlloc$),
      match401k$: round2(matchAlloc$),
      hsa$: round2(hsaAlloc$),
      retirementTaxAdv$: round2(retirementTaxAdv$),
      brokerage$: round2(finalBrokerage$),
      routing: {
        acctType,
        splitRetirePct: round2(retirePct * 100),
        splitBrokerPct: round2(brokerPct * 100),
      },
      notes,
    };
  }
  
  return {
    ef$: round2(efAlloc$),
    highAprDebt$: round2(debtAlloc$),
    match401k$: round2(matchAlloc$),
    hsa$: round2(hsaAlloc$),
    retirementTaxAdv$: round2(retirementTaxAdv$),
    brokerage$: round2(totalBrokerage$),
    routing: {
      acctType,
      splitRetirePct: round2(retirePct * 100),
      splitBrokerPct: round2(brokerPct * 100),
    },
    notes,
  };
}

