/**
 * Centralized Savings Calculations — SINGLE SOURCE OF TRUTH
 *
 * All pages (Income, Savings Allocator, Monthly Pulse, etc.) MUST use these
 * functions for savings-related calculations. Do not duplicate logic elsewhere.
 *
 * SOURCE OF TRUTH:
 * - Employee 401k contribution: customSavingsAllocation.match401k$ (when applied)
 *   or payrollContributions (when set) or engine recommendation
 * - Employer 401k match: ALWAYS derived via calculateEmployerMatch() — uses
 *   GROSS income for the match cap (6% of gross), not net/take-home
 * - Payroll Savings = Employee 401k + Employee HSA (pre-tax)
 */

import type { IncomeState, PayrollContributions } from '@/lib/onboarding/types';
import { getPaychecksPerMonth } from '@/lib/onboarding/usePlanData';

// Estimate marginal tax rate (federal + state)
export const ESTIMATED_MARGINAL_TAX_RATE = 0.25; // 25% combined federal + state

export interface PreTaxSavings {
  traditional401k: {
    percent: number | null;
    monthly: number;
  };
  hsa: {
    monthly: number;
  };
  employerMatch: {
    monthly: number;
  };
  employerHSA: {
    monthly: number;
  };
  total: number;
}

export interface SavingsBreakdown {
  cashSavingsMTD: number; // Post-tax cash savings (observed)
  payrollSavingsMTD: number; // Pre-tax payroll savings (estimated) - 401k + Employee HSA
  employerMatchMTD: number; // Employer 401K match (estimated)
  employerHSAMTD: number; // Employer HSA contribution (estimated)
  totalSavingsMTD: number; // Total = Cash + Payroll + Employer 401K Match + Employee HSA + Employer HSA
  baseSavingsMonthly: number; // Original savings from income allocation (income - needs - wants)
  preTaxSavingsTotal: number; // Total pre-tax contributions (401k + Employee HSA)
  taxSavingsMonthly: number; // Tax savings from pre-tax contributions
  netPreTaxImpact: number; // Net impact on take-home (pre-tax - tax savings)
}

/**
 * Calculate pre-tax payroll savings (401k + HSA)
 */
export function calculatePreTaxSavings(
  income: IncomeState | undefined,
  payrollContributions: PayrollContributions | undefined
): PreTaxSavings {
  if (!income || !payrollContributions) {
    return {
      traditional401k: { percent: null, monthly: 0 },
      hsa: { monthly: 0 },
      employerMatch: { monthly: 0 },
      employerHSA: { monthly: 0 },
      total: 0,
    };
  }

  const paychecksPerMonth = getPaychecksPerMonth(income.payFrequency || 'biweekly');
  const grossIncomePerPaycheck = income.grossIncome$ || income.netIncome$ || 0;
  const grossIncomeMonthly = grossIncomePerPaycheck * paychecksPerMonth;

  // Calculate 401k contribution
  let traditional401kMonthly = 0;
  let traditional401kPercent: number | null = null;
  
  if (payrollContributions.has401k && payrollContributions.currentlyContributing401k === "yes") {
    if (payrollContributions.contributionType401k === "percent_gross" && payrollContributions.contributionValue401k) {
      traditional401kPercent = payrollContributions.contributionValue401k;
      traditional401kMonthly = (grossIncomeMonthly * payrollContributions.contributionValue401k) / 100;
    } else if (payrollContributions.contributionType401k === "amount" && payrollContributions.contributionValue401k) {
      if (payrollContributions.contributionFrequency401k === "per_paycheck") {
        traditional401kMonthly = payrollContributions.contributionValue401k * paychecksPerMonth;
      } else if (payrollContributions.contributionFrequency401k === "per_month") {
        traditional401kMonthly = payrollContributions.contributionValue401k;
      }
      if (grossIncomeMonthly > 0) {
        traditional401kPercent = (traditional401kMonthly / grossIncomeMonthly) * 100;
      }
    }
  }

  // Calculate HSA contribution
  let hsaMonthly = 0;
  
  if (payrollContributions.hasHSA && payrollContributions.currentlyContributingHSA === "yes") {
    if (payrollContributions.contributionTypeHSA === "percent_gross" && payrollContributions.contributionValueHSA) {
      hsaMonthly = (grossIncomeMonthly * payrollContributions.contributionValueHSA) / 100;
    } else if (payrollContributions.contributionTypeHSA === "amount" && payrollContributions.contributionValueHSA) {
      if (payrollContributions.contributionFrequencyHSA === "per_paycheck") {
        hsaMonthly = payrollContributions.contributionValueHSA * paychecksPerMonth;
      } else if (payrollContributions.contributionFrequencyHSA === "per_month") {
        hsaMonthly = payrollContributions.contributionValueHSA;
      }
    }
  }

  // Calculate employer match
  let employerMatchMonthly = 0;
  
  if (payrollContributions.has401k && payrollContributions.hasEmployerMatch === "yes") {
    if (payrollContributions.employerMatchPct && payrollContributions.employerMatchCapPct && grossIncomeMonthly > 0) {
      const matchCapMonthly = (grossIncomeMonthly * payrollContributions.employerMatchCapPct) / 100;
      const matchableContribution = Math.min(traditional401kMonthly, matchCapMonthly);
      employerMatchMonthly = (matchableContribution * payrollContributions.employerMatchPct) / 100;
    }
  }

  // Calculate employer HSA contribution
  let employerHSAMonthly = 0;
  
  if (payrollContributions.hasHSA && payrollContributions.employerHSAContribution === "yes") {
    employerHSAMonthly = payrollContributions.employerHSAAmount$ || 0;
  }

  const totalPreTax = traditional401kMonthly + hsaMonthly;

  return {
    traditional401k: {
      percent: traditional401kPercent,
      monthly: traditional401kMonthly,
    },
    hsa: {
      monthly: hsaMonthly,
    },
    employerMatch: {
      monthly: employerMatchMonthly,
    },
    employerHSA: {
      monthly: employerHSAMonthly,
    },
    total: totalPreTax,
  };
}

