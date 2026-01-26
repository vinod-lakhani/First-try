/**
 * Centralized Savings Calculations
 * 
 * This module provides a single source of truth for all savings calculations
 * across the application. All pages and tools should use these functions
 * to ensure consistency.
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
 * Calculate base savings monthly from income allocation
 * This is the original savings = income - needs - wants
 * BEFORE accounting for pre-tax deductions
 */
export function calculateBaseSavingsMonthly(
  income: IncomeState | undefined,
  monthlyNeeds: number,
  monthlyWants: number
): number {
  if (!income) return 0;
  
  const paychecksPerMonth = getPaychecksPerMonth(income.payFrequency || 'biweekly');
  const incomePeriod$ = income.netIncome$ || income.grossIncome$ || 0;
  const monthlyIncome = incomePeriod$ * paychecksPerMonth;
  
  // Base savings = income - needs - wants (original allocation)
  return Math.max(0, monthlyIncome - monthlyNeeds - monthlyWants);
}

/**
 * Calculate complete savings breakdown
 * This is the single source of truth for all savings calculations
 */
export function calculateSavingsBreakdown(
  income: IncomeState | undefined,
  payrollContributions: PayrollContributions | undefined,
  monthlyNeeds: number,
  monthlyWants: number
): SavingsBreakdown {
  // Calculate base savings (income - needs - wants)
  const baseSavingsMonthly = calculateBaseSavingsMonthly(income, monthlyNeeds, monthlyWants);
  
  // Calculate pre-tax savings
  const preTaxSavings = calculatePreTaxSavings(income, payrollContributions);
  const preTaxSavingsTotal = preTaxSavings.total;
  
  // Calculate tax savings from pre-tax contributions
  const taxSavingsMonthly = preTaxSavingsTotal * ESTIMATED_MARGINAL_TAX_RATE;
  
  // Calculate net pre-tax impact on take-home
  // Pre-tax reduces take-home, but tax savings partially offset it
  const netPreTaxImpact = preTaxSavingsTotal - taxSavingsMonthly;
  
  // Calculate post-tax cash savings available
  // Post-tax available = base savings - (pre-tax contributions - tax savings)
  const cashSavingsMTD = Math.max(0, baseSavingsMonthly - netPreTaxImpact);
  
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
