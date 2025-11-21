/**
 * Build Profile Data
 * 
 * Derives profile page data from onboarding store.
 */

import type { OnboardingState } from '@/lib/onboarding/types';
import type {
  ProfilePageData,
  PersonalLifeStage,
  IncomeHousingProfile,
  FinancialConnectionSummary,
  GoalSettings,
  PlanSettings,
  NotificationSettings,
  RiskPreferences,
  SecurityDataSettings,
} from './types';

function getPaychecksPerMonth(frequency: string): number {
  switch (frequency) {
    case 'weekly': return 4.33;
    case 'biweekly': return 2.17;
    case 'semimonthly': return 2;
    case 'monthly': return 1;
    default: return 2.17;
  }
}

export function buildProfileData(state: OnboardingState, userEmail: string = 'user@example.com'): ProfilePageData {
  // Onboarding Status
  const onboardingStatus = state.isComplete
    ? "complete"
    : state.currentStep && state.currentStep !== 'welcome'
    ? "in_progress"
    : "not_started";

  // Personal & Life Stage (default values - would be stored/collected separately)
  const personal: PersonalLifeStage = {
    ageRange: "26-30", // Default - would come from user profile
    employmentType: "full_time", // Default
    householdStatus: "single", // Default
    location: "San Francisco, CA", // Default
  };

  // Income & Housing
  const paychecksPerMonth = state.income ? getPaychecksPerMonth(state.income.payFrequency || 'biweekly') : 1;
  const monthlyNetIncome = state.income ? (state.income.netIncome$ || state.income.grossIncome$ || 0) * paychecksPerMonth : 0;
  
  // Get rent from fixed expenses
  const rentExpense = state.fixedExpenses.find(e => e.name.toLowerCase().includes('rent') || e.category === 'needs');
  const rentOrHousing = rentExpense?.amount$ || 0;
  
  // Calculate other fixed needs (excluding rent)
  const otherFixedNeeds = state.fixedExpenses
    .filter(e => e.category === 'needs' && !e.name.toLowerCase().includes('rent'))
    .reduce((sum, e) => sum + e.amount$, 0);

  const incomeHousing: IncomeHousingProfile = {
    monthlyNetIncome$: monthlyNetIncome,
    incomeSource: "salary", // Default - could be derived or stored separately
    rentOrHousing$: rentOrHousing,
    otherFixedNeeds$: otherFixedNeeds,
  };

  // Financial Connections
  const connections: FinancialConnectionSummary[] = [];
  if (state.plaidConnected) {
    connections.push({
      institutionName: "Connected Bank",
      status: "connected",
      lastSyncAt: state.lastSyncDate,
    });
  }

  // Goals & Priorities
  const safetyStrategy = state.safetyStrategy || {};
  const hasHighAprDebt = state.debts.some(d => d.isHighApr || d.aprPct > 10);
  
  const goals: GoalSettings = {
    emergencyFundEnabled: true, // Always enabled
    emergencyFundMonths: (safetyStrategy.efTargetMonths || 3) as 3 | 6 | 9,
    highInterestDebtEnabled: hasHighAprDebt,
    debtStrategy: safetyStrategy.debtPayoffStrategy === 'snowball' ? 'snowball' : 'avalanche',
    retirementEnabled: true,
    retirementFocus: (safetyStrategy.retirementFocus?.toLowerCase() || 'medium') as "low" | "medium" | "high",
    bigPurchaseEnabled: false, // Would be determined from goals
    liquidityNeed: (safetyStrategy.liquidity?.toLowerCase() || 'medium') as "low" | "medium" | "high",
  };

  // Plan Settings
  const riskConstraints = state.riskConstraints || {};
  const savingsTargetPct = riskConstraints.targets?.savingsPct || 0.20;
  const shiftLimitPct = riskConstraints.shiftLimitPct || 0.04;
  
  let changeAggressiveness: "gentle" | "balanced" | "aggressive" = "balanced";
  if (shiftLimitPct <= 0.02) changeAggressiveness = "gentle";
  else if (shiftLimitPct >= 0.06) changeAggressiveness = "aggressive";
  
  const wantsFloorPct = riskConstraints.targets?.wantsPct || 0.30;

  const plan: PlanSettings = {
    savingsTargetPct,
    changeAggressiveness,
    wantsFloorPct,
  };

  // Notifications & Nudges
  const pulsePreferences = state.pulsePreferences || {};
  const notifications: NotificationSettings = {
    channels: {
      email: pulsePreferences.channels?.includes('email') || false,
      sms: pulsePreferences.channels?.includes('sms') || false,
      push: pulsePreferences.channels?.includes('push') || false,
    },
    types: {
      criticalAlerts: true, // Always on
      savingsProgress: true,
      opportunities: true,
      education: false,
    },
    frequency: pulsePreferences.frequency === 'daily' ? 'frequent' : pulsePreferences.frequency === 'weekly' ? 'weekly' : 'important_only',
  };

  // Investment & Risk Preferences
  const riskScore = riskConstraints.riskScore1to5 || 3;
  const dominantHorizon = riskConstraints.dominantTimeHorizon || 'medium';
  
  let riskComfort: "conservative" | "balanced" | "growth" = "balanced";
  if (riskScore <= 2) riskComfort = "conservative";
  else if (riskScore >= 4) riskComfort = "growth";

  const risk: RiskPreferences = {
    riskComfort,
    mainHorizon: dominantHorizon as "short" | "medium" | "long",
    cryptoStance: "avoid", // Default
  };

  // Security & Data
  const security: SecurityDataSettings = {
    email: userEmail,
    twoFAEnabled: false, // Default
    allowAnonymizedUsage: false, // Default
  };

  return {
    onboarding: {
      status: onboardingStatus,
      completedAt: state.completedAt,
    },
    personal,
    incomeHousing,
    connections,
    goals,
    plan,
    notifications,
    risk,
    security,
  };
}

