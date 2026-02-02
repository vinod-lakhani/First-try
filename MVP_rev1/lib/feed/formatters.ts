/**
 * Leap card formatting helpers. Never throw; fall back gracefully when payload fields are missing.
 * Later we will enrich payload with specific impact fields (monthly contribution, match gap, delta savings).
 */

import type { Leap } from './leapTypes';
import { getLeapCopy } from './leapCopyMap';

/** Format number as currency e.g. "$1,102" (no cents). */
export function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Format number as months e.g. "2 months". */
export function formatMonths(n: number): string {
  return n === 1 ? '1 month' : `${Math.round(n)} months`;
}

/** Safe get from payload; returns fallback if key missing or undefined. */
export function safeGet(
  payload: Record<string, unknown> | undefined,
  key: string,
  fallback: string
): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const v = payload[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'number') return String(v);
  return String(v);
}

/**
 * Renders leap subtitle by substituting placeholders from leap.payload.
 * Must never throw; if fields missing, returns a generic subtitle.
 */
export function renderLeapSubtitle(leap: Leap): string {
  const copy = getLeapCopy(leap.leapType);
  const payload = leap.payload && typeof leap.payload === 'object' ? leap.payload : {};
  const template = copy.subtitleTemplate;

  // Replace {key} with payload[key] or sensible fallback (never throw)
  const result = template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = payload[key];
    if (v === undefined || v === null) return '—';
    if (typeof v === 'number') {
      const k = key.toLowerCase();
      if (k.includes('gap') || k.includes('savings') || k.includes('contribution') || k.includes('match') || k.includes('delta')) return formatMoney(v);
      if (k.includes('month')) return String(Math.round(v));
      return String(v);
    }
    return String(v);
  });

  return result || 'Take a look when you\'re ready.';
}

/**
 * Derives an optional impact line from leap.payload. Returns null if no impact data.
 * Fallback: "Impact: High | Medium | Low" based on priorityScore (>=90 High, >=60 Medium, else Low).
 */
export function deriveImpactLine(leap: Leap): string | null {
  const payload = leap.payload && typeof leap.payload === 'object' ? leap.payload : {};

  switch (leap.leapType) {
    // ─── Emergency Fund ────────────────────────────────────────────────────
    case 'EMERGENCY_FUND_GAP': {
      const rec = payload.recommendedMonthlyContribution;
      if (typeof rec === 'number') return `Recommended: ${formatMoney(rec)}/mo`;
      break;
    }
    
    // ─── Employer Match (new + legacy) ─────────────────────────────────────
    case 'MISSING_EMPLOYER_MATCH':
    case 'EMPLOYER_MATCH_NOT_MET': {
      const gap = payload.employerMatchGapMonthly;
      if (typeof gap === 'number') return `Free money: ~${formatMoney(gap)}/mo`;
      break;
    }
    
    // ─── Income Lifecycle ──────────────────────────────────────────────────
    case 'FIRST_INCOME_PLAN_NEEDED': {
      return 'Impact: High';
    }
    
    case 'MONTH_CLOSED_REVIEW_INCOME_PLAN': {
      return 'Impact: Medium';
    }
    
    case 'INCOME_DRIFT_DETECTED': {
      const drift = payload.drift;
      if (typeof drift === 'number') return `Drift: ${Math.round(drift)}% off plan`;
      break;
    }
    
    case 'PAYCHECK_REBALANCE_AVAILABLE': {
      const delta = payload.deltaSavingsMonthly;
      if (typeof delta === 'number') return `+ ${formatMoney(delta)}/mo to savings`;
      break;
    }
    
    // ─── Cash Risk ─────────────────────────────────────────────────────────
    case 'CASH_RISK_DETECTED': {
      const shortfall = payload.shortfallEstimate;
      if (typeof shortfall === 'number') return `Risk: ~${formatMoney(shortfall)} shortfall`;
      break;
    }
    
    // ─── High APR Debt (new + legacy) ──────────────────────────────────────
    case 'HIGH_APR_DEBT_PRIORITY':
    case 'HIGH_APR_DEBT_PRESENT': {
      const apr = payload.highAprDebtApr;
      if (typeof apr === 'number') return `APR: ${apr}%`;
      break;
    }
    
    default:
      break;
  }

  // Fallback by priority tier
  const score = leap.priorityScore ?? leap.debug?.score ?? 0;
  if (score >= 90) return 'Impact: High';
  if (score >= 60) return 'Impact: Medium';
  return 'Impact: Low';
}

/** Human label for originating tool (for card footer). */
export function toolLabel(tool: Leap['originatingTool']): string {
  switch (tool) {
    case 'income': return 'Income';
    case 'savings': return 'Savings';
    case 'sweeper': return 'Sweeper';
    case 'sidekick': return 'Sidekick';
    default: return 'Tool';
  }
}
