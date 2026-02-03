/**
 * Savings Allocator — Chat-first wrapper (Phase 2A).
 * Feed Logic decides WHAT; Sidekick/Chat narrates HOW; Savings Allocation logic is single source of truth.
 * No plan applied without explicit user confirmation.
 * TODO Phase 2B: Income Allocation chat-first wrapper.
 * TODO Phase 2C: Money Sweeper chat-first flow.
 */

'use client';

import { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData, getPaychecksPerMonth } from '@/lib/onboarding/usePlanData';
import { buildFinalPlanData, type FinalPlanData } from '@/lib/onboarding/plan';
import { simulateScenario, type ScenarioInput, type MonthlyPlan as SimMonthlyPlan } from '@/lib/sim/netWorth';
import type { OnboardingState } from '@/lib/onboarding/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, ArrowRight, AlertTriangle, HelpCircle, Edit, CheckCircle2, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { calculateSavingsBreakdown } from '@/lib/utils/savingsCalculations';
import { runSavingsAllocation } from '@/lib/tools/savings/runSavingsAllocation';
import { adaptSavingsResultToPlan, adaptUIAllocationToPlan } from '@/lib/tools/savings/adaptSavingsResultToPlan';
import { diffPlans, type PlanDiffItem } from '@/lib/tools/savings/diffPlans';
import {
  applyOverridesAndRebalance,
  applyPostTaxStepperChange,
  deepEqualPlans,
  getAllocatorMode,
  generateUIMessages,
  trimPostTaxToPool,
  STEP_SIZES,
  type PostTaxBucketKey,
  type SavingsPlanSnapshot,
  type SavingsOverrides,
} from '@/lib/tools/savings/allocatorState';
import type { ProposedPlan } from '@/lib/tools/savings/types';
import { SavingsChatPanel } from '@/components/tools/SavingsChatPanel';
import { AdjustPlanChatPanel } from '@/components/tools/AdjustPlanChatPanel';
import { PlanConfirmModal } from '@/components/tools/PlanConfirmModal';
import { generateCandidateLeaps } from '@/lib/feed/generateLeaps';
import { buildUserFinancialStateFromPlan, buildTriggerSignalsFromPlan } from '@/lib/feed/fromPlanData';
import { getScenarioById } from '@/lib/feed/scenarios';
import { getLeapCopy } from '@/lib/feed/leapCopyMap';

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

const DEFAULT_EMPTY_PLAN: ProposedPlan = {
  steps: [],
  totals: {},
  assumptions: [],
  warnings: [],
  keyMetric: { label: 'Total savings', value: '—' },
};

function SavingsAllocatorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const baselineState = useOnboardingStore();
  // Current plan = user state (expenses, income, customSavingsAllocation), not 3-month average (actuals3m)
  const planData = usePlanData({ useCurrentStateActuals: true });
  const baselinePlanData = planData;

  // Query params: source=feed|sidekick|onboarding, leapId, leapType
  const source = searchParams.get('source') ?? undefined;
  const leapId = searchParams.get('leapId') ?? undefined;
  const leapType = searchParams.get('leapType') ?? undefined;

  // Confirmed vs proposed plan state (Phase 2A chat-first)
  const [confirmedPlan, setConfirmedPlan] = useState<ProposedPlan | null>(null);
  const [showPlanConfirmModal, setShowPlanConfirmModal] = useState(false);
  const [pendingUpdateMessage, setPendingUpdateMessage] = useState<string | null>(null);
  const adjustSectionRef = useRef<HTMLDivElement>(null);
  const adjustDetailsRef = useRef<HTMLDivElement>(null);
  /** Snapshot of "current plan" net worth at load so chart baseline doesn't change when sliders move. Cleared on confirm. */
  const currentPlanNetWorthSnapshotRef = useRef<number[] | null>(null);
  const [adjustDetailsOpen, setAdjustDetailsOpen] = useState(false);
  const [highlightSliders, setHighlightSliders] = useState(false);
  /** User override deltas (chat or steppers). When any set, we're in PROPOSAL mode. */
  const [overrides, setOverrides] = useState<SavingsOverrides>({});
  /** Pre-tax manual overrides: 401k employee and HSA monthly. */
  const [pretaxOverrides, setPretaxOverrides] = useState<{ k401EmployeeMonthly?: number; hsaMonthly?: number }>({});
  /** Last bucket auto-reduced by stepper (for uiMessages). */
  const [lastStepperReducedBucket, setLastStepperReducedBucket] = useState<PostTaxBucketKey | undefined>();
  const [lastEditedKey, setLastEditedKey] = useState<string | null>(null);
  const [whyPlanShowMore, setWhyPlanShowMore] = useState(false);
  
  // Calculate paychecks per month - MUST be before any hooks that use it
  const paychecksPerMonth = getPaychecksPerMonth(baselineState.income?.payFrequency || 'biweekly');
  const monthlyIncome = (baselineState.income?.netIncome$ || baselineState.income?.grossIncome$ || 0) * paychecksPerMonth;
  
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

  // Get baseline savings budget and allocation details
  // CRITICAL: This must recalculate when planData changes (which happens when riskConstraints change)
  const baselineSavingsData = useMemo(() => {
    if (!baselinePlanData) {
      console.log('[Savings Allocator] No baselinePlanData, baselineSavingsData = null');
      return null;
    }

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
    let hsa$ = 0;
    let retirementTaxAdv$ = 0;
    let brokerage$ = 0;

    if (longTermCategory?.subCategories) {
      const matchSub = longTermCategory.subCategories.find((s) => s.key === '401k_match');
      const hsaSub = longTermCategory.subCategories.find((s) => s.key === 'hsa');
      const retirementSub = longTermCategory.subCategories.find(
        (s) => s.key === 'retirement_tax_advantaged'
      );
      const brokerageSub = longTermCategory.subCategories.find((s) => s.key === 'brokerage');

      match401k$ = (matchSub?.amount || 0) * paychecksPerMonth;
      hsa$ = (hsaSub?.amount || 0) * paychecksPerMonth;
      retirementTaxAdv$ = (retirementSub?.amount || 0) * paychecksPerMonth;
      brokerage$ = (brokerageSub?.amount || 0) * paychecksPerMonth;
    }

    const result = {
      monthlySavings,
      ef$: (emergencyCategory?.amount || 0) * paychecksPerMonth,
      debt$: (debtExtraCategory?.amount || 0) * paychecksPerMonth,
      match401k$,
      hsa$,
      retirementTaxAdv$,
      brokerage$,
    };
    
    console.log('[Savings Allocator] Calculated baselineSavingsData:', {
      result,
      emergencyCategoryAmount: emergencyCategory?.amount,
      debtExtraCategoryAmount: debtExtraCategory?.amount,
      longTermCategorySubCategories: longTermCategory?.subCategories,
      riskConstraints: baselineState.riskConstraints,
    });
    
    return result;
  }, [baselinePlanData, paychecksPerMonth, baselineState.riskConstraints]);

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
        monthly: savingsBreakdown?.employerMatchMTD || 0,
      },
      employerHSA: {
        monthly: savingsBreakdown?.employerHSAMTD || 0,
      },
      total: savingsBreakdown?.preTaxSavingsTotal || 0,
    };
  }, [baselineState.income, baselineState.payrollContributions, savingsBreakdown?.employerMatchMTD, savingsBreakdown?.preTaxSavingsTotal]);

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

  // Calculate HSA recommendation
  // Show recommendation if:
  // 1. User is HSA eligible (has HDHP), OR
  // 2. User has employer HSA contribution (indicates eligibility)
  const hsaRecommendation = useMemo(() => {
    const payrollContributions = baselineState.payrollContributions;
    if (!payrollContributions || !baselineState.income) return null;
    
    // Check eligibility: explicit hsaEligible flag OR has employer HSA contribution (indicates eligibility)
    const isEligible = payrollContributions.hsaEligible === true || 
                       (payrollContributions.employerHSAContribution === "yes" && (payrollContributions.employerHSAAmount$ || 0) > 0);
    
    if (!isEligible) return null;
    
    const paychecksPerMonth = getPaychecksPerMonth(baselineState.income.payFrequency || 'biweekly');
    const grossIncomePerPaycheck = baselineState.income.grossIncome$ || baselineState.income.netIncome$ || 0;
    const grossIncomeMonthly = grossIncomePerPaycheck * paychecksPerMonth;
    
    // HSA annual limits (2025)
    const hsaCoverageType = payrollContributions.hsaCoverageType || "unknown";
    const hsaAnnualLimits = {
      self: 4300,
      family: 8550,
      unknown: 4300,
    };
    const hsaAnnualLimit$ = hsaAnnualLimits[hsaCoverageType];
    
    // Calculate current HSA contribution
    let currentHSAMonthly$ = 0;
    if (payrollContributions.currentlyContributingHSA === "yes") {
      if (payrollContributions.contributionTypeHSA === "percent_gross" && payrollContributions.contributionValueHSA) {
        currentHSAMonthly$ = (grossIncomeMonthly * payrollContributions.contributionValueHSA) / 100;
      } else if (payrollContributions.contributionTypeHSA === "amount" && payrollContributions.contributionValueHSA) {
        if (payrollContributions.contributionFrequencyHSA === "per_paycheck") {
          currentHSAMonthly$ = payrollContributions.contributionValueHSA * paychecksPerMonth;
        } else if (payrollContributions.contributionFrequencyHSA === "per_month") {
          currentHSAMonthly$ = payrollContributions.contributionValueHSA;
        }
      }
    }
    
    const currentHSAAnnual$ = currentHSAMonthly$ * 12;
    const hsaRoomThisYear$ = Math.max(0, hsaAnnualLimit$ - currentHSAAnnual$);
    const monthsRemainingInYear = 12; // Simplified
    const remainingHsaRoomMonthly$ = hsaRoomThisYear$ / monthsRemainingInYear;
    
    // MVP recommendation: Baseline $50-200/month, or more if prioritizeHSA
    const prioritizeHSA = baselineState.safetyStrategy?.retirementFocus === "High" || baselineState.safetyStrategy?.retirementFocus === "Medium";
    const baselineHSA$ = prioritizeHSA ? 200 : 100;
    const recommendedHsaMonthly$ = Math.min(baselineHSA$, remainingHsaRoomMonthly$);
    
    // Only recommend if there's room and recommended amount > current
    // If user is not contributing (currentHSAMonthly$ === 0) and there's room, show recommendation
    if (remainingHsaRoomMonthly$ <= 0 || recommendedHsaMonthly$ <= currentHSAMonthly$) {
      return null;
    }
    
    const deltaHSAMonthly$ = recommendedHsaMonthly$ - currentHSAMonthly$;
    const hsaTaxSavings$ = deltaHSAMonthly$ * ESTIMATED_MARGINAL_TAX_RATE;
    const hsaPostTaxAvailableDelta$ = -deltaHSAMonthly$ + hsaTaxSavings$;
    const employerHSAMonthly$ = payrollContributions.employerHSAAmount$ || 0;
    const hsaWealthMoveDelta$ = deltaHSAMonthly$ + employerHSAMonthly$;
    
    return {
      currentHSAMonthly$,
      recommendedHsaMonthly$,
      deltaHSAMonthly$,
      hsaTaxSavings$,
      hsaPostTaxAvailableDelta$,
      hsaWealthMoveDelta$,
      remainingHsaRoomMonthly$,
      hsaRoomThisYear$,
      hsaAnnualLimit$,
      hsaCoverageType,
    };
  }, [baselineState.payrollContributions, baselineState.income, baselineState.safetyStrategy?.retirementFocus]);

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

  // Handle "Fund HSA" button
  const handleFundHSA = () => {
    if (!hsaRecommendation || !baselineState.payrollContributions) return;

    // Update payroll contributions to set HSA contribution
    baselineState.updatePayrollContributions({
      currentlyContributingHSA: "yes",
      contributionTypeHSA: "amount",
      contributionValueHSA: hsaRecommendation.recommendedHsaMonthly$,
      contributionFrequencyHSA: "per_month",
    });

    // Clear initialPaycheckPlan to force recalculation
    baselineState.setInitialPaycheckPlan(undefined as any);

    // Show impact preview
    setImpactPreviewData({
      deltaPreTax: hsaRecommendation.deltaHSAMonthly$,
      deltaMatch: 0,
      taxSavings: hsaRecommendation.hsaTaxSavings$,
      deltaPostTax: hsaRecommendation.hsaPostTaxAvailableDelta$,
      deltaTotalWealth: hsaRecommendation.hsaWealthMoveDelta$,
    });
    setShowImpactPreview(true);
  };

  const [showImpactPreview, setShowImpactPreview] = useState(false);
  const [showImpactDetails, setShowImpactDetails] = useState(false);
  const [impactPreviewData, setImpactPreviewData] = useState<{
    deltaPreTax: number;
    deltaMatch: number;
    taxSavings: number;
    deltaPostTax: number;
    deltaTotalWealth: number;
  } | null>(null);

  const BUCKET_KEY_MAP = { ef: 'emergencyFund' as const, debt: 'highAprDebt' as const, retirementExtra: 'roth' as const, brokerage: 'brokerage' as const };

  const applyOverride = (
    category: 'ef' | 'debt' | 'retirementExtra' | 'brokerage',
    delta: number
  ) => {
    setOverrides(prev => {
      const key = category === 'retirementExtra' ? 'retirementExtraDelta' : `${category}Delta`;
      const prevVal = (prev as Record<string, number>)[key] ?? 0;
      return { ...prev, [key]: prevVal + delta };
    });
  };

  /** Manual Mode: stepper click uses deterministic rebalance (reduce from lowest priority when over pool; leave cash left when decreasing). */
  const handlePostTaxStepper = (bucketKey: 'ef' | 'debt' | 'retirementExtra' | 'brokerage', delta: number) => {
    setLastEditedKey(`posttax.${BUCKET_KEY_MAP[bucketKey]}`);
    const base = engineSnapshot ?? currentPlan;
    if (!base || !postTaxBudgetForRebalance) return;
    const ptKey: PostTaxBucketKey = BUCKET_KEY_MAP[bucketKey];
    const { plan, reducedBucket } = applyPostTaxStepperChange(base, ptKey, delta, postTaxBudgetForRebalance);
    setLastStepperReducedBucket(reducedBucket);
    const eng = engineSnapshot ?? base;
    const r = (n: number) => Math.round(n * 100) / 100;
    setOverrides({
      efDelta: r((plan.ef$ ?? 0) - (eng.ef$ ?? 0)),
      debtDelta: r((plan.debt$ ?? 0) - (eng.debt$ ?? 0)),
      retirementExtraDelta: r((plan.retirementTaxAdv$ ?? 0) - (eng.retirementTaxAdv$ ?? 0)),
      brokerageDelta: r((plan.brokerage$ ?? 0) - (eng.brokerage$ ?? 0)),
    });
  };


  const updateOverrideToValue = (
    category: 'ef' | 'debt' | 'retirementExtra' | 'brokerage',
    absoluteValue: number
  ) => {
    const base = engineSnapshot ?? currentPlan;
    if (!base || !postTaxBudgetForRebalance) return;
    const clamped = Math.max(0, absoluteValue);
    const { plan } = applyPostTaxStepperChange(base, BUCKET_KEY_MAP[category], clamped - (category === 'ef' ? base.ef$ : category === 'debt' ? base.debt$ : category === 'retirementExtra' ? base.retirementTaxAdv$ : base.brokerage$), postTaxBudgetForRebalance);
    setLastEditedKey(`posttax.${BUCKET_KEY_MAP[category]}`);
    const eng = engineSnapshot ?? base;
    const r = (n: number) => Math.round(n * 100) / 100;
    setOverrides({
      efDelta: r((plan.ef$ ?? 0) - (eng.ef$ ?? 0)),
      debtDelta: r((plan.debt$ ?? 0) - (eng.debt$ ?? 0)),
      retirementExtraDelta: r((plan.retirementTaxAdv$ ?? 0) - (eng.retirementTaxAdv$ ?? 0)),
      brokerageDelta: r((plan.brokerage$ ?? 0) - (eng.brokerage$ ?? 0)),
    });
  };

  const handlePreTaxStepper = (key: 'k401EmployeeMonthly' | 'hsaMonthly', delta: number) => {
    setLastEditedKey(key === 'k401EmployeeMonthly' ? 'pretax.k401EmployeeMonthly' : 'pretax.hsaMonthly');
    const engine401k = engineAllocationForScenario?.preTax401k$ ?? preTaxSavings.traditional401k.monthly;
    const engineHsa = engineAllocationForScenario?.hsa$ ?? preTaxSavings.hsa.monthly;
    const cur401k = pretaxOverrides.k401EmployeeMonthly ?? engine401k;
    const curHsa = pretaxOverrides.hsaMonthly ?? engineHsa;
    if (key === 'k401EmployeeMonthly') {
      setPretaxOverrides(prev => ({ ...prev, k401EmployeeMonthly: Math.max(0, cur401k + delta) }));
    } else {
      setPretaxOverrides(prev => ({ ...prev, hsaMonthly: Math.max(0, curHsa + delta) }));
    }
  };

  const updatePreTaxToValue = (key: 'k401EmployeeMonthly' | 'hsaMonthly', value: number) => {
    const clamped = Math.max(0, Math.round(value));
    setLastEditedKey(key === 'k401EmployeeMonthly' ? 'pretax.k401EmployeeMonthly' : 'pretax.hsaMonthly');
    setPretaxOverrides(prev => ({ ...prev, [key]: clamped }));
  };

  // Use post-tax savings available as the budget for allocation
  const savingsBudget = useMemo(() => {
    if (!baselineSavingsData) {
      console.log('[Savings Allocator] No baselineSavingsData, savingsBudget = 0');
      return 0;
    }
    const budget = postTaxSavingsAvailable || baselineSavingsData.monthlySavings;
    return budget;
  }, [baselineSavingsData, postTaxSavingsAvailable]);

  // currentPlan = last applied plan (from baselineSavingsData which reflects store/planData)
  const currentPlan = useMemo((): SavingsPlanSnapshot | null => {
    if (!baselineSavingsData) return null;
    return {
      ef$: baselineSavingsData.ef$,
      debt$: baselineSavingsData.debt$,
      match401k$: baselineSavingsData.match401k$,
      hsa$: baselineSavingsData.hsa$ ?? 0,
      retirementTaxAdv$: baselineSavingsData.retirementTaxAdv$,
      brokerage$: baselineSavingsData.brokerage$,
      monthlySavings: baselineSavingsData.monthlySavings,
    };
  }, [baselineSavingsData]);

  const hasOverrides =
    (overrides.efDelta ?? 0) !== 0 ||
    (overrides.debtDelta ?? 0) !== 0 ||
    (overrides.retirementExtraDelta ?? 0) !== 0 ||
    (overrides.brokerageDelta ?? 0) !== 0;

  // Phase 2A: Engine run — must be before proposedPlanSnapshot so we can use engine as "proposed" when no overrides
  const engineRunResult = useMemo(() => {
    if (!savingsBudget || savingsBudget <= 0 || !baselineState.safetyStrategy) return null;
    try {
      const userState = {
        savingsBudget$: savingsBudget,
        efTarget$,
        efBalance$,
        highAprDebts: highAprDebts.map((d) => ({ balance$: d.balance$, aprPct: d.aprPct })),
        matchNeedThisPeriod$: matchRecommendation?.recommendedMonthly ?? 0,
        incomeSingle$: monthlyIncome * 12,
        onIDR: baselineState.safetyStrategy.onIDR,
        liquidity: baselineState.safetyStrategy.liquidity ?? 'Medium',
        retirementFocus: baselineState.safetyStrategy.retirementFocus ?? 'Medium',
        hsaEligible: baselineState.payrollContributions?.hsaEligible,
        hsaCoverageType: (baselineState.payrollContributions?.hsaCoverageType as 'self' | 'family' | 'unknown') ?? 'unknown',
        currentHSAMonthly$: preTaxSavings.hsa.monthly,
        hsaRoomThisYear$: 12 * Math.max(0, (4300 - preTaxSavings.hsa.monthly * 12)),
        prioritizeHSA: baselineState.safetyStrategy.retirementFocus === 'High' || baselineState.safetyStrategy.retirementFocus === 'Medium',
        employerMatchRatePct: baselineState.payrollContributions?.employerMatchPct ?? 50,
        employerHsaMonthly$: preTaxSavings.employerHSA?.monthly ?? 0,
        monthlyBasicsForEf: monthlyBasics,
        efTargetMonths,
        grossIncomeMonthly: monthlyIncome,
        currentPlan: baselineSavingsData
          ? {
              match401k$: baselineSavingsData.match401k$,
              preTax401k$:
                (baselineSavingsData.match401k$ ?? 0) > 0
                  ? baselineSavingsData.match401k$
                  : preTaxSavings.traditional401k.monthly,
              hsa$:
                (baselineSavingsData.hsa$ ?? 0) > 0
                  ? baselineSavingsData.hsa$
                  : preTaxSavings.hsa.monthly,
              ef$: baselineSavingsData.ef$,
              debt$: baselineSavingsData.debt$,
              retirementTaxAdv$: baselineSavingsData.retirementTaxAdv$,
              brokerage$: baselineSavingsData.brokerage$,
            }
          : undefined,
      };
      const { allocation, explain } = runSavingsAllocation(userState);
      const plan = adaptSavingsResultToPlan(allocation, {
        postTaxAllocationMonthly: savingsBudget,
        preTax401kMonthlyEst: preTaxSavings.traditional401k.monthly,
        hsaMonthlyEst: preTaxSavings.hsa.monthly,
      });
      const employerMatchRatePct = baselineState.payrollContributions?.employerMatchPct ?? 50;
      const proposed401kEmployee$ = allocation.match401k$;
      const proposedEmployerMatch$ = Math.round(proposed401kEmployee$ * (employerMatchRatePct / 100) * 100) / 100;
      const postTaxTotal = allocation.ef$ + allocation.highAprDebt$ + allocation.retirementTaxAdv$ + allocation.brokerage$;
      return {
        plan,
        allocation: {
          ef$: allocation.ef$,
          highAprDebt$: allocation.highAprDebt$,
          retirementTaxAdv$: allocation.retirementTaxAdv$,
          brokerage$: allocation.brokerage$,
          hsa$: allocation.hsa$ ?? 0,
          preTax401k$: proposed401kEmployee$,
          match401k$: proposedEmployerMatch$,
        },
        explain,
        snapshot: {
          ef$: allocation.ef$,
          debt$: allocation.highAprDebt$,
          match401k$: proposedEmployerMatch$,
          hsa$: allocation.hsa$ ?? 0,
          retirementTaxAdv$: allocation.retirementTaxAdv$,
          brokerage$: allocation.brokerage$,
          monthlySavings: postTaxTotal,
        } as SavingsPlanSnapshot,
      };
    } catch {
      return null;
    }
  }, [savingsBudget, efTarget$, efBalance$, highAprDebts, baselineSavingsData, matchRecommendation?.recommendedMonthly, monthlyIncome, monthlyBasics, efTargetMonths, baselineState.safetyStrategy, baselineState.payrollContributions, preTaxSavings.hsa.monthly, preTaxSavings.traditional401k.monthly, preTaxSavings.employerHSA?.monthly]);

  const engineAllocationForScenario = useMemo(() => engineRunResult?.allocation ?? null, [engineRunResult]);
  const engineSnapshot = useMemo(() => engineRunResult?.snapshot ?? null, [engineRunResult]);

  // Effective pre-tax: use pretaxOverrides when set, else engine/payroll
  const effectivePreTax = useMemo(() => {
    const engine401k = engineAllocationForScenario?.preTax401k$ ?? preTaxSavings.traditional401k.monthly;
    const engineHsa = engineAllocationForScenario?.hsa$ ?? preTaxSavings.hsa.monthly;
    const k401 = pretaxOverrides.k401EmployeeMonthly ?? engine401k;
    const hsa = pretaxOverrides.hsaMonthly ?? engineHsa;
    const matchRate = baselineState.payrollContributions?.employerMatchPct ?? 50;
    const matchCapPct = baselineState.payrollContributions?.employerMatchCapPct ?? 6;
    const grossMonthly = monthlyIncome;
    const matchCapMonthly = grossMonthly > 0 ? (grossMonthly * matchCapPct) / 100 : 0;
    const derivedMatch = Math.min(k401 * (matchRate / 100), matchCapMonthly * (matchRate / 100));
    const matchRequired = matchRecommendation?.recommendedMonthly ?? 0;
    const matchLostIfLowered = k401 < matchRequired && matchRequired > 0 ? (matchRequired * (matchRate / 100)) - (k401 * (matchRate / 100)) : 0;
    return { k401Employee: k401, hsa, derivedMatch, matchLostIfLowered };
  }, [engineAllocationForScenario, preTaxSavings, pretaxOverrides, baselineState.payrollContributions, monthlyIncome, matchRecommendation]);

  const hasPretaxOverrides = pretaxOverrides.k401EmployeeMonthly != null || pretaxOverrides.hsaMonthly != null;

  // Budget for post-tax categories — pool = savingsBudget - effective pre-tax (401k + HSA)
  const postTaxBudgetForRebalance = useMemo(() => {
    if (!savingsBudget) return 0;
    return Math.max(0, savingsBudget - effectivePreTax.k401Employee - effectivePreTax.hsa);
  }, [savingsBudget, effectivePreTax.k401Employee, effectivePreTax.hsa]);

  // proposedPlan = engine + pretax/posttax overrides. Uses effective pre-tax and applies post-tax overrides with rebalance.
  const proposedPlanSnapshot = useMemo((): SavingsPlanSnapshot | null => {
    if (!currentPlan || !savingsBudget) return null;
    const baseForOverrides = engineSnapshot ?? currentPlan;
    const withPretax: SavingsPlanSnapshot = {
      ...baseForOverrides,
      match401k$: effectivePreTax.derivedMatch,
      hsa$: effectivePreTax.hsa,
    };
    const base = hasPretaxOverrides ? withPretax : baseForOverrides;
    if (hasOverrides) return applyOverridesAndRebalance(base, overrides, postTaxBudgetForRebalance, true);
    if (hasPretaxOverrides) return trimPostTaxToPool(withPretax, postTaxBudgetForRebalance);
    return baseForOverrides;
  }, [currentPlan, overrides, savingsBudget, postTaxBudgetForRebalance, hasOverrides, hasPretaxOverrides, engineSnapshot, effectivePreTax]);

  const mode = currentPlan && proposedPlanSnapshot
    ? getAllocatorMode(currentPlan, proposedPlanSnapshot)
    : 'VALIDATED';

  // Proposed allocation for net worth scenario — must include ALL savings: 401k, match, HSA, employer HSA
  const proposedAllocation = useMemo(() => {
    if (!proposedPlanSnapshot) return null;
    const preTax401k$ = effectivePreTax.k401Employee;
    return {
      ef$: proposedPlanSnapshot.ef$,
      highAprDebt$: proposedPlanSnapshot.debt$,
      match401k$: proposedPlanSnapshot.match401k$,
      hsa$: proposedPlanSnapshot.hsa$,
      preTax401k$,
      retirementTaxAdv$: proposedPlanSnapshot.retirementTaxAdv$,
      brokerage$: proposedPlanSnapshot.brokerage$,
      totalAllocated: proposedPlanSnapshot.monthlySavings,
      unallocated$: 0,
      warnings: [] as string[],
      hitCaps: false,
    };
  }, [proposedPlanSnapshot, effectivePreTax.k401Employee]);

  const initialEnginePlan = useMemo(() => engineRunResult?.plan ?? null, [engineRunResult]);
  const engineExplain = useMemo(() => engineRunResult?.explain ?? null, [engineRunResult]);

  // Allocation for net worth scenario: always proposed plan (current vs proposed in PROPOSAL mode)
  const allocationForScenario = useMemo(() => {
    if (proposedAllocation) return proposedAllocation;
    return engineAllocationForScenario;
  }, [proposedAllocation, engineAllocationForScenario]);

  // ProposedPlan for chat/UI: from proposedPlanSnapshot (current + overrides)
  const proposedPlan = useMemo((): ProposedPlan => {
    if (proposedPlanSnapshot) {
      return adaptUIAllocationToPlan({
        ef$: proposedPlanSnapshot.ef$,
        highAprDebt$: proposedPlanSnapshot.debt$,
        retirementTaxAdv$: proposedPlanSnapshot.retirementTaxAdv$,
        brokerage$: proposedPlanSnapshot.brokerage$,
        match401k$: proposedPlanSnapshot.match401k$ || preTaxSavings.employerMatch.monthly,
        hsa$: proposedPlanSnapshot.hsa$ || preTaxSavings.hsa.monthly,
        postTaxAllocationMonthly: proposedPlanSnapshot.monthlySavings,
      });
    }
    return initialEnginePlan ?? DEFAULT_EMPTY_PLAN;
  }, [proposedPlanSnapshot, initialEnginePlan, preTaxSavings.employerMatch.monthly, preTaxSavings.hsa.monthly]);

  // Baseline (current/saved) plan for chat — so Ribbit can explain current vs proposed
  const baselinePlanForChat = useMemo(() => {
    if (!baselineSavingsData || !baselinePlanData) return null;
    const steps: Array<{ id: string; type: string; label: string; amountMonthly?: number }> = [];
    if (preTaxSavings.traditional401k.monthly > 0) {
      steps.push({ id: '401k', type: '401k_contrib', label: '401(k) contribution', amountMonthly: preTaxSavings.traditional401k.monthly });
    }
    if (baselineSavingsData.match401k$ > 0) {
      steps.push({ id: 'match', type: '401k_match', label: '401(k) employer match', amountMonthly: baselineSavingsData.match401k$ });
    }
    if (baselineSavingsData.ef$ > 0) {
      steps.push({ id: 'ef', type: 'emergency', label: 'Emergency fund', amountMonthly: baselineSavingsData.ef$ });
    }
    if (baselineSavingsData.debt$ > 0) {
      steps.push({ id: 'debt', type: 'debt', label: 'High-APR debt paydown', amountMonthly: baselineSavingsData.debt$ });
    }
    if ((baselineSavingsData.hsa$ ?? 0) > 0) {
      steps.push({ id: 'hsa', type: 'hsa', label: 'HSA', amountMonthly: baselineSavingsData.hsa$! });
    }
    if (baselineSavingsData.retirementTaxAdv$ > 0) {
      steps.push({ id: 'retirement', type: 'retirement', label: 'Retirement (tax-advantaged)', amountMonthly: baselineSavingsData.retirementTaxAdv$ });
    }
    if (baselineSavingsData.brokerage$ > 0) {
      steps.push({ id: 'brokerage', type: 'brokerage', label: 'Brokerage', amountMonthly: baselineSavingsData.brokerage$ });
    }
    const nw12 = baselinePlanData.netWorthProjection?.find((p) => p.label === '12 Months');
    return {
      planSteps: steps.slice(0, 5),
      totals: { postTaxAllocationMonthly: baselineSavingsData.monthlySavings },
      assumptions: [] as string[],
      warnings: [] as string[],
      keyMetric: nw12
        ? { label: 'Net worth (12 mo)', value: `$${Math.round(nw12.value).toLocaleString('en-US')}` }
        : { label: 'Total savings', value: `$${Math.round(baselineSavingsData.monthlySavings).toLocaleString('en-US')}/mo` },
    };
  }, [baselineSavingsData, baselinePlanData, preTaxSavings.traditional401k.monthly]);

  const prevMode = useRef(mode);
  useEffect(() => {
    if (mode === 'PROPOSAL' && prevMode.current === 'VALIDATED') {
      setPendingUpdateMessage("Got it — I updated the plan based on your changes. It's not applied yet. Want me to apply it?");
    }
    prevMode.current = mode;
  }, [mode]);

  // Active leap for intro message (from Feed/Sidekick)
  const activeLeap = useMemo(() => {
    if (!leapType) return null;
    const effectiveState = planData
      ? buildUserFinancialStateFromPlan(planData, {
          income: baselineState.income,
          assets: baselineState.assets,
          debts: baselineState.debts,
          payrollContributions: baselineState.payrollContributions,
          plaidConnected: baselineState.plaidConnected,
          safetyStrategy: baselineState.safetyStrategy,
        })
      : getScenarioById('missing-match')?.state ?? null;
    const effectiveSignals = planData
      ? buildTriggerSignalsFromPlan(planData, { income: baselineState.income, assets: baselineState.assets, plaidConnected: baselineState.plaidConnected })
      : { nowISO: new Date().toISOString(), cashRisk: false, surplusCash: false };
    if (!effectiveState) return null;
    const leaps = generateCandidateLeaps(effectiveState, effectiveSignals);
    return leapId ? leaps.find((l) => l.leapId === leapId) ?? leaps[0] ?? null : leaps[0] ?? null;
  }, [leapType, leapId, planData, baselineState.income, baselineState.assets, baselineState.debts, baselineState.payrollContributions, baselineState.plaidConnected, baselineState.safetyStrategy]);

  const introMessage = useMemo(() => {
    if (mode === 'VALIDATED') {
      return "Your savings plan is on track.";
    }
    return activeLeap
      ? `You're here because: **${getLeapCopy(activeLeap.leapType).title}**. Here's what changes if you confirm — current vs proposed. Want me to apply this, or adjust first?`
      : "Review your savings allocation. Here's what changes if you confirm — current vs proposed. Want me to apply this, or adjust first?";
  }, [mode, activeLeap]);

  // Calculate total wealth moves (for net worth)
  // Total wealth moves = Pre-tax savings + Employer match + Post-tax savings available (total budget)
  // This represents ALL money being moved into savings/investments, not just what's allocated
  const totalWealthMoves = useMemo(() => {
    if (!proposedPlanSnapshot) return 0;
    return preTaxSavings.total + postTaxSavingsAvailable + preTaxSavings.employerMatch.monthly;
  }, [preTaxSavings, postTaxSavingsAvailable, proposedPlanSnapshot]);

  const budgetStatus = useMemo(() => {
    if (!proposedPlanSnapshot || !savingsBudget) return null;
    const desiredTotal = proposedPlanSnapshot.monthlySavings;
    const difference = desiredTotal - savingsBudget;
    const isOverBudget = difference > 1;
    const isUnderBudget = difference < -1;
    return {
      desiredTotal,
      budget: savingsBudget,
      difference: Math.abs(difference),
      isOverBudget,
      isUnderBudget,
      isOnBudget: !isOverBudget && !isUnderBudget,
      hasCapsHit: false,
    };
  }, [proposedPlanSnapshot, savingsBudget]);

  const allocationComparison = useMemo(() => {
    if (!currentPlan || !proposedPlanSnapshot) return null;
    const current401kEmployee = preTaxSavings.traditional401k.monthly;
    const proposed401kEmployee = effectivePreTax.k401Employee;
    const rows: Array<{ label: string; id: string; current: number; updated: number }> = [];
    if (current401kEmployee > 0.01 || proposed401kEmployee > 0.01) {
      rows.push({
        label: '401(k) contribution',
        id: '401K_CONTRIB',
        current: current401kEmployee,
        updated: proposed401kEmployee,
      });
    }
    if ((currentPlan.match401k$ ?? 0) > 0.01 || (proposedPlanSnapshot.match401k$ ?? 0) > 0.01) {
      rows.push({
        label: '401(k) employer match',
        id: 'EMPLOYER_MATCH',
        current: currentPlan.match401k$ ?? 0,
        updated: proposedPlanSnapshot.match401k$ ?? 0,
      });
    }
    if ((currentPlan.hsa$ ?? 0) > 0.01 || (proposedPlanSnapshot.hsa$ ?? 0) > 0.01) {
      rows.push({
        label: 'HSA',
        id: 'HSA',
        current: currentPlan.hsa$ ?? 0,
        updated: proposedPlanSnapshot.hsa$ ?? 0,
      });
    }
    return [
      ...rows,
      {
        label: 'Emergency Fund',
        id: 'EMERGENCY_FUND',
        current: currentPlan.ef$,
        updated: proposedPlanSnapshot.ef$,
      },
      {
        label: 'High-APR Debt',
        id: 'HIGH_APR_DEBT',
        current: currentPlan.debt$,
        updated: proposedPlanSnapshot.debt$,
      },
      {
        label: 'Roth IRA / Taxable Retirement',
        id: 'RETIREMENT',
        current: currentPlan.retirementTaxAdv$,
        updated: proposedPlanSnapshot.retirementTaxAdv$,
      },
      {
        label: 'Brokerage',
        id: 'BROKERAGE',
        current: currentPlan.brokerage$,
        updated: proposedPlanSnapshot.brokerage$,
      },
    ];
  }, [currentPlan, proposedPlanSnapshot, preTaxSavings.traditional401k.monthly, effectivePreTax.k401Employee]);

  // Build delta for chat panel: current vs proposed. In VALIDATED mode, isNoChange=true.
  const posttaxSum = useMemo(() =>
    (proposedPlanSnapshot?.ef$ ?? 0) + (proposedPlanSnapshot?.debt$ ?? 0) + (proposedPlanSnapshot?.retirementTaxAdv$ ?? 0) + (proposedPlanSnapshot?.brokerage$ ?? 0),
    [proposedPlanSnapshot]
  );
  const efMonthsCurrent = monthlyBasics > 0 ? Math.min(efTargetMonths, efBalance$ / monthlyBasics) : efTargetMonths;
  const efMonthsProposed = monthlyBasics > 0 ? Math.min(efTargetMonths, efBalance$ / monthlyBasics) : efTargetMonths;

  const uiMessages = useMemo(() => generateUIMessages({
    currentPlan,
    proposedPlan: proposedPlanSnapshot,
    mode,
    lastEditedKey,
    reducedBucket: lastStepperReducedBucket,
    matchNeedMonthly: matchRecommendation?.recommendedMonthly ?? 0,
    fullMatchMonthly: preTaxSavings.employerMatch.monthly,
    efTargetMonths,
    efMonthsProposed,
    efMonthsCurrent,
    monthlyBasics,
    totalDebtBalance: totalDebtBalance$,
    hsaRecommendedMonthly: hsaRecommendation?.recommendedHsaMonthly$ ?? 0,
    postTaxPool: postTaxBudgetForRebalance ?? 0,
    posttaxSum,
  }), [currentPlan, proposedPlanSnapshot, mode, lastEditedKey, lastStepperReducedBucket, matchRecommendation, preTaxSavings.employerMatch.monthly, efTargetMonths, efMonthsProposed, efMonthsCurrent, monthlyBasics, totalDebtBalance$, hsaRecommendation, postTaxBudgetForRebalance, posttaxSum]);

  const deltaOverride = useMemo(() => {
    if (!allocationComparison) return null;
    const rows = allocationComparison
      .filter((r) => r.current > 0.01 || r.updated > 0.01)
      .map((r) => ({
        id: r.id,
        label: r.label,
        current: { monthly: r.current },
        proposed: { monthly: r.updated },
      }));
    const hasAnyDelta = rows.some((r) => Math.abs(r.proposed.monthly - r.current.monthly) > 0.01);
    return {
      headline: mode === 'PROPOSAL' ? 'Here\'s what would change' : undefined,
      rows,
      isNoChange: mode === 'VALIDATED',
    };
  }, [allocationComparison, mode]);

  const scenarioPlanData = useMemo<FinalPlanData | null>(() => {
    if (!allocationForScenario || !baselinePlanData || !baselineState) return baselinePlanData ?? null;

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
          extraPayment: d.isHighApr ? allocationForScenario.highAprDebt$ : undefined,
        })),
      };
      
      // Net worth must include ALL savings: 401k contribution, employer match, HSA, employer HSA
      const scenarioPreTax401k$ = ('preTax401k$' in allocationForScenario && (allocationForScenario as { preTax401k$?: number }).preTax401k$ != null)
        ? (allocationForScenario as { preTax401k$: number }).preTax401k$
        : preTaxSavings.traditional401k.monthly;
      const scenarioMatch401k$ = ('match401k$' in allocationForScenario && (allocationForScenario as { match401k$?: number }).match401k$ != null)
        ? (allocationForScenario as { match401k$: number }).match401k$
        : preTaxSavings.employerMatch.monthly;
      const scenarioHsa$ = ('hsa$' in allocationForScenario && (allocationForScenario as { hsa$?: number }).hsa$ != null)
        ? (allocationForScenario as { hsa$: number }).hsa$
        : preTaxSavings.hsa.monthly;
      const scenarioEmployerHsa$ = preTaxSavings.employerHSA?.monthly ?? 0;
      const monthlyPlan: SimMonthlyPlan = {
        monthIndex: 0,
        incomeNet: incomePeriod$ * paychecksPerMonth,
        needs$: Math.max(0, monthlyNeeds),
        wants$: monthlyWants,
        ef$: allocationForScenario.ef$,
        highAprDebt$: allocationForScenario.highAprDebt$,
        preTax401k$: scenarioPreTax401k$,
        match401k$: scenarioMatch401k$,
        hsa$: scenarioHsa$,
        employerHsa$: scenarioEmployerHsa$,
        retirementTaxAdv$: allocationForScenario.retirementTaxAdv$,
        brokerage$: allocationForScenario.brokerage$,
      };
      
      console.log('[Savings Allocator] Monthly plan inputs (all savings for net worth)', {
        ef$: monthlyPlan.ef$,
        highAprDebt$: monthlyPlan.highAprDebt$,
        preTax401k$: monthlyPlan.preTax401k$,
        match401k$: monthlyPlan.match401k$,
        hsa$: monthlyPlan.hsa$,
        employerHsa$: monthlyPlan.employerHsa$,
        retirementTaxAdv$: monthlyPlan.retirementTaxAdv$,
        brokerage$: monthlyPlan.brokerage$,
      });
      
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
        allocationSource: mode === 'PROPOSAL' ? 'user-override' : 'engine',
        savings: {
          ef$: allocationForScenario.ef$,
          debt$: allocationForScenario.highAprDebt$,
          match401k$: preTaxSavings.employerMatch.monthly,
          retirementTaxAdv$: allocationForScenario.retirementTaxAdv$,
          brokerage$: allocationForScenario.brokerage$,
        },
      });
      
      return modifiedPlan;
    } catch (err) {
      console.error('[Savings Allocator] Error running net worth simulator:', err);
      return baselinePlanData ?? null;
    }
      }, [allocationForScenario, baselinePlanData, baselineState, mode, paychecksPerMonth, preTaxSavings]);

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

  // Snapshot "current plan" net worth once at load so chart baseline stays fixed until user confirms
  useEffect(() => {
    if (baselineNetWorthChartData?.netWorth?.length && currentPlanNetWorthSnapshotRef.current === null) {
      currentPlanNetWorthSnapshotRef.current = [...baselineNetWorthChartData.netWorth];
    }
  }, [baselineNetWorthChartData]);

  const [showDebtDetails, setShowDebtDetails] = useState(false);

  const handleConfirmApply = () => {
    // Use proposed allocation so Income, Feed, Monthly pulse use one source of truth
    // Fallback: engine proposal when allocationForScenario is null (e.g. sliders not opened, engine only)
    const allocationToSave = allocationForScenario ?? engineAllocationForScenario;
    if (!allocationToSave) {
      console.warn('[Savings Allocator] No allocation to save (allocationForScenario and engine both null)');
      alert('Unable to apply: no allocation calculated. Try opening "Adjust plan" or refresh the page.');
      return;
    }
    const proposedEf = allocationToSave.ef$;
    const proposedDebt = allocationToSave.highAprDebt$;
    const proposedRetirement = allocationToSave.retirementTaxAdv$;
    const proposedBrokerage = allocationToSave.brokerage$;
    const proposedHsa =
      'hsa$' in allocationToSave && (allocationToSave as { hsa$?: number }).hsa$ != null
        ? (allocationToSave as { hsa$: number }).hsa$
        : preTaxSavings.hsa.monthly ?? 0;
    // match401k$ in store = employee 401k contribution (to capture match), not employer match $
    const proposed401kEmployee =
      'preTax401k$' in allocationToSave && (allocationToSave as { preTax401k$?: number }).preTax401k$ != null
        ? (allocationToSave as { preTax401k$: number }).preTax401k$
        : preTaxSavings.traditional401k.monthly ?? 0;
    const customSavingsAllocation = {
      ef$: proposedEf,
      highAprDebt$: proposedDebt,
      match401k$: proposed401kEmployee,
      hsa$: proposedHsa,
      retirementTaxAdv$: proposedRetirement,
      brokerage$: proposedBrokerage,
    };
    try {
      baselineState.updateSafetyStrategy({ customSavingsAllocation });
      baselineState.setInitialPaycheckPlan(undefined as any);
      if (typeof baselineState.invalidatePlan === 'function') {
        baselineState.invalidatePlan();
      }
      currentPlanNetWorthSnapshotRef.current = null;
      setConfirmedPlan(proposedPlan);
      setOverrides({});
      setPretaxOverrides({});
      setLastStepperReducedBucket(undefined);
      setLastEditedKey(null);
      setShowPlanConfirmModal(false);
      setPendingUpdateMessage(null);
      router.push('/app/income');
      router.refresh();
    } catch (error) {
      console.error('[Savings Allocator] Error saving customSavingsAllocation:', error);
      alert('Failed to save changes. Please try again.');
    }
  };

  const handleApply = () => {
    setShowPlanConfirmModal(true);
  };

  const planConfirmDiffs = useMemo(
    () => diffPlans(confirmedPlan, proposedPlan),
    [confirmedPlan, proposedPlan]
  );

  if (!baselinePlanData || !baselineSavingsData || !proposedPlanSnapshot || !scenarioPlanData) {
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

          {/* Phase 2A: Chat-first panel */}
          <SavingsChatPanel
            introMessage={introMessage}
            proposedPlan={proposedPlan}
            isConfirmed={confirmedPlan !== null}
            onConfirmApply={() => setShowPlanConfirmModal(true)}
            toolOutputExplain={engineExplain}
            onAdjustPlan={() => {
              setAdjustDetailsOpen(true);
              requestAnimationFrame(() => {
                adjustDetailsRef.current?.scrollIntoView({ behavior: 'smooth' });
              });
              setHighlightSliders(true);
              setTimeout(() => setHighlightSliders(false), 2000);
            }}
            onNotNow={() => router.push('/app/feed')}
            userStateForChat={{
              monthlyIncome,
              postTaxSavingsAvailable: savingsBudget,
              efTarget$,
              efBalance$,
            }}
            baselinePlanForChat={baselinePlanForChat}
            currentContextForChat={{ source, leapId, leapType }}
            pendingUpdateMessage={pendingUpdateMessage}
            deltaOverride={deltaOverride}
            onUserRequestedPlanChange={
              currentPlan
                ? ({ category, delta }) => {
                    applyOverride(category, delta);
                  }
                : undefined
            }
          />

          {/* Net worth impact — visible by default (cards + chart) */}
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">Net worth impact</h2>
            {/* Benefit sublines from toolOutput.explain only (no UI math) */}
            {engineExplain && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
                {engineExplain.derived?.match?.matchGapMonthly != null && engineExplain.derived.match.matchGapMonthly > 0 && (
                  <span>
                    Free money unlocked: ~${Math.round(engineExplain.derived.match.matchGapMonthly).toLocaleString('en-US')}/mo ({Math.round((engineExplain.derived.match.matchRateEffective ?? 0.5) * 100)}% match)
                  </span>
                )}
                {engineExplain.outputs?.preTaxPlan?.employerHsaMonthlyEstimated != null && engineExplain.outputs.preTaxPlan.employerHsaMonthlyEstimated > 0 && (
                  <span>
                    Tax advantage + employer adds ~${Math.round(engineExplain.outputs.preTaxPlan.employerHsaMonthlyEstimated).toLocaleString('en-US')}/mo
                  </span>
                )}
                {engineExplain.derived?.emergencyFund?.currentMonths != null && engineExplain.derived.emergencyFund?.targetMonths != null && (
                  <span>
                    You're at ~{Math.round(engineExplain.derived.emergencyFund.currentMonths)} months, target is {engineExplain.derived.emergencyFund.targetMonths}
                  </span>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {scenarioPlanData.netWorthProjection.map((projection) => {
                const baselineValue = baselinePlanData.netWorthProjection.find(p => p.label === projection.label)?.value || 0;
                const scenarioValue = projection.value;
                const delta = scenarioValue - baselineValue;
                const showDelta = Math.abs(delta) > 1;
                return (
                  <div
                    key={projection.label}
                    className="rounded-lg border bg-white p-4 text-center dark:bg-slate-800 dark:border-slate-700"
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
            <div className="overflow-x-auto rounded-lg border bg-white p-4 dark:bg-slate-800 dark:border-slate-700">
              <NetWorthChart
                key={`savings-allocator-nw-${proposedPlanSnapshot?.ef$ ?? 0}-${proposedPlanSnapshot?.debt$ ?? 0}-${proposedPlanSnapshot?.retirementTaxAdv$ ?? 0}-${proposedPlanSnapshot?.brokerage$ ?? 0}-${scenarioPlanData.netWorthChartData.netWorth.length}-${scenarioPlanData.netWorthChartData.netWorth[0] ?? 0}-${scenarioPlanData.netWorthChartData.netWorth[scenarioPlanData.netWorthChartData.netWorth.length - 1] ?? 0}`}
                labels={scenarioPlanData.netWorthChartData.labels}
                netWorth={scenarioPlanData.netWorthChartData.netWorth}
                assets={scenarioPlanData.netWorthChartData.assets}
                liabilities={scenarioPlanData.netWorthChartData.liabilities}
                baselineNetWorth={(() => {
                  const scenarioLen = scenarioPlanData.netWorthChartData.netWorth.length;
                  const snapshot = currentPlanNetWorthSnapshotRef.current;
                  if (snapshot && snapshot.length === scenarioLen) {
                    return [...snapshot];
                  }
                  if (baselineNetWorthChartData && baselineNetWorthChartData.netWorth.length === scenarioLen) {
                    return [...baselineNetWorthChartData.netWorth];
                  }
                  return undefined;
                })()}
                height={400}
              />
              <p className="mt-2 text-xs text-center text-slate-500 dark:text-slate-400">
                Chart reflects your total wealth moves (pre-tax + post-tax + employer 401K match + employer HSA).
              </p>
            </div>
          </div>

          {/* Why this plan? — visible by default, right below Net worth impact */}
          {(proposedPlan.assumptions.length > 0 || (proposedPlan.warnings && proposedPlan.warnings.length > 0)) && (
            <div className="space-y-2">
              <h2 className="font-semibold text-slate-900 dark:text-white">Why this plan?</h2>
              <Card className="border-slate-200 dark:border-slate-700">
                <CardContent className="p-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  {(whyPlanShowMore
                    ? [...proposedPlan.assumptions, ...(proposedPlan.warnings ?? [])]
                    : [...proposedPlan.assumptions, ...(proposedPlan.warnings ?? [])].slice(0, 6)
                  ).map((item, i) => (
                    <p key={i} className={i >= proposedPlan.assumptions.length ? 'text-amber-700 dark:text-amber-300' : ''}>
                      {item}
                    </p>
                  ))}
                  {[...proposedPlan.assumptions, ...(proposedPlan.warnings ?? [])].length > 6 && (
                    <button
                      type="button"
                      onClick={() => setWhyPlanShowMore(!whyPlanShowMore)}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {whyPlanShowMore ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Adjust plan details — collapsed by default; expand on "Adjust plan" or manual open */}
          <div ref={adjustDetailsRef} className="scroll-mt-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setAdjustDetailsOpen(!adjustDetailsOpen)}
                className="flex w-full items-center justify-between bg-slate-50 dark:bg-slate-800 px-4 py-3 text-left font-medium text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-750"
              >
                <span>Adjust plan details</span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${adjustDetailsOpen ? 'rotate-180' : ''}`} />
              </button>
              {adjustDetailsOpen && (
                <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-6">
                  {/* Embedded Ribbit — Adjustments chat */}
                  <AdjustPlanChatPanel
                    context={{
                      currentPlanSummary: currentPlan ? { ef$: currentPlan.ef$, debt$: currentPlan.debt$, match401k$: currentPlan.match401k$ ?? 0, hsa$: currentPlan.hsa$ ?? 0, retirementTaxAdv$: currentPlan.retirementTaxAdv$, brokerage$: currentPlan.brokerage$, preTax401k$: preTaxSavings.traditional401k.monthly } : {},
                      proposedPlanSummary: proposedPlanSnapshot ? { ef$: proposedPlanSnapshot.ef$, debt$: proposedPlanSnapshot.debt$, match401k$: proposedPlanSnapshot.match401k$ ?? 0, hsa$: proposedPlanSnapshot.hsa$ ?? 0, retirementTaxAdv$: proposedPlanSnapshot.retirementTaxAdv$, brokerage$: proposedPlanSnapshot.brokerage$, preTax401k$: effectivePreTax.k401Employee } : {},
                      changedRows: (allocationComparison ?? []).filter(r => Math.abs(r.updated - r.current) > 0.01).map(r => ({ label: r.label, current: r.current, proposed: r.updated })),
                      postTaxPool: postTaxBudgetForRebalance,
                      cashLeft: Math.max(0, postTaxBudgetForRebalance - posttaxSum),
                      matchCaptured: effectivePreTax.k401Employee >= (matchRecommendation?.recommendedMonthly ?? 0),
                      matchGapMonthly: matchRecommendation?.matchGapMonthly ?? 0,
                      matchLostIfLowered: effectivePreTax.matchLostIfLowered,
                      uiMessages: uiMessages.map(m => ({ type: m.type, text: m.text })),
                      lastEditedKey,
                    }}
                    onReset={() => { setOverrides({}); setPretaxOverrides({}); setLastStepperReducedBucket(undefined); setLastEditedKey(null); }}
                    onApplyEdit={(edit) => {
                      if (edit.type === '401k') handlePreTaxStepper('k401EmployeeMonthly', edit.delta);
                      else if (edit.type === 'hsa') handlePreTaxStepper('hsaMonthly', edit.delta);
                      else applyOverride(edit.type as 'ef' | 'debt' | 'retirementExtra' | 'brokerage', edit.delta);
                    }}
                  />

                  {/* Pre-Tax Savings — manual controls with +/- and editable inputs */}
                  {(() => {
                    const display401k = effectivePreTax.k401Employee;
                    const displayHsa = effectivePreTax.hsa;
                    const displayMatch = effectivePreTax.derivedMatch;
                    const hasAnyPreTax = baselineState.payrollContributions?.has401k || baselineState.payrollContributions?.hsaEligible || display401k > 0 || displayHsa > 0 || displayMatch > 0 || (preTaxSavings.employerHSA?.monthly ?? 0) > 0;
                    return hasAnyPreTax && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Pre‑Tax Savings (Payroll)</h3>
                <Button variant="outline" size="sm" onClick={() => router.push(`/onboarding/payroll-contributions?returnTo=${encodeURIComponent('/app/tools/savings-allocator')}`)} className="gap-1.5">
                  <Edit className="h-3.5 w-3.5" />
                  Edit payroll
                </Button>
              </div>

              {/* 401(k) employee — editable with +/- */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">401(k) employee contribution</span>
                  {matchRecommendation && !(effectivePreTax.k401Employee >= (matchRecommendation.recommendedMonthly ?? 0)) && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" title="Why?">Recommended: capture full match</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => handlePreTaxStepper('k401EmployeeMonthly', -STEP_SIZES.pretax401k)} className="h-9 w-9 shrink-0">
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
                    <input type="number" value={Math.round(display401k)} onChange={(e) => { const v = parseFloat(String(e.target.value).replace(/[^0-9.-]/g, '')) || 0; updatePreTaxToValue('k401EmployeeMonthly', v); }} onBlur={(e) => { const v = parseFloat(String(e.target.value).replace(/[^0-9.-]/g, '')) || 0; updatePreTaxToValue('k401EmployeeMonthly', Math.max(0, v)); }} className="w-full text-right text-base font-semibold bg-transparent border-none outline-none" min={0} />
                    <div className="text-right text-xs text-slate-500">$/mo</div>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => handlePreTaxStepper('k401EmployeeMonthly', STEP_SIZES.pretax401k)} className="h-9 w-9 shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {effectivePreTax.matchLostIfLowered > 0.01 && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Heads up — lowering this forfeits about ${Math.round(effectivePreTax.matchLostIfLowered).toLocaleString()}/mo in employer match (free money).</p>
                )}
              </div>

              {/* HSA — editable with +/- */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">HSA contribution</span>
                  {hsaRecommendation && displayHsa < (hsaRecommendation.recommendedHsaMonthly$ ?? 0) - 0.01 && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" title="Why?">Recommended: fund HSA</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => handlePreTaxStepper('hsaMonthly', -STEP_SIZES.pretaxHsa)} className="h-9 w-9 shrink-0">
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
                    <input type="number" value={Math.round(displayHsa)} onChange={(e) => { const v = parseFloat(String(e.target.value).replace(/[^0-9.-]/g, '')) || 0; updatePreTaxToValue('hsaMonthly', v); }} onBlur={(e) => { const v = parseFloat(String(e.target.value).replace(/[^0-9.-]/g, '')) || 0; updatePreTaxToValue('hsaMonthly', Math.max(0, v)); }} className="w-full text-right text-base font-semibold bg-transparent border-none outline-none" min={0} />
                    <div className="text-right text-xs text-slate-500">$/mo</div>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => handlePreTaxStepper('hsaMonthly', STEP_SIZES.pretaxHsa)} className="h-9 w-9 shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Derived: Employer match and HSA (read-only) */}
              {displayMatch > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600 dark:text-slate-400">Employer 401(k) match (derived)</span>
                  <span className="font-medium text-green-600 dark:text-green-400">+${Math.round(displayMatch).toLocaleString()}/mo</span>
                </div>
              )}
              {(preTaxSavings.employerHSA?.monthly ?? 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Employer HSA (estimated)</span>
                  <span className="font-medium text-green-600 dark:text-green-400">+${Math.round(preTaxSavings.employerHSA!.monthly).toLocaleString()}/mo</span>
                </div>
              )}
            </div>
                    );
                  })()}

              {/* Hidden: Match Capture Recommendation (replaced by tip chips) */}
              {false && matchRecommendation && (
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

              {/* Hidden: HSA Recommendation (replaced by tip chips in manual controls) */}
              {false && hsaRecommendation && (
                <div className="mt-4 rounded-lg border-2 border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">
                      Fund your HSA (Step 2 in Savings Stack)
                    </h4>
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      {hsaRecommendation.hsaCoverageType === "family" ? "Family coverage" : hsaRecommendation.hsaCoverageType === "self" ? "Self-only coverage" : "Coverage type unknown"} - ${hsaRecommendation.hsaAnnualLimit$.toLocaleString('en-US')}/year limit
                    </p>
                  </div>
                  
                  <div className="mb-3 space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 dark:text-slate-300">Recommended change:</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        ${Math.round(hsaRecommendation.currentHSAMonthly$).toLocaleString('en-US')}/mo → ${Math.round(hsaRecommendation.recommendedHsaMonthly$).toLocaleString('en-US')}/mo
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 dark:text-slate-300">Delta pre-tax:</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        +${Math.round(hsaRecommendation.deltaHSAMonthly$).toLocaleString('en-US')}/mo
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 dark:text-slate-300">Wealth move (HSA + Employer HSA):</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        +${Math.round(hsaRecommendation.hsaWealthMoveDelta$).toLocaleString('en-US')}/mo
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleFundHSA}
                      size="sm"
                      className="flex-1"
                    >
                      Fund my HSA
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const returnPath = '/app/tools/savings-allocator';
                        router.push(`/onboarding/payroll-contributions?returnTo=${encodeURIComponent(returnPath)}`);
                      }}
                    >
                      Edit
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
                        setShowImpactDetails(false);
                        // Force recalculation by clearing the plan data
                        baselineState.setInitialPaycheckPlan(undefined as any);
                      }}
                      className="h-8 px-4 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      OK
                    </Button>
                  </div>
                  
                  <div className="space-y-3 text-sm mt-3">
                    {/* Main breakdown lines */}
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
                    </div>
                    
                    {/* Expandable section */}
                    <button
                      onClick={() => setShowImpactDetails(!showImpactDetails)}
                      className="w-full flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <span>View details</span>
                      {showImpactDetails ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    
                    {showImpactDetails && (
                      <div className="space-y-2.5 pt-2 border-t border-blue-200 dark:border-blue-800">
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
                    )}
                  </div>
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

            {/* Secondary metrics — use proposed when available */}
            {(() => {
              const preTaxDisplay = (engineAllocationForScenario?.preTax401k$ ?? preTaxSavings.traditional401k.monthly) + (proposedPlanSnapshot?.hsa$ ?? engineAllocationForScenario?.hsa$ ?? preTaxSavings.hsa.monthly);
              const matchDisplay = proposedPlanSnapshot?.match401k$ ?? engineAllocationForScenario?.match401k$ ?? preTaxSavings.employerMatch.monthly;
              return (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="text-center">
                <div className="text-xs text-slate-600 dark:text-slate-400">Pre‑tax payroll savings</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  ${Math.round(preTaxDisplay).toLocaleString('en-US')}/mo
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {Math.abs(preTaxDisplay - preTaxSavings.total) > 0.01 ? '(proposed)' : '(estimated)'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-600 dark:text-slate-400">Employer match</div>
                <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                  +${Math.round(matchDisplay).toLocaleString('en-US')}/mo
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {Math.abs(matchDisplay - preTaxSavings.employerMatch.monthly) > 0.01 ? '(proposed)' : '(estimated)'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-600 dark:text-slate-400">Total wealth moves</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  ${Math.round(totalWealthMoves).toLocaleString('en-US')}/mo
                </div>
              </div>
            </div>
            );
            })()}
          </div>

          {/* Warnings */}
          {proposedAllocation?.warnings && proposedAllocation.warnings.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <div className="flex-1 space-y-1">
                  {proposedAllocation.warnings.map((warning, idx) => (
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
            {/* Manual Mode: Budget Status removed; "Cash left" shown under Post-Tax steppers */}

            {/* Adjust allocation — Manual Mode: +/- steppers, deterministic rebalance */}
            <div
              ref={adjustSectionRef}
              className={`space-y-6 scroll-mt-4 rounded-lg transition-all duration-300 ${
                highlightSliders ? 'ring-2 ring-amber-400 ring-offset-2 bg-amber-50/50 dark:bg-amber-950/20' : ''
              }`}
            >
              <h2 className="font-semibold text-slate-900 dark:text-white">Manual Mode</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Use +/- to tweak each bucket. Changes create a proposed update; nothing is applied until you confirm.
              </p>

              {/* uiMessages — inline warnings/info */}
              {uiMessages.length > 0 && (
                <div className="space-y-2">
                  {uiMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        msg.type === 'danger' ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200' :
                        msg.type === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200' :
                        'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {msg.text}
                    </div>
                  ))}
                </div>
              )}

              {mode === 'PROPOSAL' && (
                <Button variant="outline" size="sm" onClick={() => { setOverrides({}); setPretaxOverrides({}); setLastStepperReducedBucket(undefined); setLastEditedKey(null); }}>
                  Reset to recommended
                </Button>
              )}

              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Post-Tax Savings Categories</h3>
              
              {/* Emergency Fund — Manual Mode: +/- steppers only, $50 step */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium text-slate-900 dark:text-white">Emergency Fund</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Target: {savingsBudget > 0 ? ((savingsBudget * 0.4) / savingsBudget * 100).toFixed(0) : 0}% of budget
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePostTaxStepper('ef', -STEP_SIZES.posttax)}
                    className="h-10 w-10 shrink-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
                    <input type="number" value={Math.round(proposedPlanSnapshot?.ef$ ?? 0)} onChange={(e) => { const v = parseFloat(String(e.target.value).replace(/[^0-9.-]/g, '')) || 0; updateOverrideToValue('ef', v); }} onBlur={(e) => { const v = parseFloat(String(e.target.value).replace(/[^0-9.-]/g, '')) || 0; updateOverrideToValue('ef', Math.max(0, v)); }} className="w-full text-right text-lg font-semibold bg-transparent border-none outline-none" min={0} />
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400 mt-1">/mo</div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePostTaxStepper('ef', STEP_SIZES.posttax)}
                    className="h-10 w-10 shrink-0"
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-1 space-y-1">
                  {efGap$ > 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Gap to target: ${efGap$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  ) : (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      ✓ Emergency fund target met
                    </p>
                  )}
                  {(proposedPlanSnapshot?.ef$ ?? 0) > savingsBudget * 0.4 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      ℹ️ Exceeds 40% target (${(savingsBudget * 0.4).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}). You can allocate more if needed.
                    </p>
                  )}
                </div>
              </div>

              {/* High-APR Debt — Manual Mode: +/- steppers, $50 step */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <button
                    onClick={() => totalDebtBalance$ > 0 && setShowDebtDetails(!showDebtDetails)}
                    className={`font-medium text-slate-900 dark:text-white ${totalDebtBalance$ > 0 ? 'cursor-pointer hover:text-primary' : ''}`}
                    disabled={totalDebtBalance$ === 0}
                  >
                    High-APR Debt Paydown
                  </button>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Target: {savingsBudget > 0 ? ((savingsBudget * 0.4) / savingsBudget * 100).toFixed(0) : 0}% of budget
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePostTaxStepper('debt', -STEP_SIZES.posttax)}
                    className="h-10 w-10 shrink-0"
                    disabled={totalDebtBalance$ === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
                    <input type="number" value={Math.round(proposedPlanSnapshot?.debt$ ?? 0)} onChange={(e) => { const v = parseFloat(String(e.target.value).replace(/[^0-9.-]/g, '')) || 0; updateOverrideToValue('debt', v); }} onBlur={(e) => { const v = parseFloat(String(e.target.value).replace(/[^0-9.-]/g, '')) || 0; updateOverrideToValue('debt', Math.max(0, v)); }} className="w-full text-right text-lg font-semibold bg-transparent border-none outline-none" min={0} disabled={totalDebtBalance$ === 0} />
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400 mt-1">/mo</div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePostTaxStepper('debt', STEP_SIZES.posttax)}
                    className="h-10 w-10 shrink-0"
                    disabled={totalDebtBalance$ === 0}
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {(proposedPlanSnapshot?.debt$ ?? 0) > savingsBudget * 0.4 && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    ℹ️ Exceeds 40% target (${(savingsBudget * 0.4).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}). You can allocate more if needed.
                  </p>
                )}
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
                        const extraPayment = (proposedAllocation?.highAprDebt$ ?? 0) * debtProportion;
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
                              ${(highAprDebts.reduce((sum, d) => sum + d.minPayment$, 0) + (proposedAllocation?.highAprDebt$ ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">Allocated to Debt:</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              ${(proposedAllocation?.highAprDebt$ ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo
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

              {/* Retirement Extra (Roth IRA / Taxable Retirement) — Manual Mode: +/- steppers, $50 step */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium text-slate-900 dark:text-white">Roth IRA / Taxable Retirement</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePostTaxStepper('retirementExtra', -STEP_SIZES.posttax)}
                    className="h-10 w-10 shrink-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
                    <input type="number" value={Math.round(proposedPlanSnapshot?.retirementTaxAdv$ ?? 0)} onChange={(e) => { const v = parseFloat(String(e.target.value).replace(/[^0-9.-]/g, '')) || 0; updateOverrideToValue('retirementExtra', v); }} onBlur={(e) => { const v = parseFloat(String(e.target.value).replace(/[^0-9.-]/g, '')) || 0; updateOverrideToValue('retirementExtra', Math.max(0, v)); }} className="w-full text-right text-lg font-semibold bg-transparent border-none outline-none" min={0} />
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400 mt-1">/mo</div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePostTaxStepper('retirementExtra', STEP_SIZES.posttax)}
                    className="h-10 w-10 shrink-0"
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Post-tax retirement accounts (Roth IRA, taxable retirement)
                </p>
              </div>

              {/* Brokerage — Manual Mode: +/- steppers, $50 step */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium text-slate-900 dark:text-white">Brokerage (Taxable Investing)</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePostTaxStepper('brokerage', -STEP_SIZES.posttax)}
                    className="h-10 w-10 shrink-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
                    <input type="number" value={Math.round(proposedPlanSnapshot?.brokerage$ ?? 0)} onChange={(e) => { const v = parseFloat(String(e.target.value).replace(/[^0-9.-]/g, '')) || 0; updateOverrideToValue('brokerage', v); }} onBlur={(e) => { const v = parseFloat(String(e.target.value).replace(/[^0-9.-]/g, '')) || 0; updateOverrideToValue('brokerage', Math.max(0, v)); }} className="w-full text-right text-lg font-semibold bg-transparent border-none outline-none" min={0} />
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400 mt-1">/mo</div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePostTaxStepper('brokerage', STEP_SIZES.posttax)}
                    className="h-10 w-10 shrink-0"
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Cash left / Fully allocated — replaces Budget Status in Manual Mode */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                {(postTaxBudgetForRebalance - posttaxSum) < 0.01
                  ? <span className="text-green-700 dark:text-green-400">✓ Fully allocated</span>
                  : <span className="text-slate-700 dark:text-slate-300">Cash left to allocate: ${Math.round(Math.max(0, postTaxBudgetForRebalance - posttaxSum)).toLocaleString('en-US')}/mo</span>
                }
              </div>
            </div>

            {/* Monthly Allocation Changes (chart + projection cards moved to Net worth impact above) */}
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
          </div>
        </div>
      )}
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

      {/* Phase 2A: Plan confirmation modal (required before apply) */}
      <PlanConfirmModal
        open={showPlanConfirmModal}
        diffs={planConfirmDiffs}
        isFirstApply={confirmedPlan === null}
        onConfirm={handleConfirmApply}
        onCancel={() => setShowPlanConfirmModal(false)}
        onReviewDetails={() => {
          setShowPlanConfirmModal(false);
          setAdjustDetailsOpen(true);
          requestAnimationFrame(() => {
            adjustDetailsRef.current?.scrollIntoView({ behavior: 'smooth' });
          });
        }}
      />
        </div>
      </div>
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

