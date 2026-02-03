/**
 * Monthly Pulse Detail Page
 * 
 * Shows detailed breakdown of Needs, Wants, and Savings with all sub-categories.
 */

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/feed/utils';
import { getPaychecksPerMonth } from '@/lib/onboarding/usePlanData';
import { calculateSavingsBreakdown, calculatePreTaxSavings, calculateEmployerMatch, getGrossIncomeMonthly } from '@/lib/utils/savingsCalculations';

export default function MonthlyPulsePage() {
  const router = useRouter();
  const state = useOnboardingStore();
  const planData = usePlanData();

  const income = state.income;
  const paychecksPerMonth = getPaychecksPerMonth(income?.payFrequency || 'biweekly');
  const monthlyIncome = planData ? planData.paycheckAmount * paychecksPerMonth : 0;
  const grossIncome = income?.grossIncome$
    ? income.grossIncome$ * paychecksPerMonth
    : monthlyIncome;
  const [savingsExpanded, setSavingsExpanded] = useState(false);
  const [savingsBreakdownExpanded, setSavingsBreakdownExpanded] = useState(false);

  // Get targets from riskConstraints or use defaults
  const targets = state.riskConstraints?.targets || {
    needsPct: 0.5,
    wantsPct: 0.3,
    savingsPct: 0.2,
  };

  // Normalize targets if they're in percentage format (50, 30, 20)
  const targetSum = targets.needsPct + targets.wantsPct + targets.savingsPct;
  const normalizedTargets = useMemo(() => {
    if (Math.abs(targetSum - 100) < 1 && Math.abs(targetSum - 1.0) > 0.1) {
      return {
        needsPct: targets.needsPct,
        wantsPct: targets.wantsPct,
        savingsPct: targets.savingsPct,
      };
    }
    return {
      needsPct: targets.needsPct * 100,
      wantsPct: targets.wantsPct * 100,
      savingsPct: targets.savingsPct * 100,
    };
  }, [targets, targetSum]);

  // Calculate breakdowns from plan categories - same as Income page
  const breakdowns = useMemo(() => {
    if (!planData) {
      return {
        needs: [],
        wants: [],
        savings: [],
      };
    }

    // For Needs: Break down essentials into individual fixed expenses, plus show debt minimums separately
    const needsList: Array<{ label: string; amount: number }> = [];
    
    // Add individual fixed expenses (essentials breakdown)
    if (state.fixedExpenses.length > 0) {
      state.fixedExpenses.forEach(exp => {
        needsList.push({
          label: exp.name,
          amount: exp.amount$,
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

    // Wants: Show fun_flexible category
    const wantsList = planData.paycheckCategories
      .filter(cat => cat.key === 'fun_flexible')
      .map(cat => ({
        label: cat.label,
        amount: cat.amount * paychecksPerMonth,
      }));

    // Savings: Break down into individual components
    const savingsList: Array<{ label: string; amount: number }> = [];
    
    // Get individual savings components
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
    
    // Cash Savings = post-tax only. EXCLUDE 401k_match and HSA (pre-tax payroll).
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
      savingsList.push({
        label: longTermCategory.label,
        amount: longTermCategory.amount * paychecksPerMonth,
      });
    }

    return {
      needs: needsList.sort((a, b) => b.amount - a.amount),
      wants: wantsList.sort((a, b) => b.amount - a.amount),
      savings: savingsList.sort((a, b) => b.amount - a.amount),
    };
  }, [planData, paychecksPerMonth, state.fixedExpenses, state.debts]);

  // Calculate totals
  const totalNeeds = breakdowns.needs.reduce((sum, item) => sum + item.amount, 0);
  const totalWants = breakdowns.wants.reduce((sum, item) => sum + item.amount, 0);
  const totalSavings = breakdowns.savings.reduce((sum, item) => sum + item.amount, 0);
  const totalIncome = totalNeeds + totalWants + totalSavings;

  const needsPct = totalIncome > 0 ? (totalNeeds / totalIncome) * 100 : 0;
  const wantsPct = totalIncome > 0 ? (totalWants / totalIncome) * 100 : 0;
  const savingsPct = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

  // Use centralized savings calculation for consistency
  const payrollContributions = state.payrollContributions;
  
  // Calculate monthly needs and wants from plan categories
  // CRITICAL: Use planData categories which reflect the current plan (updated from riskConstraints)
  const monthlyNeeds = useMemo(() => {
    if (!planData) {
      console.log('[Monthly Pulse] No planData, monthlyNeeds = 0');
      return 0;
    }
    const needsCategories = planData.paycheckCategories.filter(c => 
      c.key === 'essentials' || c.key === 'debt_minimums'
    );
    const needs = needsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
    console.log('[Monthly Pulse] Calculated monthlyNeeds:', {
      needsCategoriesCount: needsCategories.length,
      needsCategoriesAmounts: needsCategories.map(c => ({ key: c.key, amount: c.amount })),
      paychecksPerMonth,
      monthlyNeeds: needs,
      riskConstraints: state.riskConstraints,
    });
    return needs;
  }, [planData, paychecksPerMonth, state.riskConstraints]);
  
  const monthlyWants = useMemo(() => {
    if (!planData) {
      console.log('[Monthly Pulse] No planData, monthlyWants = 0');
      return 0;
    }
    const wantsCategories = planData.paycheckCategories.filter(c => c.key === 'fun_flexible');
    const wants = wantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
    console.log('[Monthly Pulse] Calculated monthlyWants:', {
      wantsCategoriesCount: wantsCategories.length,
      wantsCategoriesAmounts: wantsCategories.map(c => ({ key: c.key, amount: c.amount })),
      paychecksPerMonth,
      monthlyWants: wants,
      riskConstraints: state.riskConstraints,
    });
    return wants;
  }, [planData, paychecksPerMonth, state.riskConstraints]);
  
  // Use centralized calculation function
  const savingsBreakdown = useMemo(() => {
    return calculateSavingsBreakdown(income, payrollContributions, monthlyNeeds, monthlyWants);
  }, [income, payrollContributions, monthlyNeeds, monthlyWants]);

  const preTaxSavings = useMemo(
    () => calculatePreTaxSavings(income, payrollContributions),
    [income, payrollContributions]
  );
  const planBasedPayroll = useMemo(() => {
    if (!planData) return null;
    const longTerm = planData.paycheckCategories.find(c => c.key === 'long_term_investing');
    const subs = longTerm?.subCategories;
    if (!subs?.length) return null;
    const matchSub = subs.find(s => s.key === '401k_match');
    const hsaSub = subs.find(s => s.key === 'hsa');
    const plan401kEmployeeMonthly = (matchSub?.amount ?? 0) * paychecksPerMonth;
    const planHsaMonthly = (hsaSub?.amount ?? 0) * paychecksPerMonth;
    if (plan401kEmployeeMonthly < 0.01 && planHsaMonthly < 0.01) return null;
    const grossIncomeMonthly = getGrossIncomeMonthly(income);
    const employerMatchMTD = calculateEmployerMatch(plan401kEmployeeMonthly, grossIncomeMonthly, payrollContributions ?? undefined);
    const payrollSavingsMTD = plan401kEmployeeMonthly + (planHsaMonthly > 0.01 ? planHsaMonthly : preTaxSavings.hsa.monthly);
    return { employerMatchMTD, payrollSavingsMTD };
  }, [planData, paychecksPerMonth, preTaxSavings.hsa.monthly, payrollContributions, income]);

  // Plan-based cash (post-tax) = EF + Debt + Roth + Brokerage
  const emergencyCat = planData?.paycheckCategories.find(c => c.key === 'emergency');
  const debtExtraCat = planData?.paycheckCategories.find(c => c.key === 'debt_extra');
  const longTermCat = planData?.paycheckCategories.find(c => c.key === 'long_term_investing');
  const rothSub = longTermCat?.subCategories?.find(s => s.key === 'retirement_tax_advantaged');
  const brokerageSub = longTermCat?.subCategories?.find(s => s.key === 'brokerage');
  const planBasedCashMTD = (emergencyCat?.amount ?? 0) * paychecksPerMonth
    + (debtExtraCat?.amount ?? 0) * paychecksPerMonth
    + (rothSub?.amount ?? 0) * paychecksPerMonth
    + (brokerageSub?.amount ?? 0) * paychecksPerMonth;
  const observedCashSavingsMTD = planData ? planBasedCashMTD : savingsBreakdown.cashSavingsMTD;
  const expectedPayrollSavingsMTD = planBasedPayroll?.payrollSavingsMTD ?? savingsBreakdown.payrollSavingsMTD;
  const expectedMatchMTD = planBasedPayroll?.employerMatchMTD ?? savingsBreakdown.employerMatchMTD;
  const expectedEmployerHSAMTD = savingsBreakdown.employerHSAMTD;
  const totalSavingsMTD = observedCashSavingsMTD + expectedPayrollSavingsMTD + expectedMatchMTD + expectedEmployerHSAMTD;

  // Calculate targets
  // For now, we'll use the same target percentage for total savings
  // In the future, we might want separate targets for cash vs payroll
  const targetCashSavingsMTD = (normalizedTargets.savingsPct / 100) * monthlyIncome;
  const targetPayrollSavingsMTD = expectedPayrollSavingsMTD; // Target equals expected (from payroll settings)
  const targetMatchMTD = expectedMatchMTD; // Target equals expected match
  const targetTotalSavingsMTD = targetCashSavingsMTD + targetPayrollSavingsMTD + targetMatchMTD;

  if (!planData) {
    return (
      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading monthly pulse...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine pulse headline
  const savingsDelta = totalSavings - (normalizedTargets.savingsPct / 100) * monthlyIncome;
  const pulseHeadline = savingsDelta >= 0
    ? `You're on track this month: +${formatCurrency(Math.abs(savingsDelta))} vs your savings plan.`
    : `You're behind by ${formatCurrency(Math.abs(savingsDelta))} on your savings this month.`;

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Monthly Pulse</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Detailed breakdown of your income allocation
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-8 w-8"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Pulse Summary Card */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="text-xl">Monthly Pulse Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="font-medium text-slate-900 dark:text-white">
                {pulseHeadline}
              </p>

              {/* N/W/S Visualization */}
              <div className="space-y-3">
                {/* Needs */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400">Needs</span>
                    <span className="font-medium">
                      {formatPercent(needsPct)} ({formatCurrency(totalNeeds)})
                    </span>
                  </div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all"
                      style={{ width: `${needsPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Target: {formatPercent(normalizedTargets.needsPct)}
                  </p>
                </div>

                {/* Wants */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400">Wants</span>
                    <span className="font-medium">
                      {formatPercent(wantsPct)} ({formatCurrency(totalWants)})
                    </span>
                  </div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${wantsPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Target: {formatPercent(normalizedTargets.wantsPct)}
                  </p>
                </div>

                {/* Savings - Expandable */}
                <div>
                  <button
                    onClick={() => setSavingsExpanded(!savingsExpanded)}
                    className="w-full"
                  >
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 dark:text-slate-400">Savings</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {formatPercent((totalSavingsMTD / monthlyIncome) * 100)} ({formatCurrency(totalSavingsMTD)})
                        </span>
                        {savingsExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${Math.min((totalSavingsMTD / monthlyIncome) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Target: {formatPercent(normalizedTargets.savingsPct)}
                    </p>
                  </button>

                  {/* Savings Breakdown */}
                  {savingsExpanded && (
                    <div className="mt-3 space-y-2 pl-2 border-l-2 border-green-200 dark:border-green-800">
                      {/* Cash Savings (Post-tax) */}
                      <div className="text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Cash savings (Post-tax):</span>
                          <span className="font-medium text-slate-900 dark:text-white">
                            {formatCurrency(observedCashSavingsMTD)}
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
                              {formatCurrency(expectedPayrollSavingsMTD)}
                            </span>
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 italic">estimated</div>
                        </div>
                      )}

                      {/* Employer Match */}
                      {expectedMatchMTD > 0 && (
                        <div className="text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">Employer match:</span>
                            <span className="font-medium text-green-600 dark:text-green-400">
                              +{formatCurrency(expectedMatchMTD)}
                            </span>
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 italic">estimated</div>
                        </div>
                      )}

                      {/* Total Savings */}
                      <div className="text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between font-semibold">
                          <span className="text-slate-700 dark:text-slate-300">Total Savings (Cash + Payroll + Match):</span>
                          <span className="text-slate-900 dark:text-white">
                            {formatCurrency(totalSavingsMTD)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Needs Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Needs</CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Total: {formatCurrency(totalNeeds)} ({formatPercent(needsPct)})
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {breakdowns.needs.length > 0 ? (
                  breakdowns.needs.map((item) => {
                    const maxAmount = Math.max(...breakdowns.needs.map(e => e.amount), 1);
                    const widthPct = (item.amount / maxAmount) * 100;
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.label}</span>
                          <span className="font-semibold">{formatCurrency(item.amount)}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className="h-full bg-orange-500 transition-all"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-400">No needs categories</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Wants Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Wants</CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Total: {formatCurrency(totalWants)} ({formatPercent(wantsPct)})
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {breakdowns.wants.length > 0 ? (
                  breakdowns.wants.map((item) => {
                    const maxAmount = Math.max(...breakdowns.wants.map(e => e.amount), 1);
                    const widthPct = (item.amount / maxAmount) * 100;
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.label}</span>
                          <span className="font-semibold">{formatCurrency(item.amount)}</span>
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
                  <p className="text-sm text-slate-600 dark:text-slate-400">No wants categories</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Savings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Savings</CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Total Savings /month: {formatCurrency(totalSavingsMTD)} ({grossIncome ? ((totalSavingsMTD / grossIncome) * 100).toFixed(0) : savingsPct.toFixed(0)}% of Gross Income)
              </p>
            </CardHeader>
            <CardContent>
              {/* Savings Breakdown Header - Expandable */}
              <div className="mb-4">
                <button
                  onClick={() => setSavingsBreakdownExpanded(!savingsBreakdownExpanded)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Savings Breakdown</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatCurrency(totalSavingsMTD)}
                      </span>
                      {savingsBreakdownExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Savings Breakdown Details */}
                {savingsBreakdownExpanded && (
                  <div className="mt-3 space-y-2 pl-2 border-l-2 border-green-200 dark:border-green-800">
                    {/* Cash Savings (Post-tax) */}
                    <div className="text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Cash savings (Post-tax):</span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {formatCurrency(observedCashSavingsMTD)}
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
                            {formatCurrency(expectedPayrollSavingsMTD)}
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
                            +{formatCurrency(expectedMatchMTD)}
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
                            +{formatCurrency(expectedEmployerHSAMTD)}
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
                          {formatCurrency(totalSavingsMTD)}
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
                  breakdowns.savings.map((item) => {
                    const maxAmount = Math.max(...breakdowns.savings.map(s => s.amount), 1);
                    const widthPct = (item.amount / maxAmount) * 100;
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.label}</span>
                          <span className="font-semibold">{formatCurrency(item.amount)}</span>
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
                  <p className="text-sm text-slate-600 dark:text-slate-400">No savings categories</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

