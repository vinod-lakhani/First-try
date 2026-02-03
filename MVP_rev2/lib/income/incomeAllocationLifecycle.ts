/**
 * Income Allocation — Foundational Logic & Lifecycle
 *
 * Two modes: CALIBRATION (first-time) vs MONTHLY_CHECKIN (ongoing).
 * Four states: FIRST_TIME | ON_TRACK | OVERSAVED | UNDERSAVED.
 * No mid-month projections; uses last 3 months and last month (closed) only.
 */

export type IncomeAllocationMode = 'CALIBRATION' | 'MONTHLY_CHECKIN';
export type IncomeAllocationState = 'FIRST_TIME' | 'ON_TRACK' | 'OVERSAVED' | 'UNDERSAVED';

export type IncomeAllocationSnapshot = {
  mode: IncomeAllocationMode;
  state: IncomeAllocationState;
  period: {
    last3m_start?: string;
    last3m_end?: string;
    lastMonth_start?: string;
    lastMonth_end?: string;
    nextMonth_label?: string;
  };
  income: {
    netIncomeMonthly: number;
  };
  actuals: {
    last3m_avg: { needs: number; wants: number; totalSpend: number };
    lastMonth?: { needs: number; wants: number; totalSpend: number; savings: number };
  };
  plan: {
    currentPlan?: {
      plannedSavings: number;
      plannedSpend: number;
      plannedNeeds?: number;
      plannedWants?: number;
    };
    recommendedPlan: {
      plannedSavings: number;
      plannedSpend: number;
      plannedNeeds?: number;
      plannedWants?: number;
    };
  };
  deltas: {
    savings_vs_plan?: number;
    recommended_change?: number;
  };
  shiftLimit: {
    monthlyMaxChange: number;
    appliedChange: number;
  };
  narrative: {
    headline: string;
    subhead: string;
    confidenceLine?: string;
    subtext?: string;
    primaryCta: string;
    secondaryCta: string;
  };
  netWorth: {
    currentScenario: unknown;
    proposedScenario: unknown;
  };
};

const TOLERANCE_DOLLARS = 50;
const TOLERANCE_PCT = 0.05;

function getShiftLimit(netIncomeMonthly: number): number {
  return Math.round(0.04 * netIncomeMonthly);
}

function getNextMonthLabel(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleString('default', { month: 'long' });
}

export interface LifecycleInputs {
  netIncomeMonthly: number;
  last3m_avg: { needs: number; wants: number; totalSpend: number };
  lastMonth?: { needs: number; wants: number; totalSpend: number; savings: number };
  currentPlan?: {
    plannedSavings: number;
    plannedSpend: number;
    plannedNeeds?: number;
    plannedWants?: number;
  };
  netWorthCurrent?: unknown;
  netWorthProposed?: unknown;
  /** Employer 401(k) match $/mo — included in displayed "You saved $X" total so the number matches total savings (cash + match). */
  employerMatchMonthly?: number;
}

/**
 * Build the authoritative Income Allocation snapshot.
 * - CALIBRATION (FIRST_TIME): no current plan; recommend safe_savings from last 3 months.
 * - MONTHLY_CHECKIN: compare last month actual vs plan → ON_TRACK | OVERSAVED | UNDERSAVED; recommend one step-sized change or none.
 */
