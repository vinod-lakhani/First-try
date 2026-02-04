/**
 * Income Tab
 * 
 * Comprehensive income breakdown with allocation charts and detailed breakdowns.
 */

'use client';

import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IncomeDistributionChart } from '@/components/charts/IncomeDistributionChart';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { calculateDisplaySavingsBreakdown } from '@/lib/utils/savingsCalculations';

// Helper to get paychecks per month (internal use only)
function getPaychecksPerMonth(frequency: string | undefined): number {
  switch (frequency) {
    case 'weekly':
      return 4.33;
    case 'biweekly':
      return 2.17;
    case 'semimonthly':
      return 2;
    case 'monthly':
    default:
      return 1;
  }
}

export default function IncomePage() {
  const router = useRouter();
  const state = useOnboardingStore();
  const planData = usePlanData(); // Use centralized hook for consistency
  const [savingsExpanded, setSavingsExpanded] = useState(false);

  const income = state.income;
  const paychecksPerMonth = getPaychecksPerMonth(income?.payFrequency || 'monthly');
  const takeHomePayPerPeriod = planData?.paycheckAmount || 0;
  const monthlyTakeHomePay = takeHomePayPerPeriod * paychecksPerMonth;
  const grossIncome = income?.grossIncome$
    ? income.grossIncome$ * paychecksPerMonth
    : monthlyTakeHomePay;

  // Calculate tax and deductions breakdown - must be called unconditionally
  const taxBreakdown = useMemo(() => {
    if (!grossIncome || !monthlyTakeHomePay) return null;
    
    const totalDeductions = grossIncome - monthlyTakeHomePay;
    const federalTax = totalDeductions * 0.4; // Rough estimate
    const stateTax = totalDeductions * 0.15;
    const fica = totalDeductions * 0.2;
    const otherDeductions = totalDeductions * 0.15;
    const benefits = totalDeductions * 0.1;

    return {
      takeHomePay: monthlyTakeHomePay,
      tax: federalTax + stateTax + fica,
      deductions: otherDeductions,
      benefits,
      federalTax,
      stateTax,
      fica,
      otherDeductions,
    };
  }, [grossIncome, monthlyTakeHomePay]);

  // Calculate breakdowns from plan categories - must be called unconditionally
  // Show all individual subcategories, not lumped together
  // CRITICAL: This must recalculate when planData changes (which happens when riskConstraints change)
  const breakdowns = useMemo(() => {
    if (!planData) {
      console.log('[Income Page] No planData, returning empty breakdowns');
      return {
        needs: [],
        wants: [],
        savings: [],
      };
    }
    
    console.log('[Income Page] Calculating breakdowns from planData:', {
      paycheckCategoriesCount: planData.paycheckCategories.length,
      categories: planData.paycheckCategories.map(c => ({
        key: c.key,
        label: c.label,
        amount: c.amount,
        hasSubCategories: !!c.subCategories,
        subCategoriesCount: c.subCategories?.length || 0,
      })),
      riskConstraints: state.riskConstraints,
    });

    // For Needs: Break down essentials into individual fixed expenses, plus show debt minimums separately
    const needsList: Array<{ label: string; amount: number }> = [];
    
    // Add individual fixed expenses (essentials breakdown)
    // All expenses should be stored as monthly (single source of truth)
    // Show actual expenses from store - no scaling
    if (state.fixedExpenses.length > 0) {
      state.fixedExpenses.forEach(exp => {
        needsList.push({
          label: exp.name,
          amount: exp.amount$, // amount$ is already monthly
        });
      });
    } else {
      // Fallback: show essentials category if no fixed expenses
      const essentialsCategory = planData.paycheckCategories.find(cat => cat.key === 'essentials');
      if (essentialsCategory) {
        needsList.push({
          label: essentialsCategory.label,
          amount: essentialsCategory.amount * paychecksPerMonth,
        });
      }
    }
    
    // Add debt minimums (show each debt separately)
    // Debt minPayment$ is stored as per-paycheck, convert to monthly
    if (state.debts.length > 0) {
      state.debts.forEach(debt => {
        // Convert per-paycheck debt payment to monthly
        const monthlyDebtPayment = debt.minPayment$ * paychecksPerMonth;
        needsList.push({
          label: debt.name,
          amount: monthlyDebtPayment,
        });
      });
    } else {
      // Fallback: show debt minimums category if no debts
      const debtMinCategory = planData.paycheckCategories.find(cat => cat.key === 'debt_minimums');
      if (debtMinCategory) {
        needsList.push({
          label: debtMinCategory.label,
          amount: debtMinCategory.amount * paychecksPerMonth,
        });
      }
    }

    // Wants: Show fun_flexible category (already individual)
    const wantsList = planData.paycheckCategories
      .filter(cat => cat.key === 'fun_flexible')
      .map(cat => ({
        label: cat.label,
        amount: cat.amount * paychecksPerMonth,
      }));

    // Savings: Break down into individual components
    const savingsList: Array<{ label: string; amount: number }> = [];
    
    // Get individual savings components by recalculating savings allocation
    const emergencyCategory = planData.paycheckCategories.find(cat => cat.key === 'emergency');
    const debtExtraCategory = planData.paycheckCategories.find(cat => cat.key === 'debt_extra');
    const longTermCategory = planData.paycheckCategories.find(cat => cat.key === 'long_term_investing');
    
    // Add Emergency Savings
    if (emergencyCategory) {
      savingsList.push({
        label: emergencyCategory.label,
        amount: emergencyCategory.amount * paychecksPerMonth,
      });
    }
    
    // Add Extra Debt Paydown
    if (debtExtraCategory) {
      savingsList.push({
        label: debtExtraCategory.label,
        amount: debtExtraCategory.amount * paychecksPerMonth,
      });
    }
    
    // Break down Long-Term Investing into components using subCategories from planData
    // Cash Savings = POST-TAX only. EXCLUDE 401k_match and HSA (both are pre-tax payroll).
    if (longTermCategory && longTermCategory.subCategories) {
      longTermCategory.subCategories.forEach(subCat => {
        const monthlyAmount = subCat.amount * paychecksPerMonth;
        const isPreTax = subCat.key === '401k_match' || subCat.key === 'hsa';
        if (monthlyAmount > 0.01 && !isPreTax) {
          savingsList.push({
            label: subCat.label,
            amount: monthlyAmount,
          });
        }
      });
    } else if (longTermCategory) {
      // Fallback: if no subCategories, show the total (but check if it's not a match category)
      const labelLower = longTermCategory.label.toLowerCase();
      if (!labelLower.includes('match')) {
        savingsList.push({
          label: longTermCategory.label,
          amount: longTermCategory.amount * paychecksPerMonth,
        });
      }
    }

    const result = {
      needs: needsList.sort((a, b) => b.amount - a.amount),
      wants: wantsList.sort((a, b) => b.amount - a.amount),
      savings: savingsList, // Keep order: Extra Debt Paydown, Emergency Savings, Retirement Tax-Advantaged, Brokerage (401k Match excluded - it's pre-tax)
    };
    
    console.log('[Income Page] Calculated breakdowns:', {
      needsCount: result.needs.length,
      wantsCount: result.wants.length,
      savingsCount: result.savings.length,
      savingsBreakdown: result.savings.map(s => ({ label: s.label, amount: s.amount })),
      totalSavings: result.savings.reduce((sum, s) => sum + s.amount, 0),
    });
    
    return result;
  }, [planData, paychecksPerMonth, state.fixedExpenses, state.debts, state.riskConstraints]);

  // Calculate totals from plan data to ensure consistency
  // Needs = essentials + debt_minimums from paycheckCategories
  const needsCategories = planData?.paycheckCategories.filter(c => 
    c.key === 'essentials' || c.key === 'debt_minimums'
  ) || [];
  const wantsCategories = planData?.paycheckCategories.filter(c => 
    c.key === 'fun_flexible'
  ) || [];
  const savingsCategories = planData?.paycheckCategories.filter(c => 
    c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
  ) || [];

  const totalFixedExpenses = needsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
  const totalVariableExpenses = wantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
  
  // Plan-based amounts (for allocation display)
  const debtExtraCategory = planData?.paycheckCategories.find(c => c.key === 'debt_extra');
  const emergencyCategory = planData?.paycheckCategories.find(c => c.key === 'emergency');
  const longTermCategory = planData?.paycheckCategories.find(c => c.key === 'long_term_investing');
  
  const monthlyDebtExtra = (debtExtraCategory?.amount || 0) * paychecksPerMonth;
  const monthlyEmergency = (emergencyCategory?.amount || 0) * paychecksPerMonth;
  const match401kSub = longTermCategory?.subCategories?.find(s => s.key === '401k_match');
  const hsaSub = longTermCategory?.subCategories?.find(s => s.key === 'hsa');
  const retirementTaxAdvSub = longTermCategory?.subCategories?.find(s => s.key === 'retirement_tax_advantaged');
  const brokerageSub = longTermCategory?.subCategories?.find(s => s.key === 'brokerage');
  
  const monthly401kPlan = (match401kSub?.amount || 0) * paychecksPerMonth;
  const monthlyHsaPlan = (hsaSub?.amount || 0) * paychecksPerMonth;
  const monthlyRetirementTaxAdv = (retirementTaxAdvSub?.amount || 0) * paychecksPerMonth;
  const monthlyBrokerage = (brokerageSub?.amount || 0) * paychecksPerMonth;
  
  // Total savings from plan (for allocation % before we have planBasedPayroll)
  const totalSavingsFromPlan = monthlyDebtExtra + monthlyEmergency + monthly401kPlan + monthlyHsaPlan + monthlyRetirementTaxAdv + monthlyBrokerage;

  // Calculate percentages - use same method as Income tool (normalize by sum of needs+wants+savings)
  // This ensures consistency with the Income tool's "Current Plan"
  const totalAllocated = totalFixedExpenses + totalVariableExpenses + totalSavingsFromPlan;
  const needsPctNormalized = totalAllocated > 0 ? totalFixedExpenses / totalAllocated : 0;
  const wantsPctNormalized = totalAllocated > 0 ? totalVariableExpenses / totalAllocated : 0;
  const savingsPctNormalized = totalAllocated > 0 ? totalSavingsFromPlan / totalAllocated : 0;

  // Calculate percentages of gross income for display
  const fixedExpensesPct = grossIncome ? (totalFixedExpenses / grossIncome) * 100 : 0;
  const variableExpensesPct = grossIncome ? (totalVariableExpenses / grossIncome) * 100 : 0;
  const savingsPct = grossIncome ? (totalSavingsFromPlan / grossIncome) * 100 : 0;

  // Single source of truth: same function as Monthly Pulse and plan-final
  const payrollContributions = state.payrollContributions;
  const monthlyNeeds = useMemo(() => {
    if (!planData) return 0;
    const needsCategories = planData.paycheckCategories.filter(c => 
      c.key === 'essentials' || c.key === 'debt_minimums'
    );
    return needsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
  }, [planData, paychecksPerMonth]);
  const monthlyWants = useMemo(() => {
    if (!planData) return 0;
    const wantsCategories = planData.paycheckCategories.filter(c => c.key === 'fun_flexible');
    return wantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
  }, [planData, paychecksPerMonth]);

  const displaySavings = useMemo(
    () => calculateDisplaySavingsBreakdown(
      income,
      payrollContributions,
      monthlyNeeds,
      monthlyWants,
      planData?.paycheckCategories ?? null,
      state.safetyStrategy?.customSavingsAllocation ?? undefined
    ),
    [income, payrollContributions, monthlyNeeds, monthlyWants, planData?.paycheckCategories, state.safetyStrategy?.customSavingsAllocation]
  );
  const observedCashSavingsMTD = displaySavings.cashSavingsMTD;
  const expectedPayrollSavingsMTD = displaySavings.payrollSavingsMTD;
  const expectedMatchMTD = displaySavings.employerMatchMTD;
  const expectedEmployerHSAMTD = displaySavings.employerHSAMTD;
  const totalSavingsMTD = displaySavings.totalSavingsMTD;

  if (!planData) {
    return (
      <div className="flex min-h-[calc(100vh-73px)] flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto w-full max-w-lg">
            <Card className="w-full">
              <CardContent className="py-12 text-center">
                <p className="text-slate-600 dark:text-slate-400">
                  Loading your monthly plan...
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
      {/* Income Allocation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Income Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <IncomeDistributionChart
            takeHomePay={monthlyTakeHomePay}
            grossIncome={grossIncome}
            categories={planData.paycheckCategories.map(cat => ({
              label: cat.label,
              amount: cat.amount * paychecksPerMonth,
              percent: cat.percent,
              color: 
                cat.key === 'essentials' || cat.key === 'debt_minimums' ? '#f97316' : // orange
                cat.key === 'fun_flexible' ? '#3b82f6' : // blue
                '#14b8a6', // teal
              why: cat.why,
            }))}
            size={280}
            totalSavings={totalSavingsMTD}
            savingsBreakdown={[
              {
                label: 'Cash Savings',
                amount: observedCashSavingsMTD,
                percent: grossIncome ? (observedCashSavingsMTD / grossIncome) * 100 : (observedCashSavingsMTD / monthlyTakeHomePay) * 100,
              },
              {
                label: 'Payroll Savings',
                amount: expectedPayrollSavingsMTD,
                percent: grossIncome ? (expectedPayrollSavingsMTD / grossIncome) * 100 : (expectedPayrollSavingsMTD / monthlyTakeHomePay) * 100,
              },
              {
                label: '401K Match',
                amount: expectedMatchMTD,
                percent: grossIncome ? (expectedMatchMTD / grossIncome) * 100 : (expectedMatchMTD / monthlyTakeHomePay) * 100,
              },
              {
                label: 'Employer HSA',
                amount: expectedEmployerHSAMTD,
                percent: grossIncome ? (expectedEmployerHSAMTD / grossIncome) * 100 : (expectedEmployerHSAMTD / monthlyTakeHomePay) * 100,
              },
            ].filter(item => item.amount > 0.01)}
          />
          <div className="mt-4 flex justify-center">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/app/tools/savings-helper')}
            >
              Edit Income Distribution
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Take Home Pay Estimation */}
      {taxBreakdown && grossIncome && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Take Home Pay Estimation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Take Home Pay /month</p>
                  <p className="text-lg font-semibold">${taxBreakdown.takeHomePay.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Tax /month</p>
                  <p className="text-lg font-semibold">${taxBreakdown.tax.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Deductions /month</p>
                  <p className="text-lg font-semibold">${taxBreakdown.deductions.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Benefits /month</p>
                  <p className="text-lg font-semibold">${taxBreakdown.benefits.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                </div>
              </div>
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                    <span>Gross Income /month</span>
                  </div>
                  <span className="font-semibold">${grossIncome.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-orange-500"></div>
                    <span>401K Deductions</span>
                  </div>
                  <span className="font-semibold">-${(taxBreakdown.otherDeductions * 0.6).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                    <span>Federal Taxes</span>
                  </div>
                  <span className="font-semibold">-${taxBreakdown.federalTax.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                    <span>State Taxes</span>
                  </div>
                  <span className="font-semibold">-${taxBreakdown.stateTax.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                    <span>FICA (Medicare + SS)</span>
                  </div>
                  <span className="font-semibold">-${taxBreakdown.fica.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                    <span>Take Home Pay /month</span>
                  </div>
                  <span className="font-semibold">${taxBreakdown.takeHomePay.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                    <span>Benefits (401K + HSA Match)</span>
                  </div>
                  <span className="font-semibold">+${taxBreakdown.benefits.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

                  {/* Needs */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Needs</CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Total Needs /month: ${totalFixedExpenses.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({fixedExpensesPct.toFixed(0)}% of Gross Income)
                      </p>
                    </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {breakdowns.needs.map((expense) => {
              const maxAmount = Math.max(...breakdowns.needs.map(e => e.amount), 1);
              const widthPct = (expense.amount / maxAmount) * 100;
              return (
                <div key={expense.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{expense.label}</span>
                    <span className="font-semibold">${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full bg-orange-500 transition-all"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

                  {/* Wants */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Wants</CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Total Wants /month: ${totalVariableExpenses.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({variableExpensesPct.toFixed(0)}% of Gross Income)
                      </p>
                    </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {breakdowns.wants.length > 0 ? (
              breakdowns.wants.map((expense) => {
                const maxAmount = Math.max(...breakdowns.wants.map(e => e.amount), 1);
                const widthPct = (expense.amount / maxAmount) * 100;
                return (
                  <div key={expense.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{expense.label}</span>
                      <span className="font-semibold">${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">No variable expenses tracked</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Savings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Savings</CardTitle>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Total Savings /month: ${totalSavingsMTD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({grossIncome ? ((totalSavingsMTD / grossIncome) * 100).toFixed(0) : savingsPct.toFixed(0)}% of Gross Income)
          </p>
        </CardHeader>
        <CardContent>
          {/* Savings Breakdown Header - Expandable */}
          <div className="mb-4">
            <button
              onClick={() => setSavingsExpanded(!savingsExpanded)}
              className="w-full text-left"
            >
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">Savings Breakdown</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {totalSavingsMTD.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  {savingsExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </div>
            </button>

            {/* Savings Breakdown Details */}
            {savingsExpanded && (
              <div className="mt-3 space-y-2 pl-2 border-l-2 border-green-200 dark:border-green-800">
                {/* Cash Savings (Post-tax) */}
                <div className="text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Cash savings (Post-tax):</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      ${observedCashSavingsMTD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 italic">observed</div>
                </div>

                {/* Payroll Savings (Pre-tax) */}
                {expectedPayrollSavingsMTD > 0 && (
                  <div className="text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Payroll savings (Pre-tax):</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        ${expectedPayrollSavingsMTD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 italic">estimated</div>
                  </div>
                )}

                {/* Employer 401K Match */}
                {expectedMatchMTD > 0 && (
                  <div className="text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Employer 401K match:</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        +${expectedMatchMTD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 italic">estimated</div>
                  </div>
                )}

                {/* Employer HSA */}
                {expectedEmployerHSAMTD > 0 && (
                  <div className="text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Employer HSA:</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        +${expectedEmployerHSAMTD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 italic">estimated</div>
                  </div>
                )}

                {/* Total Savings */}
                <div className="text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-700 dark:text-slate-300">Total Savings (Cash + Payroll + Employer 401K Match + Employee HSA + Employer HSA):</span>
                    <span className="text-slate-900 dark:text-white">
                      ${totalSavingsMTD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Savings Subcategories */}
          <div className="space-y-3 border-t pt-4">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Cash Savings Categories:</p>
            {breakdowns.savings.length > 0 ? (
              breakdowns.savings.map((saving) => {
                const maxAmount = Math.max(...breakdowns.savings.map(s => s.amount), 1);
                const widthPct = (saving.amount / maxAmount) * 100;
                return (
                  <div key={saving.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{saving.label}</span>
                      <span className="font-semibold">${saving.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">No savings allocations</p>
            )}
          </div>
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  );
}
