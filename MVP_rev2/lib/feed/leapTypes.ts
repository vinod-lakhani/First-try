/**
 * Feed Logic — Leap data model, state, signals, and Sidekick Insight IDs.
 * Phase 1: Candidate Leaps for validation and ranking.
 */

// ─── Leap Type (recommendation kind) ───────────────────────────────────────
export type LeapType =
  // Income lifecycle
  | 'FIRST_INCOME_PLAN_NEEDED'
  | 'MONTH_CLOSED_REVIEW_INCOME_PLAN'
  | 'INCOME_DRIFT_DETECTED'
  // Legacy income (kept for compatibility)
  | 'PAYCHECK_REBALANCE_AVAILABLE'
  | 'SAVINGS_DRIFT_DETECTED'
  // Savings stack
  | 'MISSING_EMPLOYER_MATCH'
  | 'EMERGENCY_FUND_GAP'
  | 'HSA_OPPORTUNITY'
  | 'HIGH_APR_DEBT_PRIORITY'
  // Legacy savings (kept for compatibility)
  | 'EMPLOYER_MATCH_NOT_MET'
  | 'HSA_RECOMMENDATION_PENDING'
  | 'HIGH_APR_DEBT_PRESENT'
  // Cash optimization
  | 'SURPLUS_CASH_AVAILABLE'
  | 'CASH_RISK_DETECTED'
  // Legacy cash (kept for compatibility)
  | 'SURPLUS_CASH_DETECTED'
  // Meta
  | 'UNIMPLEMENTED_RECOMMENDATION';

// ─── Originating Tool ──────────────────────────────────────────────────────
export type OriginatingTool = 'income' | 'savings' | 'sweeper' | 'sidekick';

// ─── Leap State (lifecycle) ─────────────────────────────────────────────────
export type LeapState =
  | 'new'
  | 'surfaced'
  | 'opened'
  | 'proposed'
  | 'confirmed'
  | 'applied'
  | 'completed'
  | 'dismissed'
  | 'snoozed';

// ─── Sidekick Insight IDs (Phase 1) ─────────────────────────────────────────
export const SIDEKICK_INSIGHT_IDS = {
  SAVINGS_STACK_ORDER: 'savings-stack-order',
  EMERGENCY_FUND_FREEDOM: 'emergency-fund-freedom',
  PAYCHECK_ADAPTATION: 'paycheck-adaptation',
  START_RETIREMENT_EARLY: 'start-retirement-early',
  NEEDS_VS_WANTS_CLARITY: 'needs-vs-wants-clarity',
  SMALL_MOVES_BIG_IMPACT: 'small-moves-big-impact',
  EMPLOYER_MATCH_FREE_MONEY: 'employer-match-free-money',
  HSA_TAX_ADVANTAGE: 'hsa-tax-advantage',
} as const;

export type SidekickInsightId = (typeof SIDEKICK_INSIGHT_IDS)[keyof typeof SIDEKICK_INSIGHT_IDS];

// ─── Preview metric (one benefit line per Leap; deterministic, rounded) ──────
export type LeapPreviewMetric = {
  label: string; // e.g. "Free money", "Status", "Delta"
  value: string; // e.g. "$333/mo", "2 months", "+$85/mo"
  isEstimate?: boolean; // if true, show "~" or "est."
  source?: 'feed' | 'income_logic' | 'eligibility_math';
};

// ─── Benefit Preview (1-2 user-facing fields) ──────────────────────────────
export interface BenefitPreview {
  label: string;
  value: string;
}

// ─── CTA Action Types ──────────────────────────────────────────────────────
export type CtaActionType = 'OPEN_TOOL' | 'OPEN_SIDEKICK' | 'APPLY';

export interface PrimaryCta {
  label: string;
  actionType: CtaActionType;
  route?: string;
  toolParams?: Record<string, unknown>;
}

export interface SecondaryCta {
  label: string;
  actionType: CtaActionType;
  route?: string;
}

// ─── Debug Information ─────────────────────────────────────────────────────
export interface LeapDebug {
  score: number;
  reasonCode: string;
  payload: Record<string, unknown>;
  dedupeKey: string;
}

// ─── Leap (recommendation object) ───────────────────────────────────────────
export interface Leap {
  // Core identity
  id: string;
  leapType: LeapType;
  
  // User-facing content
  title: string;
  subtitle: string;
  tool: 'income' | 'savings' | 'sweeper' | 'sidekick';
  benefitPreview?: BenefitPreview;
  
  // Actions
  primaryCta: PrimaryCta;
  secondaryCtas?: SecondaryCta[];
  
  // Debug (never shown in User View)
  debug: LeapDebug;
  
  // Legacy fields (for backward compatibility during migration)
  /** @deprecated Use id instead */
  leapId: string;
  /** @deprecated Use tool instead */
  originatingTool: OriginatingTool;
  /** @deprecated Use debug.score instead */
  priorityScore: number;
  /** @deprecated Use debug.reasonCode instead */
  reasonCode: string;
  /** @deprecated Use debug.payload instead */
  payload: Record<string, unknown>;
  /** @deprecated Use debug.dedupeKey instead */
  dedupeKey: string;
  
  // Metadata
  originatingTrigger: string;
  sidekickInsightId?: SidekickInsightId;
  state: LeapState;
  cooldownUntil?: string; // ISO
  /** True when this Leap was generated from unimplementedLeaps follow-up */
  fromUnimplementedFollowUp?: boolean;
  /** Single lightweight benefit metric for Feed/Sidekick; do not show net worth or multi-year projections */
  previewMetric?: LeapPreviewMetric | null;
  /** True when leap is suppressed (e.g. EF on-track). Show only in Debug View with suppression metadata. */
  suppressed?: boolean;
}

// ─── User Financial State (minimal, mockable) ─────────────────────────────────
export interface UserFinancialState {
  takeHomePayMonthly: number;
  paycheckDetected: boolean;
  needsPercent: number;
  wantsPercent: number;
  savingsPercent: number;
  cashBalance: number;
  safetyBufferTarget: number;
  emergencyFundMonths: number;
  emergencyFundTargetMonths: number;
  hasHighAprDebt: boolean;
  highAprDebtApr?: number;
  employerMatchEligible: boolean;
  employerMatchMet: boolean;
  hsaEligible: boolean;
  hsaContributing: boolean;
  unimplementedLeaps: UnimplementedLeapEntry[];
  /** Max employer match left on the table per month (when eligible and not met); for EMPLOYER_MATCH_NOT_MET */
  employerMatchGapMonthly?: number;
  /** EF monthly contribution from applied savings plan (post-tax EF allocation). Used for EF on-track suppression. */
  appliedPlanEfMonthly?: number;
  /** Timestamp when savings plan was last applied (ISO). Used for grace-period suppression. */
  savingsPlanAppliedAt?: string;
}

export interface UnimplementedLeapEntry {
  dedupeKey: string;
  leapType: string;
  lastSurfacedAt: string; // ISO
  timesIgnored: number;
}

// ─── Trigger Signals ────────────────────────────────────────────────────────
export interface TriggerSignals {
  nowISO: string;
  lastPaycheckISO?: string;
  cashRisk: boolean;
  surplusCash: boolean;
}

// ─── Scenario (named preset for simulator) ───────────────────────────────────
export interface FeedScenario {
  id: string;
  label: string;
  state: UserFinancialState;
  signals: TriggerSignals;
}
