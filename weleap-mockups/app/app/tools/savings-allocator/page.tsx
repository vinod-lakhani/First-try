/**
 * Savings Allocator
 * 
 * Allows users to adjust savings allocation across buckets using sliders
 * and see immediate impact on long-term net worth.
 */

'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData, getPaychecksPerMonth } from '@/lib/onboarding/usePlanData';
import { buildFinalPlanData, type FinalPlanData } from '@/lib/onboarding/plan';
import { simulateScenario, type ScenarioInput, type MonthlyPlan as SimMonthlyPlan } from '@/lib/sim/netWorth';
import type { OnboardingState } from '@/lib/onboarding/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, ArrowRight, AlertTriangle, HelpCircle, Edit, CheckCircle2, Plus, Minus } from 'lucide-react';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { calculateSavingsBreakdown } from '@/lib/utils/savingsCalculations';

type PaycheckCategoryWithSubs = FinalPlanData['paycheckCategories'][number] & {
  subCategories?: Array<{
    id?: string;
    key: '401k_match' | 'retirement_tax_advantaged' | 'brokerage';
    label?: string;
    amount: number;
    percent?: number;
  }>;
};

// Estimate marginal tax rate (federal + state)
const ESTIMATED_MARGINAL_TAX_RATE = 0.25; // 25% combined federal + state

