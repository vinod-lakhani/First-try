/**
 * Monthly Plan Design Page
 * 
 * Step 2 of 2: Allows user to design/edit their monthly plan.
 */

'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { getPaychecksPerMonth } from '@/lib/onboarding/usePlanData';
import { generateInitialPaycheckPlanFromEngines } from '@/lib/onboarding/plan';
import MonthlyPlanDesign from '@/components/monthly-plan/MonthlyPlanDesign';

export default function MonthlyPlanDesignPage() {
  const router = useRouter();
  const store = useOnboardingStore();
  const { income, fixedExpenses, debts, setInitialPaycheckPlan, setCurrentStep } = store;
  const planData = usePlanData();

  // Calculate current monthly values (actuals)
  const { currentIncome, currentNeeds, currentWants } = useMemo(() => {
    const incomeAmount = income?.netIncome$ || income?.grossIncome$ || 0;
    const payFrequency = income?.payFrequency || 'biweekly';
    const paychecksPerMonth = getPaychecksPerMonth(payFrequency);
    const monthlyIncome = incomeAmount * paychecksPerMonth;

    // Calculate actual needs and wants from expenses
    let needsTotal = 0;
    let wantsTotal = 0;

    for (const expense of fixedExpenses) {
      let monthlyAmount = expense.amount$;
      if (expense.frequency === 'weekly') monthlyAmount = expense.amount$ * 4.33;
      else if (expense.frequency === 'biweekly') monthlyAmount = expense.amount$ * 2.17;
      else if (expense.frequency === 'semimonthly') monthlyAmount = expense.amount$ * 2;
      else if (expense.frequency === 'yearly') monthlyAmount = expense.amount$ / 12;

      if (expense.category === 'needs' || !expense.category) {
        needsTotal += monthlyAmount;
      } else if (expense.category === 'wants') {
        wantsTotal += monthlyAmount;
      }
    }

    // Add debt minimum payments to needs
    const totalDebtMinPayments = debts.reduce((sum, d) => sum + d.minPayment$, 0);
    if (totalDebtMinPayments > 0.01) {
      needsTotal += totalDebtMinPayments * paychecksPerMonth;
    }

    return {
      currentIncome: monthlyIncome,
      currentNeeds: needsTotal,
      currentWants: wantsTotal,
    };
  }, [income, fixedExpenses, debts]);

  // Calculate recommended values from plan engine
  const { recommendedIncome, recommendedNeeds, recommendedWants } = useMemo(() => {
    try {
      if (!income?.netIncome$ && !income?.grossIncome$) {
        return {
          recommendedIncome: currentIncome,
          recommendedNeeds: currentNeeds,
          recommendedWants: currentWants,
        };
      }

      const paycheckPlan = generateInitialPaycheckPlanFromEngines(store);
      const payFrequency = income?.payFrequency || 'biweekly';
      const paychecksPerMonth = getPaychecksPerMonth(payFrequency);

      return {
        recommendedIncome: currentIncome, // Use current income as recommended
        recommendedNeeds: paycheckPlan.needs$ * paychecksPerMonth,
        recommendedWants: paycheckPlan.wants$ * paychecksPerMonth,
      };
    } catch (error) {
      console.error('Failed to generate recommended plan:', error);
      return {
        recommendedIncome: currentIncome,
        recommendedNeeds: currentNeeds,
        recommendedWants: currentWants,
      };
    }
  }, [store, currentIncome, currentNeeds, currentWants, income]);

  const handleSave = (plan: { income: number; needs: number; wants: number; savings: number }) => {
    // Convert monthly values back to per-paycheck for storage
    const payFrequency = income?.payFrequency || 'biweekly';
    const paychecksPerMonth = getPaychecksPerMonth(payFrequency);
    
    const paycheckPlan = {
      needs$: plan.needs / paychecksPerMonth,
      wants$: plan.wants / paychecksPerMonth,
      savings$: plan.savings / paychecksPerMonth,
      categories: [
        {
          name: 'Needs',
          percentage: (plan.needs / plan.income) * 100,
          amount$: plan.needs / paychecksPerMonth,
        },
        {
          name: 'Wants',
          percentage: (plan.wants / plan.income) * 100,
          amount$: plan.wants / paychecksPerMonth,
        },
        {
          name: 'Savings',
          percentage: (plan.savings / plan.income) * 100,
          amount$: plan.savings / paychecksPerMonth,
        },
      ],
      notes: [],
    };

    setInitialPaycheckPlan(paycheckPlan);
    setCurrentStep('payroll-contributions');
    router.push('/onboarding/payroll-contributions');
  };

  if (!currentIncome || currentIncome <= 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-red-600 dark:text-red-400 font-medium">
            Income information is required to design your monthly plan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MonthlyPlanDesign
      currentIncome={currentIncome}
      currentNeeds={currentNeeds}
      currentWants={currentWants}
      recommendedIncome={recommendedIncome}
      recommendedNeeds={recommendedNeeds}
      recommendedWants={recommendedWants}
      onSave={handleSave}
    />
  );
}

