/**
 * Monthly Plan Current Page
 * 
 * Step 1 of 2: Shows read-only current monthly picture based on actuals.
 */

'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { getPaychecksPerMonth } from '@/lib/onboarding/usePlanData';
import MonthlyPlanCurrent from '@/components/monthly-plan/MonthlyPlanCurrent';
import type { MonthlyBucket } from '@/components/monthly-plan/MonthlyPlanCurrent';

export default function MonthlyPlanCurrentPage() {
  const router = useRouter();
  const store = useOnboardingStore();
  const { income, fixedExpenses, debts } = store;
  const planData = usePlanData();

  // Calculate monthly income
  const monthlyIncome = useMemo(() => {
    if (!income?.netIncome$ && !income?.grossIncome$) return 0;
    const incomeAmount = income.netIncome$ || income.grossIncome$ || 0;
    const payFrequency = income.payFrequency || 'biweekly';
    const paychecksPerMonth = getPaychecksPerMonth(payFrequency);
    return incomeAmount * paychecksPerMonth;
  }, [income]);

  // Calculate actual monthly needs and wants from expenses
  const { needs, wants } = useMemo(() => {
    const needsBreakdown: Array<{ label: string; amount: number; percentOfBucket: number }> = [];
    const wantsBreakdown: Array<{ label: string; amount: number; percentOfBucket: number }> = [];

    let needsTotal = 0;
    let wantsTotal = 0;

    // Process fixed expenses - they should already be monthly
    for (const expense of fixedExpenses) {
      let monthlyAmount = expense.amount$;
      // Safety check: convert if not already monthly
      if (expense.frequency === 'weekly') monthlyAmount = expense.amount$ * 4.33;
      else if (expense.frequency === 'biweekly') monthlyAmount = expense.amount$ * 2.17;
      else if (expense.frequency === 'semimonthly') monthlyAmount = expense.amount$ * 2;
      else if (expense.frequency === 'yearly') monthlyAmount = expense.amount$ / 12;

      if (expense.category === 'needs' || !expense.category) {
        needsTotal += monthlyAmount;
        needsBreakdown.push({
          label: expense.name,
          amount: monthlyAmount,
          percentOfBucket: 0, // Will calculate after
        });
      } else if (expense.category === 'wants') {
        wantsTotal += monthlyAmount;
        wantsBreakdown.push({
          label: expense.name,
          amount: monthlyAmount,
          percentOfBucket: 0, // Will calculate after
        });
      }
    }

    // Add debt minimum payments to needs
    const payFrequency = income?.payFrequency || 'biweekly';
    const paychecksPerMonth = getPaychecksPerMonth(payFrequency);
    const totalDebtMinPayments = debts.reduce((sum, d) => sum + d.minPayment$, 0);
    if (totalDebtMinPayments > 0.01) {
      const monthlyDebtMinPayments = totalDebtMinPayments * paychecksPerMonth;
      needsTotal += monthlyDebtMinPayments;
      needsBreakdown.push({
        label: 'Debt Minimum Payments',
        amount: monthlyDebtMinPayments,
        percentOfBucket: 0,
      });
    }

    // Calculate percentages for breakdown
    if (needsTotal > 0) {
      needsBreakdown.forEach((item) => {
        item.percentOfBucket = (item.amount / needsTotal) * 100;
      });
    }
    if (wantsTotal > 0) {
      wantsBreakdown.forEach((item) => {
        item.percentOfBucket = (item.amount / wantsTotal) * 100;
      });
    }

    const needsPercentOfIncome = monthlyIncome > 0 ? (needsTotal / monthlyIncome) * 100 : 0;
    const wantsPercentOfIncome = monthlyIncome > 0 ? (wantsTotal / monthlyIncome) * 100 : 0;

    return {
      needs: {
        label: 'Needs',
        amount: needsTotal,
        percentOfIncome: needsPercentOfIncome,
        breakdown: needsBreakdown,
      },
      wants: {
        label: 'Wants',
        amount: wantsTotal,
        percentOfIncome: wantsPercentOfIncome,
        breakdown: wantsBreakdown,
      },
    };
  }, [fixedExpenses, debts, income, monthlyIncome]);

  const savingsAmount = monthlyIncome - needs.amount - wants.amount;

  const handleContinue = () => {
    router.push('/onboarding/monthly-plan-design');
  };

  if (!monthlyIncome || monthlyIncome <= 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-red-600 dark:text-red-400 font-medium">
            Income information is required to view your monthly plan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MonthlyPlanCurrent
      income={monthlyIncome}
      needs={needs}
      wants={wants}
      savingsAmount={savingsAmount}
      onContinue={handleContinue}
    />
  );
}

