/**
 * Feed Logic Engine — Generates candidate Leaps from user financial state + trigger signals.
 * Phase 1: Deterministic, rule-based; all candidates surfaced (debug mode).
 *
 * TODO Phase 2: Sidekick open should fetch top 1–3 Leaps from this engine (call generateCandidateLeaps, slice 0–3).
 * TODO Phase 2: Sidekick should narrate tool output (not invent plan).
 * TODO Phase 2: Tool pages should become chat-first wrappers around existing MVP UIs.
 */

import type {
  Leap,
  LeapType,
  OriginatingTool,
  UserFinancialState,
  TriggerSignals,
  UnimplementedLeapEntry,
} from './leapTypes';
import { SIDEKICK_INSIGHT_IDS } from './leapTypes';
import { shouldShowEmergencyFundLeap } from './efSuppression';

// Priority bands (higher number = higher priority).
// Order: missing match > EF/cash risk > high APR debt > HSA > income review/drift > surplus sweeper
const PRIORITY: Record<LeapType, number> = {
  // Highest priority: missing match (free money)
  MISSING_EMPLOYER_MATCH: 100,
  EMPLOYER_MATCH_NOT_MET: 100, // legacy
  
  // EF/cash risk
  CASH_RISK_DETECTED: 95,
  EMERGENCY_FUND_GAP: 90,
  
  // High APR debt
  HIGH_APR_DEBT_PRIORITY: 80,
  HIGH_APR_DEBT_PRESENT: 80, // legacy
  
  // HSA
  HSA_OPPORTUNITY: 70,
  HSA_RECOMMENDATION_PENDING: 70, // legacy
  
  // Income review/drift
  FIRST_INCOME_PLAN_NEEDED: 60,
  MONTH_CLOSED_REVIEW_INCOME_PLAN: 55,
  INCOME_DRIFT_DETECTED: 50,
  PAYCHECK_REBALANCE_AVAILABLE: 50, // legacy
  SAVINGS_DRIFT_DETECTED: 45, // legacy
  
  // Surplus sweeper
  SURPLUS_CASH_AVAILABLE: 40,
  SURPLUS_CASH_DETECTED: 40, // legacy
  
  // Follow-ups
  UNIMPLEMENTED_RECOMMENDATION: 65, // between HSA and income
};

const DEFAULT_TOOL: Record<LeapType, OriginatingTool> = {
  // Income lifecycle
  FIRST_INCOME_PLAN_NEEDED: 'income',
  MONTH_CLOSED_REVIEW_INCOME_PLAN: 'income',
  INCOME_DRIFT_DETECTED: 'income',
  PAYCHECK_REBALANCE_AVAILABLE: 'income', // legacy
  SAVINGS_DRIFT_DETECTED: 'income', // legacy
  
  // Savings stack
  MISSING_EMPLOYER_MATCH: 'savings',
  EMERGENCY_FUND_GAP: 'savings',
  HSA_OPPORTUNITY: 'savings',
  HIGH_APR_DEBT_PRIORITY: 'savings',
  EMPLOYER_MATCH_NOT_MET: 'savings', // legacy
  HSA_RECOMMENDATION_PENDING: 'savings', // legacy
  HIGH_APR_DEBT_PRESENT: 'savings', // legacy
  
  // Cash optimization
  SURPLUS_CASH_AVAILABLE: 'sweeper',
  CASH_RISK_DETECTED: 'sweeper',
  SURPLUS_CASH_DETECTED: 'sweeper', // legacy
  
  // Meta
  UNIMPLEMENTED_RECOMMENDATION: 'sidekick',
};

