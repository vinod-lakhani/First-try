/**
 * Ribbit context types for onboarding screens
 */

export type BaseRibbitContext = {
  screen: "income" | "savings" | "plan";
  userName?: string;
  onboardingStage: "welcome" | "connect" | "income" | "savings" | "plan";
  hasLinkedAccounts: boolean;
  source: "estimated_from_income" | "linked_accounts" | "mixed";
};

export type IncomeScreenContext = BaseRibbitContext & {
  screen: "income";
  monthlyIncome: number;
  needsAmount: number;
  needsPct: number;
  wantsAmount: number;
  wantsPct: number;
  savingsAmount: number;
  savingsPct: number;
  modelName: string;
};

export type SavingsBucket = {
  label: "cash" | "retirement" | "investment";
  amount: number;
  pct: number;
  description: string;
};

export type SavingsScreenContext = BaseRibbitContext & {
  screen: "savings";
  monthlySavings: number;
  allocationModelName: string;
  buckets: SavingsBucket[];
  note?: string;
};

export type PlanMilestones = {
  oneYear: number;
  fiveYears: number;
  tenYears: number;
};

export type PlanScreenContext = BaseRibbitContext & {
  screen: "plan";
  monthlySavings: number;
  projectedNetWorth30Y: number;
  horizonYears: number;
  milestones: PlanMilestones;
  projectionAssumptionsLabel: string;
};

export type RibbitScreenContext =
  | IncomeScreenContext
  | SavingsScreenContext
  | PlanScreenContext;
