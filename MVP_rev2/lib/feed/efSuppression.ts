/**
 * Emergency Fund Leap Suppression — EF On-Track Trajectory
 *
 * A gap is NOT feed-worthy if the user's applied plan is already closing the gap at an acceptable pace.
 * Implements suppression gate: "EF On-Track Trajectory".
 */

import type { UserFinancialState } from './leapTypes';

const EF_HORIZON_MONTHS = 12;
const ON_TRACK_BUFFER = 0.9; // 10% buffer so we don't spam for tiny differences
const GRACE_PERIOD_DAYS = 14;

export interface EfSuppressionResult {
  show: boolean;
  /** Reason for suppression (when show is false). */
  suppressedReason?: 'target_met' | 'on_track' | 'grace_period';
  /** Debug metadata for Debug View. */
  debug: {
    efMonths: number;
    efTargetMonths: number;
    efGapDollars: number;
    monthlyExpenseBaseline: number;
    appliedPlanEfMonthly: number;
    efRequiredPerMonth: number;
    efOnTrack: boolean;
    recentlyApplied: boolean;
    criticallyLow: boolean;
  };
}

/**
 * Returns true if the EF leap should be shown to the user. Returns false (suppress) if:
 * 1) efMonths >= efTargetMonths
 * 2) efOnTrack === true (applied plan closing gap at acceptable pace)
 * 3) Grace period: plan applied recently AND EF not critically low
 */
export function shouldShowEmergencyFundLeap(state: UserFinancialState): EfSuppressionResult {
  const efTargetMonths = state.emergencyFundTargetMonths || 6;
  const efMonths = Math.max(0, state.emergencyFundMonths ?? 0);

  // monthlyExpenseBaseline: same baseline used to compute EF months
  const monthlyExpenseBaseline =
    state.takeHomePayMonthly > 0 && state.needsPercent > 0
      ? (state.needsPercent / 100) * state.takeHomePayMonthly
      : 2000;

  const efTargetBalance = efTargetMonths * monthlyExpenseBaseline;
  const efBalance = efMonths * monthlyExpenseBaseline;
  const efGapDollars = Math.max(0, efTargetBalance - efBalance);

  const appliedPlanEfMonthly = state.appliedPlanEfMonthly ?? 0;
  const efRequiredPerMonth = efGapDollars > 0 ? efGapDollars / EF_HORIZON_MONTHS : 0;
  const efOnTrack =
    efRequiredPerMonth > 0 && appliedPlanEfMonthly >= efRequiredPerMonth * ON_TRACK_BUFFER;

  const now = new Date();
  const appliedAt = state.savingsPlanAppliedAt
    ? new Date(state.savingsPlanAppliedAt)
    : null;
  const daysSinceApplied = appliedAt
    ? (now.getTime() - appliedAt.getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;
  const recentlyApplied = daysSinceApplied < GRACE_PERIOD_DAYS;
  const criticallyLow = efMonths < 1;

  const debug = {
    efMonths,
    efTargetMonths,
    efGapDollars: Math.round(efGapDollars),
    monthlyExpenseBaseline: Math.round(monthlyExpenseBaseline),
    appliedPlanEfMonthly: Math.round(appliedPlanEfMonthly),
    efRequiredPerMonth: Math.round(efRequiredPerMonth),
    efOnTrack,
    recentlyApplied,
    criticallyLow,
  };

  // 1) Target met — suppress
  if (efMonths >= efTargetMonths) {
    return { show: false, suppressedReason: 'target_met', debug };
  }

  // 2) On-track trajectory — suppress
  if (efOnTrack) {
    return { show: false, suppressedReason: 'on_track', debug };
  }

  // 3) Grace period: recently applied AND not critically low — suppress
  if (recentlyApplied && !criticallyLow) {
    return { show: false, suppressedReason: 'grace_period', debug };
  }

  return { show: true, debug };
}
