/**
 * Thin wrapper around existing Savings Allocation engine.
 * Single source of truth: allocateSavings from lib/alloc/savings.
 * Returns allocation + toolOutput.explain (engine-only; no UI/Sidekick math).
 * TODO Phase 2B: Income Allocation chat-first wrapper.
 * TODO Phase 2C: Money Sweeper chat-first flow.
 */

import { allocateSavings, type SavingsAllocation, type SavingsInputs } from '@/lib/alloc/savings';
import { buildSavingsExplain, type SavingsAllocationExplain } from './explain';
import type { SavingsAllocationUserState } from './types';

export interface SavingsAllocationResult {
  allocation: SavingsAllocation;
  explain: SavingsAllocationExplain;
}

/**
 * Runs the Savings Allocation engine with the given user state.
 * State should be in monthly terms (savingsBudget$, matchNeedThisPeriod$, etc.).
 * Returns the authoritative allocation and toolOutput.explain — do not invent numbers elsewhere.
 */
export function runSavingsAllocation(userState: SavingsAllocationUserState): SavingsAllocationResult {
  const inputs: SavingsInputs = {
    savingsBudget$: userState.savingsBudget$,
    efTarget$: userState.efTarget$,
    efBalance$: userState.efBalance$,
    highAprDebts: userState.highAprDebts,
    matchNeedThisPeriod$: userState.matchNeedThisPeriod$,
    incomeSingle$: userState.incomeSingle$,
    onIDR: userState.onIDR,
    liquidity: userState.liquidity ?? 'Medium',
    retirementFocus: userState.retirementFocus ?? 'Medium',
    iraRoomThisYear$: userState.iraRoomThisYear$ ?? 7000,
    k401RoomThisYear$: userState.k401RoomThisYear$ ?? 23000,
    hsaEligible: userState.hsaEligible,
    hsaCoverageType: userState.hsaCoverageType ?? 'unknown',
    currentHSAMonthly$: userState.currentHSAMonthly$ ?? 0,
    hsaRoomThisYear$: userState.hsaRoomThisYear$ ?? 0,
    prioritizeHSA: userState.prioritizeHSA,
  };
  const allocation = allocateSavings(inputs);
  const explain = buildSavingsExplain(inputs, allocation, {
    employerMatchRatePct: userState.employerMatchRatePct,
    employerHsaMonthly$: userState.employerHsaMonthly$,
    monthlyBasicsForEf: userState.monthlyBasicsForEf,
    efTargetMonths: userState.efTargetMonths,
    grossIncomeMonthly: userState.grossIncomeMonthly,
    currentPlan: userState.currentPlan,
  });
  return { allocation, explain };
}
