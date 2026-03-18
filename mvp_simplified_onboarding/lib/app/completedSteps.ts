/**
 * Completed steps state for app feedback loop
 * Persists to localStorage, syncs from URL params
 */

export const STEPS = ["connect", "debts", "payroll", "savings-allocation"] as const;
export type StepId = (typeof STEPS)[number];

const STORAGE_KEY = "weleap_completed_steps";

export function getCompletedSteps(): StepId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is StepId => STEPS.includes(s));
  } catch {
    return [];
  }
}

export function setCompletedSteps(steps: StepId[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(steps)]));
  } catch {
    // ignore
  }
}

export function addCompletedStep(step: StepId): StepId[] {
  const current = getCompletedSteps();
  if (current.includes(step)) return current;
  const next = [...current, step];
  setCompletedSteps(next);
  return next;
}

export function getPlanCompletenessPercent(steps: StepId[]): number {
  const pctPerStep = 80 / STEPS.length;
  return Math.round(20 + steps.length * pctPerStep);
}

export function getNextStep(steps: StepId[]): StepId | null {
  return STEPS.find((s) => !steps.includes(s)) ?? null;
}
