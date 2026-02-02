/**
 * Onboarding - Payroll Contributions Step
 * 
 * Collects payroll contribution information: 401k, HSA, emergency fund target, and retirement preference.
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { OnboardingChat } from '@/components/onboarding/OnboardingChat';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import type { PayrollContributions } from '@/lib/onboarding/types';
import { useMemo } from 'react';
import { getPaychecksPerMonth } from '@/lib/onboarding/usePlanData';

// Estimate marginal tax rate (federal + state)
const ESTIMATED_MARGINAL_TAX_RATE = 0.25;

function PayrollContributionsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const { payrollContributions, setPayrollContributions, setInitialPaycheckPlan, setCurrentStep, updateSafetyStrategy, income } = useOnboardingStore();

  // Local state for form fields
  const [has401k, setHas401k] = useState<boolean | undefined>(payrollContributions?.has401k);
  const [hasEmployerMatch, setHasEmployerMatch] = useState<"yes" | "no" | "not_sure" | undefined>(payrollContributions?.hasEmployerMatch);
  const [employerMatchPct, setEmployerMatchPct] = useState<number | null>(payrollContributions?.employerMatchPct ?? null);
  const [employerMatchCapPct, setEmployerMatchCapPct] = useState<number | null>(payrollContributions?.employerMatchCapPct ?? null);
  const [currentlyContributing401k, setCurrentlyContributing401k] = useState<"yes" | "no" | undefined>(payrollContributions?.currentlyContributing401k);
  const [contributionType401k, setContributionType401k] = useState<"percent_gross" | "amount" | null>(payrollContributions?.contributionType401k ?? null);
  const [contributionValue401k, setContributionValue401k] = useState<number | null>(payrollContributions?.contributionValue401k ?? null);
  const [contributionFrequency401k, setContributionFrequency401k] = useState<"per_paycheck" | "per_month" | null>(payrollContributions?.contributionFrequency401k ?? null);

  const [hasHSA, setHasHSA] = useState<boolean | undefined>(payrollContributions?.hasHSA);
  // Auto-set hsaEligible to true and hsaCoverageType to "self" when hasHSA is true
  // We don't need state for these since they're auto-determined
  const [currentlyContributingHSA, setCurrentlyContributingHSA] = useState<"yes" | "no" | undefined>(payrollContributions?.currentlyContributingHSA);
  const [contributionTypeHSA, setContributionTypeHSA] = useState<"percent_gross" | "amount" | null>(payrollContributions?.contributionTypeHSA ?? null);
  const [contributionValueHSA, setContributionValueHSA] = useState<number | null>(payrollContributions?.contributionValueHSA ?? null);
  const [contributionFrequencyHSA, setContributionFrequencyHSA] = useState<"per_paycheck" | "per_month" | null>(payrollContributions?.contributionFrequencyHSA ?? null);
  const [employerHSAContribution, setEmployerHSAContribution] = useState<"yes" | "no" | "not_sure" | undefined>(payrollContributions?.employerHSAContribution);
  const [employerHSAAmount$, setEmployerHSAAmount$] = useState<number | null>(payrollContributions?.employerHSAAmount$ ?? null);
  const [hsaIntent, setHsaIntent] = useState<"medical" | "investing" | "decide" | undefined>(payrollContributions?.hsaIntent ?? "decide");

  const [emergencyFundMonths, setEmergencyFundMonths] = useState<3 | 4 | 5 | 6>(payrollContributions?.emergencyFundMonths ?? 6);
  const [retirementPreference, setRetirementPreference] = useState<"roth" | "traditional" | "decide">(payrollContributions?.retirementPreference ?? "decide");

  // Expandable section states
  const [expanded401k, setExpanded401k] = useState(has401k === true);
  const [expandedHSA, setExpandedHSA] = useState(hasHSA === true);

  // Change summary state
  const [showChangeSummary, setShowChangeSummary] = useState(false);
  const [changeSummaryData, setChangeSummaryData] = useState<{
    deltaPreTax: number;
    deltaMatch: number;
    taxSavings: number;
    deltaPostTax: number;
    deltaTotalWealth: number;
  } | null>(null);

  // Calculate current pre-tax values
  const calculateCurrentPreTax = useMemo(() => {
    if (!income) return { traditional401k: 0, hsa: 0, match: 0, total: 0 };
    
    const paychecksPerMonth = getPaychecksPerMonth(income.payFrequency || 'biweekly');
    const grossIncomePerPaycheck = income.grossIncome$ || income.netIncome$ || 0;
    const grossIncomeMonthly = grossIncomePerPaycheck * paychecksPerMonth;

    let traditional401kMonthly = 0;
    if (has401k && currentlyContributing401k === "yes") {
      if (contributionType401k === "percent_gross" && contributionValue401k) {
        traditional401kMonthly = (grossIncomeMonthly * contributionValue401k) / 100;
      } else if (contributionType401k === "amount" && contributionValue401k) {
        if (contributionFrequency401k === "per_paycheck") {
          traditional401kMonthly = contributionValue401k * paychecksPerMonth;
        } else if (contributionFrequency401k === "per_month") {
          traditional401kMonthly = contributionValue401k;
        }
      }
    }

    let hsaMonthly = 0;
    if (hasHSA && currentlyContributingHSA === "yes") {
      if (contributionTypeHSA === "percent_gross" && contributionValueHSA) {
        hsaMonthly = (grossIncomeMonthly * contributionValueHSA) / 100;
      } else if (contributionTypeHSA === "amount" && contributionValueHSA) {
        if (contributionFrequencyHSA === "per_paycheck") {
          hsaMonthly = contributionValueHSA * paychecksPerMonth;
        } else if (contributionFrequencyHSA === "per_month") {
          hsaMonthly = contributionValueHSA;
        }
      }
    }

    let matchMonthly = 0;
    if (has401k && hasEmployerMatch === "yes" && employerMatchPct && employerMatchCapPct) {
      const matchCapMonthly = (grossIncomeMonthly * employerMatchCapPct) / 100;
      const matchableContribution = Math.min(traditional401kMonthly, matchCapMonthly);
      matchMonthly = (matchableContribution * employerMatchPct) / 100;
    }

    return {
      traditional401k: traditional401kMonthly,
      hsa: hsaMonthly,
      match: matchMonthly,
      total: traditional401kMonthly + hsaMonthly,
    };
  }, [income, has401k, currentlyContributing401k, contributionType401k, contributionValue401k, contributionFrequency401k, hasHSA, currentlyContributingHSA, contributionTypeHSA, contributionValueHSA, contributionFrequencyHSA, hasEmployerMatch, employerMatchPct, employerMatchCapPct]);

  // Calculate previous pre-tax values (from saved payrollContributions)
  const calculatePreviousPreTax = useMemo(() => {
    if (!income || !payrollContributions) return { traditional401k: 0, hsa: 0, match: 0, total: 0 };
    
    const paychecksPerMonth = getPaychecksPerMonth(income.payFrequency || 'biweekly');
    const grossIncomePerPaycheck = income.grossIncome$ || income.netIncome$ || 0;
    const grossIncomeMonthly = grossIncomePerPaycheck * paychecksPerMonth;

    let traditional401kMonthly = 0;
    if (payrollContributions.has401k && payrollContributions.currentlyContributing401k === "yes") {
      if (payrollContributions.contributionType401k === "percent_gross" && payrollContributions.contributionValue401k) {
        traditional401kMonthly = (grossIncomeMonthly * payrollContributions.contributionValue401k) / 100;
      } else if (payrollContributions.contributionType401k === "amount" && payrollContributions.contributionValue401k) {
        if (payrollContributions.contributionFrequency401k === "per_paycheck") {
          traditional401kMonthly = payrollContributions.contributionValue401k * paychecksPerMonth;
        } else if (payrollContributions.contributionFrequency401k === "per_month") {
          traditional401kMonthly = payrollContributions.contributionValue401k;
        }
      }
    }

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

    let matchMonthly = 0;
    if (payrollContributions.has401k && payrollContributions.hasEmployerMatch === "yes" && payrollContributions.employerMatchPct && payrollContributions.employerMatchCapPct) {
      const matchCapMonthly = (grossIncomeMonthly * payrollContributions.employerMatchCapPct) / 100;
      const matchableContribution = Math.min(traditional401kMonthly, matchCapMonthly);
      matchMonthly = (matchableContribution * payrollContributions.employerMatchPct) / 100;
    }

    return {
      traditional401k: traditional401kMonthly,
      hsa: hsaMonthly,
      match: matchMonthly,
      total: traditional401kMonthly + hsaMonthly,
    };
  }, [income, payrollContributions]);

  // Calculate change summary when values change
  useEffect(() => {
    // Only calculate if we have saved payroll contributions to compare against
    if (!payrollContributions || !income) {
      setShowChangeSummary(false);
      return;
    }

    const deltaPreTax = calculateCurrentPreTax.total - calculatePreviousPreTax.total;
    const deltaMatch = calculateCurrentPreTax.match - calculatePreviousPreTax.match;
    
    // Only show if there's a meaningful change (> $1)
    if (Math.abs(deltaPreTax) > 1) {
      const taxSavings = deltaPreTax * ESTIMATED_MARGINAL_TAX_RATE;
      const deltaTakeHome = -deltaPreTax + taxSavings;
      const deltaPostTax = deltaTakeHome;
      // Total wealth moves = Pre-tax contribution amount only
      // This represents the actual wealth move (money going into 401k/HSA)
      // Match is a bonus, post-tax available change is cash flow impact
      const deltaTotalWealth = deltaPreTax;

      setChangeSummaryData({
        deltaPreTax,
        deltaMatch,
        taxSavings,
        deltaPostTax,
        deltaTotalWealth,
      });
      setShowChangeSummary(true);
    } else {
      setShowChangeSummary(false);
    }
  }, [calculateCurrentPreTax, calculatePreviousPreTax, payrollContributions, income]);

  // Update expanded state when has401k/hasHSA changes
  useEffect(() => {
    setExpanded401k(has401k === true);
  }, [has401k]);

  useEffect(() => {
    setExpandedHSA(hasHSA === true);
  }, [hasHSA]);

  const handleContinue = () => {
    // Build payroll contributions object
    // IMPORTANT: Explicitly set values to null/undefined when not contributing to ensure old values are cleared
    const contributions: PayrollContributions = {
      has401k,
      hasEmployerMatch: has401k ? hasEmployerMatch : undefined,
      employerMatchPct: has401k && hasEmployerMatch === "yes" ? employerMatchPct : null,
      employerMatchCapPct: has401k && hasEmployerMatch === "yes" ? employerMatchCapPct : null,
      currentlyContributing401k: has401k ? currentlyContributing401k : undefined,
      // Explicitly clear contribution values when not contributing
      contributionType401k: has401k && currentlyContributing401k === "yes" ? contributionType401k : null,
      contributionValue401k: has401k && currentlyContributing401k === "yes" ? contributionValue401k : null,
      contributionFrequency401k: has401k && currentlyContributing401k === "yes" && contributionType401k === "amount" ? contributionFrequency401k : null,
      
      hasHSA,
      // Auto-set: if hasHSA is true, assume eligible and default to self coverage
      hsaEligible: hasHSA === true ? true : undefined,
      hsaCoverageType: hasHSA === true ? "self" : undefined,
      currentlyContributingHSA: hasHSA === true ? currentlyContributingHSA : undefined,
      // Explicitly clear HSA contribution values when not contributing
      contributionTypeHSA: hasHSA === true && currentlyContributingHSA === "yes" ? contributionTypeHSA : null,
      contributionValueHSA: hasHSA === true && currentlyContributingHSA === "yes" ? contributionValueHSA : null,
      contributionFrequencyHSA: hasHSA === true && currentlyContributingHSA === "yes" && contributionTypeHSA === "amount" ? contributionFrequencyHSA : null,
      employerHSAContribution: hasHSA === true ? employerHSAContribution : undefined,
      employerHSAAmount$: hasHSA === true && employerHSAContribution === "yes" ? employerHSAAmount$ : null,
      hsaIntent: hasHSA === true ? hsaIntent : undefined,
      
      emergencyFundMonths,
      retirementPreference,
    };

    // Save to store - use setPayrollContributions to completely replace, not merge
    // This ensures old values are cleared when contributions are removed
    setPayrollContributions(contributions);
    
    // Clear initialPaycheckPlan to force recalculation with new payroll contributions
    // This ensures planData recalculates with the correct pre-tax deductions
    setInitialPaycheckPlan(undefined as any);
    
    // Also update safety strategy with emergency fund months
    updateSafetyStrategy({
      efTargetMonths: emergencyFundMonths === 6 ? 6 : emergencyFundMonths,
    });

    // Navigate based on return path or default to onboarding flow
    if (returnTo) {
      // User came from a tool page (e.g., savings-allocator), return them there
      router.push(returnTo);
    } else {
      // User is in onboarding flow — open savings-allocator in first_time mode
      setCurrentStep('savings');
      router.push('/app/tools/savings-allocator?source=onboarding&scenario=first_time');
    }
  };

  const RadioOption = ({ 
    value, 
    selected, 
    onChange, 
    label 
  }: { 
    value: string; 
    selected: boolean; 
    onChange: () => void; 
    label: string;
  }) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        checked={selected}
        onChange={onChange}
        className="h-4 w-4 text-primary focus:ring-primary"
      />
      <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
    </label>
  );

  const ChipButton = ({
    value,
    selected,
    onClick,
    label,
    emoji,
  }: {
    value: string;
    selected: boolean;
    onClick: () => void;
    label: string;
    emoji?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
        selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-500'
      }`}
    >
      {emoji && <span className="mr-1.5">{emoji}</span>}
      {label}
    </button>
  );

  return (
    <>
      <Card className="w-full min-w-0 max-w-md sm:max-w-lg lg:max-w-xl mx-auto overflow-x-hidden">
        <CardHeader className="space-y-2">
          <div className="mb-4">
            <OnboardingProgress />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-center">
            Help your Sidekick make smarter moves
          </CardTitle>
          <CardDescription className="text-base text-center">
            Just a few quick things we can't see yet.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 overflow-x-hidden">
          {/* Section 1: Employer Retirement Plan */}
          <div className="rounded-lg border bg-slate-50 dark:bg-slate-800 p-4">
            <button
              type="button"
              onClick={() => setExpanded401k(!expanded401k)}
              className="w-full flex items-center justify-between mb-2"
            >
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Employer Retirement Plan
              </h3>
              {expanded401k ? (
                <ChevronUp className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              )}
            </button>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Do you have a retirement plan through work?
                </p>
                <div className="space-y-2">
                  <RadioOption
                    value="yes"
                    selected={has401k === true}
                    onChange={() => setHas401k(true)}
                    label="Yes"
                  />
                  <RadioOption
                    value="no"
                    selected={has401k === false}
                    onChange={() => {
                      setHas401k(false);
                      setExpanded401k(false);
                    }}
                    label="No"
                  />
                  <RadioOption
                    value="not_sure"
                    selected={has401k === undefined}
                    onChange={() => {
                      setHas401k(undefined);
                      setExpanded401k(false);
                    }}
                    label="Not sure"
                  />
                </div>
              </div>

              {expanded401k && has401k === true && (
                <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Does your employer match contributions?
                    </p>
                    <div className="space-y-2">
                      <RadioOption
                        value="yes"
                        selected={hasEmployerMatch === "yes"}
                        onChange={() => setHasEmployerMatch("yes")}
                        label="Yes"
                      />
                      <RadioOption
                        value="no"
                        selected={hasEmployerMatch === "no"}
                        onChange={() => setHasEmployerMatch("no")}
                        label="No"
                      />
                      <RadioOption
                        value="not_sure"
                        selected={hasEmployerMatch === "not_sure"}
                        onChange={() => setHasEmployerMatch("not_sure")}
                        label="Not sure"
                      />
                    </div>
                  </div>

                  {hasEmployerMatch === "yes" && (
                    <div className="space-y-3 p-3 bg-white dark:bg-slate-700 rounded-lg">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        How does the match work?
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                            Match %
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={employerMatchPct ?? ''}
                            onChange={(e) => setEmployerMatchPct(e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            placeholder="0-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                            Up to % of pay
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="15"
                            value={employerMatchCapPct ?? ''}
                            onChange={(e) => setEmployerMatchCapPct(e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            placeholder="0-15"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Example: 50% match up to 6%
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setEmployerMatchPct(null);
                          setEmployerMatchCapPct(null);
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        Not sure
                      </button>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Are you currently contributing?
                    </p>
                    <div className="space-y-2">
                      <RadioOption
                        value="yes"
                        selected={currentlyContributing401k === "yes"}
                        onChange={() => setCurrentlyContributing401k("yes")}
                        label="Yes"
                      />
                      <RadioOption
                        value="no"
                        selected={currentlyContributing401k === "no"}
                        onChange={() => setCurrentlyContributing401k("no")}
                        label="No"
                      />
                    </div>
                  </div>

                  {currentlyContributing401k === "yes" && (
                    <div className="space-y-3 p-3 bg-white dark:bg-slate-700 rounded-lg">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        How much are you contributing?
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={contributionType401k === "percent_gross"}
                            onChange={() => {
                              setContributionType401k("percent_gross");
                              setContributionFrequency401k(null);
                            }}
                            className="h-4 w-4 text-primary"
                          />
                          <label className="text-sm text-slate-700 dark:text-slate-300">
                            % of gross income:
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={contributionType401k === "percent_gross" ? (contributionValue401k ?? '') : ''}
                            onChange={(e) => setContributionValue401k(e.target.value ? parseFloat(e.target.value) : null)}
                            disabled={contributionType401k !== "percent_gross"}
                            className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            placeholder="0-50"
                          />
                          <span className="text-sm text-slate-600 dark:text-slate-400">%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={contributionType401k === "amount"}
                            onChange={() => setContributionType401k("amount")}
                            className="h-4 w-4 text-primary"
                          />
                          <label className="text-sm text-slate-700 dark:text-slate-300">
                            $ amount:
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={contributionType401k === "amount" ? (contributionValue401k ?? '') : ''}
                            onChange={(e) => setContributionValue401k(e.target.value ? parseFloat(e.target.value) : null)}
                            disabled={contributionType401k !== "amount"}
                            className="w-32 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      {contributionType401k === "amount" && (
                        <div className="pt-2 space-y-2">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Contribution frequency:
                          </p>
                          <div className="space-y-2">
                            <RadioOption
                              value="per_paycheck"
                              selected={contributionFrequency401k === "per_paycheck"}
                              onChange={() => setContributionFrequency401k("per_paycheck")}
                              label="Per paycheck"
                            />
                            <RadioOption
                              value="per_month"
                              selected={contributionFrequency401k === "per_month"}
                              onChange={() => setContributionFrequency401k("per_month")}
                              label="Per month"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    We'll always prioritize free employer match first.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Health Savings Account (HSA) */}
          <div className="rounded-lg border bg-slate-50 dark:bg-slate-800 p-4">
            <button
              type="button"
              onClick={() => setExpandedHSA(!expandedHSA)}
              className="w-full flex items-center justify-between mb-2"
            >
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Health Savings Account (HSA)
              </h3>
              {expandedHSA ? (
                <ChevronUp className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              )}
            </button>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Do you have a Health Savings Account (HSA)?
                </p>
                <div className="space-y-2">
                  <RadioOption
                    value="yes"
                    selected={hasHSA === true}
                    onChange={() => {
                      setHasHSA(true);
                      // Auto-expand HSA section when user selects "Yes"
                      setExpandedHSA(true);
                    }}
                    label="Yes"
                  />
                  <RadioOption
                    value="no"
                    selected={hasHSA === false}
                    onChange={() => {
                      setHasHSA(false);
                      setExpandedHSA(false);
                    }}
                    label="No"
                  />
                  <RadioOption
                    value="not_sure"
                    selected={hasHSA === undefined}
                    onChange={() => {
                      setHasHSA(undefined);
                      setExpandedHSA(false);
                    }}
                    label="Not sure"
                  />
                </div>
              </div>

              {expandedHSA && hasHSA === true && (
                <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Are you currently contributing to your HSA?
                    </p>
                    <div className="space-y-2">
                      <RadioOption
                        value="yes"
                        selected={currentlyContributingHSA === "yes"}
                        onChange={() => setCurrentlyContributingHSA("yes")}
                        label="Yes"
                      />
                      <RadioOption
                        value="no"
                        selected={currentlyContributingHSA === "no"}
                        onChange={() => setCurrentlyContributingHSA("no")}
                        label="No"
                      />
                    </div>
                  </div>

                  {currentlyContributingHSA === "yes" && (
                    <div className="space-y-3 p-3 bg-white dark:bg-slate-700 rounded-lg">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        How much are you contributing?
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={contributionTypeHSA === "percent_gross"}
                            onChange={() => {
                              setContributionTypeHSA("percent_gross");
                              setContributionFrequencyHSA(null);
                            }}
                            className="h-4 w-4 text-primary"
                          />
                          <label className="text-sm text-slate-700 dark:text-slate-300">
                            % of gross income:
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={contributionTypeHSA === "percent_gross" ? (contributionValueHSA ?? '') : ''}
                            onChange={(e) => setContributionValueHSA(e.target.value ? parseFloat(e.target.value) : null)}
                            disabled={contributionTypeHSA !== "percent_gross"}
                            className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            placeholder="0-50"
                          />
                          <span className="text-sm text-slate-600 dark:text-slate-400">%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={contributionTypeHSA === "amount"}
                            onChange={() => setContributionTypeHSA("amount")}
                            className="h-4 w-4 text-primary"
                          />
                          <label className="text-sm text-slate-700 dark:text-slate-300">
                            $ amount:
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={contributionTypeHSA === "amount" ? (contributionValueHSA ?? '') : ''}
                            onChange={(e) => setContributionValueHSA(e.target.value ? parseFloat(e.target.value) : null)}
                            disabled={contributionTypeHSA !== "amount"}
                            className="w-32 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      {contributionTypeHSA === "amount" && (
                        <div className="pt-2 space-y-2">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Contribution frequency:
                          </p>
                          <div className="space-y-2">
                            <RadioOption
                              value="per_paycheck"
                              selected={contributionFrequencyHSA === "per_paycheck"}
                              onChange={() => setContributionFrequencyHSA("per_paycheck")}
                              label="Per paycheck"
                            />
                            <RadioOption
                              value="per_month"
                              selected={contributionFrequencyHSA === "per_month"}
                              onChange={() => setContributionFrequencyHSA("per_month")}
                              label="Per month"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Does your employer contribute to your HSA?
                    </p>
                    <div className="space-y-2">
                      <RadioOption
                        value="yes"
                        selected={employerHSAContribution === "yes"}
                        onChange={() => setEmployerHSAContribution("yes")}
                        label="Yes"
                      />
                      <RadioOption
                        value="no"
                        selected={employerHSAContribution === "no"}
                        onChange={() => {
                          setEmployerHSAContribution("no");
                          setEmployerHSAAmount$(null);
                        }}
                        label="No"
                      />
                      <RadioOption
                        value="not_sure"
                        selected={employerHSAContribution === "not_sure"}
                        onChange={() => {
                          setEmployerHSAContribution("not_sure");
                          setEmployerHSAAmount$(null);
                        }}
                        label="Not sure"
                      />
                    </div>
                  </div>

                  {employerHSAContribution === "yes" && (
                    <div className="space-y-3 p-3 bg-white dark:bg-slate-700 rounded-lg">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        How much does your employer contribute per month?
                      </p>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-700 dark:text-slate-300">
                          $ per month:
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={employerHSAAmount$ ?? ''}
                          onChange={(e) => setEmployerHSAAmount$(e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-32 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      How should your Sidekick treat your HSA?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <ChipButton
                        value="medical"
                        selected={hsaIntent === "medical"}
                        onClick={() => setHsaIntent("medical")}
                        label="Medical safety"
                        emoji="💊"
                      />
                      <ChipButton
                        value="investing"
                        selected={hsaIntent === "investing"}
                        onClick={() => setHsaIntent("investing")}
                        label="Long-term investing"
                        emoji="📈"
                      />
                      <ChipButton
                        value="decide"
                        selected={hsaIntent === "decide"}
                        onClick={() => setHsaIntent("decide")}
                        label="Decide for me"
                        emoji="✨"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    HSAs can be one of the most powerful tax-advantaged accounts.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Emergency Fund Target */}
          <div className="rounded-lg border bg-slate-50 dark:bg-slate-800 p-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Emergency Fund Target
            </h3>
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                How much safety buffer do you want?
              </p>
              <div className="px-2">
                <Slider
                  value={[emergencyFundMonths]}
                  onValueChange={([value]) => {
                    const months = Math.round(value) as 3 | 4 | 5 | 6;
                    setEmergencyFundMonths(months);
                  }}
                  min={3}
                  max={6}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between mt-2 text-xs text-slate-600 dark:text-slate-400">
                  <span>3 months</span>
                  <span>4 months</span>
                  <span>5 months</span>
                  <span>6+ months</span>
                </div>
                <div className="text-center mt-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {emergencyFundMonths === 6 ? '6+' : emergencyFundMonths} months
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                This is money for life surprises — not investing.
              </p>
            </div>
          </div>

          {/* Section 4: Retirement Style Preference */}
          <div className="rounded-lg border bg-slate-50 dark:bg-slate-800 p-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Retirement Style Preference
            </h3>
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                How do you prefer to save for retirement?
              </p>
              <div className="flex flex-wrap gap-2">
                <ChipButton
                  value="roth"
                  selected={retirementPreference === "roth"}
                  onClick={() => setRetirementPreference("roth")}
                  label="Roth (pay tax now)"
                  emoji="🟢"
                />
                <ChipButton
                  value="traditional"
                  selected={retirementPreference === "traditional"}
                  onClick={() => setRetirementPreference("traditional")}
                  label="Traditional (pay tax later)"
                  emoji="🔵"
                />
                <ChipButton
                  value="decide"
                  selected={retirementPreference === "decide"}
                  onClick={() => setRetirementPreference("decide")}
                  label="Decide for me"
                  emoji="✨"
                />
              </div>
            </div>
          </div>

          {/* Change Summary */}
          {showChangeSummary && changeSummaryData && (
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
                  onClick={() => setShowChangeSummary(false)}
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
                        {changeSummaryData.deltaPreTax >= 0 ? '+' : ''}${Math.round(changeSummaryData.deltaPreTax).toLocaleString('en-US')}/mo
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      This goes straight into your retirement account.
                    </p>
                  </div>
                  
                  {changeSummaryData.deltaMatch !== 0 && (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-700 dark:text-slate-300">Employer match (free money):</span>
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {changeSummaryData.deltaMatch >= 0 ? '+' : ''}~${Math.round(changeSummaryData.deltaMatch).toLocaleString('en-US')}/mo
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
                        +~${Math.round(changeSummaryData.taxSavings).toLocaleString('en-US')}/mo
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
                        {changeSummaryData.deltaPostTax >= 0 ? '+' : ''}${Math.round(changeSummaryData.deltaPostTax).toLocaleString('en-US')}/mo
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
                        {changeSummaryData.deltaPreTax + changeSummaryData.deltaMatch >= 0 ? '+' : ''}${Math.round(changeSummaryData.deltaPreTax + changeSummaryData.deltaMatch).toLocaleString('en-US')}/mo
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
                        {changeSummaryData.deltaPostTax >= 0 ? '+' : ''}${Math.round(changeSummaryData.deltaPostTax).toLocaleString('en-US')}/mo
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

          {/* Primary CTA */}
          <div className="pt-4 space-y-2">
            <Button onClick={handleContinue} size="lg" className="w-full">
              Build my savings plan
            </Button>
            <p className="text-xs text-center text-slate-500 dark:text-slate-400">
              You can change any of this anytime.
            </p>
          </div>
        </CardContent>

        {/* Floating Ribbit Chat Button */}
        <OnboardingChat context="payroll-contributions" />
      </Card>
    </>
  );
}

export default function PayrollContributionsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading...
            </p>
          </CardContent>
        </Card>
      </div>
    }>
      <PayrollContributionsPageContent />
    </Suspense>
  );
}
