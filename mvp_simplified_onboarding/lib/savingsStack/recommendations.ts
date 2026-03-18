/**
 * Savings Stack Recommendations
 *
 * Generates actionable recommendations based on the savings stack spec:
 * 1. Emergency Fund
 * 2. 401k match capture
 * 3. HSA toward max
 * 4. High-APR debt
 * 5. Retirement (Roth vs Traditional per ~$190K heuristic)
 * 6. Brokerage
 */

import {
  getRecommended401kMatchCapture,
  getHsaMax2025,
  favorRothOverTraditional,
  getIraMax2025,
} from "./allocation";

export type RecommendationId =
  | "add-payroll-401k"
  | "capture-401k-match"
  | "max-hsa"
  | "add-hsa"
  | "prioritize-roth"
  | "prioritize-traditional"
  | "emergency-fund"
  | "high-apr-debt";

export type SavingsStackRecommendation = {
  id: RecommendationId;
  priority: number;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  /** Amount to consider (e.g. monthly contribution) */
  suggestedAmount?: number;
};

export type RecommendationsInput = {
  monthlySavings: number;
  annualIncome?: number;
  /** User has 401k available (from employer) */
  has401k?: boolean;
  /** User has HSA available */
  hasHsa?: boolean;
  /** Current 401k (employee + employer) from payroll */
  payroll401k?: number;
  /** Employee-only 401k contribution (for match capture check) */
  employee401k?: number;
  /** Current HSA from payroll */
  payrollHsa?: number;
  matchPct?: number;
  matchUpToPct?: number;
  /** Has high-APR debt (APR >= 10%) */
  hasHighAprDebt?: boolean;
  /** From payroll flow — user already added payroll details */
  fromPayroll?: boolean;
  /** Savings param for building hrefs */
  savings?: string;
  projected?: string;
};

const DEFAULT_ANNUAL = 120_000;

/**
 * Generate savings stack recommendations based on user context.
 */
export function getSavingsStackRecommendations(input: RecommendationsInput): SavingsStackRecommendation[] {
  const {
    monthlySavings,
    annualIncome = DEFAULT_ANNUAL,
    has401k = false,
    hasHsa = false,
    payroll401k = 0,
    employee401k = 0,
    payrollHsa = 0,
    matchPct = 0,
    matchUpToPct = 0,
    hasHighAprDebt = false,
    fromPayroll = false,
    savings = "1362",
    projected = "2000000",
  } = input;

  const recs: SavingsStackRecommendation[] = [];

  // 1. 401k: Not capturing match — highest priority ("free money")
  // matchUpToPct from URL is 0-100 (e.g. 6 for 6% of salary)
  const matchUpToVal = matchUpToPct > 1 ? matchUpToPct : matchUpToPct * 100;
  if (has401k && matchPct > 0 && matchUpToVal > 0) {
    const recommendedEmployee = getRecommended401kMatchCapture(annualIncome, matchPct / 100, matchUpToVal);
    const currentEmployee = employee401k || payroll401k;
    if (recommendedEmployee > 0 && currentEmployee < recommendedEmployee * 0.9) {
      recs.push({
        id: "capture-401k-match",
        priority: 1,
        title: "Capture your 401(k) match",
        message: `Your employer matches up to ${matchUpToPct}% of your salary. Contributing ~$${Math.round(recommendedEmployee).toLocaleString()}/month captures the full match — that's guaranteed return.`,
        suggestedAmount: Math.round(recommendedEmployee),
        actionLabel: fromPayroll ? undefined : "Add payroll details →",
        actionHref: fromPayroll ? undefined : `/onboarding/payroll?returnTo=app&savings=${savings}&projected=${projected}`,
      });
    }
  }

  // 2. Not from payroll — recommend adding payroll to capture 401k match / HSA
  if (!fromPayroll) {
    recs.push({
      id: "add-payroll-401k",
      priority: 2,
      title: "Capture 401(k) match & HSA",
      message: "If your employer offers a 401(k) match, capturing it is the highest priority — it's free money. HSA is also highly tax-efficient. Add your payroll details to optimize your plan.",
      actionLabel: "Add payroll details →",
      actionHref: `/onboarding/payroll?returnTo=app&savings=${savings}&projected=${projected}`,
    });
  }

  // 3. HSA: Eligible but not maxing
  if (hasHsa) {
    const hsaMax = getHsaMax2025(false) / 12;
    const currentHsa = payrollHsa;
    if (currentHsa < hsaMax * 0.9) {
      const gap = Math.round(hsaMax - currentHsa);
      recs.push({
        id: "max-hsa",
        priority: 3,
        title: "Consider maxing your HSA",
        message: `HSA offers triple tax advantage. 2025 max is ~$${Math.round(hsaMax).toLocaleString()}/month. You're at ~$${Math.round(currentHsa).toLocaleString()}/month — adding ~$${gap}/month gets you to max.`,
        suggestedAmount: gap,
      });
    }
  }

  // 4. HSA: Has access but hasn't added
  if (hasHsa && !fromPayroll && !recs.some((r) => r.id === "add-payroll-401k")) {
    recs.push({
      id: "add-hsa",
      priority: 4,
      title: "Add your HSA details",
      message: "HSA is one of the most tax-efficient accounts. Add your payroll details to include it in your plan.",
      actionLabel: "Add payroll details →",
      actionHref: `/onboarding/payroll?returnTo=app&savings=${savings}&projected=${projected}`,
    });
  }

  // 5. Roth vs Traditional (post-tax allocation guidance)
  const favorRoth = favorRothOverTraditional(annualIncome);
  if (favorRoth) {
    const iraMax = getIraMax2025(false) / 12;
    recs.push({
      id: "prioritize-roth",
      priority: 5,
      title: "Prioritize Roth IRA",
      message: `With income under ~$190K, Roth IRA lets you lock in today's tax rate. Consider up to ~$${Math.round(iraMax).toLocaleString()}/month (2025 cap).`,
      suggestedAmount: Math.round(iraMax),
    });
  } else {
    recs.push({
      id: "prioritize-traditional",
      priority: 5,
      title: "Prioritize Traditional 401(k) / IRA",
      message: "With higher income, Traditional tax-deferred savings can reduce your tax bill now. Max your 401(k) before brokerage.",
    });
  }

  // 6. High-APR debt
  if (hasHighAprDebt) {
    recs.push({
      id: "high-apr-debt",
      priority: 6,
      title: "Prioritize high-APR debt payoff",
      message: "Debt at 10%+ APR costs more than most investments earn. Allocating ~40% of post-EF savings to debt payoff is recommended.",
    });
  }

  return recs.sort((a, b) => a.priority - b.priority);
}
