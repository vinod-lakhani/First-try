/**
 * Home Screen Types
 * 
 * Data models for the Monthly Home Screen dashboard.
 */

export interface MonthlySummary {
  income$: number;
  needs$: number;
  wants$: number;
  savings$: number;
  targetNeedsPct: number;
  targetWantsPct: number;
  targetSavingsPct: number;
  plannedSavings$: number;
}

export interface MonthlyInsight {
  id: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaAction?: {
    kind: "open_feed" | "open_optimizer" | "open_goal";
    payload?: any;
  };
}

export interface NetWorthSnapshot {
  currentNetWorth$: number;
  deltaVsLastMonth$: number;
  history: { month: string; value$: number }[]; // last 12–24 months
}

export interface MonthlyGoalProgress {
  id: string;
  label: string;
  current$: number;
  target$: number;
  contributedThisMonth$: number;
}

export interface HomeScreenData {
  summary: MonthlySummary;
  insights: MonthlyInsight[]; // ideally top 3
  netWorth: NetWorthSnapshot;
  goals: MonthlyGoalProgress[];
}

