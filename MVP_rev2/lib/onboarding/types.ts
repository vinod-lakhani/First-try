/**
 * Onboarding Types
 * 
 * Shared types for the WeLeap onboarding flow.
 * These types represent the user state needed for the allocation engines.
 */

/**
 * Pay frequency options
 */
export type PayFrequency = 
  | "weekly"
  | "biweekly"
  | "semimonthly"
  | "monthly";

/**
 * Income state
 */
export interface IncomeState {
  /** Gross income per pay period */
  grossIncome$: number;
  /** Net income per pay period (after taxes/deductions) */
  netIncome$: number;
  /** Pay frequency */
  payFrequency: PayFrequency;
  /** Annual salary (for calculations) */
  annualSalary$?: number;
  /** Single filer income (for tax calculations) */
  incomeSingle$?: number;
}

/**
 * Fixed expense (bills, subscriptions, etc.)
 */
export interface FixedExpense {
  id: string;
  name: string;
  amount$: number;
  frequency: PayFrequency | "monthly" | "yearly";
  category?: "needs" | "wants";
  /** Whether this is a subscription */
  isSubscription?: boolean;
  /** Next due date (optional) */
  nextDueDate?: string; // ISO date
}

/**
 * Debt information
 */
export interface Debt {
  id: string;
  name: string;
  balance$: number;
  aprPct: number;
  minPayment$: number;
  /** Whether this is high-APR debt (>10%) */
  isHighApr?: boolean;
  /** Account type (credit card, loan, etc.) */
  type?: string;
}

/**
 * Asset information
 */
export interface Asset {
  id: string;
  name: string;
  value$: number;
  type: "cash" | "brokerage" | "retirement" | "hsa" | "other";
  /** Account name or identifier */
  accountName?: string;
}

/**
 * Primary goal selection
 */
export type PrimaryGoal =
  | "emergency-fund"
  | "debt-free"
  | "retirement"
  | "house-down-payment"
  | "other";

/**
 * Goal details
 */
export interface Goal {
  id: string;
  type: PrimaryGoal;
  name: string;
  targetAmount$?: number;
  targetDate?: string; // ISO date
  priority: number;
  /** Custom description for "other" goals */
  description?: string;
}

/**
 * Payroll contribution preferences
 */
export interface PayrollContributions {
  // 401(k) / Retirement Plan
  /** Whether user has a retirement plan through work */
  has401k?: boolean;
  /** Whether employer matches contributions */
  hasEmployerMatch?: "yes" | "no" | "not_sure";
  /** Employer match percentage (0-100) */
  employerMatchPct?: number | null;
  /** Employer match cap as % of pay (0-15) */
  employerMatchCapPct?: number | null;
  /** Whether currently contributing to 401k */
  currentlyContributing401k?: "yes" | "no";
  /** Contribution type: percent of gross or dollar amount */
  contributionType401k?: "percent_gross" | "amount" | null;
  /** Contribution value (percentage 0-50 or dollar amount) */
  contributionValue401k?: number | null;
  /** Contribution frequency (only if contributionType401k=amount) */
  contributionFrequency401k?: "per_paycheck" | "per_month" | null;
  
  // HSA
  /** Whether user has an HSA */
  hasHSA?: boolean;
  /** Whether user is eligible for HSA (has HDHP) */
  hsaEligible?: boolean;
  /** HSA coverage type: self, family, or unknown */
  hsaCoverageType?: "self" | "family" | "unknown";
  /** Whether currently contributing to HSA */
  currentlyContributingHSA?: "yes" | "no";
  /** HSA contribution type: percent of gross or dollar amount */
  contributionTypeHSA?: "percent_gross" | "amount" | null;
  /** HSA contribution value (percentage 0-50 or dollar amount) */
  contributionValueHSA?: number | null;
  /** HSA contribution frequency (only if contributionTypeHSA=amount) */
  contributionFrequencyHSA?: "per_paycheck" | "per_month" | null;
  /** Whether employer contributes to HSA */
  employerHSAContribution?: "yes" | "no" | "not_sure";
  /** Employer HSA contribution amount per month (if employer contributes) */
  employerHSAAmount$?: number | null;
  /** How Sidekick should treat HSA */
  hsaIntent?: "medical" | "investing" | "decide";
  
  // Emergency Fund
  /** Emergency fund target in months (3, 4, 5, or 6+) */
  emergencyFundMonths?: 3 | 4 | 5 | 6;
  
  // Retirement Preference
  /** Retirement account preference */
  retirementPreference?: "roth" | "traditional" | "decide";
}

/**
 * Safety and strategy preferences
 */