const DEFAULT_INSIGHT: Partial<Record<LeapType, string>> = {
  FIRST_INCOME_PLAN_NEEDED: SIDEKICK_INSIGHT_IDS.PAYCHECK_ADAPTATION,
  MONTH_CLOSED_REVIEW_INCOME_PLAN: SIDEKICK_INSIGHT_IDS.PAYCHECK_ADAPTATION,
  INCOME_DRIFT_DETECTED: SIDEKICK_INSIGHT_IDS.NEEDS_VS_WANTS_CLARITY,
  PAYCHECK_REBALANCE_AVAILABLE: SIDEKICK_INSIGHT_IDS.PAYCHECK_ADAPTATION, // legacy
  SAVINGS_DRIFT_DETECTED: SIDEKICK_INSIGHT_IDS.NEEDS_VS_WANTS_CLARITY, // legacy
  MISSING_EMPLOYER_MATCH: SIDEKICK_INSIGHT_IDS.EMPLOYER_MATCH_FREE_MONEY,
  EMPLOYER_MATCH_NOT_MET: SIDEKICK_INSIGHT_IDS.EMPLOYER_MATCH_FREE_MONEY, // legacy
  HSA_OPPORTUNITY: SIDEKICK_INSIGHT_IDS.HSA_TAX_ADVANTAGE,
  HSA_RECOMMENDATION_PENDING: SIDEKICK_INSIGHT_IDS.HSA_TAX_ADVANTAGE, // legacy
  EMERGENCY_FUND_GAP: SIDEKICK_INSIGHT_IDS.EMERGENCY_FUND_FREEDOM,
  HIGH_APR_DEBT_PRIORITY: SIDEKICK_INSIGHT_IDS.SAVINGS_STACK_ORDER,
  HIGH_APR_DEBT_PRESENT: SIDEKICK_INSIGHT_IDS.SAVINGS_STACK_ORDER, // legacy
  SURPLUS_CASH_AVAILABLE: SIDEKICK_INSIGHT_IDS.SMALL_MOVES_BIG_IMPACT,
  SURPLUS_CASH_DETECTED: SIDEKICK_INSIGHT_IDS.SMALL_MOVES_BIG_IMPACT, // legacy
  CASH_RISK_DETECTED: SIDEKICK_INSIGHT_IDS.EMERGENCY_FUND_FREEDOM,
};

function makeLeap(
  leapType: LeapType,
  state: UserFinancialState,
  signals: TriggerSignals,
  overrides: Partial<Leap> = {}
): Leap {
  const baseScore = PRIORITY[leapType];
  const tool = (overrides.originatingTool as OriginatingTool) ?? DEFAULT_TOOL[leapType];
  const insight = overrides.sidekickInsightId ?? DEFAULT_INSIGHT[leapType];
  const dedupeKey = overrides.dedupeKey ?? `leap:${leapType}:${state.takeHomePayMonthly}:${state.cashBalance}`;
  const leapId = `leap-${dedupeKey}-${signals.nowISO}`.replace(/[^a-zA-Z0-9-]/g, '-');
  
  // Build normalized Leap with new structure
  const payload = overrides.payload ?? {};
  const debug: Leap['debug'] = {
    score: overrides.priorityScore ?? baseScore,
    reasonCode: overrides.reasonCode ?? leapType,
    payload,
    dedupeKey,
  };
  
  return {
    // Core identity
    id: leapId,
    leapType,
    
    // User-facing content (will be filled in by leapCopyMap)
    title: overrides.title ?? '',
    subtitle: overrides.subtitle ?? '',
    tool: tool === 'sweeper' ? 'sweeper' : tool === 'sidekick' ? 'sidekick' : tool,
    benefitPreview: overrides.benefitPreview,
    
    // Actions
    primaryCta: overrides.primaryCta ?? {
      label: 'Open tool',
      actionType: 'OPEN_TOOL',
    },
    secondaryCtas: overrides.secondaryCtas,
    
    // Debug
    debug,
    
    // Legacy fields (for backward compatibility)
    leapId,
    originatingTrigger: overrides.originatingTrigger ?? 'state_signal',
    originatingTool: tool,
    priorityScore: debug.score,
    reasonCode: debug.reasonCode,
    payload,
    sidekickInsightId: insight as Leap['sidekickInsightId'],
    state: 'new',
    dedupeKey,
    ...overrides,
  };
}