/**
 * Calculate employer 401K match from employee contribution.
 * Single source of truth — employer match cap is based on GROSS income.
 * Formula: employer match = min(employee401k, 6% of gross) × 50%.
 *
 * @param employee401kMonthly - Employee 401k contribution $/mo (from plan/custom alloc or payroll)
 * @param grossIncomeMonthly - Gross income $/mo (must be gross, not net)
 * @param payrollContributions - For match rate and cap %
 */
export function calculateEmployerMatch(
  employee401kMonthly: number,
  grossIncomeMonthly: number,
  payrollContributions: PayrollContributions | undefined
): number {
  if (
    !payrollContributions?.has401k ||
    payrollContributions?.hasEmployerMatch !== 'yes' ||
    !payrollContributions?.employerMatchPct ||
    !payrollContributions?.employerMatchCapPct ||
    grossIncomeMonthly <= 0
  ) {
    return 0;
  }
  const matchCapMonthly = (grossIncomeMonthly * payrollContributions.employerMatchCapPct) / 100;
  const matchableContribution = Math.min(employee401kMonthly, matchCapMonthly);
  return (matchableContribution * payrollContributions.employerMatchPct) / 100;
}

/**
 * Get gross income monthly from income state (single source for match calculations).
 */
export function getGrossIncomeMonthly(income: IncomeState | undefined): number {
  if (!income) return 0;
  const paychecksPerMonth = getPaychecksPerMonth(income.payFrequency || 'biweekly');
  const grossPerPaycheck = income.grossIncome$ ?? income.netIncome$ ?? 0;
  return grossPerPaycheck * paychecksPerMonth;
}

/**
 * Calculate base savings monthly from income allocation.
 * Uses NET (take-home) when available — 401k/HSA already deducted from net.
 */
export function calculateBaseSavingsMonthly(
  income: IncomeState | undefined,
  monthlyNeeds: number,
  monthlyWants: number
): number {
  if (!income) return 0;

  const paychecksPerMonth = getPaychecksPerMonth(income.payFrequency || 'biweekly');
  const netPerPaycheck = income.netIncome$ ?? income.grossIncome$ ?? 0;
  const monthlyNet = netPerPaycheck * paychecksPerMonth;

  return Math.max(0, monthlyNet - monthlyNeeds - monthlyWants);
}

/**
 * Calculate complete savings breakdown.
 *
 * PRE-TAX vs POST-TAX:
 * - Cash (post-tax) = EF + Debt extra + Roth + Brokerage — from take-home
 * - Payroll (pre-tax) = 401k + HSA — from gross, before taxes
 * - When NET exists: cash = net - needs - wants (401k/HSA already out of net)
 * - When GROSS only: cash = (gross - needs - wants) - netPreTaxImpact
 */
export function calculateSavingsBreakdown(
  income: IncomeState | undefined,
  payrollContributions: PayrollContributions | undefined,
  monthlyNeeds: number,
  monthlyWants: number
): SavingsBreakdown {
  const preTaxSavings = calculatePreTaxSavings(income, payrollContributions);
  const preTaxSavingsTotal = preTaxSavings.total;
  const taxSavingsMonthly = preTaxSavingsTotal * ESTIMATED_MARGINAL_TAX_RATE;
  const netPreTaxImpact = preTaxSavingsTotal - taxSavingsMonthly;

  const baseSavingsMonthly = calculateBaseSavingsMonthly(income, monthlyNeeds, monthlyWants);
  const hasNet = !!(income?.netIncome$ ?? 0);
  const grossMonthly = getGrossIncomeMonthly(income);

  // NET: 401k/HSA already deducted — cash = baseSavings (net - needs - wants)
  // GROSS only: total budget minus pre-tax cost to take-home
  const cashSavingsMTD =
    hasNet
      ? baseSavingsMonthly
      : Math.max(0, baseSavingsMonthly - netPreTaxImpact);
  
  // Calculate payroll savings (pre-tax)
  const payrollSavingsMTD = preTaxSavingsTotal;
  
  // Calculate employer match
  const employerMatchMTD = preTaxSavings.employerMatch.monthly;
  
  // Calculate employer HSA contribution
  const employerHSAMTD = preTaxSavings.employerHSA.monthly;
  
  // Calculate total savings (all-in)
  // Total = Cash + Payroll + Employer 401K Match + Employee HSA + Employer HSA
  const totalSavingsMTD = cashSavingsMTD + payrollSavingsMTD + employerMatchMTD + employerHSAMTD;
  
  return {
    cashSavingsMTD,
    payrollSavingsMTD,
    employerMatchMTD,
    employerHSAMTD,
    totalSavingsMTD,
    baseSavingsMonthly,
    preTaxSavingsTotal,
    taxSavingsMonthly,
    netPreTaxImpact,
  };
}