function SavingsAllocatorContent() {
  const router = useRouter();
  const baselineState = useOnboardingStore();
  
  // Use centralized hook for baseline plan data
  const baselinePlanDataFromHook = usePlanData();
  const baselinePlanData = baselinePlanDataFromHook;
  
  // Debug: Log when planData changes
  useEffect(() => {
    console.log('[Savings Allocator] baselinePlanData changed:', {
      hasPlanData: !!baselinePlanData,
      categoriesCount: baselinePlanData?.paycheckCategories.length,
      riskConstraints: baselineState.riskConstraints,
      categories: baselinePlanData?.paycheckCategories.map(c => ({
        key: c.key,
        amount: c.amount,
        monthly: c.amount * paychecksPerMonth,
      })),
    });
  }, [baselinePlanData, baselineState.riskConstraints, paychecksPerMonth]);

  const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
  const monthlyIncome = (baselineState.income?.netIncome$ || baselineState.income?.grossIncome$ || 0) * paychecksPerMonth;

  // Get baseline savings budget and allocation details
  const baselineSavingsData = useMemo(() => {
    if (!baselinePlanData) return null;

    const savingsCategories = baselinePlanData.paycheckCategories.filter(c => 
      c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
    );
    const monthlySavings = savingsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;

    // Extract individual category amounts
    const emergencyCategory = baselinePlanData.paycheckCategories.find(c => c.key === 'emergency');
    const debtExtraCategory = baselinePlanData.paycheckCategories.find(c => c.key === 'debt_extra');
    const longTermCategory = baselinePlanData.paycheckCategories.find(
      c => c.key === 'long_term_investing'
    ) as PaycheckCategoryWithSubs | undefined;
    
    let match401k$ = 0;
    let retirementTaxAdv$ = 0;
    let brokerage$ = 0;
    
    if (longTermCategory?.subCategories) {
      const matchSub = longTermCategory.subCategories.find((s) => s.key === '401k_match');
      const retirementSub = longTermCategory.subCategories.find(
        (s) => s.key === 'retirement_tax_advantaged'
      );
      const brokerageSub = longTermCategory.subCategories.find((s) => s.key === 'brokerage');
      
      match401k$ = (matchSub?.amount || 0) * paychecksPerMonth;
      retirementTaxAdv$ = (retirementSub?.amount || 0) * paychecksPerMonth;
      brokerage$ = (brokerageSub?.amount || 0) * paychecksPerMonth;
    }

    return {
      monthlySavings,
      ef$: (emergencyCategory?.amount || 0) * paychecksPerMonth,
      debt$: (debtExtraCategory?.amount || 0) * paychecksPerMonth,
      match401k$,
      retirementTaxAdv$,
      brokerage$,
    };
  }, [baselinePlanData, paychecksPerMonth]);

  // Get EF and debt data for caps
  const efTargetMonths = baselineState.safetyStrategy?.efTargetMonths || 3;
  const monthlyBasics = baselineState.fixedExpenses
    .filter(e => e.category === 'needs')
    .reduce((sum, e) => sum + e.amount$, 0);
  const efTarget$ = monthlyBasics > 0 ? monthlyBasics * efTargetMonths : monthlyIncome * 0.3 * efTargetMonths;
  const efBalance$ = baselineState.safetyStrategy?.efBalance$ || 
    baselineState.assets.filter(a => a.type === 'cash').reduce((sum, a) => sum + a.value$, 0);
  const efGap$ = Math.max(0, efTarget$ - efBalance$);

  const highAprDebts = baselineState.debts
    .filter(d => d.isHighApr || d.aprPct > 10)
    .map(d => ({ 
      id: d.id,
      name: d.name,
      balance$: d.balance$, 
      aprPct: d.aprPct,
      minPayment$: d.minPayment$,
    }));
  const totalDebtBalance$ = highAprDebts.reduce((sum, d) => sum + d.balance$, 0);

  // match401kPerMonth$ is already monthly, use directly
  const matchNeedThisPeriod$ = baselineState.safetyStrategy?.match401kPerMonth$ || 0;

  // Calculate monthly needs and wants from plan categories for centralized calculation
  // CRITICAL: This must use the latest planData which reflects updated riskConstraints
  const monthlyNeeds = useMemo(() => {
    if (!baselinePlanData) {
      console.log('[Savings Allocator] No baselinePlanData, monthlyNeeds = 0');
      return 0;
    }
    const needsCategories = baselinePlanData.paycheckCategories.filter(c => 
      c.key === 'essentials' || c.key === 'debt_minimums'
    );
    const needs = needsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
    console.log('[Savings Allocator] Calculated monthlyNeeds:', {
      needsCategoriesCount: needsCategories.length,
      needsCategoriesAmounts: needsCategories.map(c => ({ key: c.key, amount: c.amount })),
      paychecksPerMonth,
      monthlyNeeds: needs,
    });
    return needs;
  }, [baselinePlanData, paychecksPerMonth]);
  
  const monthlyWants = useMemo(() => {
    if (!baselinePlanData) {
      console.log('[Savings Allocator] No baselinePlanData, monthlyWants = 0');
      return 0;
    }
    const wantsCategories = baselinePlanData.paycheckCategories.filter(c => c.key === 'fun_flexible');
    const wants = wantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
    console.log('[Savings Allocator] Calculated monthlyWants:', {
      wantsCategoriesCount: wantsCategories.length,
      wantsCategoriesAmounts: wantsCategories.map(c => ({ key: c.key, amount: c.amount })),
      paychecksPerMonth,
      monthlyWants: wants,
    });
    return wants;
  }, [baselinePlanData, paychecksPerMonth]);
  
  // Use centralized savings calculation for consistency
  const savingsBreakdown = useMemo(() => {
    return calculateSavingsBreakdown(
      baselineState.income,
      baselineState.payrollContributions,
      monthlyNeeds,
      monthlyWants
    );
  }, [baselineState.income, baselineState.payrollContributions, monthlyNeeds, monthlyWants]);
  
  // Calculate pre-tax payroll savings estimates (needed for match recommendation)
  // We still need individual 401k calculation for match recommendation logic
  const preTaxSavings = useMemo(() => {
    const { income, payrollContributions } = baselineState;
    if (!income || !payrollContributions) {
      return {
        traditional401k: { percent: null, monthly: 0 },
        hsa: { monthly: 0 },
        employerMatch: { monthly: 0 },
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

    // Use employer match from centralized calculation for consistency
    return {
      traditional401k: {
        percent: traditional401kPercent,
        monthly: traditional401kMonthly,
      },
      hsa: {
        monthly: hsaMonthly,
      },
      employerMatch: {
        monthly: savingsBreakdown.employerMatchMTD,
      },
      total: savingsBreakdown.preTaxSavingsTotal,
    };
  }, [baselineState.income, baselineState.payrollContributions, savingsBreakdown.employerMatchMTD, savingsBreakdown.preTaxSavingsTotal]);

  // Calculate post-tax savings available (cash that can be allocated) - use centralized calculation
  const postTaxSavingsAvailable = savingsBreakdown.cashSavingsMTD;
  
  // Debug logging to trace the calculation
  console.log('[Savings Allocator] Post-tax savings calculation:', {
    monthlyNeeds,
    monthlyWants,
    monthlyIncome: baselineState.income ? (baselineState.income.netIncome$ || baselineState.income.grossIncome$ || 0) * paychecksPerMonth : 0,
    baseSavingsMonthly: savingsBreakdown.baseSavingsMonthly,
    preTaxSavingsTotal: savingsBreakdown.preTaxSavingsTotal,
    netPreTaxImpact: savingsBreakdown.netPreTaxImpact,
    cashSavingsMTD: savingsBreakdown.cashSavingsMTD,
    postTaxSavingsAvailable,
    riskConstraints: baselineState.riskConstraints,
    planDataCategories: baselinePlanData?.paycheckCategories.map(c => ({
      key: c.key,
      label: c.label,
      amount: c.amount,
      monthly: c.amount * paychecksPerMonth,
    })),
  });


  // Calculate match capture recommendation
  const matchRecommendation = useMemo(() => {
    const { income, payrollContributions } = baselineState;
    if (!income || !payrollContributions || !payrollContributions.has401k || payrollContributions.hasEmployerMatch !== "yes") {
      return null;
    }

    if (!payrollContributions.employerMatchPct || !payrollContributions.employerMatchCapPct) {
      return null;
    }

    const paychecksPerMonth = getPaychecksPerMonth(income.payFrequency || 'biweekly');
    const grossIncomePerPaycheck = income.grossIncome$ || income.netIncome$ || 0;
    const grossIncomeMonthly = grossIncomePerPaycheck * paychecksPerMonth;

    // Calculate required contribution to capture full match
    const matchRequiredPercent = payrollContributions.employerMatchCapPct;
    const matchRequiredMonthly = (grossIncomeMonthly * matchRequiredPercent) / 100;

    // Current contribution
    const current401kMonthly = preTaxSavings.traditional401k.monthly;
    const current401kPercent = preTaxSavings.traditional401k.percent || 0;

    // Check if match is captured
    const isMatchCaptured = current401kMonthly >= matchRequiredMonthly;

    if (isMatchCaptured) {
      return null; // No recommendation needed
    }

    // Calculate deltas
    const delta401kMonthly = matchRequiredMonthly - current401kMonthly;
    const delta401kPercent = matchRequiredPercent - current401kPercent;

    // Calculate new match amount
    const newMatchMonthly = (matchRequiredMonthly * payrollContributions.employerMatchPct) / 100;
    const currentMatchMonthly = preTaxSavings.employerMatch.monthly;
    const deltaMatchMonthly = newMatchMonthly - currentMatchMonthly;

    return {
      isMatchCaptured: false,
      currentPercent: current401kPercent,
      recommendedPercent: matchRequiredPercent,
      currentMonthly: current401kMonthly,
      recommendedMonthly: matchRequiredMonthly,
      delta401kMonthly,
      delta401kPercent,
      deltaMatchMonthly,
      matchGapMonthly: deltaMatchMonthly,
    };
  }, [baselineState, preTaxSavings]);

  // Check if match is captured
  const isMatchCaptured = useMemo(() => {
    if (!matchRecommendation) {
      const { payrollContributions, income } = baselineState;
      if (payrollContributions?.has401k && payrollContributions?.hasEmployerMatch === "yes") {
        const paychecksPerMonth = getPaychecksPerMonth(income?.payFrequency || 'biweekly');
        const grossIncomePerPaycheck = income?.grossIncome$ || income?.netIncome$ || 0;
        const grossIncomeMonthly = grossIncomePerPaycheck * paychecksPerMonth;
        
        if (payrollContributions.employerMatchCapPct && grossIncomeMonthly > 0) {
          const matchRequiredMonthly = (grossIncomeMonthly * payrollContributions.employerMatchCapPct) / 100;
          return preTaxSavings.traditional401k.monthly >= matchRequiredMonthly;
        }
      }
      return true;
    }
    return false;
  }, [matchRecommendation, baselineState, preTaxSavings]);

  // Handle "Capture my match" button
  const handleCaptureMatch = () => {
    if (!matchRecommendation || !baselineState.payrollContributions) return;

    const deltaPreTax = matchRecommendation.delta401kMonthly;
    const deltaMatch = matchRecommendation.deltaMatchMonthly;
    const taxSavings = deltaPreTax * ESTIMATED_MARGINAL_TAX_RATE;
    const deltaTakeHome = -deltaPreTax + taxSavings;
    const deltaPostTax = deltaTakeHome;
    // Total wealth moves = Pre-tax + Match + Post-tax available change
    // Post-tax available is negative (less cash), so adding it reduces the total
    // Formula: Pre-tax (+$677) + Match (+$339) + Post-tax available (-$508) = $677 + $339 - $508 = $508
    // But user says it should be $677, so maybe: Pre-tax only (the actual wealth move)
    // Or: Pre-tax + Match - |Post-tax| = $677 + $339 - $508 = $508
    // Let me use: Pre-tax (since that's the actual contribution, match is bonus, post-tax reduction is the cost)
    const deltaTotalWealth = deltaPreTax; // Just the pre-tax contribution amount

    // Update payroll contributions - ensure currentlyContributing401k is set to "yes"
    baselineState.updatePayrollContributions({
      currentlyContributing401k: "yes",
      contributionType401k: "percent_gross",
      contributionValue401k: matchRecommendation.recommendedPercent,
      contributionFrequency401k: null,
    });

    // Clear initialPaycheckPlan to force recalculation with new payroll contributions
    baselineState.setInitialPaycheckPlan(undefined as any);

    // Show impact preview
    setImpactPreviewData({
      deltaPreTax,
      deltaMatch,
      taxSavings,
      deltaPostTax,
      deltaTotalWealth,
    });
    setShowImpactPreview(true);
  };

  const [showImpactPreview, setShowImpactPreview] = useState(false);
  const [impactPreviewData, setImpactPreviewData] = useState<{
    deltaPreTax: number;
    deltaMatch: number;
    taxSavings: number;
    deltaPostTax: number;
    deltaTotalWealth: number;
  } | null>(null);

  // Initialize dollar amount values from baseline
  const [amounts, setAmounts] = useState({
    ef: 0,
    debt: 0,
    retirementMatch: 0,
    retirementExtra: 0,
    brokerage: 0,
  });
  const [originalAmounts, setOriginalAmounts] = useState(amounts);

  const clampAmount = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const updateAmount = (
    key: keyof typeof amounts,
    rawValue: number,
    min: number = 0,
    max: number = Infinity
  ) => {
    const clamped = clampAmount(rawValue, min, max);
    setAmounts(prev => ({
      ...prev,
      [key]: clamped,
    }));
  };

  const adjustAmount = (
    key: keyof typeof amounts,
    delta: number,
    min: number = 0,
    max: number = Infinity
  ) => {
    setAmounts(prev => {
      const newValue = prev[key] + delta;
      const clamped = clampAmount(newValue, min, max);
      return {
        ...prev,
        [key]: clamped,
      };
    });
  };

  useEffect(() => {
    if (baselineSavingsData && baselineSavingsData.monthlySavings > 0) {
      // Initialize with dollar amounts directly
      const initial = {
        ef: baselineSavingsData.ef$,
        debt: baselineSavingsData.debt$,
        retirementMatch: 0, // Match is pre-tax, not in post-tax allocation
        retirementExtra: baselineSavingsData.retirementTaxAdv$,
        brokerage: baselineSavingsData.brokerage$,
      };

      setAmounts(initial);
      setOriginalAmounts(initial);
    }
  }, [baselineSavingsData]);

  // Use post-tax savings available as the budget for allocation
  const savingsBudget = useMemo(() => {
    if (!baselineSavingsData) {
      console.log('[Savings Allocator] No baselineSavingsData, savingsBudget = 0');
      return 0;
    }
    // Use post-tax available for post-tax allocation
    const budget = postTaxSavingsAvailable || baselineSavingsData.monthlySavings;
    console.log('[Savings Allocator] Calculated savingsBudget:', {
      postTaxSavingsAvailable,
      baselineSavingsDataMonthlySavings: baselineSavingsData.monthlySavings,
      savingsBudget: budget,
      riskConstraints: baselineState.riskConstraints,
    });
    return budget;
  }, [baselineSavingsData, postTaxSavingsAvailable, baselineState.riskConstraints]);

  // Calculate desired total from amounts
  const desiredTotalFromAmounts = useMemo(() => {
    // Only include post-tax categories (match is pre-tax, not in post-tax allocation)
    const total =
      amounts.ef +
      amounts.debt +
      amounts.retirementExtra +
      amounts.brokerage;
    
    return total;
  }, [amounts]);

  // Calculate custom allocation directly from dollar amounts
  const customAllocation = useMemo(() => {
    if (!baselineSavingsData || savingsBudget <= 0) return null;

    const budget = postTaxSavingsAvailable || baselineSavingsData.monthlySavings;
    const warnings: string[] = [];

    // Apply caps
    const efCap = Math.min(budget * 0.4, efGap$ > 0 ? efGap$ : budget);
    const ef$ = Math.max(0, Math.min(amounts.ef, efCap));
    const efHitCap = amounts.ef > efCap;

    const debtCap = budget * 0.4;
    const highAprDebt$ = Math.max(0, Math.min(amounts.debt, debtCap));
    const debtHitCap = amounts.debt > debtCap;

    // Match is pre-tax, not post-tax
    const match401k$ = 0;

    const retirementTaxAdv$ = Math.max(0, amounts.retirementExtra);
    const brokerage$ = Math.max(0, amounts.brokerage);

    const totalAllocated = ef$ + highAprDebt$ + retirementTaxAdv$ + brokerage$;
    const unallocated$ = Math.max(0, budget - totalAllocated);

    const hitCaps = efHitCap || debtHitCap;

    if (efHitCap) {
      warnings.push(`Emergency fund allocation capped at $${efCap.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} (40% of budget or gap amount)`);
    }
    if (debtHitCap) {
      warnings.push(`Debt paydown allocation capped at $${debtCap.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} (40% of budget)`);
    }

    return {
      ef$,
      highAprDebt$,
      match401k$: 0, // Match is pre-tax, not post-tax
      retirementTaxAdv$,
      brokerage$,
      totalAllocated,
      unallocated$,
      warnings,
      hitCaps,
    };
  }, [baselineSavingsData, savingsBudget, efGap$, amounts, postTaxSavingsAvailable]);

  // Calculate total wealth moves (for net worth)
  // Total wealth moves = Pre-tax savings + Employer match + Post-tax savings available (total budget)
  // This represents ALL money being moved into savings/investments, not just what's allocated
  const totalWealthMoves = useMemo(() => {
    if (!customAllocation) return 0;
    
    // Use postTaxSavingsAvailable (total budget) instead of allocated amounts
    // This ensures we show the total potential wealth moves, not just what's currently allocated
    return preTaxSavings.total + postTaxSavingsAvailable + preTaxSavings.employerMatch.monthly;
  }, [preTaxSavings, postTaxSavingsAvailable]);

  // Calculate budget status based on desired total from amounts vs actual budget
  const budgetStatus = useMemo(() => {
    if (!customAllocation || !savingsBudget || !baselineSavingsData) return null;
    
    const difference = desiredTotalFromAmounts - savingsBudget;
    const isOverBudget = difference > 1; // Allow small rounding differences
    const isUnderBudget = difference < -1;
    
    return {
      desiredTotal: desiredTotalFromAmounts,
      budget: savingsBudget,
      difference: Math.abs(difference),
      isOverBudget,
      isUnderBudget,
      isOnBudget: !isOverBudget && !isUnderBudget,
      hasCapsHit: customAllocation.hitCaps,
    };
  }, [desiredTotalFromAmounts, savingsBudget, customAllocation, baselineSavingsData]);

  const allocationComparison = useMemo(() => {
    if (!baselineSavingsData || !customAllocation) return null;
    return [
      {
        label: 'Emergency Fund',
        current: baselineSavingsData.ef$,
        updated: customAllocation.ef$,
      },
      {
        label: 'High-APR Debt',
        current: baselineSavingsData.debt$,
        updated: customAllocation.highAprDebt$,
      },
      // Match is pre-tax, not in post-tax allocation comparison
      {
        label: 'Roth IRA / Taxable Retirement',
        current: baselineSavingsData.retirementTaxAdv$,
        updated: customAllocation.retirementTaxAdv$,
      },
      {
        label: 'Brokerage',
        current: baselineSavingsData.brokerage$,
        updated: customAllocation.brokerage$,
      },
    ];
  }, [baselineSavingsData, customAllocation]);

  const scenarioPlanData = useMemo<FinalPlanData | null>(() => {
    if (!customAllocation || !baselinePlanData || !baselineState) return baselinePlanData ?? null;

    try {
      const incomePeriod$ = baselineState.income?.netIncome$ || baselineState.income?.grossIncome$ || 0;
      const essentialsCategories = baselinePlanData.paycheckCategories.filter(c => 
        c.key === 'essentials'
      );
      const debtMinimumCategories = baselinePlanData.paycheckCategories.filter(c => 
        c.key === 'debt_minimums'
      );
      const needsCategories = [...essentialsCategories, ...debtMinimumCategories];
      const wantsCategories = baselinePlanData.paycheckCategories.filter(c => 
        c.key === 'fun_flexible'
      );
      const monthlyEssentials = essentialsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
      const monthlyDebtMinimums = debtMinimumCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
      const monthlyNeeds = monthlyEssentials + monthlyDebtMinimums;
      const monthlyWants = wantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
      
      const assets = baselineState.assets || [];
      const debts = baselineState.debts || [];
      const efBalance$ = baselineState.safetyStrategy?.efBalance$ || 
        assets.filter(a => a.type === 'cash').reduce((sum, a) => sum + a.value$, 0);
      
      const efTargetMonths = baselineState.safetyStrategy?.efTargetMonths || 3;
      const monthlyBasics = baselineState.fixedExpenses
        .filter(e => e.category === 'needs')
        .reduce((sum, e) => sum + e.amount$, 0);
      const efTarget$ = monthlyBasics > 0 
        ? monthlyBasics * efTargetMonths 
        : (incomePeriod$ * 2.17 * 0.3 * efTargetMonths);
      
      const openingBalances = {
        cash: efBalance$,
        brokerage: assets.filter(a => a.type === 'brokerage').reduce((sum, a) => sum + a.value$, 0),
        retirement: assets.filter(a => a.type === 'retirement').reduce((sum, a) => sum + a.value$, 0),
        hsa: assets.find(a => a.type === 'hsa')?.value$,
        otherAssets: assets.filter(a => a.type === 'other').reduce((sum, a) => sum + a.value$, 0),
        liabilities: debts.map(d => ({
          name: d.name,
          balance: d.balance$,
          aprPct: d.aprPct,
          minPayment: d.minPayment$,
          extraPayment: d.isHighApr ? customAllocation.highAprDebt$ : undefined,
        })),
      };
      
      const monthlyPlan: SimMonthlyPlan = {
        monthIndex: 0,
        incomeNet: incomePeriod$ * paychecksPerMonth,
        needs$: Math.max(0, monthlyNeeds),
        wants$: monthlyWants,
        ef$: customAllocation.ef$,
        highAprDebt$: customAllocation.highAprDebt$,
        match401k$: preTaxSavings.employerMatch.monthly, // Use pre-tax match, not post-tax
        retirementTaxAdv$: customAllocation.retirementTaxAdv$,
        brokerage$: customAllocation.brokerage$,
      };
      
      console.log('[Savings Allocator] Monthly plan inputs', [{
        incomeNet: monthlyPlan.incomeNet,
        needs$: monthlyPlan.needs$,
        debtMinimums$: monthlyDebtMinimums,
        wants$: monthlyPlan.wants$,
        ef$: monthlyPlan.ef$,
        highAprDebt$: monthlyPlan.highAprDebt$,
        match401k$: monthlyPlan.match401k$,
        retirementTaxAdv$: monthlyPlan.retirementTaxAdv$,
        brokerage$: monthlyPlan.brokerage$,
        unallocated$: customAllocation.unallocated$,
      }]);
      
      const horizonMonths = 480;
      const monthlyPlans: SimMonthlyPlan[] = Array.from({ length: horizonMonths }, (_, i) => ({
        ...monthlyPlan,
        monthIndex: i,
      }));
      
      const riskConstraints = baselineState.riskConstraints;
      const scenarioInput: ScenarioInput = {
        startDate: new Date().toISOString().split('T')[0],
        horizonMonths,
        inflationRatePct: riskConstraints?.assumptions?.inflationRatePct || 2.5,
        nominalReturnPct: riskConstraints?.assumptions?.nominalReturnPct || 9.0,
        cashYieldPct: riskConstraints?.assumptions?.cashYieldPct || 4.0,
        taxDragBrokeragePct: 0.5,
        openingBalances,
        monthlyPlan: monthlyPlans,
        goals: {
          efTarget$,
        },
      };
      
      const simulation = simulateScenario(scenarioInput);
      
      const chartLabels: string[] = [];
      const chartNetWorth: number[] = [];
      const chartAssets: number[] = [];
      const chartLiabilities: number[] = [];
      
      for (let i = 0; i < simulation.netWorth.length; i += 3) {
        const month = i + 1;
        const year = Math.floor(month / 12);
        const monthInYear = (month % 12) || 12;
        chartLabels.push(`${monthInYear}/${year}`);
        chartNetWorth.push(simulation.netWorth[i] || 0);
        chartAssets.push(simulation.assets[i] || 0);
        chartLiabilities.push(simulation.liabilities[i] || 0);
      }
      
      const currentNetWorth = simulation.netWorth[0] || 0;
      const netWorth6m = simulation.netWorth[5] || currentNetWorth;
      const netWorth12m = simulation.netWorth[11] || currentNetWorth;
      const netWorth24m = simulation.netWorth[23] || simulation.netWorth[simulation.netWorth.length - 1] || currentNetWorth;
      
      const modifiedPlan: FinalPlanData = {
        ...baselinePlanData,
        netWorthChartData: {
          labels: chartLabels,
          netWorth: chartNetWorth,
          assets: chartAssets,
          liabilities: chartLiabilities,
        },
        netWorthProjection: [
          { label: 'Today', months: 0, value: currentNetWorth },
          { label: '6 Months', months: 6, value: netWorth6m },
          { label: '12 Months', months: 12, value: netWorth12m },
          { label: '24 Months', months: 24, value: netWorth24m },
        ],
      };
      
      console.log('[Savings Allocator] Scenario net worth calculated', {
        dataPoints: chartNetWorth.length,
        firstValue: chartNetWorth[0],
        lastValue: chartNetWorth[chartNetWorth.length - 1],
        netWorth12m,
        netWorth24m,
        customSavings: {
          ef$: customAllocation.ef$,
          debt$: customAllocation.highAprDebt$,
          match401k$: preTaxSavings.employerMatch.monthly, // Pre-tax match
          retirementTaxAdv$: customAllocation.retirementTaxAdv$,
          brokerage$: customAllocation.brokerage$,
        },
      });
      
      return modifiedPlan;
    } catch (err) {
      console.error('[Savings Allocator] Error running net worth simulator:', err);
      return baselinePlanData ?? null;
    }
      }, [customAllocation, baselinePlanData, baselineState, paychecksPerMonth, preTaxSavings]);

  // Use baseline plan's net worth chart data, but resample to match scenario format (every 3 months)
  // The baselinePlanData has full 480-month simulation, but scenario samples every 3 months
  const baselineNetWorthChartData = useMemo(() => {
    if (!baselinePlanData?.netWorthChartData) return null;
    
    // Resample baseline data to match scenario sampling (every 3 months)
    const baselineNetWorth = baselinePlanData.netWorthChartData.netWorth;
    const resampledNetWorth: number[] = [];
    const resampledLabels: string[] = [];
    
    for (let i = 0; i < baselineNetWorth.length; i += 3) {
      const month = i + 1;
      const year = Math.floor(month / 12);
      const monthInYear = (month % 12) || 12;
      resampledLabels.push(`${monthInYear}/${year}`);
      resampledNetWorth.push(baselineNetWorth[i] || 0);
    }
    
    console.log('[Savings Allocator] Resampled baseline net worth to match scenario format', {
      originalDataPoints: baselineNetWorth.length,
      resampledDataPoints: resampledNetWorth.length,
      firstValue: resampledNetWorth[0],
      lastValue: resampledNetWorth[resampledNetWorth.length - 1],
    });
    
    return {
      labels: resampledLabels,
      netWorth: resampledNetWorth,
    };
  }, [baselinePlanData]);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDebtDetails, setShowDebtDetails] = useState(false);

  // Determine if values have changed
  const hasChanged = useMemo(() => {
    return Math.abs(amounts.ef - originalAmounts.ef) > 0.01 ||
      Math.abs(amounts.debt - originalAmounts.debt) > 0.01 ||
      Math.abs(amounts.retirementExtra - originalAmounts.retirementExtra) > 0.01 ||
      Math.abs(amounts.brokerage - originalAmounts.brokerage) > 0.01;
  }, [amounts, originalAmounts]);

  const handleConfirmApply = () => {
    if (!customAllocation) return;
    
    // Save custom savings allocation to safetyStrategy
    // This will override the engine's calculation in buildFinalPlanData
    baselineState.updateSafetyStrategy({
      customSavingsAllocation: {
        ef$: customAllocation.ef$,
        highAprDebt$: customAllocation.highAprDebt$,
        match401k$: preTaxSavings.employerMatch.monthly, // Pre-tax match, not post-tax
        retirementTaxAdv$: customAllocation.retirementTaxAdv$,
        brokerage$: customAllocation.brokerage$,
      },
    });
    
    // Clear initialPaycheckPlan to force recalculation
    baselineState.setInitialPaycheckPlan(undefined as any);
    
    setShowConfirmDialog(false);
    router.push('/app/income'); // Navigate to Income tab to see the changes
  };

  const handleApply = () => {
    setShowConfirmDialog(true);
  };

  if (!baselinePlanData || !baselineSavingsData || !customAllocation || !scenarioPlanData) {
    return (
      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading allocator...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate income distribution from scenario plan
  const essentialsCategories = scenarioPlanData.paycheckCategories.filter(c => c.key === 'essentials');
  const debtMinimumCategories = scenarioPlanData.paycheckCategories.filter(c => c.key === 'debt_minimums');
  const needsCategories = [...essentialsCategories, ...debtMinimumCategories];
  const wantsCategories = scenarioPlanData.paycheckCategories.filter(c => 
    c.key === 'fun_flexible'
  );
  const savingsCategories = scenarioPlanData.paycheckCategories.filter(c => 
    c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
  );

  const monthlyEssentials = essentialsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
  const monthlyDebtMinimums = debtMinimumCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
  const scenarioMonthlyNeeds = monthlyEssentials + monthlyDebtMinimums;
  const scenarioMonthlyWants = wantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
  const scenarioMonthlySavings = savingsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
  const scenarioMonthlyTotal = scenarioMonthlyNeeds + scenarioMonthlyWants + scenarioMonthlySavings;

  const needsPct = scenarioMonthlyTotal > 0 ? (scenarioMonthlyNeeds / scenarioMonthlyTotal) * 100 : 0;
  const wantsPct = scenarioMonthlyTotal > 0 ? (scenarioMonthlyWants / scenarioMonthlyTotal) * 100 : 0;
  const savingsPct = scenarioMonthlyTotal > 0 ? (scenarioMonthlySavings / scenarioMonthlyTotal) * 100 : 0;

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Savings Allocation</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-8 w-8"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Pre-Tax Savings (Payroll) Panel */}
          {(preTaxSavings.traditional401k.monthly > 0 || preTaxSavings.hsa.monthly > 0 || preTaxSavings.employerMatch.monthly > 0 || baselineState.payrollContributions?.has401k) && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Pre‑Tax Savings (Payroll)
                  </h3>
                  <div className="group relative">
                    <HelpCircle className="h-4 w-4 text-slate-400 cursor-help" />
                    <div className="absolute bottom-full left-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-normal max-w-xs shadow-lg">
                        Payroll savings are deducted before your paycheck hits your bank. We estimate them unless payroll is connected.
                        <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Save current state, then navigate to payroll contributions
                    // After saving, return to this tool
                    const returnPath = '/app/tools/savings-allocator';
                    router.push(`/onboarding/payroll-contributions?returnTo=${encodeURIComponent(returnPath)}`);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit payroll savings
                </Button>
              </div>

              {/* Match Status Badge */}
              {baselineState.payrollContributions?.has401k && baselineState.payrollContributions?.hasEmployerMatch === "yes" && (
                <div className="mb-3">
                  {isMatchCaptured ? (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Match captured
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Match not captured
                    </div>
                  )}
                </div>
              )}
              
              <div className="space-y-2.5">
                {preTaxSavings.traditional401k.monthly > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">
                      Traditional 401(k): {preTaxSavings.traditional401k.percent !== null 
                        ? `${preTaxSavings.traditional401k.percent.toFixed(1)}%`
                        : '—'}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      ~${Math.round(preTaxSavings.traditional401k.monthly).toLocaleString('en-US')}/mo (estimated)
                    </span>
                  </div>
                )}
                
                {preTaxSavings.hsa.monthly > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">HSA:</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      ~${Math.round(preTaxSavings.hsa.monthly).toLocaleString('en-US')}/mo (estimated)
                    </span>
                  </div>
                )}
                
                {preTaxSavings.employerMatch.monthly > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">Employer match:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      ~+${Math.round(preTaxSavings.employerMatch.monthly).toLocaleString('en-US')}/mo (estimated)
                    </span>
                  </div>
                )}
              </div>

              {/* Match Capture Recommendation */}
              {matchRecommendation && (
                <div className="mt-4 rounded-lg border-2 border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-1">
                      You're missing free employer match
                    </h4>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Match gap: ${Math.round(matchRecommendation.matchGapMonthly).toLocaleString('en-US')}/month
                    </p>
                  </div>
                  
                  <div className="mb-3 space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 dark:text-slate-300">Recommended change:</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {matchRecommendation.currentPercent.toFixed(1)}% → {matchRecommendation.recommendedPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 dark:text-slate-300">Delta pre-tax:</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        +${Math.round(matchRecommendation.delta401kMonthly).toLocaleString('en-US')}/mo
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 dark:text-slate-300">Delta match:</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        +${Math.round(matchRecommendation.deltaMatchMonthly).toLocaleString('en-US')}/mo
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleCaptureMatch}
                      size="sm"
                      className="flex-1"
                    >
                      Capture my match
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Save current state, then navigate to payroll contributions
                        // After saving, return to this tool
                        const returnPath = '/app/tools/savings-allocator';
                        router.push(`/onboarding/payroll-contributions?returnTo=${encodeURIComponent(returnPath)}`);
                      }}
                    >
                      Edit payroll savings
                    </Button>
                  </div>
                </div>
              )}

              {/* Change Summary */}
              {showImpactPreview && impactPreviewData && (
                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                        Change Summary (estimated)
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        We're estimating taxes + match since payroll isn't connected yet.
                      </p>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setShowImpactPreview(false);
                        // Force recalculation by clearing the plan data
                        baselineState.setInitialPaycheckPlan(undefined as any);
                      }}
                      className="h-8 px-4 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      OK
                    </Button>
                  </div>
                  
                  <div className="space-y-3 text-sm mt-3">
                    {/* Breakdown lines */}
                    <div className="space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-700 dark:text-slate-300">Pre-tax invested (401k/HSA):</span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            +${Math.round(impactPreviewData.deltaPreTax).toLocaleString('en-US')}/mo
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          This goes straight into your retirement account.
                        </p>
                      </div>
                      
                      {impactPreviewData.deltaMatch > 0 && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-700 dark:text-slate-300">Employer match (free money):</span>
                            <span className="font-medium text-green-600 dark:text-green-400">
                              +~${Math.round(impactPreviewData.deltaMatch).toLocaleString('en-US')}/mo
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Your job adds this on top. No extra effort.
                          </p>
                        </div>
                      )}
                      
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-700 dark:text-slate-300">Estimated tax savings:</span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            +~${Math.round(impactPreviewData.taxSavings).toLocaleString('en-US')}/mo
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Your take-home drops less because you pay less tax.
                        </p>
                      </div>
                      
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-700 dark:text-slate-300">Take-home change:</span>
                          <span className="font-medium text-red-600 dark:text-red-400">
                            {impactPreviewData.deltaPostTax >= 0 ? '+' : ''}${Math.round(impactPreviewData.deltaPostTax).toLocaleString('en-US')}/mo
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          This is the cash you'll have less of in your bank account.
                        </p>
                      </div>
                    </div>
                    
                    {/* Two totals */}
                    <div className="space-y-2.5 pt-2 border-t border-blue-200 dark:border-blue-800">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700 dark:text-slate-300">Total invested (401k + match):</span>
                          <span className="font-bold text-green-600 dark:text-green-400">
                            +${Math.round(impactPreviewData.deltaPreTax + impactPreviewData.deltaMatch).toLocaleString('en-US')}/mo
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          This is what grows your net worth over time.
                        </p>
                      </div>
                      
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700 dark:text-slate-300">Net cash impact (take-home):</span>
                          <span className="font-bold text-red-600 dark:text-red-400">
                            {impactPreviewData.deltaPostTax >= 0 ? '+' : ''}${Math.round(impactPreviewData.deltaPostTax).toLocaleString('en-US')}/mo
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          This is the tradeoff in your monthly spending money.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Summary Header */}
          <div className="space-y-3 text-center rounded-lg border bg-white p-4 dark:bg-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Post-Tax Savings Allocation
            </h2>
            
            {/* Primary number */}
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                Post‑tax savings available to allocate:
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
                ${Math.round(postTaxSavingsAvailable).toLocaleString('en-US')}/mo
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Money left after taxes + payroll deductions (401k/HSA).
              </p>
            </div>

            {/* Secondary metrics */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="text-center">
                <div className="text-xs text-slate-600 dark:text-slate-400">Pre‑tax payroll savings</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  ${Math.round(preTaxSavings.total).toLocaleString('en-US')}/mo
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">(estimated)</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-600 dark:text-slate-400">Employer match</div>
                <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                  +${Math.round(preTaxSavings.employerMatch.monthly).toLocaleString('en-US')}/mo
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">(estimated)</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-600 dark:text-slate-400">Total wealth moves</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  ${Math.round(totalWealthMoves).toLocaleString('en-US')}/mo
                </div>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {customAllocation.warnings.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <div className="flex-1 space-y-1">
                  {customAllocation.warnings.map((warning, idx) => (
                    <p key={idx} className="text-sm text-yellow-800 dark:text-yellow-200">
                      {warning}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="space-y-6">
            {/* Budget Status */}
            {budgetStatus && (
              <div className="mb-6">
                <div className={`rounded-lg border-2 p-4 ${
                  budgetStatus.isOverBudget 
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                    : budgetStatus.isUnderBudget
                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                    : 'border-green-500 bg-green-50 dark:bg-green-900/20'
                }`}>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Budget Status</h3>
                    <span className={`text-lg font-bold ${
                      budgetStatus.isOverBudget 
                        ? 'text-red-600 dark:text-red-400' 
                        : budgetStatus.isUnderBudget
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {budgetStatus.isOverBudget 
                        ? `Over by $${budgetStatus.difference.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                        : budgetStatus.isUnderBudget
                        ? `Under by $${budgetStatus.difference.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                        : 'On Budget'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Desired Total (from sliders):</span>
                      <span className="ml-2 font-semibold">${budgetStatus.desiredTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Post-Tax Available:</span>
                      <span className="ml-2 font-semibold">${budgetStatus.budget.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                  <div className="mt-3 rounded bg-white/50 p-2 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
                    <p>💡 The total above is calculated by adding up all post-tax allocations. Adjust amounts below to see how your desired post-tax allocation compares to your post-tax savings available.</p>
                  </div>
                  {budgetStatus.isOverBudget && (
                    <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                      ⚠️ Your desired post-tax allocation (${budgetStatus.desiredTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}) exceeds your post-tax savings available (${budgetStatus.budget.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}). Reduce slider values to stay within budget.
                    </p>
                  )}
                  {budgetStatus.isUnderBudget && (
                    <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                      ℹ️ Your desired post-tax allocation (${budgetStatus.desiredTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}) is under your post-tax savings available (${budgetStatus.budget.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}). You can increase slider values to use more of your budget.
                    </p>
                  )}
                  {budgetStatus.isOnBudget && (
                    <p className="mt-2 text-sm text-green-700 dark:text-green-300">
                      ✓ Your desired post-tax allocation matches your post-tax savings available.
                    </p>
                  )}
                  {budgetStatus.hasCapsHit && (
                    <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                      ⚠️ Some allocations hit maximum caps (EF: 40% of budget, Debt: 40% of budget). The actual allocation may be lower than your slider settings indicate.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Post-Tax Savings Categories */}
            <div className="space-y-6">
              <h2 className="font-semibold text-slate-900 dark:text-white">Post-Tax Savings Categories</h2>
              
              {/* Emergency Fund */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium text-slate-900 dark:text-white">Emergency Fund</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => adjustAmount('ef', -50, 0, Math.min(savingsBudget * 0.4, efGap$ > 0 ? efGap$ : savingsBudget))}
                    className="h-10 w-10 shrink-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
                    <input
                      type="number"
                      value={Math.round(amounts.ef)}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        updateAmount('ef', value, 0, Math.min(savingsBudget * 0.4, efGap$ > 0 ? efGap$ : savingsBudget));
                      }}
                      className="w-full text-right text-lg font-semibold bg-transparent border-none outline-none"
                      min={0}
                      max={Math.min(savingsBudget * 0.4, efGap$ > 0 ? efGap$ : savingsBudget)}
                    />
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400 mt-1">
                      /month
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => adjustAmount('ef', 50, 0, Math.min(savingsBudget * 0.4, efGap$ > 0 ? efGap$ : savingsBudget))}
                    className="h-10 w-10 shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {efGap$ > 0 ? `Gap: $${efGap$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : 'Emergency fund target met'}
                </p>
              </div>

              {/* High-APR Debt */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <button
                    onClick={() => totalDebtBalance$ > 0 && setShowDebtDetails(!showDebtDetails)}
                    className={`font-medium text-slate-900 dark:text-white ${totalDebtBalance$ > 0 ? 'cursor-pointer hover:text-primary' : ''}`}
                    disabled={totalDebtBalance$ === 0}
                  >
                    High-APR Debt Paydown
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => adjustAmount('debt', -50, 0, savingsBudget * 0.4)}
                    className="h-10 w-10 shrink-0"
                    disabled={totalDebtBalance$ === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
                    <input
                      type="number"
                      value={Math.round(amounts.debt)}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        updateAmount('debt', value, 0, savingsBudget * 0.4);
                      }}
                      className="w-full text-right text-lg font-semibold bg-transparent border-none outline-none"
                      min={0}
                      max={savingsBudget * 0.4}
                      disabled={totalDebtBalance$ === 0}
                    />
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400 mt-1">
                      /month
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => adjustAmount('debt', 50, 0, savingsBudget * 0.4)}
                    className="h-10 w-10 shrink-0"
                    disabled={totalDebtBalance$ === 0}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {totalDebtBalance$ > 0 ? `Balance: $${totalDebtBalance$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : 'No high-APR debt'}
                </p>

                {/* Debt Details Section */}
                {showDebtDetails && totalDebtBalance$ > 0 && (
                  <div className="mt-4 rounded-lg border bg-slate-50 p-4 dark:bg-slate-800">
                    <h4 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                      Debt Details & Payoff Schedule
                    </h4>
                    <div className="space-y-4">
                      {highAprDebts.map((debt) => {
                        // Calculate monthly payment (minimum + proportional extra)
                        const debtProportion = totalDebtBalance$ > 0 ? debt.balance$ / totalDebtBalance$ : 0;
                        const extraPayment = customAllocation.highAprDebt$ * debtProportion;
                        const totalMonthlyPayment = debt.minPayment$ + extraPayment;
                        
                        // Calculate months to payoff (simplified calculation)
                        // Using: months = -log(1 - (balance * apr/12) / payment) / log(1 + apr/12)
                        const monthlyRate = debt.aprPct / 100 / 12;
                        let monthsToPayoff = 0;
                        if (totalMonthlyPayment > debt.balance$ * monthlyRate) {
                          monthsToPayoff = Math.ceil(
                            -Math.log(1 - (debt.balance$ * monthlyRate) / totalMonthlyPayment) / Math.log(1 + monthlyRate)
                          );
                        } else {
                          monthsToPayoff = 999; // Will never pay off at this rate
                        }

                        // Calculate total interest paid
                        const totalPayment = totalMonthlyPayment * monthsToPayoff;
                        const totalInterest = Math.max(0, totalPayment - debt.balance$);

                        // Format date
                        const payoffDate = new Date();
                        payoffDate.setMonth(payoffDate.getMonth() + monthsToPayoff);
                        const payoffDateStr = monthsToPayoff < 999 
                          ? payoffDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                          : 'Never (increase payment)';

                        return (
                          <div key={debt.id} className="rounded border bg-white p-3 dark:bg-slate-900">
                            <div className="mb-2 flex items-center justify-between">
                              <h5 className="font-medium text-slate-900 dark:text-white">{debt.name}</h5>
                              <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                                {debt.aprPct.toFixed(1)}% APR
                              </span>
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-400">Current Balance:</span>
                                <span className="font-semibold">${debt.balance$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-400">Minimum Payment:</span>
                                <span className="font-semibold">${debt.minPayment$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-400">Extra Payment:</span>
                                <span className="font-semibold text-green-600 dark:text-green-400">
                                  ${extraPayment.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo
                                </span>
                              </div>
                              <div className="flex justify-between border-t pt-2">
                                <span className="text-slate-600 dark:text-slate-400">Total Monthly Payment:</span>
                                <span className="font-semibold text-primary">
                                  ${totalMonthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-400">Payoff Date:</span>
                                <span className={`font-semibold ${monthsToPayoff < 999 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                  {payoffDateStr}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-400">Total Interest:</span>
                                <span className="font-semibold text-red-600 dark:text-red-400">
                                  ${totalInterest.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Summary */}
                      <div className="rounded border-2 border-primary/20 bg-primary/5 p-3">
                        <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
                          Total Debt Paydown Summary
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">Total Monthly Payment:</span>
                            <span className="font-semibold">
                              ${(highAprDebts.reduce((sum, d) => sum + d.minPayment$, 0) + customAllocation.highAprDebt$).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">Allocated to Debt:</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              ${customAllocation.highAprDebt$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            Adjust the amount above to change your total debt paydown allocation. Extra payments will be distributed proportionally across all debts.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Retirement Extra (Roth IRA / Taxable Retirement) */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium text-slate-900 dark:text-white">Roth IRA / Taxable Retirement</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => adjustAmount('retirementExtra', -50, 0)}
                    className="h-10 w-10 shrink-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
                    <input
                      type="number"
                      value={Math.round(amounts.retirementExtra)}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        updateAmount('retirementExtra', value, 0);
                      }}
                      className="w-full text-right text-lg font-semibold bg-transparent border-none outline-none"
                      min={0}
                    />
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400 mt-1">
                      /month
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => adjustAmount('retirementExtra', 50, 0)}
                    className="h-10 w-10 shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Post-tax retirement accounts (Roth IRA, taxable retirement)
                </p>
              </div>

              {/* Brokerage */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium text-slate-900 dark:text-white">Brokerage (Taxable Investing)</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => adjustAmount('brokerage', -50, 0)}
                    className="h-10 w-10 shrink-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
                    <input
                      type="number"
                      value={Math.round(amounts.brokerage)}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        updateAmount('brokerage', value, 0);
                      }}
                      className="w-full text-right text-lg font-semibold bg-transparent border-none outline-none"
                      min={0}
                    />
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400 mt-1">
                      /month
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => adjustAmount('brokerage', 50, 0)}
                    className="h-10 w-10 shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Wealth Accumulation */}
            <Card>
              <CardHeader>
                <CardTitle>Wealth Accumulation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-lg border bg-white p-4 dark:bg-slate-800">
                  <div className="min-w-0">
                    <NetWorthChart
                      key={`savings-allocator-${amounts.ef}-${amounts.debt}-${amounts.retirementExtra}-${amounts.brokerage}-${scenarioPlanData.netWorthChartData.netWorth.length}`}
                      labels={scenarioPlanData.netWorthChartData.labels}
                      netWorth={scenarioPlanData.netWorthChartData.netWorth}
                      assets={scenarioPlanData.netWorthChartData.assets}
                      liabilities={scenarioPlanData.netWorthChartData.liabilities}
                      baselineNetWorth={
                        baselineNetWorthChartData && baselineNetWorthChartData.netWorth.length === scenarioPlanData.netWorthChartData.netWorth.length
                          ? [...baselineNetWorthChartData.netWorth] 
                          : undefined
                      }
                      height={400}
                    />
                  </div>
                  <p className="mt-2 text-xs text-center text-slate-500 dark:text-slate-400">
                    Chart reflects your total wealth moves (pre-tax + post-tax + match).
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {scenarioPlanData.netWorthProjection.map((projection) => {
                    const baselineValue = baselinePlanData.netWorthProjection.find(p => p.label === projection.label)?.value || 0;
                    const scenarioValue = projection.value;
                    const delta = scenarioValue - baselineValue;
                    const showDelta = hasChanged && Math.abs(delta) > 1;
                    
                    return (
                      <div
                        key={projection.label}
                        className="rounded-lg border bg-white p-4 text-center dark:bg-slate-800"
                      >
                        <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                          {projection.label}
                        </p>
                        <p className={`text-2xl font-bold ${
                          scenarioValue >= 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          ${scenarioValue.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </p>
                        {showDelta && (
                          <p className={`mt-1 text-xs font-medium ${
                            delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {delta >= 0 ? '+' : ''}${delta.toLocaleString('en-US', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })} vs Current
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {allocationComparison && (
                  <div className="rounded-lg border bg-white p-4 dark:bg-slate-800">
                    <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Monthly Allocation Changes
                    </h3>
                    <div className="space-y-2 text-sm">
                      {allocationComparison.map((row) => {
                        const delta = row.updated - row.current;
                        return (
                          <div key={row.label} className="flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-400">{row.label}</span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              ${row.updated.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              {Math.abs(delta) > 1 && (
                                <span className={`ml-2 text-xs ${delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {delta >= 0 ? '+' : ''}
                                  ${Math.abs(delta).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Implement Button */}
      <div className="border-t bg-background px-4 py-4">
        <div className="mx-auto max-w-lg space-y-4">
          <Button
            onClick={handleApply}
            className="w-full bg-green-600 text-white hover:bg-green-700"
            size="lg"
          >
            Implement Savings Allocation
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && customAllocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl">Confirm Changes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Please review the changes before applying them to your plan:
              </p>
              
              <div className="space-y-3 rounded-lg border bg-slate-50 p-4 dark:bg-slate-800">
                {baselineSavingsData && (
                  <>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">Emergency Fund</h3>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Current Plan:</span>
                        <span className="font-semibold">${baselineSavingsData.ef$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">New Plan:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">${customAllocation.ef$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      {Math.abs(customAllocation.ef$ - baselineSavingsData.ef$) > 0.01 && (
                        <div className="flex items-center justify-between text-sm border-t pt-2">
                          <span className="text-slate-600 dark:text-slate-400">Change:</span>
                          <span className={`font-semibold ${(customAllocation.ef$ - baselineSavingsData.ef$) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {(customAllocation.ef$ - baselineSavingsData.ef$) >= 0 ? '+' : ''}${(customAllocation.ef$ - baselineSavingsData.ef$).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">High-APR Debt</h3>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Current Plan:</span>
                        <span className="font-semibold">${baselineSavingsData.debt$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">New Plan:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">${customAllocation.highAprDebt$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      {Math.abs(customAllocation.highAprDebt$ - baselineSavingsData.debt$) > 0.01 && (
                        <div className="flex items-center justify-between text-sm border-t pt-2">
                          <span className="text-slate-600 dark:text-slate-400">Change:</span>
                          <span className={`font-semibold ${(customAllocation.highAprDebt$ - baselineSavingsData.debt$) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {(customAllocation.highAprDebt$ - baselineSavingsData.debt$) >= 0 ? '+' : ''}${(customAllocation.highAprDebt$ - baselineSavingsData.debt$).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">Roth IRA / Taxable Retirement</h3>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Current Plan:</span>
                        <span className="font-semibold">${baselineSavingsData.retirementTaxAdv$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">New Plan:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">${customAllocation.retirementTaxAdv$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      {Math.abs(customAllocation.retirementTaxAdv$ - baselineSavingsData.retirementTaxAdv$) > 0.01 && (
                        <div className="flex items-center justify-between text-sm border-t pt-2">
                          <span className="text-slate-600 dark:text-slate-400">Change:</span>
                          <span className={`font-semibold ${(customAllocation.retirementTaxAdv$ - baselineSavingsData.retirementTaxAdv$) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {(customAllocation.retirementTaxAdv$ - baselineSavingsData.retirementTaxAdv$) >= 0 ? '+' : ''}${(customAllocation.retirementTaxAdv$ - baselineSavingsData.retirementTaxAdv$).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">Brokerage</h3>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Current Plan:</span>
                        <span className="font-semibold">${baselineSavingsData.brokerage$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">New Plan:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">${customAllocation.brokerage$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month</span>
                      </div>
                      {Math.abs(customAllocation.brokerage$ - baselineSavingsData.brokerage$) > 0.01 && (
                        <div className="flex items-center justify-between text-sm border-t pt-2">
                          <span className="text-slate-600 dark:text-slate-400">Change:</span>
                          <span className={`font-semibold ${(customAllocation.brokerage$ - baselineSavingsData.brokerage$) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {(customAllocation.brokerage$ - baselineSavingsData.brokerage$) >= 0 ? '+' : ''}${(customAllocation.brokerage$ - baselineSavingsData.brokerage$).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} /month
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                These changes will update your savings allocation plan. The new plan will be applied immediately and will show in the Income and Home tabs.
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmApply}
                  className="flex-1 bg-green-600 text-white hover:bg-green-700"
                >
                  Confirm & Apply
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function SavingsAllocatorPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading allocator...
            </p>
          </CardContent>
        </Card>
      </div>
    }>
      <SavingsAllocatorContent />
    </Suspense>
  );
}