export function buildIncomeAllocationSnapshotFromInputs(
  inputs: LifecycleInputs
): IncomeAllocationSnapshot {
  const {
    netIncomeMonthly,
    last3m_avg,
    lastMonth,
    currentPlan,
    netWorthCurrent,
    netWorthProposed,
    employerMatchMonthly = 0,
  } = inputs;

  const shiftLimitMonthly = getShiftLimit(netIncomeMonthly);
  const nextMonthLabel = getNextMonthLabel();

  // --- CALIBRATION (first-time): no existing plan ---
  if (!currentPlan || currentPlan.plannedSavings === undefined) {
    const safe_savings = Math.max(0, netIncomeMonthly - last3m_avg.totalSpend);
    const recommendedPlan = {
      plannedSavings: safe_savings,
      plannedSpend: netIncomeMonthly - safe_savings,
    };

    return {
      mode: 'CALIBRATION',
      state: 'FIRST_TIME',
      period: { nextMonth_label: nextMonthLabel },
      income: { netIncomeMonthly },
      actuals: { last3m_avg: { ...last3m_avg } },
      plan: {
        recommendedPlan: {
          ...recommendedPlan,
          plannedNeeds: last3m_avg.needs,
          plannedWants: last3m_avg.wants,
        },
      },
      deltas: {},
      shiftLimit: { monthlyMaxChange: shiftLimitMonthly, appliedChange: 0 },
      narrative: {
        headline: 'How much can you safely save each month?',
        subhead: `About $${Math.round(safe_savings).toLocaleString()} / month`,
        confidenceLine: "Based on how you've actually spent over the last 3 months. This isn't a goal — it's a starting point you can realistically stick to.",
        primaryCta: 'Use this as my plan',
        secondaryCta: 'Ask Ribbit why this works',
      },
      netWorth: {
        currentScenario: netWorthCurrent ?? null,
        proposedScenario: netWorthProposed ?? null,
      },
    };
  }

  // --- MONTHLY_CHECKIN: has plan; need last month actuals ---
  // If we don't have lastMonth, use last3m as proxy for "last month" (MVP)
  const lastMonthActual = lastMonth ?? {
    needs: last3m_avg.needs,
    wants: last3m_avg.wants,
    totalSpend: last3m_avg.totalSpend,
    savings: netIncomeMonthly - last3m_avg.totalSpend,
  };

  const lastMonthSavingsActual = netIncomeMonthly - lastMonthActual.totalSpend;
  const savings_vs_plan = lastMonthSavingsActual - currentPlan.plannedSavings;
  const tolerance = Math.max(TOLERANCE_DOLLARS, TOLERANCE_PCT * currentPlan.plannedSavings);

  let state: IncomeAllocationState;
  let recommendedPlan = {
    plannedSavings: currentPlan.plannedSavings,
    plannedSpend: currentPlan.plannedSpend,
    plannedNeeds: currentPlan.plannedNeeds,
    plannedWants: currentPlan.plannedWants,
  };
  let appliedChange = 0;

  if (Math.abs(savings_vs_plan) <= tolerance) {
    state = 'ON_TRACK';
    // no change
  } else if (savings_vs_plan > tolerance) {
    state = 'OVERSAVED';
    appliedChange = Math.min(shiftLimitMonthly, savings_vs_plan);
    recommendedPlan = {
      plannedSavings: currentPlan.plannedSavings + appliedChange,
      plannedSpend: netIncomeMonthly - (currentPlan.plannedSavings + appliedChange),
      plannedNeeds: currentPlan.plannedNeeds,
      plannedWants: currentPlan.plannedWants,
    };
  } else {
    state = 'UNDERSAVED';
    // Move up toward target: increase from actual savings toward plan, capped by 4% shift limit
    const gapToTarget = currentPlan.plannedSavings - lastMonthSavingsActual;
    appliedChange = Math.min(shiftLimitMonthly, Math.max(0, gapToTarget));
    const newSavings = Math.min(netIncomeMonthly, lastMonthSavingsActual + appliedChange);
    recommendedPlan = {
      plannedSavings: newSavings,
      plannedSpend: netIncomeMonthly - newSavings,
      plannedNeeds: currentPlan.plannedNeeds,
      plannedWants: currentPlan.plannedWants,
    };
  }

  const recommended_change = recommendedPlan.plannedSavings - currentPlan.plannedSavings;

  // Narrative copy per spec
  let headline: string;
  let subhead: string;
  let confidenceLine: string | undefined;
  let primaryCta: string;
  let secondaryCta: string;

  if (state === 'ON_TRACK') {
    headline = 'Your plan worked last month';
    // Show cash and match separately to avoid double-counting (plan or actuals may already include match elsewhere)
    const cashSaved = Math.round(lastMonthSavingsActual);
    subhead = employerMatchMonthly > 0
      ? `You saved $${cashSaved.toLocaleString()} (plus $${Math.round(employerMatchMonthly).toLocaleString()} employer match) — right in line with your plan.`
      : `You saved $${cashSaved.toLocaleString()} — right in line with your plan.`;
    confidenceLine = 'Nothing needs to change unless you want it to.';
    primaryCta = 'Keep plan for next month';
    secondaryCta = 'Explore options';
  } else if (state === 'OVERSAVED') {
    const A = Math.round(Math.min(appliedChange, savings_vs_plan));
    headline = 'You had room to save more';
    subhead = `You saved $${Math.round(savings_vs_plan).toLocaleString()} more than planned last month.`;
    confidenceLine = 'If you want, you can lock that in going forward.';
    primaryCta = `Save $${A.toLocaleString()} more next month`;
    secondaryCta = 'Keep current plan';
  } else {
    const A = Math.round(appliedChange);
    headline = 'Last month was tighter than expected';
    subhead = `You saved $${Math.round(Math.abs(savings_vs_plan)).toLocaleString()} less than planned.`;
    confidenceLine = "Let's step back toward your target — one small move at a time.";
    primaryCta = A > 0 ? `Save $${A.toLocaleString()} more next month` : 'Adjust plan for next month';
    secondaryCta = 'Keep current plan';
  }

  return {
    mode: 'MONTHLY_CHECKIN',
    state,
    period: { nextMonth_label: nextMonthLabel },
    income: { netIncomeMonthly },
    actuals: {
      last3m_avg: { ...last3m_avg },
      lastMonth: { ...lastMonthActual },
    },
    plan: {
      currentPlan: { ...currentPlan },
      recommendedPlan,
    },
    deltas: {
      savings_vs_plan,
      recommended_change: state === 'ON_TRACK' ? undefined : recommended_change,
    },
    shiftLimit: {
      monthlyMaxChange: shiftLimitMonthly,
      appliedChange,
    },
    narrative: {
      headline,
      subhead,
      confidenceLine,
      primaryCta,
      secondaryCta,
    },
    netWorth: {
      currentScenario: netWorthCurrent ?? null,
      proposedScenario: netWorthProposed ?? (state !== 'ON_TRACK' ? netWorthProposed : netWorthCurrent) ?? null,
    },
  };
}
