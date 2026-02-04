/**
 * Pre-tax savings calculations for net worth simulation.
 * Used to derive 401(k) and HSA amounts from payroll/contributions.
 */

import type { IncomeState, PayrollContributions } from '@/lib/onboarding/types';
import { getPaychecksPerMonth } from '@/lib/onboarding/usePlanData';

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

/**
 * Calculate pre-tax payroll savings (401k + HSA) for net worth inflows.
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

  let traditional401kMonthly = 0;
  let traditional401kPercent: number | null = null;

  if (payrollContributions.has401k && payrollContributions.currentlyContributing401k === 'yes') {
    if (payrollContributions.contributionType401k === 'percent_gross' && payrollContributions.contributionValue401k) {
      traditional401kPercent = payrollContributions.contributionValue401k;
      traditional401kMonthly = (grossIncomeMonthly * payrollContributions.contributionValue401k) / 100;
    } else if (payrollContributions.contributionType401k === 'amount' && payrollContributions.contributionValue401k) {
      if (payrollContributions.contributionFrequency401k === 'per_paycheck') {
        traditional401kMonthly = payrollContributions.contributionValue401k * paychecksPerMonth;
      } else if (payrollContributions.contributionFrequency401k === 'per_month') {
        traditional401kMonthly = payrollContributions.contributionValue401k;
      }
      if (grossIncomeMonthly > 0) {
        traditional401kPercent = (traditional401kMonthly / grossIncomeMonthly) * 100;
      }
    }
  }

  let hsaMonthly = 0;

  if (payrollContributions.hasHSA && payrollContributions.currentlyContributingHSA === 'yes') {
    if (payrollContributions.contributionTypeHSA === 'percent_gross' && payrollContributions.contributionValueHSA) {
      hsaMonthly = (grossIncomeMonthly * payrollContributions.contributionValueHSA) / 100;
    } else if (payrollContributions.contributionTypeHSA === 'amount' && payrollContributions.contributionValueHSA) {
      if (payrollContributions.contributionFrequencyHSA === 'per_paycheck') {
        hsaMonthly = payrollContributions.contributionValueHSA * paychecksPerMonth;
      } else if (payrollContributions.contributionFrequencyHSA === 'per_month') {
        hsaMonthly = payrollContributions.contributionValueHSA;
      }
    }
  }

  let employerMatchMonthly = 0;

  if (payrollContributions.has401k && payrollContributions.hasEmployerMatch === 'yes') {
    if (payrollContributions.employerMatchPct && payrollContributions.employerMatchCapPct && grossIncomeMonthly > 0) {
      const matchCapMonthly = (grossIncomeMonthly * payrollContributions.employerMatchCapPct) / 100;
      const matchableContribution = Math.min(traditional401kMonthly, matchCapMonthly);
      employerMatchMonthly = (matchableContribution * payrollContributions.employerMatchPct) / 100;
    }
  }

  let employerHSAMonthly = 0;

  if (payrollContributions.hasHSA && payrollContributions.employerHSAContribution === 'yes') {
    employerHSAMonthly = payrollContributions.employerHSAAmount$ || 0;
  }

  const totalPreTax = traditional401kMonthly + hsaMonthly;

  return {
    traditional401k: {
      percent: traditional401kPercent,
      monthly: traditional401kMonthly,
    },
    hsa: { monthly: hsaMonthly },
    employerMatch: { monthly: employerMatchMonthly },
    employerHSA: { monthly: employerHSAMonthly },
    total: totalPreTax,
  };
}
