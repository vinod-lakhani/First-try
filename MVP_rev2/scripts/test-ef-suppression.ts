/**
 * Unit tests for shouldShowEmergencyFundLeap.
 * Run: npx tsx scripts/test-ef-suppression.ts
 */

import { shouldShowEmergencyFundLeap } from '../lib/feed/efSuppression';
import type { UserFinancialState } from '../lib/feed/leapTypes';

function baseState(overrides: Partial<UserFinancialState> = {}): UserFinancialState {
  return {
    takeHomePayMonthly: 5000,
    paycheckDetected: false,
    needsPercent: 55,
    wantsPercent: 25,
    savingsPercent: 20,
    cashBalance: 3000,
    safetyBufferTarget: 2000,
    emergencyFundMonths: 2,
    emergencyFundTargetMonths: 6,
    hasHighAprDebt: false,
    employerMatchEligible: false,
    employerMatchMet: false,
    hsaEligible: false,
    hsaContributing: false,
    unimplementedLeaps: [],
    ...overrides,
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function runTest(name: string, fn: () => void): void {
  try {
    console.log(`\nTest: ${name}`);
    fn();
    console.log(`  PASS`);
  } catch (e) {
    console.error(`  FAIL:`, e);
    process.exit(1);
  }
}

// Case A — EF below target BUT on-track (should suppress)
runTest('Case A: EF on-track (suppress)', () => {
  const state = baseState({
    emergencyFundMonths: 2,
    emergencyFundTargetMonths: 6,
    appliedPlanEfMonthly: 850, // gap ~11k, need 825/mo
  });
  const result = shouldShowEmergencyFundLeap(state);
  assert(!result.show, 'should suppress');
  assert(result.suppressedReason === 'on_track', 'reason should be on_track');
  assert(result.debug.efOnTrack === true, 'efOnTrack should be true');
});

// Case B — EF below target AND not on-track (should show)
runTest('Case B: EF not on-track (show)', () => {
  const state = baseState({
    emergencyFundMonths: 1,
    emergencyFundTargetMonths: 6,
    appliedPlanEfMonthly: 0,
  });
  const result = shouldShowEmergencyFundLeap(state);
  assert(result.show, 'should show');
  assert(result.debug.efOnTrack === false, 'efOnTrack should be false');
});

// Case C — EF target met (should suppress)
runTest('Case C: EF target met (suppress)', () => {
  const state = baseState({
    emergencyFundMonths: 6,
    emergencyFundTargetMonths: 6,
  });
  const result = shouldShowEmergencyFundLeap(state);
  assert(!result.show, 'should suppress');
  assert(result.suppressedReason === 'target_met', 'reason should be target_met');
});

// Case D — plan applied yesterday, EF months = 2 (should suppress due to grace)
runTest('Case D: Grace period (suppress)', () => {
  const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const state = baseState({
    emergencyFundMonths: 2,
    emergencyFundTargetMonths: 6,
    savingsPlanAppliedAt: yesterday,
    appliedPlanEfMonthly: 0,
  });
  const result = shouldShowEmergencyFundLeap(state);
  assert(!result.show, 'should suppress');
  assert(result.suppressedReason === 'grace_period', 'reason should be grace_period');
  assert(result.debug.recentlyApplied === true, 'recentlyApplied should be true');
  assert(result.debug.criticallyLow === false, 'criticallyLow should be false');
});

// Case E — plan applied yesterday, EF months = 0.5 (critically low) (should show)
runTest('Case E: Grace + critically low (show)', () => {
  const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const state = baseState({
    emergencyFundMonths: 0.5,
    emergencyFundTargetMonths: 6,
    savingsPlanAppliedAt: yesterday,
    appliedPlanEfMonthly: 0,
  });
  const result = shouldShowEmergencyFundLeap(state);
  assert(result.show, 'should show');
  assert(result.debug.criticallyLow === true, 'criticallyLow should be true');
});

// Edge: exactly at 90% of required (on-track)
runTest('Edge: exactly 90% of required (on-track)', () => {
  // monthlyExpenseBaseline = 0.55 * 5000 = 2750
  // efGapDollars = 4 * 2750 = 11000 (4 months gap)
  // efRequiredPerMonth = 11000/12 = 916.67
  // 90% = 825
  const state = baseState({
    emergencyFundMonths: 2,
    emergencyFundTargetMonths: 6,
    appliedPlanEfMonthly: 825,
  });
  const result = shouldShowEmergencyFundLeap(state);
  assert(!result.show, 'should suppress (at threshold)');
  assert(result.debug.efOnTrack === true, 'efOnTrack should be true');
});

// Edge: just below 90% (show)
runTest('Edge: just below 90% (show)', () => {
  const state = baseState({
    emergencyFundMonths: 2,
    emergencyFundTargetMonths: 6,
    appliedPlanEfMonthly: 800, // below 825
  });
  const result = shouldShowEmergencyFundLeap(state);
  assert(result.show, 'should show');
  assert(result.debug.efOnTrack === false, 'efOnTrack should be false');
});

console.log('\n\nAll tests passed.');
