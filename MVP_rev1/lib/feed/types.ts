/**
 * Feed Card Types and Data Models
 * 
 * Defines the structure for feed cards that appear in the Feed page.
 */

export type FeedCardType =
  | "pulse"
  | "alert_savings_gap"
  | "alert_debt_high_apr"
  | "alert_cashflow_risk"
  | "action_income_shift"
  | "action_savings_rate"
  | "action_savings_allocation"
  | "opp_rent_optimizer"
  | "opp_savings_allocator"
  | "opp_side_income"
  | "progress_ef"
  | "progress_debt"
  | "progress_savings_streak"
  | "education"
  | "weekly_summary"
  | "seasonal"
  | "notification"
  | "alert"
  | "recommendation"
  | "informational";

export interface FeedCardBase {
  id: string;
  type: FeedCardType;
  priority: number; // 1 = highest, 5 = lowest
  createdAt: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaAction?: {
    kind: "open_view" | "open_optimizer" | "apply_plan" | "show_education";
    payload?: any;
  };
}

// Specific card metadata types
export interface PulseCardMetadata {
  needsPct: number;
  wantsPct: number;
  savingsPct: number;
  targetNeedsPct: number;
  targetWantsPct: number;
  targetSavingsPct: number;
  savingsDelta$: number; // actual - target
  monthlyIncome$: number;
}

export interface AlertSavingsGapMetadata {
  actualSavingsPct: number;
  targetSavingsPct: number;
  gapPct: number; // percentage points
  suggestedShiftPct: number;
  monthlyImpact$: number;
}

export interface AlertDebtHighAprMetadata {
  debtName: string;
  apr: number;
  monthlyInterest$: number;
  suggestedExtraPayment$: number;
  monthsToPayoff: number;
  interestSaved$: number;
}

export interface AlertCashflowRiskMetadata {
  projectedLowBalance$: number;
  projectedLowDate: string;
  upcomingBills$: number;
}

export interface ActionIncomeShiftMetadata {
  fromCategory: "wants" | "needs";
  toCategory: "savings";
  shiftPct: number;
  monthlyImpact$: number;
}

export interface ActionSavingsRateMetadata {
  currentRate: number;
  suggestedRate: number;
  monthlyIncrease$: number;
  netWorthImpact20yr$: number;
}

export interface ActionSavingsAllocationMetadata {
  fromCategory: string;
  toCategory: string;
  amount$: number;
  currentProgressPct: number;
  newProgressPct: number;
}

export interface OppRentOptimizerMetadata {
  currentRent$: number;
  suggestedRent$: number;
  monthlySavings$: number;
  netWorthImpact20yr$: number;
}

export interface OppSavingsAllocatorMetadata {
  currentAllocation: string;
  suggestedShift$: number;
  benefit: string;
}

export interface OppSideIncomeMetadata {
  sideIncome$: number;
  netWorthImpact20yr$: number;
}

export interface ProgressEfMetadata {
  current$: number;
  target$: number;
  progressPct: number;
  monthsToTarget: number;
  monthlyContribution$: number;
}

export interface ProgressDebtMetadata {
  debtName: string;
  paidThisMonth$: number;
  remainingBalance$: number;
  monthsToPayoff: number;
}

export interface ProgressSavingsStreakMetadata {
  streakMonths: number;
  targetMet: boolean;
}

export interface EducationMetadata {
  topic: string;
  explanation: string;
}

export interface WeeklySummaryMetadata {
  weekDate: string;
  wantsUnderBudgetPct: number;
  savingsTargetMet: boolean;
}

export interface SeasonalMetadata {
  event: string;
  date: string;
  impact: string;
}

export interface NotificationMetadata {
  category: string;
  timestamp: string;
}

export interface AlertMetadata {
  severity: "high" | "medium";
  category: string;
}

export interface RecommendationMetadata {
  category: string;
  impact?: string;
}

export interface InformationalMetadata {
  topic: string;
  category: string;
}

// Union type for all card metadata
export type FeedCardMetadata =
  | PulseCardMetadata
  | AlertSavingsGapMetadata
  | AlertDebtHighAprMetadata
  | AlertCashflowRiskMetadata
  | ActionIncomeShiftMetadata
  | ActionSavingsRateMetadata
  | ActionSavingsAllocationMetadata
  | OppRentOptimizerMetadata
  | OppSavingsAllocatorMetadata
  | OppSideIncomeMetadata
  | ProgressEfMetadata
  | ProgressDebtMetadata
  | ProgressSavingsStreakMetadata
  | EducationMetadata
  | WeeklySummaryMetadata
  | SeasonalMetadata
  | NotificationMetadata
  | AlertMetadata
  | RecommendationMetadata
  | InformationalMetadata;

export interface FeedCard extends FeedCardBase {
  metadata?: FeedCardMetadata;
}

/**
 * User snapshot input for building feed cards
 */
export interface UserSnapshot {
  // Income allocation
  monthlyIncome$: number;
  needsPct: number;
  wantsPct: number;
  savingsPct: number;
  targetNeedsPct: number;
  targetWantsPct: number;
  targetSavingsPct: number;
  
  // Savings allocation
  efCurrent$: number;
  efTarget$: number;
  efMonthly$: number;
  highAprDebt$: number;
  match401k$: number;
  retirementTaxAdv$: number;
  brokerage$: number;
  
  // Debts
  highAprDebts: Array<{
    name: string;
    balance$: number;
    apr: number;
    minPayment$: number;
    monthlyInterest$: number;
  }>;
  
  // Cash flow
  currentBalance$: number;
  upcomingBills$: number;
  
  // Goals
  goals: Array<{
    id: string;
    label: string;
    progressPct: number;
  }>;
  
  // Savings streak
  savingsStreakMonths?: number;
}

/**
 * Transaction and Activity Types
 */

export type AccountKind = 'bank' | 'credit_card';

export interface FeedTransaction {
  id: string;
  accountKind: AccountKind;
  accountName: string;
  merchant: string;
  amount$: number; // positive for credits/income, negative for debits/spending
  date: string; // ISO date string
  category?: string;
}

export interface TransactionsSection {
  bankTransactions: FeedTransaction[];
  creditCardTransactions: FeedTransaction[];
}

