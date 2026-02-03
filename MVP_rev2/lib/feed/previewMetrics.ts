/**
 * Feed Preview Benefit Metrics — ONE deterministic, rounded metric per Leap.
 * Do NOT compute net worth delta or multi-year projections here (those belong in tools).
 * Consistent across Feed + Sidekick.
 */

import type { LeapType, LeapPreviewMetric, UserFinancialState, TriggerSignals } from './leapTypes';
import { formatMoney } from './formatters';

function roundMonths(n: number): number {
  return Math.round(n);
}

function roundDollars(n: number): number {
  return Math.round(n);
}

/**
 * Computes at most ONE preview metric per Leap. Returns null if required inputs missing;
 * UI should then fall back to "Impact: High/Medium/Low".
 * 
 * Benefit Preview Rules (single source of truth):
 * - match: "Free money: ~$X/mo"
 * - EF: "Runway: A → B months"
 * - debt: "APR: XX%"
 * - sweeper: "Available: ~$X"
 * Do NOT show net worth delta on feed. That stays inside tools.
 */
export function computePreviewMetric(
  leapType: LeapType,
  state: UserFinancialState,
  signals: TriggerSignals,
  payload?: Record<string, unknown>
): LeapPreviewMetric | null {
  const p = payload && typeof payload === 'object' ? payload : {};

  switch (leapType) {
    // ─── Employer Match (new + legacy) ─────────────────────────────────────
    case 'MISSING_EMPLOYER_MATCH':
    case 'EMPLOYER_MATCH_NOT_MET': {
      if (!state.employerMatchEligible || state.employerMatchMet) return null;
      const gap =
        typeof p.employerMatchGapMonthly === 'number'
          ? p.employerMatchGapMonthly
          : state.employerMatchGapMonthly;
      if (gap === undefined || gap <= 0) return null;
      const rounded = roundDollars(gap);
      return {
        label: 'Free money',
        value: `~${formatMoney(rounded)}/mo`,
        isEstimate: true,
        source: 'eligibility_math',
      };
    }

    // ─── HSA (new + legacy) ────────────────────────────────────────────────
    case 'HSA_OPPORTUNITY':
    case 'HSA_RECOMMENDATION_PENDING': {
      return {
        label: 'Tax advantage',
        value: 'Triple tax-advantaged',
        isEstimate: false,
        source: 'feed',
      };
    }

    // ─── Emergency Fund ────────────────────────────────────────────────────
    case 'EMERGENCY_FUND_GAP': {
      const months = typeof state.emergencyFundMonths === 'number' ? state.emergencyFundMonths : 0;
      const goal = typeof state.emergencyFundTargetMonths === 'number' ? state.emergencyFundTargetMonths : 6;
      const m = roundMonths(months);
      const g = roundMonths(goal);
      return {
        label: 'Runway',
        value: `${m} → ${g} months`,
        isEstimate: false,
        source: 'feed',
      };
    }

    // ─── Income Lifecycle ──────────────────────────────────────────────────
    case 'FIRST_INCOME_PLAN_NEEDED': {
      return {
        label: 'Status',
        value: 'No plan yet',
        isEstimate: false,
        source: 'feed',
      };
    }

    case 'MONTH_CLOSED_REVIEW_INCOME_PLAN': {
      return {
        label: 'Status',
        value: 'Month closed',
        isEstimate: false,
        source: 'feed',
      };
    }

    case 'INCOME_DRIFT_DETECTED': {
      const drift = typeof p.drift === 'number' ? p.drift : undefined;
      if (drift === undefined || drift <= 0) return null;
      return {
        label: 'Drift',
        value: `${Math.round(drift)}% off plan`,
        isEstimate: false,
        source: 'income_logic',
      };
    }

    case 'PAYCHECK_REBALANCE_AVAILABLE': {
      const delta = typeof p.deltaSavingsMonthly === 'number' ? p.deltaSavingsMonthly : undefined;
      if (delta === undefined || delta <= 0) return null;
      const rounded = roundDollars(delta);
      return {
        label: 'Delta',
        value: `+${formatMoney(rounded)}/mo to savings`,
        isEstimate: false,
        source: 'income_logic',
      };
    }

    case 'SAVINGS_DRIFT_DETECTED': {
      const shortfall = typeof p.savingsShortfallMonthly === 'number' ? p.savingsShortfallMonthly : undefined;
      if (shortfall === undefined || shortfall <= 0) return null;
      const rounded = roundDollars(shortfall);
      return {
        label: 'Status',
        value: `~${formatMoney(rounded)} below plan`,
        isEstimate: true,
        source: 'income_logic',
      };
    }

    // ─── High APR Debt (new + legacy) ──────────────────────────────────────
    case 'HIGH_APR_DEBT_PRIORITY':
    case 'HIGH_APR_DEBT_PRESENT': {
      const apr = state.highAprDebtApr ?? (typeof p.highAprDebtApr === 'number' ? p.highAprDebtApr : undefined);
      if (apr === undefined) return null;
      const a = Math.round(apr);
      return {
        label: 'APR',
        value: `${a}%`,
        isEstimate: false,
        source: 'feed',
      };
    }

    // ─── Surplus Cash (new + legacy) ───────────────────────────────────────
    case 'SURPLUS_CASH_AVAILABLE':
    case 'SURPLUS_CASH_DETECTED': {
      const surplus = typeof p.surplusCashAmount === 'number' ? p.surplusCashAmount : undefined;
      const computed =
        signals.surplusCash && state.cashBalance > state.safetyBufferTarget
          ? roundDollars(state.cashBalance - state.safetyBufferTarget)
          : undefined;
      const amount = surplus ?? computed;
      if (amount === undefined || amount <= 0) return null;
      const rounded = roundDollars(amount);
      return {
        label: 'Available',
        value: `~${formatMoney(rounded)}`,
        isEstimate: true,
        source: 'feed',
      };
    }

    // ─── Cash Risk ─────────────────────────────────────────────────────────
    case 'CASH_RISK_DETECTED': {
      const shortfall = typeof p.shortfallEstimate === 'number' ? p.shortfallEstimate : undefined;
      if (shortfall === undefined) return null;
      const rounded = roundDollars(Math.abs(shortfall));
      if (rounded <= 0) return null;
      return {
        label: 'Risk',
        value: `~${formatMoney(rounded)} shortfall`,
        isEstimate: true,
        source: 'feed',
      };
    }

    // ─── Unimplemented ─────────────────────────────────────────────────────
    case 'UNIMPLEMENTED_RECOMMENDATION': {
      return {
        label: 'Follow-up',
        value: 'Still worth doing',
        isEstimate: false,
        source: 'feed',
      };
    }

    default:
      return null;
  }
}
