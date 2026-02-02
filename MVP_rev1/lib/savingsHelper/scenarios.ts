/**
 * Savings Helper simulation scenarios.
 * Used on the home page to select mock data for past 3 months and current month,
 * so the savings-helper tool can simulate: low savings rate, high/low/on-track spending.
 */

export const PAST3M_SCENARIO_DEFAULT = 'default';
export const PAST3M_SCENARIO_LOW_SAVINGS_10 = 'low-savings-10';

export const CURRENT_MONTH_SCENARIO_DEFAULT = 'default';
export const CURRENT_MONTH_SCENARIO_HIGH_EXPENSES = 'high-expenses';
export const CURRENT_MONTH_SCENARIO_LOW_EXPENSES = 'low-expenses';
export const CURRENT_MONTH_SCENARIO_ON_TRACK = 'on-track';

export type Past3mScenarioId = typeof PAST3M_SCENARIO_DEFAULT | typeof PAST3M_SCENARIO_LOW_SAVINGS_10;
export type CurrentMonthScenarioId =
  | typeof CURRENT_MONTH_SCENARIO_DEFAULT
  | typeof CURRENT_MONTH_SCENARIO_HIGH_EXPENSES
  | typeof CURRENT_MONTH_SCENARIO_LOW_EXPENSES
  | typeof CURRENT_MONTH_SCENARIO_ON_TRACK;

export const PAST3M_SCENARIOS: { id: Past3mScenarioId; label: string }[] = [
  { id: 'default', label: 'From plan / expenses' },
  { id: 'low-savings-10', label: 'Low savings (10%)' },
];

/** Past 3 months override: when low-savings-10, use 55% needs, 35% wants, 10% savings. */
export const PAST3M_OVERRIDE_LOW_SAVINGS_10 = {
  needsPct: 0.55,
  wantsPct: 0.35,
  savingsPct: 0.10,
};

export const CURRENT_MONTH_SCENARIOS: { id: CurrentMonthScenarioId; label: string }[] = [
  { id: 'default', label: 'From plan / expenses' },
  { id: 'high-expenses', label: 'High expenses (~8% over plan)' },
  { id: 'low-expenses', label: 'Low expenses (~8% under plan)' },
  { id: 'on-track', label: 'On track (matches plan)' },
];

/** Multipliers for current month vs recommended plan spend (Needs + Wants). */
export const CURRENT_MONTH_SPEND_MULTIPLIER: Record<CurrentMonthScenarioId, number> = {
  default: 1,
  'high-expenses': 1.08,
  'low-expenses': 0.92,
  'on-track': 1,
};