/** Paycheck category shape (subset needed for display breakdown) */
export interface PlanPaycheckCategory {
  key: string;
  amount: number;
  subCategories?: Array<{ key: string; amount: number }>;
}

/**
 * Calculate display savings breakdown — SAME logic as Income tab and Monthly Pulse.
 * Uses plan-based overrides when plan has 401k/HSA in long_term_investing, so chat and UI show
 * identical numbers. Use this for chat context and any "Savings Breakdown" display.
 */
export function calculateDisplaySavingsBreakdown(
  income: IncomeState | undefined,
  payrollContributions: PayrollContributions | undefined,
  monthlyNeeds: number,
  monthlyWants: number,
  planCategories: PlanPaycheckCategory[] | null | undefined
): SavingsBreakdown {
  const savingsCalc = calculateSavingsBreakdown(income, payrollContributions, monthlyNeeds, monthlyWants);
  const preTaxSavings = calculatePreTaxSavings(income, payrollContributions);
  const paychecksPerMonth = getPaychecksPerMonth(income?.payFrequency || 'biweekly');

  if (!planCategories || planCategories.length === 0) {
    return savingsCalc;
  }

  const emergencyCat = planCategories.find((c) => c.key === 'emergency');
  const debtExtraCat = planCategories.find((c) => c.key === 'debt_extra');
  const longTermCat = planCategories.find((c) => c.key === 'long_term_investing');
  const matchSub = longTermCat?.subCategories?.find((s) => s.key === '401k_match');
  const hsaSub = longTermCat?.subCategories?.find((s) => s.key === 'hsa');
  const rothSub = longTermCat?.subCategories?.find((s) => s.key === 'retirement_tax_advantaged');
  const brokerageSub = longTermCat?.subCategories?.find((s) => s.key === 'brokerage');

  const plan401kEmployeeMonthly = (matchSub?.amount ?? 0) * paychecksPerMonth;
  const planHsaMonthly = (hsaSub?.amount ?? 0) * paychecksPerMonth;
  const usePlanPayroll = (plan401kEmployeeMonthly > 0.01 || planHsaMonthly > 0.01);

  const grossIncomeMonthly = getGrossIncomeMonthly(income);
  const employerMatchFromPlan = calculateEmployerMatch(
    plan401kEmployeeMonthly,
    grossIncomeMonthly,
    payrollContributions ?? undefined
  );

  const planBasedCashMTD =
    (emergencyCat?.amount ?? 0) * paychecksPerMonth +
    (debtExtraCat?.amount ?? 0) * paychecksPerMonth +
    (rothSub?.amount ?? 0) * paychecksPerMonth +
    (brokerageSub?.amount ?? 0) * paychecksPerMonth;

  const observedCashSavingsMTD = planCategories.length > 0 ? planBasedCashMTD : savingsCalc.cashSavingsMTD;
  const expectedPayrollSavingsMTD = usePlanPayroll
    ? plan401kEmployeeMonthly + (planHsaMonthly > 0.01 ? planHsaMonthly : preTaxSavings.hsa.monthly)
    : savingsCalc.payrollSavingsMTD;
  const expectedMatchMTD = usePlanPayroll ? employerMatchFromPlan : savingsCalc.employerMatchMTD;
  const expectedEmployerHSAMTD = savingsCalc.employerHSAMTD;
  const totalSavingsMTD =
    observedCashSavingsMTD + expectedPayrollSavingsMTD + expectedMatchMTD + expectedEmployerHSAMTD;

  return {
    cashSavingsMTD: observedCashSavingsMTD,
    payrollSavingsMTD: expectedPayrollSavingsMTD,
    employerMatchMTD: expectedMatchMTD,
    employerHSAMTD: expectedEmployerHSAMTD,
    totalSavingsMTD,
    baseSavingsMonthly: savingsCalc.baseSavingsMonthly,
    preTaxSavingsTotal: expectedPayrollSavingsMTD,
    taxSavingsMonthly: savingsCalc.taxSavingsMonthly,
    netPreTaxImpact: savingsCalc.netPreTaxImpact,
  };
}
