/**
 * Onboarding - Savings Plan Step
 * 
 * Redesigned to clearly separate Pre-Tax (Payroll) vs Post-Tax (Cash) savings allocation.
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { allocateSavings, type SavingsInputs, type SavingsAllocation } from '@/lib/alloc/savings';
import { Info, Shield, CreditCard, TrendingUp, PiggyBank, HelpCircle, Edit, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { OnboardingChat } from '@/components/onboarding/OnboardingChat';
import { getPaychecksPerMonth } from '@/lib/onboarding/usePlanData';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { calculateSavingsBreakdown, calculatePreTaxSavings } from '@/lib/utils/savingsCalculations';

interface SavingsCategory {
  id: string;
  label: string;
  amount: number;
  percent: number;
  icon: React.ReactNode;
  description: string;
  color: string;
}

// Estimate marginal tax rate (federal + state)
// This is a simplified estimate - in production, this should use actual tax brackets
const ESTIMATED_MARGINAL_TAX_RATE = 0.25; // 25% combined federal + state

export default function SavingsPlanPage() {
  const router = useRouter();
  const state = useOnboardingStore();
  const {
    income,
    initialPaycheckPlan,
    fixedExpenses,
    debts,
    assets,
    safetyStrategy,
    payrollContributions,
    setCurrentStep,
    updateSafetyStrategy,
    updatePayrollContributions,
    setInitialPaycheckPlan,
  } = state;

  const planData = usePlanData();

  const [savingsAlloc, setSavingsAlloc] = useState<SavingsAllocation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [efTargetMonths, setEfTargetMonths] = useState<number>(
    payrollContributions?.emergencyFundMonths || safetyStrategy?.efTargetMonths || 6
  );
  const [efAllocationPct, setEfAllocationPct] = useState<number>(0);
  const [hasAdjustedEfSlider, setHasAdjustedEfSlider] = useState<boolean>(false);
  const [debtAllocationPct, setDebtAllocationPct] = useState<number>(0);
  const [hasAdjustedDebtSlider, setHasAdjustedDebtSlider] = useState<boolean>(false);
  const [retirementAllocationPct, setRetirementAllocationPct] = useState<number>(0);
  const [hasAdjustedRetirementSlider, setHasAdjustedRetirementSlider] = useState<boolean>(false);
  const [brokerageAllocationPct, setBrokerageAllocationPct] = useState<number>(0);
  const [hasAdjustedBrokerageSlider, setHasAdjustedBrokerageSlider] = useState<boolean>(false);
  const [showImpactPreview, setShowImpactPreview] = useState(false);
  const [showImpactDetails, setShowImpactDetails] = useState(false);
  const [impactPreviewData, setImpactPreviewData] = useState<{
    deltaPreTax: number;
    deltaMatch: number;
    taxSavings: number;
    deltaPostTax: number;
    deltaTotalWealth: number;
  } | null>(null);
  
  // Calculate monthly needs and wants from plan categories for centralized calculation
  const monthlyNeeds = useMemo(() => {
    if (!planData) return 0;
    const paychecksPerMonth = getPaychecksPerMonth(income?.payFrequency || 'biweekly');
    const needsCategories = planData.paycheckCategories.filter(c => 
      c.key === 'essentials' || c.key === 'debt_minimums'
    );
    return needsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
  }, [planData, income?.payFrequency]);
  
  const monthlyWants = useMemo(() => {
    if (!planData) return 0;
    const paychecksPerMonth = getPaychecksPerMonth(income?.payFrequency || 'biweekly');
    const wantsCategories = planData.paycheckCategories.filter(c => c.key === 'fun_flexible');
    return wantsCategories.reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth;
  }, [planData, income?.payFrequency]);
  
  // Use centralized savings calculation for consistency
  const savingsBreakdown = useMemo(() => {
    return calculateSavingsBreakdown(
      income,
      payrollContributions,
      monthlyNeeds,
      monthlyWants
    );
  }, [income, payrollContributions, monthlyNeeds, monthlyWants]);
  
  // Calculate pre-tax payroll savings estimates (needed for match recommendation and display)
  // We still need individual 401k calculation for match recommendation logic
  const preTaxSavingsCalc = calculatePreTaxSavings(income, payrollContributions);
  const preTaxSavings = {
    traditional401k: {
      percent: preTaxSavingsCalc.traditional401k.percent,
      monthly: preTaxSavingsCalc.traditional401k.monthly,
    },
    hsa: {
      monthly: preTaxSavingsCalc.hsa.monthly,
    },
    employerMatch: {
      monthly: savingsBreakdown.employerMatchMTD,
    },
    employerHSA: {
      monthly: savingsBreakdown.employerHSAMTD,
    },
    total: savingsBreakdown.preTaxSavingsTotal,
  };
  
  const taxSavingsMonthly = savingsBreakdown.taxSavingsMonthly;

  // Calculate match capture recommendation
  const matchRecommendation = useMemo(() => {
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
  }, [income, payrollContributions, preTaxSavings]);

  // Check if match is captured
  const isMatchCaptured = useMemo(() => {
    if (!matchRecommendation) {
      // If no recommendation, either no match or already captured
      if (payrollContributions?.has401k && payrollContributions?.hasEmployerMatch === "yes") {
        // Check if current contribution meets requirement
        const paychecksPerMonth = getPaychecksPerMonth(income?.payFrequency || 'biweekly');
        const grossIncomePerPaycheck = income?.grossIncome$ || income?.netIncome$ || 0;
        const grossIncomeMonthly = grossIncomePerPaycheck * paychecksPerMonth;
        
        if (payrollContributions.employerMatchCapPct && grossIncomeMonthly > 0) {
          const matchRequiredMonthly = (grossIncomeMonthly * payrollContributions.employerMatchCapPct) / 100;
          return preTaxSavings.traditional401k.monthly >= matchRequiredMonthly;
        }
      }
      return true; // Default to captured if we can't determine
    }
    return false;
  }, [matchRecommendation, payrollContributions, income, preTaxSavings]);

  // Calculate HSA recommendation
  // Show recommendation if:
  // 1. User is HSA eligible (has HDHP), OR
  // 2. User has employer HSA contribution (indicates eligibility)
  const hsaRecommendation = useMemo(() => {
    if (!payrollContributions || !income) return null;
    
    // Check eligibility: explicit hsaEligible flag OR has employer HSA contribution (indicates eligibility)
    const isEligible = payrollContributions.hsaEligible === true || 
                       (payrollContributions.employerHSAContribution === "yes" && (payrollContributions.employerHSAAmount$ || 0) > 0);
    
    if (!isEligible) return null;
    
    const paychecksPerMonth = getPaychecksPerMonth(income.payFrequency || 'biweekly');
    const grossIncomePerPaycheck = income.grossIncome$ || income.netIncome$ || 0;
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
    const prioritizeHSA = safetyStrategy?.retirementFocus === "High" || safetyStrategy?.retirementFocus === "Medium";
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
  }, [payrollContributions, income, safetyStrategy?.retirementFocus]);

  // Handle "Capture my match" button
  const handleCaptureMatch = () => {
    if (!matchRecommendation || !payrollContributions) return;

    const deltaPreTax = matchRecommendation.delta401kMonthly;
    const deltaMatch = matchRecommendation.deltaMatchMonthly;
    const taxSavings = deltaPreTax * ESTIMATED_MARGINAL_TAX_RATE;
    const deltaTakeHome = -deltaPreTax + taxSavings;
    const deltaPostTax = deltaTakeHome;
    // Total wealth moves = Pre-tax contribution amount only
    // This represents the actual wealth move (money going into 401k)
    // Match is a bonus, post-tax available change is cash flow impact
    const deltaTotalWealth = deltaPreTax;

    // Update payroll contributions - ensure currentlyContributing401k is set to "yes"
    updatePayrollContributions({
      currentlyContributing401k: "yes",
      contributionType401k: "percent_gross",
      contributionValue401k: matchRecommendation.recommendedPercent,
      contributionFrequency401k: null,
    });

    // Clear initialPaycheckPlan to force recalculation with new payroll contributions
    setInitialPaycheckPlan(undefined as any);

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
    if (!hsaRecommendation || !payrollContributions) return;

    // Update payroll contributions to set HSA contribution
    updatePayrollContributions({
      currentlyContributingHSA: "yes",
      contributionTypeHSA: "amount",
      contributionValueHSA: hsaRecommendation.recommendedHsaMonthly$,
      contributionFrequencyHSA: "per_month",
    });

    // Clear initialPaycheckPlan to force recalculation
    setInitialPaycheckPlan(undefined as any);

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

  // Calculate post-tax savings available (cash that can be allocated) - use centralized calculation
  const postTaxSavingsAvailable = savingsBreakdown.cashSavingsMTD;
  
  // Debug logging to track data persistence issues
  console.log('[SavingsPlan] postTaxSavingsAvailable calculation:', {
    baseSavingsMonthly: savingsBreakdown.baseSavingsMonthly,
    preTaxSavingsTotal: savingsBreakdown.preTaxSavingsTotal,
    taxSavingsMonthly: savingsBreakdown.taxSavingsMonthly,
    netPreTaxImpact: savingsBreakdown.netPreTaxImpact,
    result: postTaxSavingsAvailable,
    currentlyContributing401k: payrollContributions?.currentlyContributing401k,
    contributionValue401k: payrollContributions?.contributionValue401k,
  });

  // Calculate total wealth moves (for net worth)
  const totalWealthMoves = useMemo(() => {
    if (!savingsAlloc) return 0;
    
    // Total wealth moves = Pre-tax Payroll Savings + Employer 401K Match + Employee HSA + Employer HSA + Post-tax
    const postTaxTotal = savingsAlloc.ef$ + savingsAlloc.highAprDebt$ + savingsAlloc.retirementTaxAdv$ + savingsAlloc.brokerage$;
    return preTaxSavings.total + postTaxTotal + preTaxSavings.employerMatch.monthly + preTaxSavings.employerHSA.monthly;
  }, [savingsAlloc, preTaxSavings]);

  // Calculate EF target and current balance
  const efTarget$ = useMemo(() => {
    if (!efTargetMonths || fixedExpenses.length === 0) {
      return 0;
    }
    const monthlyEssentials = fixedExpenses
      .filter((e) => e.category === 'needs' || !e.category)
      .reduce((sum, exp) => {
        let monthly = exp.amount$;
        if (exp.frequency === 'weekly') monthly = exp.amount$ * 4.33;
        else if (exp.frequency === 'biweekly') monthly = exp.amount$ * 2.17;
        else if (exp.frequency === 'semimonthly') monthly = exp.amount$ * 2;
        else if (exp.frequency === 'yearly') monthly = exp.amount$ / 12;
        return sum + monthly;
      }, 0);
    return monthlyEssentials * efTargetMonths;
  }, [efTargetMonths, fixedExpenses]);

  const efBalance$ = useMemo(() => {
    return assets
      .filter((a) => a.type === 'cash')
      .reduce((sum, a) => sum + a.value$, 0);
  }, [assets]);
  
  const efGap$ = useMemo(() => Math.max(0, efTarget$ - efBalance$), [efTarget$, efBalance$]);

  // Get high-APR debts
  const highAprDebts = useMemo(() => {
    return debts
      .filter((d) => d.aprPct > 10 && d.balance$ > 0)
      .map((d) => ({
        balance$: d.balance$,
        aprPct: d.aprPct,
      }));
  }, [debts]);

  // Generate savings allocation when inputs change
  useEffect(() => {
    if (postTaxSavingsAvailable > 0 && income) {
      setIsGenerating(true);
      try {
        // Calculate HSA eligibility and room
        const hsaEligible = payrollContributions?.hsaEligible === true;
        const hsaCoverageType = payrollContributions?.hsaCoverageType || "unknown";
        
        // HSA annual limits (2025)
        const hsaAnnualLimits = {
          self: 4300,
          family: 8550,
          unknown: 4300, // Default to self if unknown
        };
        const hsaAnnualLimit$ = hsaAnnualLimits[hsaCoverageType];
        
        // Calculate current HSA contribution (annual)
        let currentHSAMonthly$ = 0;
        if (payrollContributions?.hasHSA && payrollContributions?.currentlyContributingHSA === "yes") {
          const paychecksPerMonthForHSA = getPaychecksPerMonth(income.payFrequency || 'biweekly');
          const grossIncomePerPaycheck = income.grossIncome$ || income.netIncome$ || 0;
          const grossIncomeMonthly = grossIncomePerPaycheck * paychecksPerMonthForHSA;
          
          if (payrollContributions.contributionTypeHSA === "percent_gross" && payrollContributions.contributionValueHSA) {
            currentHSAMonthly$ = (grossIncomeMonthly * payrollContributions.contributionValueHSA) / 100;
          } else if (payrollContributions.contributionTypeHSA === "amount" && payrollContributions.contributionValueHSA) {
            if (payrollContributions.contributionFrequencyHSA === "per_paycheck") {
              currentHSAMonthly$ = payrollContributions.contributionValueHSA * paychecksPerMonthForHSA;
            } else if (payrollContributions.contributionFrequencyHSA === "per_month") {
              currentHSAMonthly$ = payrollContributions.contributionValueHSA;
            }
          }
        }
        
        const currentHSAAnnual$ = currentHSAMonthly$ * 12;
        const hsaRoomThisYear$ = Math.max(0, hsaAnnualLimit$ - currentHSAAnnual$);
        
        // Determine if user should prioritize HSA
        const prioritizeHSA = safetyStrategy?.retirementFocus === "High" || safetyStrategy?.retirementFocus === "Medium";

        const inputs: SavingsInputs = {
          savingsBudget$: postTaxSavingsAvailable,
          efTarget$,
          efBalance$,
          highAprDebts,
          matchNeedThisPeriod$: 0, // Match is already in pre-tax, not post-tax
          incomeSingle$: income.incomeSingle$ || income.annualSalary$ || income.netIncome$ * 26,
          hsaEligible,
          hsaCoverageType,
          currentHSAMonthly$,
          hsaRoomThisYear$,
          prioritizeHSA,
        };

        const allocation = allocateSavings(inputs);
        
        // Initialize allocation percentages from the calculated allocation if user hasn't adjusted
        if (!hasAdjustedEfSlider) {
          setEfAllocationPct((allocation.ef$ / postTaxSavingsAvailable) * 100);
        }
        if (!hasAdjustedDebtSlider) {
          setDebtAllocationPct((allocation.highAprDebt$ / postTaxSavingsAvailable) * 100);
        }
        if (!hasAdjustedRetirementSlider) {
          setRetirementAllocationPct((allocation.retirementTaxAdv$ / postTaxSavingsAvailable) * 100);
        }
        if (!hasAdjustedBrokerageSlider) {
          setBrokerageAllocationPct((allocation.brokerage$ / postTaxSavingsAvailable) * 100);
        }
        
        // Override allocations with slider values if user has adjusted them
        if (hasAdjustedEfSlider) {
          const efAmount = Math.min(
            (efAllocationPct / 100) * postTaxSavingsAvailable,
            efGap$ > 0 ? efGap$ : postTaxSavingsAvailable * 0.4
          );
          allocation.ef$ = efAmount;
        }
        
        if (hasAdjustedDebtSlider) {
          const debtMax = postTaxSavingsAvailable * 0.4;
          allocation.highAprDebt$ = Math.min((debtAllocationPct / 100) * postTaxSavingsAvailable, debtMax);
        }
        
        if (hasAdjustedRetirementSlider) {
          allocation.retirementTaxAdv$ = (retirementAllocationPct / 100) * postTaxSavingsAvailable;
        }
        
        if (hasAdjustedBrokerageSlider) {
          allocation.brokerage$ = (brokerageAllocationPct / 100) * postTaxSavingsAvailable;
        }
        
        // If EF was adjusted but others weren't, rebalance the others proportionally
        if (hasAdjustedEfSlider && !hasAdjustedDebtSlider && !hasAdjustedRetirementSlider && !hasAdjustedBrokerageSlider) {
          const originalEf = (allocation.ef$ / (efAllocationPct / 100)) * (allocation.ef$ / postTaxSavingsAvailable * 100) || allocation.ef$;
          const difference = allocation.ef$ - originalEf;
          const otherTotal = allocation.highAprDebt$ + allocation.retirementTaxAdv$ + allocation.brokerage$;
          
          if (otherTotal > 0 && Math.abs(difference) > 0.01) {
            const scale = Math.max(0, (otherTotal - difference) / otherTotal);
            allocation.highAprDebt$ = Math.max(0, allocation.highAprDebt$ * scale);
            allocation.retirementTaxAdv$ = Math.max(0, allocation.retirementTaxAdv$ * scale);
            allocation.brokerage$ = Math.max(0, allocation.brokerage$ * scale);
          } else if (difference < 0) {
            allocation.brokerage$ = Math.max(0, allocation.brokerage$ - difference);
          }
        }
        
        setSavingsAlloc(allocation);
      } catch (error) {
        console.error('Failed to generate savings allocation:', error);
      } finally {
        setIsGenerating(false);
      }
    }
  }, [
    postTaxSavingsAvailable,
    efTarget$,
    efBalance$,
    efGap$,
    highAprDebts,
    income,
    efAllocationPct,
    hasAdjustedEfSlider,
    debtAllocationPct,
    hasAdjustedDebtSlider,
    retirementAllocationPct,
    hasAdjustedRetirementSlider,
    brokerageAllocationPct,
    hasAdjustedBrokerageSlider,
  ]);

  const handleContinue = () => {
    // Guard clause: if savingsAlloc is null, we can't continue
    if (!savingsAlloc) {
      console.error('Cannot continue: savingsAlloc is null');
      return;
    }

    // Calculate the actual displayed amounts from sliders to ensure we save exactly what the user sees
    // This matches the calculation used in the UI
    const efAmountToSave = hasAdjustedEfSlider 
      ? Math.min((efAllocationPct / 100) * postTaxSavingsAvailable, efGap$ > 0 ? efGap$ : postTaxSavingsAvailable * 0.4)
      : savingsAlloc.ef$;
    
    const debtAmountToSave = hasAdjustedDebtSlider
      ? Math.min((debtAllocationPct / 100) * postTaxSavingsAvailable, postTaxSavingsAvailable * 0.4)
      : savingsAlloc.highAprDebt$;
    
    const retirementAmountToSave = hasAdjustedRetirementSlider
      ? (retirementAllocationPct / 100) * postTaxSavingsAvailable
      : savingsAlloc.retirementTaxAdv$;
    
    const brokerageAmountToSave = hasAdjustedBrokerageSlider
      ? (brokerageAllocationPct / 100) * postTaxSavingsAvailable
      : savingsAlloc.brokerage$;
    
    // Save the custom savings allocation so it's used in buildFinalPlanData
    // This ensures the allocation shown on this page is what gets stored in planData
    updateSafetyStrategy({
      match401kPerMonth$: preTaxSavings.employerMatch.monthly,
      efTargetMonths,
      customSavingsAllocation: {
        ef$: efAmountToSave,
        highAprDebt$: debtAmountToSave,
        match401k$: savingsAlloc.match401k$,
        retirementTaxAdv$: retirementAmountToSave,
        brokerage$: brokerageAmountToSave,
      },
    });
    
    // Clear initialPaycheckPlan to force recalculation with the saved allocation
    setInitialPaycheckPlan(undefined as any);
    
    setCurrentStep('plan-final');
    router.push('/onboarding/plan-final');
  };

  if (isGenerating) {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-2">
          <div className="mb-4">
            <OnboardingProgress />
          </div>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            Generating your savings allocation...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!savingsAlloc) {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-2">
          <div className="mb-4">
            <OnboardingProgress />
          </div>
        </CardHeader>
        <CardContent className="py-12 text-center space-y-4">
          {postTaxSavingsAvailable <= 0 ? (
            <>
              <p className="text-red-600 dark:text-red-400 font-medium">
                Monthly plan is required to generate savings allocation.
              </p>
              <Button
                onClick={() => router.push('/onboarding/monthly-plan')}
                variant="outline"
              >
                Go to Monthly Plan
              </Button>
            </>
          ) : (
            <p className="text-slate-600 dark:text-slate-400">
              Unable to generate savings allocation. Please check your information.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Calculate current amounts from sliders or allocation (for display)
  // Note: savingsAlloc is guaranteed to be non-null here due to guard clause above
  const currentEfAmount = hasAdjustedEfSlider 
    ? Math.min((efAllocationPct / 100) * postTaxSavingsAvailable, efGap$ > 0 ? efGap$ : postTaxSavingsAvailable * 0.4)
    : savingsAlloc?.ef$ ?? 0;
  const currentDebtAmount = hasAdjustedDebtSlider
    ? Math.min((debtAllocationPct / 100) * postTaxSavingsAvailable, postTaxSavingsAvailable * 0.4)
    : savingsAlloc?.highAprDebt$ ?? 0;
  const currentRetirementAmount = hasAdjustedRetirementSlider
    ? (retirementAllocationPct / 100) * postTaxSavingsAvailable
    : savingsAlloc?.retirementTaxAdv$ ?? 0;
  const currentBrokerageAmount = hasAdjustedBrokerageSlider
    ? (brokerageAllocationPct / 100) * postTaxSavingsAvailable
    : savingsAlloc?.brokerage$ ?? 0;

  // Post-tax categories only (removed 401k match and traditional 401k from post-tax list)
  const emergencyCategory: SavingsCategory = {
    id: 'emergency',
    label: 'Emergency Fund',
    amount: currentEfAmount,
    percent: (currentEfAmount / postTaxSavingsAvailable) * 100,
    icon: <Shield className="h-5 w-5" />,
    description: 'Builds your safety net for unexpected expenses',
    color: '#10b981',
  };

  // Post-tax categories - removed 401k match (it's pre-tax) and traditional 401k
  const otherCategories: SavingsCategory[] = [
    {
      id: 'debt',
      label: 'High-APR Debt Paydown',
      amount: currentDebtAmount,
      percent: (currentDebtAmount / postTaxSavingsAvailable) * 100,
      icon: <CreditCard className="h-5 w-5" />,
      description: 'Accelerates debt payoff and saves on interest',
      color: '#f59e0b',
    },
    {
      id: 'retirement',
      label: 'Roth IRA / Taxable Retirement',
      amount: currentRetirementAmount,
      percent: (currentRetirementAmount / postTaxSavingsAvailable) * 100,
      icon: <TrendingUp className="h-5 w-5" />,
      description: `Post-tax retirement accounts (${savingsAlloc?.routing?.acctType ?? 'retirement'}) for long-term growth`,
      color: '#8b5cf6',
    },
    {
      id: 'brokerage',
      label: 'Taxable Brokerage',
      amount: currentBrokerageAmount,
      percent: (currentBrokerageAmount / postTaxSavingsAvailable) * 100,
      icon: <PiggyBank className="h-5 w-5" />,
      description: 'Flexible investing for medium-term goals',
      color: '#14b8a6',
    },
  ].filter((cat) => cat.amount > 0.01);

  const categories = [emergencyCategory, ...otherCategories];
  const totalAllocated = categories.reduce((sum, cat) => sum + cat.amount, 0);
  const remaining = postTaxSavingsAvailable - totalAllocated;

  return (
    <>
      <Card className="w-full min-w-0 max-w-md sm:max-w-lg lg:max-w-xl mx-auto overflow-x-hidden">
        <CardHeader className="space-y-2">
          <div className="mb-4">
            <OnboardingProgress />
          </div>
        </CardHeader>

        <CardContent className="space-y-6 overflow-x-hidden">
          {/* Pre-Tax Savings (Payroll) Panel */}
          {(preTaxSavings.traditional401k.monthly > 0 || preTaxSavings.hsa.monthly > 0 || preTaxSavings.employerMatch.monthly > 0 || preTaxSavings.employerHSA.monthly > 0 || payrollContributions?.has401k) && (
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
                  onClick={() => router.push('/onboarding/payroll-contributions')}
                  className="flex items-center gap-1.5"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit payroll savings
                </Button>
              </div>

              {/* Match Status Badge */}
              {payrollContributions?.has401k && payrollContributions?.hasEmployerMatch === "yes" && (
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
                    <span className="text-slate-700 dark:text-slate-300">Employer 401K match:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      ~+${Math.round(preTaxSavings.employerMatch.monthly).toLocaleString('en-US')}/mo (estimated)
                    </span>
                  </div>
                )}
                
                {preTaxSavings.employerHSA.monthly > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">Employer HSA:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      ~+${Math.round(preTaxSavings.employerHSA.monthly).toLocaleString('en-US')}/mo (estimated)
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
                      onClick={() => router.push('/onboarding/payroll-contributions')}
                    >
                      Edit payroll savings
                    </Button>
                  </div>
                </div>
              )}

              {/* HSA Recommendation (Step 2 in Savings Stack) */}
              {hsaRecommendation && (
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
                      onClick={() => router.push('/onboarding/payroll-contributions')}
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
                        setInitialPaycheckPlan(undefined as any);
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
            </div>
          )}

          {/* Summary Header */}
          <div className="space-y-3 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Savings Allocation
            </h1>
            
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
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="text-center">
                <div className="text-xs text-slate-600 dark:text-slate-400">Pre‑tax payroll savings</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  ${Math.round(preTaxSavings.total).toLocaleString('en-US')}/mo
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">(estimated)</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-600 dark:text-slate-400">Employer 401K match</div>
                <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                  +${Math.round(preTaxSavings.employerMatch.monthly).toLocaleString('en-US')}/mo
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">(estimated)</div>
              </div>
              {preTaxSavings.employerHSA.monthly > 0 && (
                <div className="text-center">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Employer HSA</div>
                  <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                    +${Math.round(preTaxSavings.employerHSA.monthly).toLocaleString('en-US')}/mo
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">(estimated)</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-xs text-slate-600 dark:text-slate-400">Total wealth moves</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  ${Math.round(totalWealthMoves).toLocaleString('en-US')}/mo
                </div>
              </div>
            </div>
          </div>

          {/* Post-Tax Savings Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Post-Tax Savings
            </h3>
            
            {/* Emergency Fund Section with Slider */}
            {(() => {
              const efCategory = emergencyCategory;
              const currentEfPct = hasAdjustedEfSlider ? efAllocationPct : ((savingsAlloc?.ef$ ?? 0) / postTaxSavingsAvailable) * 100;
              const efAllocationAmount = (currentEfPct / 100) * postTaxSavingsAvailable;
              const efCap = Math.min(postTaxSavingsAvailable * 0.4, efGap$ > 0 ? efGap$ : postTaxSavingsAvailable);
              const maxPct = (efCap / postTaxSavingsAvailable) * 100;
              
              return (
                <div className="rounded-lg border-2 border-green-200 bg-white p-4 dark:border-green-800 dark:bg-slate-800">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="rounded-lg p-2"
                        style={{ backgroundColor: `${efCategory.color}20` }}
                      >
                        <div style={{ color: efCategory.color }}>{efCategory.icon}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {efCategory.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        ${efAllocationAmount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} /month
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {currentEfPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* EF Status */}
                  <div className="mb-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-700">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-slate-600 dark:text-slate-400">Current Balance</div>
                        <div className="text-lg font-semibold text-slate-900 dark:text-white">
                          ${efBalance$.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Target</span>
                          <select
                            value={efTargetMonths}
                            onChange={(e) => {
                              const months = parseInt(e.target.value);
                              setEfTargetMonths(months);
                              updateSafetyStrategy({ efTargetMonths: months });
                            }}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                          >
                            <option value="3">3 months</option>
                            <option value="6">6 months</option>
                          </select>
                        </div>
                        <div className="text-lg font-semibold text-slate-900 dark:text-white">
                          ${efTarget$.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </div>
                        {efGap$ > 0 && (
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            ${efGap$.toLocaleString('en-US', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })} remaining
                          </div>
                        )}
                        {efGap$ <= 0 && (
                          <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                            Target reached! ✓
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Slider */}
                  <div className="mb-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        Monthly Allocation (% of post-tax savings)
                      </span>
                      <span className="text-sm font-semibold">{currentEfPct.toFixed(1)}%</span>
                    </div>
                    <Slider
                      value={[currentEfPct]}
                      onValueChange={([value]) => {
                        setEfAllocationPct(Math.min(value, maxPct));
                        setHasAdjustedEfSlider(true);
                      }}
                      min={0}
                      max={maxPct}
                      step={0.5}
                      className="w-full"
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {efGap$ > 0 
                        ? `Recommended: ${Math.min(40, (efGap$ / postTaxSavingsAvailable) * 100).toFixed(1)}% to reach target`
                        : 'Target reached - excess allocation will go to other categories'}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${currentEfPct}%`,
                        backgroundColor: efCategory.color,
                      }}
                    />
                  </div>

                  {/* Description */}
                  <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{efCategory.description}</p>
                  </div>
                </div>
              );
            })()}
            
            {/* Other Post-Tax Categories */}
            {otherCategories.map((category) => {
              // Get current percentage based on whether slider has been adjusted
              let currentPct = category.percent;
              let maxPct = 100;
              
              if (category.id === 'debt') {
                currentPct = hasAdjustedDebtSlider ? debtAllocationPct : category.percent;
                maxPct = 40; // 40% cap for debt
              } else if (category.id === 'retirement') {
                currentPct = hasAdjustedRetirementSlider ? retirementAllocationPct : category.percent;
                maxPct = 100;
              } else if (category.id === 'brokerage') {
                currentPct = hasAdjustedBrokerageSlider ? brokerageAllocationPct : category.percent;
                maxPct = 100;
              }
              
              // Calculate current amount from percentage
              const currentAmount = (currentPct / 100) * postTaxSavingsAvailable;
              
              return (
                <div
                  key={category.id}
                  className="rounded-lg border-2 border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="rounded-lg p-2"
                        style={{ backgroundColor: `${category.color}20` }}
                      >
                        <div style={{ color: category.color }}>{category.icon}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {category.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        ${currentAmount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} /month
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {currentPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Slider */}
                  <div className="mb-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        Monthly Allocation (% of post-tax savings)
                      </span>
                      <span className="text-sm font-semibold">{currentPct.toFixed(1)}%</span>
                    </div>
                    <Slider
                      value={[currentPct]}
                      onValueChange={([value]) => {
                        if (category.id === 'debt') {
                          setDebtAllocationPct(Math.min(value, maxPct));
                          setHasAdjustedDebtSlider(true);
                        } else if (category.id === 'retirement') {
                          setRetirementAllocationPct(Math.min(value, maxPct));
                          setHasAdjustedRetirementSlider(true);
                        } else if (category.id === 'brokerage') {
                          setBrokerageAllocationPct(Math.min(value, maxPct));
                          setHasAdjustedBrokerageSlider(true);
                        }
                      }}
                      min={0}
                      max={maxPct}
                      step={0.5}
                      className="w-full"
                    />
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${currentPct}%`,
                        backgroundColor: category.color,
                      }}
                    />
                  </div>

                  {/* Description */}
                  <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{category.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cash Plan Balance */}
          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Cash plan balance
              </span>
              <span className={`font-bold ${
                remaining > 0.01 
                  ? 'text-amber-600 dark:text-amber-400' 
                  : remaining < -0.01
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-900 dark:text-white'
              }`}>
                ${remaining.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} /month
              </span>
            </div>
            {remaining > 0.01 && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                You're leaving money idle. Consider allocating it to reach your goals faster.
              </p>
            )}
            {remaining < -0.01 && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                You're planning to save more than cash available. Adjust your allocation.
              </p>
            )}
          </div>

          {/* Continue Button */}
          <div className="pt-4">
            <Button onClick={handleContinue} size="lg" className="w-full">
              View Final Plan
            </Button>
          </div>
        </CardContent>

        {/* Floating Ribbit Chat Button */}
        <OnboardingChat context="savings-plan" />
      </Card>
    </>
  );
}
