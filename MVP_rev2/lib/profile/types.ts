/**
 * Profile & Settings Types
 * 
 * Data types for the Profile & Settings page.
 */

export interface ProfileOnboardingStatus {
  status: "complete" | "in_progress" | "not_started";
  completedAt?: string; // ISO date
}

export interface PersonalLifeStage {
  ageRange: string; // e.g. "26-30"
  employmentType: "student" | "full_time" | "part_time" | "contractor" | "self_employed" | "other";
  householdStatus: "single" | "couple" | "family" | "other";
  location: string; // city, state
}

export interface IncomeHousingProfile {
  monthlyNetIncome$: number;
  incomeSource: "salary" | "hourly" | "gig" | "mixed" | "other";
  rentOrHousing$: number;
  otherFixedNeeds$: number;
}

export interface FinancialConnectionSummary {
  institutionName: string;
  status: "connected" | "needs_attention";
  lastSyncAt?: string;
}

export interface GoalSettings {
  emergencyFundEnabled: boolean;
  emergencyFundMonths: 3 | 6 | 9;
  highInterestDebtEnabled: boolean;
  debtStrategy: "avalanche" | "snowball";
  retirementEnabled: boolean;
  retirementFocus: "low" | "medium" | "high";
  bigPurchaseEnabled: boolean;
  liquidityNeed: "low" | "medium" | "high";
}

export interface PlanSettings {
  savingsTargetPct: number; // 0-1 (e.g., 0.20 = 20%)
  changeAggressiveness: "gentle" | "balanced" | "aggressive";
  wantsFloorPct: number; // 0-1 (e.g., 0.15 = 15%)
}

export interface NotificationSettings {
  channels: { email: boolean; sms: boolean; push: boolean };
  types: {
    criticalAlerts: boolean;
    savingsProgress: boolean;
    opportunities: boolean;
    education: boolean;
  };
  frequency: "important_only" | "weekly" | "frequent";
  quietHours?: { start: string; end: string }; // "21:00", "08:00"
}

export interface RiskPreferences {
  riskComfort: "conservative" | "balanced" | "growth";
  mainHorizon: "short" | "medium" | "long"; // <5, 5-15, 15+
  cryptoStance?: "avoid" | "ok" | "friendly";
}

export interface SecurityDataSettings {
  email: string;
  twoFAEnabled: boolean;
  allowAnonymizedUsage: boolean;
}

export interface ProfilePageData {
  onboarding: ProfileOnboardingStatus;
  personal: PersonalLifeStage;
  incomeHousing: IncomeHousingProfile;
  connections: FinancialConnectionSummary[];
  goals: GoalSettings;
  plan: PlanSettings;
  notifications: NotificationSettings;
  risk: RiskPreferences;
  security: SecurityDataSettings;
}