/**
 * Generates all candidate Leaps from state and signals. Dedupes by dedupeKey (keeps higher priorityScore).
 * Phase 1: Cooldowns are stored but do NOT suppress candidates (debug mode).
 * 
 * Implements suppression logic:
 * - EF Gap: suppressed if user is "on track" (EF >= target OR plan trajectory meets target)
 */
export function generateCandidateLeaps(
  state: UserFinancialState,
  signals: TriggerSignals
): Leap[] {
  const raw: Leap[] = [];

  // ─── Income Lifecycle ───────────────────────────────────────────────────
  
  // 1) FIRST_INCOME_PLAN_NEEDED
  // Trigger: has >=3 months settled actuals AND net income available AND no income plan exists
  const hasActuals = state.takeHomePayMonthly > 0;
  const hasIncomePlan = state.savingsPercent > 0; // heuristic: if savings % set, plan exists
  if (hasActuals && !hasIncomePlan) {
    raw.push(
      makeLeap('FIRST_INCOME_PLAN_NEEDED', state, signals, {
        originatingTrigger: 'first_plan_needed',
        reasonCode: 'FIRST_PLAN',
        dedupeKey: 'leap:FIRST_INCOME_PLAN_NEEDED',
        payload: { takeHomePayMonthly: state.takeHomePayMonthly },
      })
    );
  }
  
  // 2) MONTH_CLOSED_REVIEW_INCOME_PLAN
  // Trigger: month boundary AND last month closed/settled AND income plan exists
  // For now, we'll use lastPaycheckISO as a proxy for month closed
  if (hasIncomePlan && signals.lastPaycheckISO) {
    raw.push(
      makeLeap('MONTH_CLOSED_REVIEW_INCOME_PLAN', state, signals, {
        originatingTrigger: 'month_closed',
        reasonCode: 'MONTHLY_REVIEW',
        dedupeKey: `leap:MONTH_CLOSED_REVIEW:${signals.lastPaycheckISO}`,
        payload: { lastPaycheckISO: signals.lastPaycheckISO },
      })
    );
  }
  
  // 3) INCOME_DRIFT_DETECTED
  // Trigger: month closed AND abs(actualSavings - plannedSavings) > driftThreshold
  const targetSavings = 20; // example threshold
  const driftThreshold = 5; // percentage points
  if (hasIncomePlan && Math.abs(state.savingsPercent - targetSavings) > driftThreshold) {
    raw.push(
      makeLeap('INCOME_DRIFT_DETECTED', state, signals, {
        originatingTrigger: 'savings_drift',
        reasonCode: 'INCOME_DRIFT',
        dedupeKey: 'leap:INCOME_DRIFT_DETECTED',
        payload: {
          savingsPercent: state.savingsPercent,
          targetSavingsPercent: targetSavings,
          drift: Math.abs(state.savingsPercent - targetSavings),
        },
      })
    );
  }

  // ─── Savings Stack ──────────────────────────────────────────────────────
  
  // 4) MISSING_EMPLOYER_MATCH (highest priority in savings stack)
  // Trigger: employer match available AND employee contrib < match threshold
  if (state.employerMatchEligible && !state.employerMatchMet) {
    raw.push(
      makeLeap('MISSING_EMPLOYER_MATCH', state, signals, {
        originatingTrigger: 'employer_match_eligible',
        reasonCode: 'FREE_MONEY',
        dedupeKey: 'leap:MISSING_EMPLOYER_MATCH',
        payload: { 
          takeHomePayMonthly: state.takeHomePayMonthly,
          employerMatchGapMonthly: state.employerMatchGapMonthly,
        },
      })
    );
  }
  
  // 5) EMERGENCY_FUND_GAP (with suppression via shouldShowEmergencyFundLeap)
  // Trigger: EF months < target AND user has capacity/reallocation room
  // SUPPRESSION: target met, on-track trajectory, or grace period
  if (state.emergencyFundMonths < state.emergencyFundTargetMonths) {
    const suppression = shouldShowEmergencyFundLeap(state);
    raw.push(
      makeLeap('EMERGENCY_FUND_GAP', state, signals, {
        originatingTrigger: 'emergency_fund_below_target',
        reasonCode: 'EF_GAP',
        dedupeKey: 'leap:EMERGENCY_FUND_GAP',
        payload: {
          emergencyFundMonths: state.emergencyFundMonths,
          emergencyFundTargetMonths: state.emergencyFundTargetMonths,
          efProgress: state.emergencyFundTargetMonths > 0
            ? state.emergencyFundMonths / state.emergencyFundTargetMonths
            : 0,
          ...suppression.debug,
          suppressedReason: suppression.suppressedReason,
        },
        suppressed: !suppression.show,
      })
    );
  }
  
  // 6) HSA_OPPORTUNITY
  // Trigger: HSA eligible AND contrib < max AND higher priority not blocking
  if (state.hsaEligible && !state.hsaContributing) {
    raw.push(
      makeLeap('HSA_OPPORTUNITY', state, signals, {
        originatingTrigger: 'hsa_eligible_not_contributing',
        reasonCode: 'TAX_ADVANTAGE',
        dedupeKey: 'leap:HSA_OPPORTUNITY',
      })
    );
  }
  
  // 7) HIGH_APR_DEBT_PRIORITY
  // Trigger: debt APR >= threshold AND balance > 0
  if (state.hasHighAprDebt) {
    raw.push(
      makeLeap('HIGH_APR_DEBT_PRIORITY', state, signals, {
        originatingTrigger: 'high_apr_debt_detected',
        reasonCode: 'HIGH_APR_DEBT',
        dedupeKey: 'leap:HIGH_APR_DEBT_PRIORITY',
        payload: { highAprDebtApr: state.highAprDebtApr },
      })
    );
  }

  // ─── Cash Optimization ──────────────────────────────────────────────────
  
  // 8) CASH_RISK_DETECTED — highest priority overall
  if (signals.cashRisk || state.cashBalance < state.safetyBufferTarget) {
    raw.push(
      makeLeap('CASH_RISK_DETECTED', state, signals, {
        originatingTrigger: 'cash_risk_signal',
        reasonCode: 'CASH_RISK',
        dedupeKey: 'leap:CASH_RISK_DETECTED',
        payload: {
          cashBalance: state.cashBalance,
          safetyBufferTarget: state.safetyBufferTarget,
        },
      })
    );
  }
  
  // 9) SURPLUS_CASH_AVAILABLE
  // Trigger: EF met AND no urgent stack issues AND surplus cash above threshold
  if (signals.surplusCash && state.cashBalance > state.safetyBufferTarget * 1.2) {
    const efMet = state.emergencyFundMonths >= state.emergencyFundTargetMonths;
    if (efMet) {
      raw.push(
        makeLeap('SURPLUS_CASH_AVAILABLE', state, signals, {
          originatingTrigger: 'surplus_cash_signal',
          reasonCode: 'SURPLUS',
          dedupeKey: 'leap:SURPLUS_CASH_AVAILABLE',
          payload: {
            cashBalance: state.cashBalance,
            safetyBufferTarget: state.safetyBufferTarget,
            surplusCashAmount: Math.round(state.cashBalance - state.safetyBufferTarget),
          },
        })
      );
    }
  }

  // ─── Legacy Triggers (backward compatibility) ───────────────────────────
  
  // Legacy: PAYCHECK_REBALANCE_AVAILABLE
  if (state.paycheckDetected && signals.lastPaycheckISO) {
    raw.push(
      makeLeap('PAYCHECK_REBALANCE_AVAILABLE', state, signals, {
        originatingTrigger: 'paycheck_detected',
        reasonCode: 'REBALANCE',
        dedupeKey: `leap:PAYCHECK_REBALANCE:${signals.lastPaycheckISO}`,
        payload: { lastPaycheckISO: signals.lastPaycheckISO },
      })
    );
  }
  
  // Legacy: SAVINGS_DRIFT_DETECTED
  if (state.savingsPercent < targetSavings && state.takeHomePayMonthly > 0) {
    raw.push(
      makeLeap('SAVINGS_DRIFT_DETECTED', state, signals, {
        originatingTrigger: 'savings_below_target',
        reasonCode: 'SAVINGS_DRIFT',
        dedupeKey: 'leap:SAVINGS_DRIFT_DETECTED',
        payload: {
          savingsPercent: state.savingsPercent,
          targetSavingsPercent: targetSavings,
        },
      })
    );
  }
  
  // Legacy: EMPLOYER_MATCH_NOT_MET — skip if we already added MISSING_EMPLOYER_MATCH
  const hasEmployerMatchLeap = raw.some((l) => l.leapType === 'MISSING_EMPLOYER_MATCH');
  if (!hasEmployerMatchLeap && state.employerMatchEligible && !state.employerMatchMet) {
    raw.push(
      makeLeap('EMPLOYER_MATCH_NOT_MET', state, signals, {
        originatingTrigger: 'employer_match_eligible',
        reasonCode: 'FREE_MONEY',
        dedupeKey: 'leap:EMPLOYER_MATCH_NOT_MET',
        payload: { takeHomePayMonthly: state.takeHomePayMonthly },
      })
    );
  }
  
  // Legacy: HSA_RECOMMENDATION_PENDING — skip if we already added HSA_OPPORTUNITY
  const hasHsaLeap = raw.some((l) => l.leapType === 'HSA_OPPORTUNITY');
  if (!hasHsaLeap && state.hsaEligible && !state.hsaContributing) {
    raw.push(
      makeLeap('HSA_RECOMMENDATION_PENDING', state, signals, {
        originatingTrigger: 'hsa_eligible_not_contributing',
        reasonCode: 'TAX_ADVANTAGE',
        dedupeKey: 'leap:HSA_RECOMMENDATION_PENDING',
      })
    );
  }
  
  // Legacy: HIGH_APR_DEBT_PRESENT — skip if we already added HIGH_APR_DEBT_PRIORITY
  const hasHighAprDebtLeap = raw.some((l) => l.leapType === 'HIGH_APR_DEBT_PRIORITY');
  if (!hasHighAprDebtLeap && state.hasHighAprDebt) {
    raw.push(
      makeLeap('HIGH_APR_DEBT_PRESENT', state, signals, {
        originatingTrigger: 'high_apr_debt_detected',
        reasonCode: 'HIGH_APR_DEBT',
        dedupeKey: 'leap:HIGH_APR_DEBT_PRESENT',
        payload: { highAprDebtApr: state.highAprDebtApr },
      })
    );
  }
  
  // Legacy: SURPLUS_CASH_DETECTED — skip if we already added SURPLUS_CASH_AVAILABLE
  const hasSurplusLeap = raw.some((l) => l.leapType === 'SURPLUS_CASH_AVAILABLE');
  if (!hasSurplusLeap && signals.surplusCash && state.cashBalance > state.safetyBufferTarget * 1.2) {
    raw.push(
      makeLeap('SURPLUS_CASH_DETECTED', state, signals, {
        originatingTrigger: 'surplus_cash_signal',
        reasonCode: 'SURPLUS',
        dedupeKey: 'leap:SURPLUS_CASH_DETECTED',
        payload: {
          cashBalance: state.cashBalance,
          safetyBufferTarget: state.safetyBufferTarget,
        },
      })
    );
  }

  // ─── Unimplemented Follow-ups ───────────────────────────────────────────
  
  const unimplementedToolByType: Record<string, OriginatingTool> = {
    FIRST_INCOME_PLAN_NEEDED: 'income',
    MONTH_CLOSED_REVIEW_INCOME_PLAN: 'income',
    INCOME_DRIFT_DETECTED: 'income',
    PAYCHECK_REBALANCE_AVAILABLE: 'income',
    SAVINGS_DRIFT_DETECTED: 'income',
    MISSING_EMPLOYER_MATCH: 'savings',
    EMPLOYER_MATCH_NOT_MET: 'savings',
    HSA_OPPORTUNITY: 'savings',
    HSA_RECOMMENDATION_PENDING: 'savings',
    EMERGENCY_FUND_GAP: 'savings',
    HIGH_APR_DEBT_PRIORITY: 'savings',
    HIGH_APR_DEBT_PRESENT: 'savings',
    SURPLUS_CASH_AVAILABLE: 'sweeper',
    SURPLUS_CASH_DETECTED: 'sweeper',
    CASH_RISK_DETECTED: 'sweeper',
  };
  const unimplementedInsightByType: Record<string, string> = {
    FIRST_INCOME_PLAN_NEEDED: SIDEKICK_INSIGHT_IDS.PAYCHECK_ADAPTATION,
    MONTH_CLOSED_REVIEW_INCOME_PLAN: SIDEKICK_INSIGHT_IDS.PAYCHECK_ADAPTATION,
    INCOME_DRIFT_DETECTED: SIDEKICK_INSIGHT_IDS.NEEDS_VS_WANTS_CLARITY,
    PAYCHECK_REBALANCE_AVAILABLE: SIDEKICK_INSIGHT_IDS.PAYCHECK_ADAPTATION,
    SAVINGS_DRIFT_DETECTED: SIDEKICK_INSIGHT_IDS.NEEDS_VS_WANTS_CLARITY,
    MISSING_EMPLOYER_MATCH: SIDEKICK_INSIGHT_IDS.EMPLOYER_MATCH_FREE_MONEY,
    EMPLOYER_MATCH_NOT_MET: SIDEKICK_INSIGHT_IDS.EMPLOYER_MATCH_FREE_MONEY,
    HSA_OPPORTUNITY: SIDEKICK_INSIGHT_IDS.HSA_TAX_ADVANTAGE,
    HSA_RECOMMENDATION_PENDING: SIDEKICK_INSIGHT_IDS.HSA_TAX_ADVANTAGE,
    EMERGENCY_FUND_GAP: SIDEKICK_INSIGHT_IDS.EMERGENCY_FUND_FREEDOM,
    HIGH_APR_DEBT_PRIORITY: SIDEKICK_INSIGHT_IDS.SAVINGS_STACK_ORDER,
    HIGH_APR_DEBT_PRESENT: SIDEKICK_INSIGHT_IDS.SAVINGS_STACK_ORDER,
    SURPLUS_CASH_AVAILABLE: SIDEKICK_INSIGHT_IDS.SMALL_MOVES_BIG_IMPACT,
    SURPLUS_CASH_DETECTED: SIDEKICK_INSIGHT_IDS.SMALL_MOVES_BIG_IMPACT,
    CASH_RISK_DETECTED: SIDEKICK_INSIGHT_IDS.EMERGENCY_FUND_FREEDOM,
  };
  state.unimplementedLeaps.forEach((entry: UnimplementedLeapEntry) => {
    const tool = unimplementedToolByType[entry.leapType] ?? 'sidekick';
    const insight = unimplementedInsightByType[entry.leapType];
    raw.push(
      makeLeap('UNIMPLEMENTED_RECOMMENDATION', state, signals, {
        originatingTrigger: 'unimplemented_follow_up',
        reasonCode: 'FOLLOW_UP',
        dedupeKey: `leap:UNIMPLEMENTED:${entry.dedupeKey}`,
        originatingTool: tool,
        sidekickInsightId: insight as Leap['sidekickInsightId'],
        payload: {
          originalLeapType: entry.leapType,
          lastSurfacedAt: entry.lastSurfacedAt,
          timesIgnored: entry.timesIgnored,
        },
        fromUnimplementedFollowUp: true,
      })
    );
  });

  // Dedupe: same dedupeKey → keep higher priorityScore
  const byKey = new Map<string, Leap>();
  for (const leap of raw) {
    const existing = byKey.get(leap.dedupeKey);
    if (!existing || leap.priorityScore > existing.priorityScore) {
      byKey.set(leap.dedupeKey, leap);
    }
  }

  const candidates = Array.from(byKey.values());
  candidates.sort((a, b) => b.priorityScore - a.priorityScore); // highest first
  return candidates;
}
