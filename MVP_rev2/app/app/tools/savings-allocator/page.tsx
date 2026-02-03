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
import { calculateSavingsBreakdown, calculateDisplaySavingsBreakdown, calculateEmployerMatch, getGrossIncomeMonthly } from '@/lib/utils/savingsCalculations';
import { buildChatCurrentPlanData } from '@/lib/chat/buildChatPlanData';
import { runSavingsAllocation } from '@/lib/tools/savings/runSavingsAllocation';
import { adaptSavingsResultToPlan, adaptUIAllocationToPlan } from '@/lib/tools/savings/adaptSavingsResultToPlan';
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
import { diffPlans } from '@/lib/tools/savings/diffPlans';
import { SavingsChatPanel } from '@/components/tools/SavingsChatPanel';
import { PlanConfirmModal } from '@/components/tools/PlanConfirmModal';
import { generateCandidateLeaps } from '@/lib/feed/generateLeaps';
import { buildUserFinancialStateFromPlan, buildTriggerSignalsFromPlan } from '@/lib/feed/fromPlanData';
import { getScenarioById } from '@/lib/feed/scenarios';
import { getLeapCopy } from '@/lib/feed/leapCopyMap';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';

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

export type AllocatorScenario =
  | 'my_data'
  | 'first_time'
  | 'savings_decrease'
  | 'savings_increase'
  | 'no_match'
  | 'no_hsa';

const ALLOCATOR_SCENARIO_OPTIONS: { value: AllocatorScenario; label: string }[] = [
  { value: 'my_data', label: 'My Data' },
  { value: 'first_time', label: 'First Time' },
  { value: 'savings_decrease', label: 'Savings Decrease' },
  { value: 'savings_increase', label: 'Savings Increase' },
  { value: 'no_match', label: 'No Match' },
  { value: 'no_hsa', label: 'No HSA' },
];

function SavingsAllocatorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const baselineState = useOnboardingStore();
  // Current plan = user state (expenses, income, customSavingsAllocation), not 3-month average (actuals3m)
  const planData = usePlanData({ useCurrentStateActuals: true });
  const baselinePlanData = planData;

  // Query params: source=feed|sidekick|onboarding, leapId, leapType, scenario, simulateAmount (from feed)
  const source = searchParams?.get('source') ?? undefined;
  const leapId = searchParams?.get('leapId') ?? undefined;
  const leapType = searchParams?.get('leapType') ?? undefined;
  const urlScenario = searchParams?.get('scenario') ?? undefined;
  const urlSimulateAmount = searchParams?.get('simulateAmount');

  // Confirmed vs proposed plan state (Phase 2A chat-first)
  const [confirmedPlan, setConfirmedPlan] = useState<ProposedPlan | null>(null);
  const [showPlanConfirmModal, setShowPlanConfirmModal] = useState(false);
  const [pendingUpdateMessage, setPendingUpdateMessage] = useState<string | null>(null);
  /** Snapshot of "current plan" net worth at load so chart baseline doesn't change. Cleared on confirm. */
  const currentPlanNetWorthSnapshotRef = useRef<number[] | null>(null);
  /** User override deltas (chat). When any set, we're in PROPOSAL mode. */
  const [overrides, setOverrides] = useState<SavingsOverrides>({});
  /** Pre-tax manual overrides: 401k employee and HSA monthly. */
  const [pretaxOverrides, setPretaxOverrides] = useState<{ k401EmployeeMonthly?: number; hsaMonthly?: number }>({});
  /** Last bucket auto-reduced by stepper (for uiMessages). */
  const [lastStepperReducedBucket, setLastStepperReducedBucket] = useState<PostTaxBucketKey | undefined>();
  const [lastEditedKey, setLastEditedKey] = useState<string | null>(null);
  const [whyPlanShowMore, setWhyPlanShowMore] = useState(false);
  /** First-time: "See details first" expanded (bucket list + Why) */
  const [firstTimeDetailsExpanded, setFirstTimeDetailsExpanded] = useState(false);
  /** Toast message (e.g. "Savings plan applied") */
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  /** Scenario for testing: My Data, First Time, Savings Decrease/Increase, No Match, No HSA */
  const [allocatorScenario, setAllocatorScenario] = useState<AllocatorScenario>('my_data');
  const [simulateAmount, setSimulateAmount] = useState(200);
  const appliedFeedParamsRef = useRef(false);

  // When opening from feed (source=feed) or onboarding (source=onboarding), apply URL scenario and simulateAmount once.
  useEffect(() => {
    if (appliedFeedParamsRef.current) return;
    if (source === 'feed') {
      const valid: AllocatorScenario[] = ['my_data', 'first_time', 'savings_decrease', 'savings_increase', 'no_match', 'no_hsa'];
      if (urlScenario && valid.includes(urlScenario as AllocatorScenario)) {
        setAllocatorScenario(urlScenario as AllocatorScenario);
        appliedFeedParamsRef.current = true;
      }
      if (urlSimulateAmount != null && urlSimulateAmount !== '') {
        const n = Number(urlSimulateAmount);
        if (!Number.isNaN(n) && n >= 0) setSimulateAmount(n);
        appliedFeedParamsRef.current = true;
      }
    } else if (source === 'onboarding') {
      setAllocatorScenario('first_time');
      appliedFeedParamsRef.current = true;
    }
  }, [source, urlScenario, urlSimulateAmount]);
  
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

  // Display savings breakdown (plan-based overrides) — matches Income tab, FinancialSidekick
  const displaySavingsBreakdown = useMemo(
    () =>
      calculateDisplaySavingsBreakdown(
        baselineState.income ?? undefined,
        baselineState.payrollContributions ?? undefined,
        monthlyNeeds,
        monthlyWants,
        baselinePlanData?.paycheckCategories ?? null
      ),
    [
      baselineState.income,
      baselineState.payrollContributions,
      monthlyNeeds,
      monthlyWants,
      baselinePlanData?.paycheckCategories,
    ]
  );

  // Current plan data for chat — consistent across all chat windows (savings-allocator, savings-helper, sidekick)
  const currentPlanDataForChat = useMemo(
    () =>
      buildChatCurrentPlanData(baselinePlanData ?? null, {
        paychecksPerMonth,
        savingsBreakdown: displaySavingsBreakdown,
      }),
    [baselinePlanData, paychecksPerMonth, displaySavingsBreakdown]
  );
  
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
    const base = engineSnapshot ?? effectiveCurrentPlan;
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
    const base = engineSnapshot ?? effectiveCurrentPlan;
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

  const grossIncomeMonthly = getGrossIncomeMonthly(baselineState.income);

  /** Pending proposed amount from savings-helper (user changed amount there but did not Apply). When set, Proposed Plan = allocation of this amount; Current Plan = last locked. Restore from sessionStorage on mount so it survives navigation/reload. */
  const proposedSavingsFromHelper = useOnboardingStore((s) => s.proposedSavingsFromHelper ?? null);
  useEffect(() => {
    if (proposedSavingsFromHelper != null) return;
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem('weleap_proposedSavingsFromHelper');
    if (!raw) return;
    const n = Number(raw);
    if (Number.isNaN(n) || n <= 0) return;
    useOnboardingStore.getState().setProposedSavingsFromHelper(n);
  }, [proposedSavingsFromHelper]);

  // Use post-tax savings available as the budget for allocation
  const savingsBudget = useMemo(() => {
    if (!baselineSavingsData) {
      console.log('[Savings Allocator] No baselineSavingsData, savingsBudget = 0');
      return 0;
    }
    const budget = postTaxSavingsAvailable || baselineSavingsData.monthlySavings;
    return budget;
  }, [baselineSavingsData, postTaxSavingsAvailable]);

  // Scenario overrides: effective budget and payroll for engine/display
  // no_match: keep budget SAME — we reallocate from brokerage→401k, not add money (avoids inflating EF/debt/retirement)
  const effectiveSavingsBudget = useMemo(() => {
    if (allocatorScenario === 'savings_decrease') {
      return Math.max(0, savingsBudget - Math.max(0, simulateAmount));
    }
    if (allocatorScenario === 'savings_increase') {
      return savingsBudget + Math.max(0, simulateAmount);
    }
    return savingsBudget;
  }, [allocatorScenario, savingsBudget, simulateAmount]);

  /** When user proposed a new amount in savings-helper (not yet applied), use it for Proposed Plan so Current vs Proposed differ. */
  const budgetForProposedPlan = useMemo(() => {
    if (proposedSavingsFromHelper != null && proposedSavingsFromHelper > 0) return proposedSavingsFromHelper;
    return effectiveSavingsBudget;
  }, [proposedSavingsFromHelper, effectiveSavingsBudget]);

  const effectivePayrollContributions = useMemo(() => {
    const base = baselineState.payrollContributions;
    if (!base) return undefined;
    // no_match = user not contributing to 401k → keep match available so engine recommends capturing (no override)
    if (allocatorScenario === 'no_match') return base;
    // no_hsa = user not contributing to HSA → keep HSA eligible so engine recommends HSA; only set not contributing
    if (allocatorScenario === 'no_hsa') {
      return { ...base, currentlyContributingHSA: 'no' as const };
    }
    return base;
  }, [baselineState.payrollContributions, allocatorScenario]);

  // Current Plan = last LOCKED (applied) plan — from store (e.g. after Apply in savings-helper).
  // Proposed Plan = engine allocation of that budget + any overrides; when user changes savings amount elsewhere, that shows as Proposed until they Apply, then it becomes Current here.
  // SavingsPlanSnapshot.match401k$ = EMPLOYER match (for deepEqualPlans). no_match: current has 401k=0, match=0.
  const currentPlan = useMemo((): SavingsPlanSnapshot | null => {
    if (!baselineSavingsData) return null;
    const employee401k = allocatorScenario === 'no_match' ? 0 : baselineSavingsData.match401k$;
    const employerMatch =
      allocatorScenario === 'no_match'
        ? 0
        : calculateEmployerMatch(
            employee401k,
            grossIncomeMonthly,
            baselineState.payrollContributions ?? undefined
          );
    const basePlan = {
      ef$: baselineSavingsData.ef$,
      debt$: baselineSavingsData.debt$,
      match401k$: employerMatch,
      hsa$: baselineSavingsData.hsa$ ?? 0,
      retirementTaxAdv$: baselineSavingsData.retirementTaxAdv$,
      brokerage$: baselineSavingsData.brokerage$,
      monthlySavings: baselineSavingsData.monthlySavings,
    };
    if (allocatorScenario === 'no_match') {
      const matchNeed$ = matchRecommendation?.recommendedMonthly ?? 0;
      const freedPostTaxCash = matchNeed$ * (1 - ESTIMATED_MARGINAL_TAX_RATE);
      const brokerageWithUnallocated = baselineSavingsData.brokerage$ + freedPostTaxCash;
      const postTaxTotal =
        baselineSavingsData.ef$ +
        baselineSavingsData.debt$ +
        baselineSavingsData.retirementTaxAdv$ +
        brokerageWithUnallocated;
      return {
        ...basePlan,
        brokerage$: brokerageWithUnallocated,
        match401k$: 0,
        monthlySavings: postTaxTotal,
      };
    }
    return basePlan;
  }, [
    baselineSavingsData,
    grossIncomeMonthly,
    baselineState.payrollContributions,
    allocatorScenario,
    matchRecommendation?.recommendedMonthly,
  ]);

  /** When scenario is First Time, treat as no current plan (engine proposes first plan). */
  const effectiveCurrentPlan = allocatorScenario === 'first_time' ? null : currentPlan;

  const hasOverrides =
    (overrides.efDelta ?? 0) !== 0 ||
    (overrides.debtDelta ?? 0) !== 0 ||
    (overrides.retirementExtraDelta ?? 0) !== 0 ||
    (overrides.brokerageDelta ?? 0) !== 0;

  // Phase 2A: Engine run — must be before proposedPlanSnapshot so we can use engine as "proposed" when no overrides.
  // When proposedSavingsFromHelper is set, we run engine with that budget so Proposed Plan shows the new amount; Current stays last locked.
  const engineRunResult = useMemo(() => {
    if (!budgetForProposedPlan || budgetForProposedPlan <= 0 || !baselineState.safetyStrategy) return null;
    try {
      // no_match = user not contributing to 401k → pass match need so engine recommends capturing; current 401k = 0 in currentPlanForEngine
      const matchNeed$ = matchRecommendation?.recommendedMonthly ?? 0;
      // no_hsa = user not contributing to HSA → keep eligible so engine recommends HSA; current HSA = 0
      const hsaEligible = effectivePayrollContributions?.hsaEligible ?? baselineState.payrollContributions?.hsaEligible ?? false;
      const currentHSAMonthly$ = allocatorScenario === 'no_hsa' ? 0 : preTaxSavings.hsa.monthly;
      const hsaRoomThisYear$ = allocatorScenario === 'no_hsa'
        ? 4300 // full room so engine can recommend (self limit placeholder)
        : 12 * Math.max(0, (4300 - preTaxSavings.hsa.monthly * 12));
      const employerMatchRatePct = effectivePayrollContributions?.employerMatchPct ?? baselineState.payrollContributions?.employerMatchPct ?? 50;
      const employerHsaMonthly$ = preTaxSavings.employerHSA?.monthly ?? 0;
      // When no_match, pass current plan with 0 401k, unallocated→brokerage so engine sees correct baseline
      const currentPlanForEngine = effectiveCurrentPlan && baselineSavingsData
        ? {
            match401k$: allocatorScenario === 'no_match' ? 0 : (baselineSavingsData.match401k$ ?? 0),
            preTax401k$: allocatorScenario === 'no_match' ? 0 : ((baselineSavingsData.match401k$ ?? 0) > 0 ? baselineSavingsData.match401k$! : preTaxSavings.traditional401k.monthly),
            hsa$: allocatorScenario === 'no_hsa' ? 0 : ((baselineSavingsData.hsa$ ?? 0) > 0 ? baselineSavingsData.hsa$! : preTaxSavings.hsa.monthly),
            ef$: baselineSavingsData.ef$,
            debt$: baselineSavingsData.debt$,
            retirementTaxAdv$: baselineSavingsData.retirementTaxAdv$,
            brokerage$: allocatorScenario === 'no_match' ? effectiveCurrentPlan.brokerage$ : baselineSavingsData.brokerage$,
          }
        : undefined;
      const userState = {
        savingsBudget$: budgetForProposedPlan,
        efTarget$,
        efBalance$,
        highAprDebts: highAprDebts.map((d) => ({ balance$: d.balance$, aprPct: d.aprPct })),
        matchNeedThisPeriod$: matchNeed$,
        incomeSingle$: monthlyIncome * 12,
        onIDR: baselineState.safetyStrategy.onIDR,
        liquidity: baselineState.safetyStrategy.liquidity ?? 'Medium',
        retirementFocus: baselineState.safetyStrategy.retirementFocus ?? 'Medium',
        hsaEligible,
        hsaCoverageType: (effectivePayrollContributions?.hsaCoverageType ?? baselineState.payrollContributions?.hsaCoverageType as 'self' | 'family' | 'unknown') ?? 'unknown',
        currentHSAMonthly$,
        hsaRoomThisYear$,
        prioritizeHSA: baselineState.safetyStrategy.retirementFocus === 'High' || baselineState.safetyStrategy.retirementFocus === 'Medium',
        employerMatchRatePct,
        employerHsaMonthly$,
        monthlyBasicsForEf: monthlyBasics,
        efTargetMonths,
        grossIncomeMonthly: monthlyIncome,
        currentPlan: currentPlanForEngine,
      };
      const { allocation, explain } = runSavingsAllocation(userState);
      const proposed401kEmployee$ = allocation.match401k$;
      const proposedEmployerMatch$ = calculateEmployerMatch(
        proposed401kEmployee$,
        grossIncomeMonthly,
        effectivePayrollContributions ?? baselineState.payrollContributions ?? undefined
      );
      const plan = adaptSavingsResultToPlan(allocation, {
        postTaxAllocationMonthly: budgetForProposedPlan,
        preTax401kMonthlyEst: preTaxSavings.traditional401k.monthly,
        hsaMonthlyEst: preTaxSavings.hsa.monthly,
        employerMatchEst: proposedEmployerMatch$,
      });
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
  }, [budgetForProposedPlan, allocatorScenario, efTarget$, efBalance$, highAprDebts, effectiveCurrentPlan, baselineSavingsData, matchRecommendation?.recommendedMonthly, monthlyIncome, monthlyBasics, efTargetMonths, baselineState.safetyStrategy, baselineState.payrollContributions, effectivePayrollContributions, preTaxSavings.hsa.monthly, preTaxSavings.traditional401k.monthly, preTaxSavings.employerHSA?.monthly, grossIncomeMonthly]);

  const engineAllocationForScenario = useMemo(() => engineRunResult?.allocation ?? null, [engineRunResult]);
  const engineSnapshot = useMemo(() => engineRunResult?.snapshot ?? null, [engineRunResult]);

  // Effective pre-tax: use pretaxOverrides when set, else engine/payroll. No Match/No HSA = engine recommends (use engine output).
  const effectivePreTax = useMemo(() => {
    const engine401k = engineAllocationForScenario?.preTax401k$ ?? preTaxSavings.traditional401k.monthly;
    const engineHsa = engineAllocationForScenario?.hsa$ ?? preTaxSavings.hsa.monthly;
    const k401 = pretaxOverrides.k401EmployeeMonthly ?? engine401k;
    const hsa = pretaxOverrides.hsaMonthly ?? engineHsa;
    const derivedMatch = calculateEmployerMatch(
      k401,
      grossIncomeMonthly,
      effectivePayrollContributions ?? baselineState.payrollContributions ?? undefined
    );
    const matchRequired = matchRecommendation?.recommendedMonthly ?? 0;
    const matchAtRequired = matchRequired > 0
      ? calculateEmployerMatch(matchRequired, grossIncomeMonthly, effectivePayrollContributions ?? baselineState.payrollContributions ?? undefined)
      : 0;
    const matchLostIfLowered = k401 < matchRequired && matchRequired > 0 ? matchAtRequired - derivedMatch : 0;
    return { k401Employee: k401, hsa, derivedMatch, matchLostIfLowered };
  }, [engineAllocationForScenario, allocatorScenario, preTaxSavings, pretaxOverrides, baselineState.payrollContributions, effectivePayrollContributions, grossIncomeMonthly, matchRecommendation]);

  const hasPretaxOverrides = pretaxOverrides.k401EmployeeMonthly != null || pretaxOverrides.hsaMonthly != null;

  // Budget for post-tax categories — pool = budgetForProposedPlan - effective pre-tax (so Proposed Plan uses same budget as engine)
  const postTaxBudgetForRebalance = useMemo(() => {
    if (!budgetForProposedPlan) return 0;
    return Math.max(0, budgetForProposedPlan - effectivePreTax.k401Employee - effectivePreTax.hsa);
  }, [budgetForProposedPlan, effectivePreTax.k401Employee, effectivePreTax.hsa]);

  // proposedPlan = engine + pretax/posttax overrides. Uses effective pre-tax and applies post-tax overrides with rebalance.
  const proposedPlanSnapshot = useMemo((): SavingsPlanSnapshot | null => {
    if (!budgetForProposedPlan) return null;
    const baseForOverrides = engineSnapshot ?? effectiveCurrentPlan;
    if (!baseForOverrides) return null;
    const withPretax: SavingsPlanSnapshot = {
      ...baseForOverrides,
      match401k$: effectivePreTax.derivedMatch,
      hsa$: effectivePreTax.hsa,
    };
    const base = hasPretaxOverrides ? withPretax : baseForOverrides;
    // allowCashLeft=false: redirect freed funds to brokerage so user keeps building wealth
    if (hasOverrides) return applyOverridesAndRebalance(base, overrides, postTaxBudgetForRebalance, false);
    if (hasPretaxOverrides) return trimPostTaxToPool(withPretax, postTaxBudgetForRebalance);
    return baseForOverrides;
  }, [effectiveCurrentPlan, overrides, budgetForProposedPlan, postTaxBudgetForRebalance, hasOverrides, hasPretaxOverrides, engineSnapshot, effectivePreTax]);

  const mode = effectiveCurrentPlan && proposedPlanSnapshot
    ? getAllocatorMode(effectiveCurrentPlan, proposedPlanSnapshot)
    : proposedPlanSnapshot ? 'PROPOSAL' : 'VALIDATED';

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
        preTax401k$: effectivePreTax.k401Employee,
        match401k$: proposedPlanSnapshot.match401k$ || preTaxSavings.employerMatch.monthly,
        hsa$: proposedPlanSnapshot.hsa$ || preTaxSavings.hsa.monthly,
        postTaxAllocationMonthly: proposedPlanSnapshot.monthlySavings,
      });
    }
    return initialEnginePlan ?? DEFAULT_EMPTY_PLAN;
  }, [proposedPlanSnapshot, initialEnginePlan, effectivePreTax.k401Employee, preTaxSavings.employerMatch.monthly, preTaxSavings.hsa.monthly]);

  // Baseline (current/saved) plan for chat — so Ribbit can explain current vs proposed
  // no_match: use effectiveCurrentPlan so steps show 401k=0, match=0, unallocated→brokerage
  const baselinePlanForChat = useMemo(() => {
    if (!baselineSavingsData || !baselinePlanData) return null;
    const current = effectiveCurrentPlan ?? {
      ef$: 0,
      debt$: 0,
      match401k$: 0,
      hsa$: 0,
      retirementTaxAdv$: 0,
      brokerage$: 0,
      monthlySavings: 0,
    };
    const steps: Array<{ id: string; type: string; label: string; amountMonthly?: number }> = [];
    const employee401k =
      allocatorScenario === 'no_match' ? 0 : baselineSavingsData.match401k$ ?? preTaxSavings.traditional401k.monthly;
    const employerMatch$ =
      allocatorScenario === 'no_match'
        ? 0
        : calculateEmployerMatch(
            employee401k,
            grossIncomeMonthly,
            baselineState.payrollContributions ?? undefined
          );
    if (employee401k > 0) {
      steps.push({ id: '401k', type: '401k_contrib', label: '401(k) contribution', amountMonthly: employee401k });
    }
    if (employerMatch$ > 0) {
      steps.push({ id: 'match', type: '401k_match', label: '401(k) employer match', amountMonthly: employerMatch$ });
    }
    if (current.ef$ > 0) {
      steps.push({ id: 'ef', type: 'emergency', label: 'Emergency fund', amountMonthly: current.ef$ });
    }
    if (current.debt$ > 0) {
      steps.push({ id: 'debt', type: 'debt', label: 'High-APR debt paydown', amountMonthly: current.debt$ });
    }
    if ((current.hsa$ ?? 0) > 0) {
      steps.push({ id: 'hsa', type: 'hsa', label: 'HSA', amountMonthly: current.hsa$! });
    }
    if (current.retirementTaxAdv$ > 0) {
      steps.push({ id: 'retirement', type: 'retirement', label: 'Roth IRA (tax-advantaged)', amountMonthly: current.retirementTaxAdv$ });
    }
    if (current.brokerage$ > 0) {
      steps.push({ id: 'brokerage', type: 'brokerage', label: 'Brokerage', amountMonthly: current.brokerage$ });
    }
    const nw12 = baselinePlanData.netWorthProjection?.find((p) => p.label === '12 Months');
    return {
      planSteps: steps.slice(0, 6),
      totals: { postTaxAllocationMonthly: current.monthlySavings },
      assumptions: [] as string[],
      warnings: [] as string[],
      keyMetric: nw12
        ? { label: 'Net worth (12 mo)', value: `$${Math.round(nw12.value).toLocaleString('en-US')}` }
        : { label: 'Total savings', value: `$${Math.round(current.monthlySavings).toLocaleString('en-US')}/mo` },
    };
  }, [
    baselineSavingsData,
    baselinePlanData,
    effectiveCurrentPlan,
    allocatorScenario,
    preTaxSavings.traditional401k.monthly,
    grossIncomeMonthly,
    baselineState.payrollContributions,
  ]);

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

  // Total Monthly Savings = Pre-tax (401k + HSA) + Employer (match + HSA) + Post-tax (EF + debt + retirement + brokerage)
  // baselineSavingsData.monthlySavings already includes 401k_employee + HSA (from plan's long_term category) — do NOT add again
  // no_match: use effectiveCurrentPlan so current reflects 401k=0, match=0, unallocated→brokerage
  const totalMonthlySavingsForChat = useMemo(() => {
    if (!baselineSavingsData || !proposedPlanSnapshot) return null;
    const employerHsa = preTaxSavings.employerHSA?.monthly ?? 0;
    const current401kEmployee =
      allocatorScenario === 'no_match' ? 0 : baselineSavingsData.match401k$ ?? preTaxSavings.traditional401k.monthly;
    const currentEmployerMatch =
      allocatorScenario === 'no_match'
        ? 0
        : calculateEmployerMatch(
            current401kEmployee,
            grossIncomeMonthly,
            baselineState.payrollContributions ?? undefined
          );
    const currentPlanMonthly = effectiveCurrentPlan?.monthlySavings ?? baselineSavingsData.monthlySavings;
    const currentHsa$ = effectiveCurrentPlan?.hsa$ ?? baselineSavingsData.hsa$ ?? 0;
    // Current: monthlySavings (post-tax) + 401k employee + match + HSA employee + employer HSA
    const totalCurrent =
      (allocatorScenario === 'no_match'
        ? currentPlanMonthly + currentHsa$ + currentEmployerMatch + employerHsa
        : currentEmployerMatch + employerHsa + baselineSavingsData.monthlySavings);
    // Proposed: monthlySavings = post-tax only (ef + debt + roth + brokerage); add 401k employee + match + HSA + employer HSA
    const totalProposed =
      effectivePreTax.k401Employee +
      effectivePreTax.derivedMatch +
      (proposedPlanSnapshot.hsa$ ?? 0) +
      employerHsa +
      proposedPlanSnapshot.monthlySavings;
    return { totalCurrent, totalProposed };
  }, [
    baselineSavingsData,
    proposedPlanSnapshot,
    effectiveCurrentPlan,
    effectivePreTax,
    preTaxSavings,
    allocatorScenario,
    baselineState.payrollContributions,
    grossIncomeMonthly,
  ]);

  /** User has an applied savings plan in the store (persisted). Used for isConfirmed and modal copy. */
  const hasAppliedPlanInStore = !!baselineState.safetyStrategy?.customSavingsAllocation;
  /** Simplified First Time UI: when scenario is "First Time", always show intro + "What this plan does" + Apply + See details first (no bucket list by default, no yellow banner). Stable and consistent. */
  const isFirstTimeSetup = allocatorScenario === 'first_time';

  const introMessage = useMemo(() => {
    if (isFirstTimeSetup) {
      return "I've designed a savings strategy that prioritizes safety, free money, and long-term growth — in that order.\n\nWant to review details first, or should I apply it?";
    }
    if (mode === 'VALIDATED') {
      return "Your savings plan is on track.";
    }
    const currentMonthly = Math.round(effectiveSavingsBudget ?? 0);
    const proposedMonthly = Math.round((proposedPlanSnapshot?.monthlySavings ?? budgetForProposedPlan ?? 0));
    const monthlyChanged = Math.abs((proposedPlanSnapshot?.monthlySavings ?? budgetForProposedPlan ?? 0) - (effectiveSavingsBudget ?? 0)) > 1;
    if (activeLeap) {
      return `You're here because: **${getLeapCopy(activeLeap.leapType).title}**. Here's what changes if you confirm — current vs proposed. Want an explanation of the breakdown?`;
    }
    if (monthlyChanged && currentMonthly > 0 && proposedMonthly > 0) {
      return `Your monthly savings target has changed from **$${currentMonthly.toLocaleString()}** to **$${proposedMonthly.toLocaleString()}**. We've updated each category to match. Want an explanation of how we allocated it?`;
    }
    return "Review your savings allocation. Here's what changes if you confirm — current vs proposed. Want an explanation of the breakdown?";
  }, [isFirstTimeSetup, mode, activeLeap, effectiveSavingsBudget, budgetForProposedPlan, proposedPlanSnapshot?.monthlySavings]);

  /** First-time: "Why this plan works" bullets (shown only inside expanded details) */
  const firstTimeWhyBullets = useMemo(() => {
    const bullets: string[] = [];
    const steps = (proposedPlan?.steps ?? []).filter((s) => (s.amountMonthly ?? 0) > 0).slice(0, 2);
    const labels = steps.map((s) => s.label.toLowerCase());
    if (labels.some((l) => l.includes('emergency') || l.includes('buffer'))) {
      bullets.push('This builds a safety buffer before anything else.');
    }
    if (labels.some((l) => l.includes('match') || l.includes('employer') || l.includes('401'))) {
      bullets.push('It captures free employer match first.');
    }
    if (bullets.length === 0) bullets.push('This plan prioritizes your goals in a smart order.');
    return bullets.slice(0, 2);
  }, [proposedPlan?.steps]);

  // Calculate total wealth moves (for net worth)
  // Total wealth moves = Pre-tax savings + Employer match + Post-tax savings available (total budget)
  // This represents ALL money being moved into savings/investments, not just what's allocated
  const totalWealthMoves = useMemo(() => {
    if (!proposedPlanSnapshot) return 0;
    return preTaxSavings.total + postTaxSavingsAvailable + preTaxSavings.employerMatch.monthly;
  }, [preTaxSavings, postTaxSavingsAvailable, proposedPlanSnapshot]);

  const budgetStatus = useMemo(() => {
    if (!proposedPlanSnapshot || !budgetForProposedPlan) return null;
    const desiredTotal = proposedPlanSnapshot.monthlySavings;
    const difference = desiredTotal - budgetForProposedPlan;
    const isOverBudget = difference > 1;
    const isUnderBudget = difference < -1;
    return {
      desiredTotal,
      budget: budgetForProposedPlan,
      difference: Math.abs(difference),
      isOverBudget,
      isUnderBudget,
      isOnBudget: !isOverBudget && !isUnderBudget,
      hasCapsHit: false,
    };
  }, [proposedPlanSnapshot, budgetForProposedPlan]);

  const allocationComparison = useMemo(() => {
    if (!proposedPlanSnapshot || !baselineSavingsData) return null;
    const currentPlanForCompare = effectiveCurrentPlan ?? {
      ef$: 0, debt$: 0, match401k$: 0, hsa$: 0, retirementTaxAdv$: 0, brokerage$: 0, monthlySavings: 0,
    } as SavingsPlanSnapshot;
    // No Match scenario: show current 401k/match as 0 so "Proposed" is the recommendation to start contributing
    const current401kEmployee = allocatorScenario === 'no_match'
      ? 0
      : (effectiveCurrentPlan ? (baselineSavingsData.match401k$ ?? preTaxSavings.traditional401k.monthly) : 0);
    const proposed401kEmployee = effectivePreTax.k401Employee;
    const currentEmployerMatch = allocatorScenario === 'no_match'
      ? 0
      : calculateEmployerMatch(
          current401kEmployee,
          grossIncomeMonthly,
          baselineState.payrollContributions ?? undefined
        );
    const proposedEmployerMatch = proposedPlanSnapshot.match401k$ ?? 0;
    const rows: Array<{ label: string; id: string; current: number; updated: number }> = [];
    if (current401kEmployee > 0.01 || proposed401kEmployee > 0.01) {
      rows.push({
        label: '401(k) contribution',
        id: '401K_CONTRIB',
        current: current401kEmployee,
        updated: proposed401kEmployee,
      });
    }
    if (currentEmployerMatch > 0.01 || proposedEmployerMatch > 0.01) {
      rows.push({
        label: '401(k) employer match',
        id: 'EMPLOYER_MATCH',
        current: currentEmployerMatch,
        updated: proposedEmployerMatch,
      });
    }
    // No HSA scenario: show current HSA as 0 so "Proposed" is the recommendation to start contributing
    const currentHsa$ = allocatorScenario === 'no_hsa' ? 0 : (currentPlanForCompare.hsa$ ?? 0);
    if (currentHsa$ > 0.01 || (proposedPlanSnapshot.hsa$ ?? 0) > 0.01) {
      rows.push({
        label: 'HSA',
        id: 'HSA',
        current: currentHsa$,
        updated: proposedPlanSnapshot.hsa$ ?? 0,
      });
    }
    return [
      ...rows,
      {
        label: 'Emergency Fund',
        id: 'EMERGENCY_FUND',
        current: currentPlanForCompare.ef$,
        updated: proposedPlanSnapshot.ef$,
      },
      {
        label: 'High-APR Debt',
        id: 'HIGH_APR_DEBT',
        current: currentPlanForCompare.debt$,
        updated: proposedPlanSnapshot.debt$,
      },
      {
        label: 'Roth IRA / Taxable Retirement',
        id: 'RETIREMENT',
        current: currentPlanForCompare.retirementTaxAdv$,
        updated: proposedPlanSnapshot.retirementTaxAdv$,
      },
      {
        label: 'Brokerage',
        id: 'BROKERAGE',
        current: currentPlanForCompare.brokerage$,
        updated: proposedPlanSnapshot.brokerage$,
      },
    ];
  }, [effectiveCurrentPlan, proposedPlanSnapshot, baselineSavingsData, preTaxSavings.traditional401k.monthly, effectivePreTax.k401Employee, baselineState.payrollContributions, grossIncomeMonthly, allocatorScenario]);

  // Build delta for chat panel: current vs proposed. In VALIDATED mode, isNoChange=true.
  const posttaxSum = useMemo(() =>
    (proposedPlanSnapshot?.ef$ ?? 0) + (proposedPlanSnapshot?.debt$ ?? 0) + (proposedPlanSnapshot?.retirementTaxAdv$ ?? 0) + (proposedPlanSnapshot?.brokerage$ ?? 0),
    [proposedPlanSnapshot]
  );
  const efMonthsCurrent = monthlyBasics > 0 ? Math.min(efTargetMonths, efBalance$ / monthlyBasics) : efTargetMonths;
  const efMonthsProposed = monthlyBasics > 0 ? Math.min(efTargetMonths, efBalance$ / monthlyBasics) : efTargetMonths;

  const uiMessages = useMemo(() => generateUIMessages({
    currentPlan: effectiveCurrentPlan ?? null,
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
  }), [effectiveCurrentPlan, proposedPlanSnapshot, mode, lastEditedKey, lastStepperReducedBucket, matchRecommendation, preTaxSavings.employerMatch.monthly, efTargetMonths, efMonthsProposed, efMonthsCurrent, monthlyBasics, totalDebtBalance$, hsaRecommendation, postTaxBudgetForRebalance, posttaxSum]);

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
      
      // "Today" = opening net worth (before any simulation). netWorth[0] is after 1 month, not today.
      const totalLiabilities = openingBalances.liabilities.reduce((s, d) => s + d.balance, 0);
      const openingNetWorth = Math.round(
        (openingBalances.cash + openingBalances.brokerage + openingBalances.retirement +
          (openingBalances.hsa ?? 0) + (openingBalances.otherAssets ?? 0) - totalLiabilities) * 100
      ) / 100;
      const netWorth6m = simulation.netWorth[5] ?? simulation.netWorth[0] ?? openingNetWorth;
      const netWorth12m = simulation.netWorth[11] ?? simulation.netWorth[0] ?? openingNetWorth;
      const netWorth24m = simulation.netWorth[23] ?? simulation.netWorth[simulation.netWorth.length - 1] ?? openingNetWorth;

      const modifiedPlan: FinalPlanData = {
        ...baselinePlanData,
        netWorthChartData: {
          labels: chartLabels,
          netWorth: chartNetWorth,
          assets: chartAssets,
          liabilities: chartLiabilities,
        },
        netWorthProjection: [
          { label: 'Today', months: 0, value: openingNetWorth },
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
    const allocationToSave = allocationForScenario ?? engineAllocationForScenario;
    if (!allocationToSave) {
      console.warn('[Savings Allocator] No allocation to save');
      alert('Unable to apply: no allocation calculated. Please refresh the page.');
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
    // New post-tax savings total (what savings-helper shows as "planned savings")
    const newPostTaxTotal = proposedEf + proposedDebt + proposedRetirement + proposedBrokerage;
    try {
      baselineState.updateSafetyStrategy({ customSavingsAllocation });
      baselineState.setInitialPaycheckPlan(undefined as any);
      // Sync riskConstraints.targets so Income tab, Monthly Pulse, and savings-helper all show the new savings target
      if (monthlyIncome > 0 && newPostTaxTotal >= 0) {
        const newSavingsPct = Math.max(0, Math.min(1, newPostTaxTotal / monthlyIncome));
        const existing = baselineState.riskConstraints?.targets;
        const spendPct = 1 - newSavingsPct;
        let needsPct: number;
        let wantsPct: number;
        if (existing && typeof existing.needsPct === 'number' && typeof existing.wantsPct === 'number') {
          const spendSum = existing.needsPct + existing.wantsPct;
          const scale = spendSum > 0 ? spendPct / spendSum : 0.5;
          needsPct = existing.needsPct * scale;
          wantsPct = existing.wantsPct * scale;
        } else {
          needsPct = spendPct * 0.5;
          wantsPct = spendPct * 0.5;
        }
        baselineState.updateRiskConstraints({
          targets: { needsPct, wantsPct, savingsPct: newSavingsPct },
          actuals3m: { needsPct, wantsPct, savingsPct: newSavingsPct },
          bypassWantsFloor: true,
        });
      }
      if (typeof baselineState.invalidatePlan === 'function') {
        baselineState.invalidatePlan();
      }
      currentPlanNetWorthSnapshotRef.current = null;
      setConfirmedPlan(proposedPlan);
      baselineState.setProposedSavingsFromHelper?.(null);
      setOverrides({});
      setPretaxOverrides({});
      setLastStepperReducedBucket(undefined);
      setLastEditedKey(null);
      setShowPlanConfirmModal(false);
      setPendingUpdateMessage(null);
      const wasFirstTime = confirmedPlan === null;
      if (wasFirstTime) {
        setToastMessage('Savings plan applied');
        setTimeout(() => setToastMessage(null), 3000);
      }
      if (source === 'onboarding') {
        baselineState.setCurrentStep('plan-final');
        router.push('/onboarding/plan-final');
      } else {
        router.push('/app/home');
      }
      router.refresh();
    } catch (error) {
      console.error('[Savings Allocator] Error saving customSavingsAllocation:', error);
      alert('Failed to save changes. Please try again.');
    }
  };

  const planConfirmDiffs = useMemo(
    () => diffPlans(confirmedPlan, proposedPlan),
    [confirmedPlan, proposedPlan]
  );

  const prevMode = useRef(mode);
  useEffect(() => {
    if (isFirstTimeSetup) return; // Never show "updated plan" banner in first-time
    if (mode === 'PROPOSAL' && prevMode.current === 'VALIDATED') {
      setPendingUpdateMessage("I've updated the plan. It's not applied yet. Want me to apply it?");
    }
    prevMode.current = mode;
  }, [mode, isFirstTimeSetup]);

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
        <div className="mx-auto w-full max-w-xl space-y-6">
          {source === 'onboarding' && (
            <div className="mb-4">
              <OnboardingProgress />
            </div>
          )}
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

          {/* Scenario testing — hidden during onboarding */}
          {source !== 'onboarding' && (
          <Card className="border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Scenario
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                value={allocatorScenario}
                onChange={(e) => setAllocatorScenario(e.target.value as AllocatorScenario)}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
              >
                {ALLOCATOR_SCENARIO_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {(allocatorScenario === 'savings_decrease' || allocatorScenario === 'savings_increase') && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {allocatorScenario === 'savings_decrease' ? 'Reduce budget by ($/mo)' : 'Increase budget by ($/mo)'}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">$</span>
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={simulateAmount}
                      onChange={(e) => setSimulateAmount(Math.max(0, Number(e.target.value) || 0))}
                      className="w-24 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
                    />
                    <span className="text-sm text-slate-500 dark:text-slate-400">/ month</span>
                  </div>
                </div>
              )}
              {allocatorScenario !== 'my_data' && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Simulating: {ALLOCATOR_SCENARIO_OPTIONS.find((o) => o.value === allocatorScenario)?.label}. Engine and chart use this scenario.
                </p>
              )}
            </CardContent>
          </Card>
          )}

          {/* Ribbit — Savings plan tile. First-time: intro + What/CTA/Details (via firstTimeMiddleContent) then input. */}
          <SavingsChatPanel
            introMessage={introMessage}
            proposedPlan={proposedPlan}
            isConfirmed={confirmedPlan !== null || hasAppliedPlanInStore}
            isFirstTimeSetup={isFirstTimeSetup}
            firstTimeChatPlaceholder="Ask Ribbit a question… (e.g., 'Why match first?')"
            firstTimeMiddleContent={isFirstTimeSetup ? (
              <div className="space-y-4">
                {/* What this plan does — outcome-based, no bucket names, no numbers */}
                <Card className="border-slate-200 dark:border-slate-700">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-2">What this plan does</h3>
                    <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
                      <li>Builds your emergency buffer toward your target</li>
                      <li>Captures free employer match so you don&apos;t leave money on the table</li>
                      <li>Uses tax-advantaged accounts before taxable investing</li>
                    </ul>
                  </CardContent>
                </Card>
                {/* CTA row: primary Apply, secondary See details first */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => setShowPlanConfirmModal(true)}
                  >
                    Apply savings plan
                  </Button>
                  <button
                    type="button"
                    onClick={() => setFirstTimeDetailsExpanded((e) => !e)}
                    className="text-sm font-medium text-green-600 dark:text-green-400 hover:underline text-left sm:text-center"
                  >
                    {firstTimeDetailsExpanded ? 'Hide details' : 'See details first'}
                  </button>
                </div>
                {/* Details section (collapsed by default): bucket list + Why */}
                {firstTimeDetailsExpanded && (
                  <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Plan details</h3>
                    {proposedPlan && (
                      <Card className="border-slate-200 dark:border-slate-700">
                        <CardContent className="p-4">
                          <div className="space-y-2 text-sm">
                            {proposedPlan.steps
                              .filter((s) => (s.amountMonthly ?? 0) > 0)
                              .map((s, i) => (
                                <div key={i} className="flex justify-between">
                                  <span className="text-slate-700 dark:text-slate-300">{s.label}</span>
                                  <span className="font-medium text-slate-900 dark:text-white">
                                    ${Math.round(s.amountMonthly ?? 0).toLocaleString()}/mo
                                  </span>
                                </div>
                              ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {firstTimeWhyBullets.length > 0 && (
                      <div className="space-y-1">
                        <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400">Why this plan works</h4>
                        <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-0.5">
                          {firstTimeWhyBullets.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : undefined}
            onConfirmApply={() => setShowPlanConfirmModal(true)}
            toolOutputExplain={engineExplain}
            onNotNow={() => router.push('/app/feed')}
            userStateForChat={{
              monthlyIncome,
              postTaxSavingsAvailable: budgetForProposedPlan,
              efTarget$,
              efBalance$,
              totalMonthlySavingsCurrent: totalMonthlySavingsForChat?.totalCurrent,
              totalMonthlySavingsProposed: totalMonthlySavingsForChat?.totalProposed,
            }}
            baselinePlanForChat={baselinePlanForChat}
            currentContextForChat={{ source, leapId, leapType }}
            currentPlanDataForChat={currentPlanDataForChat}
            pendingUpdateMessage={isFirstTimeSetup ? null : pendingUpdateMessage}
            deltaOverride={deltaOverride}
            onUserRequestedPlanChange={
              proposedPlanSnapshot
                ? ({ category, delta }) => {
                    if (category === '401k') {
                      handlePreTaxStepper('k401EmployeeMonthly', delta);
                    } else if (category === 'hsa') {
                      handlePreTaxStepper('hsaMonthly', delta);
                    } else {
                      applyOverride(category, delta);
                    }
                    const absDelta = Math.abs(delta);
                    const CATEGORY_LABELS: Record<string, string> = {
                      ef: 'emergency fund',
                      debt: 'high-APR debt',
                      retirementExtra: 'retirement',
                      brokerage: 'investment account',
                      '401k': '401(k)',
                      hsa: 'HSA',
                    };
                    const label = CATEGORY_LABELS[category] ?? category;
                    if (delta < 0 && (category === 'ef' || category === 'debt' || category === 'retirementExtra' || category === 'brokerage')) {
                      return `Got it. That frees up $${absDelta}/month.\n\nBy default, I'll redirect it to your investment account so you keep building wealth.\n\nIf you'd rather use it for spending, we can adjust your income plan instead.\n\nHere's the updated plan — want me to apply it?`;
                    }
                    if (delta < 0) {
                      return `Got it. I've reduced ${label} by $${absDelta}/month. Here's the updated plan — want me to apply it?`;
                    }
                    return `Got it. I've added $${absDelta} to ${label}. Here's the updated plan — want me to apply it?`;
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
                // "Today" is the same for both — it's the opening net worth. Never show delta for Today.
                const isToday = projection.label === 'Today';
                const baselineValue = isToday ? projection.value : (baselinePlanData.netWorthProjection.find(p => p.label === projection.label)?.value || 0);
                const scenarioValue = projection.value;
                const delta = scenarioValue - baselineValue;
                const showDelta = !isToday && Math.abs(delta) > 1;
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

          {/* Why this plan? — hidden in first-time (details live in "See details first" section) */}
          {!isFirstTimeSetup && (proposedPlan.assumptions.length > 0 || (proposedPlan.warnings && proposedPlan.warnings.length > 0)) && (
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

          <PlanConfirmModal
            open={showPlanConfirmModal}
            diffs={planConfirmDiffs}
            isFirstApply={!hasAppliedPlanInStore}
            onConfirm={handleConfirmApply}
            onCancel={() => setShowPlanConfirmModal(false)}
            onReviewDetails={() => {
              setShowPlanConfirmModal(false);
              if (isFirstTimeSetup) setFirstTimeDetailsExpanded(true);
            }}
          />

          {/* Toast: e.g. "Savings plan applied" (shown briefly after first-time apply before navigate) */}
          {toastMessage && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] rounded-lg bg-slate-900 text-white px-4 py-3 text-sm font-medium shadow-lg animate-in fade-in duration-200">
              {toastMessage}
            </div>
          )}
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

