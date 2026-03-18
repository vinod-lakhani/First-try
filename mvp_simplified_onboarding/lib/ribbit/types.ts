/**
 * Ribbit context types for onboarding screens
 */

export type BaseRibbitContext = {
  screen: "income" | "savings" | "plan" | "adjust-plan" | "savings-allocation";
  userName?: string;
  onboardingStage: "welcome" | "connect" | "income" | "savings" | "plan";
  hasLinkedAccounts: boolean;
  source: "estimated_from_income" | "linked_accounts" | "mixed";
};

export type AdjustPlanScreenContext = BaseRibbitContext & {
  screen: "adjust-plan";
  monthlyIncome: number;
  past3MonthsAvgSavings: number;
  past3MonthsSavingsRate: number;
  currentPlanSavings: number;
  currentPlanSavingsRate: number;
  recommendedSavings: number;
  recommendedSavingsRate: number;
  improveNetWorth30Y: number;
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

export type PriorityBucket = {
  id: string;
  label: string;
  amount: number;
  layer: "pre-tax" | "protection" | "wealth" | "flex";
  status?: "complete" | "attention" | "growth";
};

export type SavingsAllocationScreenContext = BaseRibbitContext & {
  screen: "savings-allocation";
  monthlySavings: number;
  buckets: PriorityBucket[];
  hasDebt: boolean;
  has401k: boolean;
  efFunded: boolean;
};

export type RibbitScreenContext =
  | IncomeScreenContext
  | SavingsScreenContext
  | PlanScreenContext
  | AdjustPlanScreenContext
  | SavingsAllocationScreenContext;