export interface SafetyStrategy {
  /** Emergency fund target (in months of expenses) */
  efTargetMonths: number;
  /** Current emergency fund balance */
  efBalance$: number;
  /** Liquidity need level */
  liquidity: "High" | "Medium" | "Low";
  /** Retirement focus level */
  retirementFocus: "High" | "Medium" | "Low";
  /** Whether user is on Income-Driven Repayment for student loans */
  onIDR: boolean;
  /** Debt payoff strategy */
  debtPayoffStrategy?: "avalanche" | "snowball" | "minimum_only";
  /** 401(k) employer match per month (dollars needed to capture full match) */
  match401kPerMonth$?: number;
  /** Remaining IRA contribution room this year */
  iraRoomThisYear$?: number;
  /** Remaining 401(k) contribution room this year (beyond match) */
  k401RoomThisYear$?: number;
  /** Custom savings allocation (monthly amounts) - overrides engine calculation if set */
  customSavingsAllocation?: {
    ef$: number;
    highAprDebt$: number;
    match401k$: number;
    /** Employee HSA (pre-tax) monthly */
    hsa$?: number;
    retirementTaxAdv$: number;
    brokerage$: number;
  };
}

/**
 * Risk and constraints
 */
export interface RiskConstraints {
  /** Shift limit percentage (max % of income that can shift from Wants to Savings) */
  shiftLimitPct: number;
  /** Target percentages for Needs/Wants/Savings */
  targets: {
    needsPct: number;
    wantsPct: number;
    savingsPct: number;
  };
  /** 3-month average actual percentages (if available) */
  actuals3m?: {
    needsPct: number;
    wantsPct: number;
    savingsPct: number;
  };
  /** Investment return assumptions */
  assumptions?: {
    cashYieldPct?: number;
    nominalReturnPct?: number;
    taxDragBrokeragePct?: number;
    inflationRatePct?: number;
  };
  /** Risk score (1-5) */
  riskScore1to5?: number;
  /** Dominant time horizon */
  dominantTimeHorizon?: "short" | "medium" | "long";
  /** Minimum checking buffer in dollars */
  minCheckingBuffer$?: number;
  /** Minimum cash percentage (0-100) */
  minCashPct?: number;
  /** If true, bypass the minimum wants floor (25%) to allow manual slider overrides */
  bypassWantsFloor?: boolean;
}

/**
 * Pulse preferences (notifications/updates)
 */
export interface PulsePreferences {
  /** Opt-in to pulse notifications */
  enabled: boolean;
  /** Frequency of updates */
  frequency?: "daily" | "weekly" | "monthly";
  /** Preferred channels */
  channels?: ("email" | "push" | "sms")[];
}

/**
 * Paycheck plan category
 */
export interface PaycheckPlanCategory {
  name: string;
  amount$: number;
  percentage?: number;
  color?: string;
}

/**
 * Paycheck plan (allocated amounts per paycheck)
 */
export interface PaycheckPlan {
  /** Needs allocation */
  needs$: number;
  /** Wants allocation */
  wants$: number;
  /** Savings allocation */
  savings$: number;
  /** Breakdown of savings allocation */
  savingsBreakdown?: {
    ef$: number;
    debt$: number;
    match401k$: number;
    retirement$: number;
    brokerage$: number;
  };
  /** Categories for visualization */
  categories?: PaycheckPlanCategory[];
  /** Notes about the plan */
  notes?: string[];
}

/**
 * Complete onboarding state
 */
export interface OnboardingState {
  // Phase 1: Core setup
  /** Current step in onboarding */
  currentStep: string;
  /** Whether onboarding is complete */
  isComplete: boolean;
  
  // Income
  income?: IncomeState;
  
  // Plaid connection
  /** Whether Plaid is connected */
  plaidConnected: boolean;
  /** Plaid access token (if connected) */
  plaidAccessToken?: string;
  /** Last sync date */
  lastSyncDate?: string;
  
  // Snapshot (from Plaid or manual)
  /** Fixed expenses */
  fixedExpenses: FixedExpense[];
  /** Debts */
  debts: Debt[];
  /** Assets */
  assets: Asset[];
  
  // Goals
  /** Primary goal */
  primaryGoal?: PrimaryGoal;
  /** All goals */
  goals: Goal[];
  
  // Strategy
  /** Payroll contribution preferences */
  payrollContributions?: PayrollContributions;
  /** Safety and strategy preferences */
  safetyStrategy?: SafetyStrategy;
  /** Risk and constraints */
  riskConstraints?: RiskConstraints;
  
  // Plans
  /** Initial paycheck plan (baseline) */
  initialPaycheckPlan?: PaycheckPlan;
  /** Boosted paycheck plan (optimized) */
  boostedPaycheckPlan?: PaycheckPlan;
  
  // Net worth projections
  /** Baseline net worth projection */
  baselineNetWorth?: {
    netWorthAtYears: Record<number, number>;
    cagrNominal?: number;
    debtFreeMonth?: number;
    efReachedMonth?: number;
  };
  /** Projected net worth (with optimizations) */
  projectedNetWorth?: {
    netWorthAtYears: Record<number, number>;
    cagrNominal?: number;
    debtFreeMonth?: number;
    efReachedMonth?: number;
  };
  
  // Snapshot metadata
  /** Money persona (e.g., "The Overloaded Juggler") */
  moneyPersona?: string;
  
  // Pulse
  /** Pulse preferences */
  pulsePreferences?: PulsePreferences;
  
  // Metadata
  /** When onboarding was started */
  startedAt?: string;
  /** When onboarding was completed */
  completedAt?: string;
}

