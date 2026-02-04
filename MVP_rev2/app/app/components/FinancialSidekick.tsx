/**
 * Financial Sidekick Component
 *
 * Feed Logic decides WHAT matters (ranked Leaps); Sidekick decides HOW to present (chat + quick actions).
 * On open: pull top 1–3 Leaps from generateCandidateLeaps (same as Feed). No invented recommendations.
 *
 * Plan updates: This sidekick does not apply PLAN_CHANGES from the API. When the user is on a tool page
 * (e.g. savings-allocator, savings-helper), plan application is handled by that page’s chat panel using
 * the shared intent module (parseSavingsAllocationIntent / intentToDelta) so "to $X" vs "by $X" is consistent.
 *
 * TODO: Persist "Not now" / dismiss and cooldown behavior.
 * TODO: Replace mock state with real user state and triggers.
 * TODO: Sidekick should narrate tool output (not invent numbers).
 */

'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Search, Zap, Send } from 'lucide-react';
import { sendChatMessageStreaming } from '@/lib/chat/chatService';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { getPaychecksPerMonth } from '@/lib/onboarding/usePlanData';
import { computeIncomePlan } from '@/lib/income/computePlan';
import { ChatMarkdown } from '@/components/chat/ChatMarkdown';
import { ChatLoadingDots } from '@/components/chat/ChatLoadingDots';
import { generateCandidateLeaps } from '@/lib/feed/generateLeaps';
import { buildUserFinancialStateFromPlan, buildTriggerSignalsFromPlan } from '@/lib/feed/fromPlanData';
import { getScenarioById } from '@/lib/feed/scenarios';
import { computePreviewMetric } from '@/lib/feed/previewMetrics';
import type { Leap } from '@/lib/feed/leapTypes';
import { SidekickLeapCard } from '@/components/sidekick/SidekickLeapCard';
import { useSidekick } from '@/app/app/context/SidekickContext';
import { withBasePath } from '@/lib/utils/basePath';
import { calculateDisplaySavingsBreakdown } from '@/lib/utils/savingsCalculations';
import { buildChatNetWorthFromPlan, buildChatSavingsAllocationFromPlan } from '@/lib/chat/buildChatPlanData';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

/** Tool routes for recommendation CTAs (Option 1: route to tool page with source=sidekick). */
function sidekickToolRoute(leap: Leap): string {
  const base = pathForTool(leap.originatingTool);
  const params = new URLSearchParams({ source: 'sidekick', leapId: leap.leapId });
  return `${base}?${params.toString()}`;
}

function pathForTool(tool: Leap['originatingTool']): string {
  switch (tool) {
    case 'income':
      return '/app/tools/savings-helper';
    case 'savings':
      return '/app/tools/savings-allocator';
    case 'sweeper':
      return '/app/tools/savings-allocator'; // stub: no sweeper page yet
    case 'sidekick':
      return '/app';
    default:
      return '/app';
  }
}

/** Quick actions — income → savings-helper, savings → savings-allocator. */
const quickActions = [
  { id: 'income', label: 'Review my income split', path: '/app/tools/savings-helper', prefill: 'Help me review my income allocation.' },
  { id: 'savings', label: 'Review my savings plan', path: '/app/tools/savings-allocator', prefill: 'Help me review my savings plan.' },
  { id: 'sweeps', label: 'Set up automatic sweeps', path: '/app/tools/savings-allocator', prefill: 'Help me set up automatic sweeps.' },
  { id: 'scenario', label: 'Analyze a scenario', path: '/app/tools/configurable-demo', prefill: 'Help me analyze a custom scenario.' },
];

interface FinancialSidekickProps {
  inline?: boolean;
  /** 'modal' = floating button + overlay when open (default). 'split' = side-by-side panel. 'below' = open as a panel below main content when user clicks. */
  variant?: 'modal' | 'split' | 'below';
}

export function FinancialSidekick({ inline = false, variant = 'modal' }: FinancialSidekickProps) {
  const sidekickContext = useSidekick();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = variant === 'split' ? true : (sidekickContext ? sidekickContext.isOpen : internalOpen);
  const setIsOpen = sidekickContext ? (open: boolean) => (open ? sidekickContext.openSidekick() : sidekickContext.closeSidekick()) : setInternalOpen;
  const isEmbedded = variant === 'split';
  const isBelow = variant === 'below';
  const showCloseButton = variant !== 'split';
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm Ribbit, your financial sidekick. I can help you with questions about your financial plan, savings, budgeting, and more. What would you like to know?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false); // Toggle between recommendations and chat
  const [dismissedLeapIds, setDismissedLeapIds] = useState<Set<string>>(new Set()); // Session-only; no persistence
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamingTextRef = useRef('');
  const streamingMessageIdRef = useRef<string | null>(null);
  const [streamingTick, setStreamingTick] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const store = useOnboardingStore();
  const planData = usePlanData();

  // Same view of the world as Feed: live state when planData exists, else fallback scenario
  const effectiveState = useMemo(() => {
    if (planData) {
      return buildUserFinancialStateFromPlan(planData, {
        income: store.income,
        assets: store.assets,
        debts: store.debts,
        payrollContributions: store.payrollContributions,
        plaidConnected: store.plaidConnected,
        safetyStrategy: store.safetyStrategy,
      });
    }
    const scenario = getScenarioById('missing-match');
    return scenario?.state ?? { takeHomePayMonthly: 6000, paycheckDetected: false, needsPercent: 55, wantsPercent: 25, savingsPercent: 20, cashBalance: 3000, safetyBufferTarget: 2000, emergencyFundMonths: 2, emergencyFundTargetMonths: 6, hasHighAprDebt: false, employerMatchEligible: true, employerMatchMet: false, employerMatchGapMonthly: 200, hsaEligible: false, hsaContributing: false, unimplementedLeaps: [] };
  }, [planData, store.income, store.assets, store.debts, store.payrollContributions, store.plaidConnected, store.safetyStrategy]);

  const effectiveSignals = useMemo(() => {
    if (planData) {
      return buildTriggerSignalsFromPlan(planData, { income: store.income, assets: store.assets, plaidConnected: store.plaidConnected });
    }
    return { nowISO: new Date().toISOString(), cashRisk: false, surplusCash: false };
  }, [planData, store.income, store.assets, store.plaidConnected]);

  // Same logic as Feed: generate leaps, filter suppressed (e.g. EF on-track) and dismissed, use same order as Feed (generation order), then take top 1–3
  const leapsWithPreview = useMemo(() => {
    const raw = generateCandidateLeaps(effectiveState, effectiveSignals);
    const unsuppressed = raw.filter((leap) => !leap.suppressed);
    const notDismissed = unsuppressed.filter((leap) => !dismissedLeapIds.has(leap.leapId));
    return notDismissed.map((leap) => {
      const payload =
        leap.leapType === 'EMPLOYER_MATCH_NOT_MET' && effectiveState.employerMatchGapMonthly != null
          ? { ...leap.payload, employerMatchGap: effectiveState.employerMatchGapMonthly, employerMatchGapMonthly: effectiveState.employerMatchGapMonthly }
          : leap.payload;
      return {
        ...leap,
        payload,
        previewMetric: computePreviewMetric(leap.leapType, effectiveState, effectiveSignals, payload),
      };
    });
  }, [effectiveState, effectiveSignals, dismissedLeapIds]);

  const topLeap = leapsWithPreview[0] ?? null;
  const otherLeaps = leapsWithPreview.slice(1, 3);
  const currentLeapsForPrompt = useMemo(() => leapsWithPreview.slice(0, 3), [leapsWithPreview]);

  const handleOpenTool = (leap: Leap) => {
    router.push(sidekickToolRoute(leap));
    setIsOpen(false);
  };

  const handleDismissLeap = (leap: Leap) => {
    setDismissedLeapIds((prev) => new Set(prev).add(leap.leapId));
  };
  
  // Determine context based on current pathname
  const getContext = (): string => {
    if (pathname?.includes('/tools/mvp-simulator')) {
      return 'mvp-simulator';
    }
    if (pathname?.includes('/tools/savings-helper')) {
      return 'savings-helper';
    }
    if (pathname?.includes('/tools/savings-allocator')) {
      return 'savings-allocator';
    }
    if (pathname?.includes('/tools/savings-optimizer')) {
      return 'savings-optimizer';
    }
    // Default context
    return 'financial-sidekick';
  };
  
  // Track last context to detect when it changes
  const lastContextRef = useRef<string>(getContext());
  
  // Reset messages when context changes (when navigating between pages)
  useEffect(() => {
    const currentContext = getContext();
    // If context changed, reset messages
    if (currentContext !== lastContextRef.current) {
      lastContextRef.current = currentContext;
      // Reset to initial message when context changes
      setMessages([
        {
          id: '1',
          text: "Hi! I'm Ribbit, your financial sidekick. I can help you with questions about your financial plan, savings, budgeting, and more. What would you like to know?",
          isUser: false,
          timestamp: new Date(),
        },
      ]);
      // Also reset showChat to show recommendations first
      setShowChat(false);
    }
  }, [pathname]);
  
  // Also reset messages when chat is opened (in case context changed while chat was closed)
  useEffect(() => {
    if (isOpen) {
      const currentContext = getContext();
      // If context changed since last interaction, reset messages
      if (currentContext !== lastContextRef.current) {
        lastContextRef.current = currentContext;
        setMessages([
          {
            id: '1',
            text: "Hi! I'm Ribbit, your financial sidekick. I can help you with questions about your financial plan, savings, budgeting, and more. What would you like to know?",
            isUser: false,
            timestamp: new Date(),
          },
        ]);
        setShowChat(false);
      }
    }
  }, [isOpen, pathname]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && showChat) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [messages, isOpen, showChat, streamingTick]);

  const handleQuickActionClick = (path: string) => {
    router.push(path);
    setIsOpen(false);
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isLoading) return;

    // Switch to chat view if not already there
    if (!showChat) {
      setShowChat(true);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: chatInput.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = chatInput.trim();
    setChatInput('');
    setIsLoading(true);

    let streamingId: string | undefined;
    try {
      // Calculate comprehensive user plan data for context
      const incomeAmount = store.income?.netIncome$ || store.income?.grossIncome$ || 0;
      const payFrequency = store.income?.payFrequency || 'biweekly';
      const paychecksPerMonth = getPaychecksPerMonth(payFrequency);
      const monthlyIncome = incomeAmount * paychecksPerMonth;

      // Use plan-based needs/wants when available (matches Income tab) — otherwise from fixedExpenses
      const monthlyNeedsFromPlan = planData
        ? planData.paycheckCategories
            .filter((c) => c.key === 'essentials' || c.key === 'debt_minimums')
            .reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth
        : 0;
      const monthlyWantsFromPlan = planData
        ? planData.paycheckCategories
            .filter((c) => c.key === 'fun_flexible')
            .reduce((sum, c) => sum + c.amount, 0) * paychecksPerMonth
        : 0;

      // Calculate expenses from fixed expenses (fallback when no plan)
      const monthlyExpenses = store.fixedExpenses.reduce((sum, expense) => {
        let monthly = expense.amount$;
        if (expense.frequency === 'weekly') monthly = expense.amount$ * 4.33;
        else if (expense.frequency === 'biweekly') monthly = expense.amount$ * 2.17;
        else if (expense.frequency === 'semimonthly') monthly = expense.amount$ * 2;
        else if (expense.frequency === 'yearly') monthly = expense.amount$ / 12;
        return sum + monthly;
      }, 0);

      // Calculate debt minimum payments per month
      const monthlyDebtPayments = store.debts.reduce((sum, debt) => {
        return sum + (debt.minPayment$ * paychecksPerMonth);
      }, 0);

      // Calculate total debt
      const totalDebt = store.debts.reduce((sum, d) => sum + d.balance$, 0);

      // Calculate needs and wants from expenses
      const monthlyNeeds = store.fixedExpenses
        .filter(e => e.category === 'needs' || !e.category)
        .reduce((sum, expense) => {
          let monthly = expense.amount$;
          if (expense.frequency === 'weekly') monthly = expense.amount$ * 4.33;
          else if (expense.frequency === 'biweekly') monthly = expense.amount$ * 2.17;
          else if (expense.frequency === 'semimonthly') monthly = expense.amount$ * 2;
          else if (expense.frequency === 'yearly') monthly = expense.amount$ / 12;
          return sum + monthly;
        }, 0) + monthlyDebtPayments; // Include debt payments in needs

      const monthlyWants = store.fixedExpenses
        .filter(e => e.category === 'wants')
        .reduce((sum, expense) => {
          let monthly = expense.amount$;
          if (expense.frequency === 'weekly') monthly = expense.amount$ * 4.33;
          else if (expense.frequency === 'biweekly') monthly = expense.amount$ * 2.17;
          else if (expense.frequency === 'semimonthly') monthly = expense.amount$ * 2;
          else if (expense.frequency === 'yearly') monthly = expense.amount$ / 12;
          return sum + monthly;
        }, 0);

      // Calculate savings (what's left after expenses)
      const monthlySavings = monthlyIncome - monthlyNeeds - monthlyWants;
      const savingsRate = monthlyIncome > 0 ? monthlySavings / monthlyIncome : 0;

      // Use same calculation as Income tab / Savings tab — plan-based overrides when plan has 401k/HSA
      const needsForBreakdown = planData ? monthlyNeedsFromPlan : monthlyNeeds;
      const wantsForBreakdown = planData ? monthlyWantsFromPlan : monthlyWants;
      const savingsBreakdown = calculateDisplaySavingsBreakdown(
        store.income ?? undefined,
        store.payrollContributions ?? undefined,
        needsForBreakdown,
        wantsForBreakdown,
        planData?.paycheckCategories ?? null
      );

      // Get expense breakdown
      const expenseBreakdown = store.fixedExpenses.map(expense => {
        let monthly = expense.amount$;
        if (expense.frequency === 'weekly') monthly = expense.amount$ * 4.33;
        else if (expense.frequency === 'biweekly') monthly = expense.amount$ * 2.17;
        else if (expense.frequency === 'semimonthly') monthly = expense.amount$ * 2;
        else if (expense.frequency === 'yearly') monthly = expense.amount$ / 12;
        return {
          name: expense.name,
          amount: monthly,
          category: expense.category || 'needs',
        };
      });

      // Get debt breakdown
      const debtBreakdown = store.debts.map(debt => ({
        name: debt.name || 'Debt',
        balance: debt.balance$,
        minPayment: debt.minPayment$ * paychecksPerMonth,
        apr: debt.aprPct || 0,
      }));

      // Get assets breakdown
      const assetsBreakdown = store.assets.map(asset => ({
        name: asset.name || 'Asset',
        value: (asset as any).balance$ || asset.value$ || 0,
        type: asset.type || 'other',
      }));

      // Get goals breakdown
      const goalsBreakdown = store.goals.map(goal => ({
        name: goal.name || 'Goal',
        target: (goal as any).target$ || goal.targetAmount$ || 0,
        current: (goal as any).current$ || 0,
        deadline: (goal as any).deadline || goal.targetDate,
      }));

      // Get actual spending from riskConstraints if available (3-month averages)
      let actualSpending = undefined;
      if (store.riskConstraints?.actuals3m) {
        const actuals = store.riskConstraints.actuals3m;
        actualSpending = {
          needsPct: actuals.needsPct * 100,
          wantsPct: actuals.wantsPct * 100,
          savingsPct: actuals.savingsPct * 100,
          monthlyNeeds: (actuals.needsPct * monthlyIncome),
          monthlyWants: (actuals.wantsPct * monthlyIncome),
          monthlySavings: (actuals.savingsPct * monthlyIncome),
        };
      }

      // If planData is available, use it for more accurate numbers
      let planDataContext = undefined;
      if (planData) {
        const needsCategories = planData.paycheckCategories.filter(c => 
          c.key === 'essentials' || c.key === 'debt_minimums'
        );
        const wantsCategories = planData.paycheckCategories.filter(c => 
          c.key === 'fun_flexible'
        );
        const savingsCategories = planData.paycheckCategories.filter(c => 
          c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
        );

        const planNeedsPerPaycheck = needsCategories.reduce((sum, c) => sum + c.amount, 0);
        const planWantsPerPaycheck = wantsCategories.reduce((sum, c) => sum + c.amount, 0);
        const planSavingsPerPaycheck = savingsCategories.reduce((sum, c) => sum + c.amount, 0);

        planDataContext = {
          planNeeds: planNeedsPerPaycheck * paychecksPerMonth,
          planWants: planWantsPerPaycheck * paychecksPerMonth,
          planSavings: planSavingsPerPaycheck * paychecksPerMonth,
        };
      }

      // Get emergency fund info if available
      let emergencyFundInfo = undefined;
      if (planData?.emergencyFund) {
        emergencyFundInfo = {
          current: planData.emergencyFund.current || 0,
          target: planData.emergencyFund.target || 0,
          monthsTarget: planData.emergencyFund.monthsTarget || 3,
          monthsToTarget: planData.emergencyFund.monthsToTarget || 0,
        };
      }

      // Net worth and savings allocation — use shared utility for consistency across all chat windows
      const netWorthInfo = buildChatNetWorthFromPlan(planData ?? null);

      // Savings allocation — use shared utility for consistency
      const savingsAllocation = buildChatSavingsAllocationFromPlan(planData ?? null, paychecksPerMonth);

      // Get current context based on pathname
      const currentContext = getContext();
      
      // For savings-helper context, calculate ALL THREE bar graph values
      let savingsHelperData = undefined;
      if (currentContext === 'savings-helper' && planData) {
        // 1. Calculate Past 3 Months Average (from actual expenses) - FIRST BAR
        let actuals3mNeedsTotal = 0;
        let actuals3mWantsTotal = 0;
        
        // Calculate from actual expenses (same logic as savings-helper page)
        for (const expense of store.fixedExpenses) {
          let monthlyAmount = expense.amount$;
          if (expense.frequency === 'weekly') monthlyAmount = expense.amount$ * 4.33;
          else if (expense.frequency === 'biweekly') monthlyAmount = expense.amount$ * 2.17;
          else if (expense.frequency === 'semimonthly') monthlyAmount = expense.amount$ * 2;
          else if (expense.frequency === 'yearly') monthlyAmount = expense.amount$ / 12;
          
          if (expense.category === 'needs' || !expense.category) {
            actuals3mNeedsTotal += monthlyAmount;
          } else if (expense.category === 'wants') {
            actuals3mWantsTotal += monthlyAmount;
          }
        }
        
        // Add debt minimum payments to needs
        const monthlyDebtMinPayments = store.debts.reduce((sum, d) => sum + (d.minPayment$ * paychecksPerMonth), 0);
        actuals3mNeedsTotal += monthlyDebtMinPayments;
        
        const actuals3mNeedsPct = monthlyIncome > 0 ? Math.max(actuals3mNeedsTotal / monthlyIncome, 0) : 0;
        const actuals3mWantsPct = monthlyIncome > 0 ? Math.max(actuals3mWantsTotal / monthlyIncome, 0) : 0;
        const actuals3mSavingsPct = Math.max(0, 1.0 - actuals3mNeedsPct - actuals3mWantsPct);
        
        // 2. Calculate Current Plan (baseline plan) - SECOND BAR
        const needsCategories = planData.paycheckCategories.filter(c => 
          c.key === 'essentials' || c.key === 'debt_minimums'
        );
        const wantsCategories = planData.paycheckCategories.filter(c => 
          c.key === 'fun_flexible'
        );
        const savingsCategories = planData.paycheckCategories.filter(c => 
          c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
        );
        const currentNeedsPerPaycheck = needsCategories.reduce((sum, c) => sum + c.amount, 0);
        const currentWantsPerPaycheck = wantsCategories.reduce((sum, c) => sum + c.amount, 0);
        const currentSavingsPerPaycheck = savingsCategories.reduce((sum, c) => sum + c.amount, 0);
        const totalPerPaycheck = currentNeedsPerPaycheck + currentWantsPerPaycheck + currentSavingsPerPaycheck;
        
        if (totalPerPaycheck > 0 && monthlyIncome > 0) {
          const currentPlan = {
            needsPct: currentNeedsPerPaycheck / totalPerPaycheck,
            wantsPct: currentWantsPerPaycheck / totalPerPaycheck,
            savingsPct: currentSavingsPerPaycheck / totalPerPaycheck,
          };
          
          // 3. Calculate Recommended Plan - THIRD BAR
          let shiftLimitPct = store.riskConstraints?.shiftLimitPct || 0.04;
          const normalizedShiftLimit = shiftLimitPct > 1 ? shiftLimitPct / 100 : shiftLimitPct;
          
          const standardTargets = {
            needsPct: 0.5,
            wantsPct: 0.3,
            savingsPct: 0.2,
          };
          
          try {
            const result = computeIncomePlan({
              income$: monthlyIncome,
              actualNeedsPct: currentPlan.needsPct,
              actualWantsPct: currentPlan.wantsPct,
              actualSavingsPct: currentPlan.savingsPct,
              targetNeedsPct: standardTargets.needsPct,
              targetWantsPct: standardTargets.wantsPct,
              targetSavingsPct: standardTargets.savingsPct,
              shiftLimitPct: normalizedShiftLimit,
            });
            
            // Cap at shift limit if needed
            const actualShift = result.next.savingsPct - currentPlan.savingsPct;
            let recommended = result.next;
            if (actualShift > normalizedShiftLimit + 0.001) {
              const cappedSavingsPct = currentPlan.savingsPct + normalizedShiftLimit;
              const cappedWantsPct = Math.max(0, currentPlan.wantsPct - normalizedShiftLimit);
              recommended = {
                needsPct: currentPlan.needsPct,
                wantsPct: cappedWantsPct,
                savingsPct: cappedSavingsPct,
                income$: monthlyIncome,
              };
            }
            
            // Pass all three bar graph values clearly
            savingsHelperData = {
              // Bar 1: Past 3 Months Average (from actual expenses)
              past3MonthsAverage: {
                needsPct: actuals3mNeedsPct,
                wantsPct: actuals3mWantsPct,
                savingsPct: actuals3mSavingsPct,
                needsAmount: actuals3mNeedsPct * monthlyIncome,
                wantsAmount: actuals3mWantsPct * monthlyIncome,
                savingsAmount: actuals3mSavingsPct * monthlyIncome,
              },
              // Bar 2: Current Plan (baseline plan)
              currentPlan: {
                needsPct: currentPlan.needsPct,
                wantsPct: currentPlan.wantsPct,
                savingsPct: currentPlan.savingsPct,
                needsAmount: currentPlan.needsPct * monthlyIncome,
                wantsAmount: currentPlan.wantsPct * monthlyIncome,
                savingsAmount: currentPlan.savingsPct * monthlyIncome,
              },
              // Bar 3: Recommended Plan (optimized)
              recommendedPlan: {
                needsPct: recommended.needsPct,
                wantsPct: recommended.wantsPct,
                savingsPct: recommended.savingsPct,
                needsAmount: recommended.needsPct * monthlyIncome,
                wantsAmount: recommended.wantsPct * monthlyIncome,
                savingsAmount: recommended.savingsPct * monthlyIncome,
              },
            };
          } catch (error) {
            console.error('[FinancialSidekick] Error calculating savings helper data:', error);
          }
        }
      }
      
      // Calculate pre-tax savings and employer match if payroll contributions are available
      let payrollContributionsData = undefined;
      if (store.payrollContributions) {
        const pc = store.payrollContributions;
        const grossIncome = store.income?.grossIncome$ || store.income?.netIncome$ || monthlyIncome;
        const grossMonthly = grossIncome * paychecksPerMonth;
        
        // Calculate 401k contribution
        let monthly401k = 0;
        if (pc.currentlyContributing401k === 'yes' && pc.contributionValue401k) {
          if (pc.contributionType401k === 'percent_gross') {
            monthly401k = grossMonthly * (pc.contributionValue401k / 100);
          } else if (pc.contributionType401k === 'amount') {
            monthly401k = pc.contributionFrequency401k === 'per_month' 
              ? pc.contributionValue401k 
              : pc.contributionValue401k * paychecksPerMonth;
          }
        }
        
        // Calculate employer match
        let monthlyMatch = 0;
        if (pc.hasEmployerMatch === 'yes' && pc.employerMatchPct && pc.employerMatchCapPct) {
          const matchableAmount = Math.min(monthly401k, grossMonthly * (pc.employerMatchCapPct / 100));
          monthlyMatch = matchableAmount * (pc.employerMatchPct / 100);
        }
        
        // Calculate HSA contribution
        let monthlyHSA = 0;
        if (pc.currentlyContributingHSA === 'yes' && pc.contributionValueHSA) {
          if (pc.contributionTypeHSA === 'percent_gross') {
            monthlyHSA = grossMonthly * (pc.contributionValueHSA / 100);
          } else if (pc.contributionTypeHSA === 'amount') {
            monthlyHSA = pc.contributionFrequencyHSA === 'per_month'
              ? pc.contributionValueHSA
              : pc.contributionValueHSA * paychecksPerMonth;
          }
        }
        
        payrollContributionsData = {
          has401k: pc.has401k,
          hasEmployerMatch: pc.hasEmployerMatch,
          employerMatchPct: pc.employerMatchPct,
          employerMatchCapPct: pc.employerMatchCapPct,
          currentlyContributing401k: pc.currentlyContributing401k,
          contributionValue401k: pc.contributionValue401k,
          monthly401kContribution: monthly401k,
          monthlyEmployerMatch: monthlyMatch,
          hasHSA: pc.hasHSA,
          monthlyHSAContribution: monthlyHSA,
        };
      }

      // Top 3 Leaps for system prompt (Sidekick must not invent beyond these)
      const currentLeaps = currentLeapsForPrompt.map((leap) => ({
        leapId: leap.leapId,
        leapType: leap.leapType,
        reasonCode: leap.reasonCode,
        payload: leap.payload,
        sidekickInsightId: leap.sidekickInsightId,
        priorityScore: leap.priorityScore,
        originatingTool: leap.originatingTool,
      }));

      // Call ChatGPT API with streaming
      const newMessageId = (Date.now() + 1).toString();
      streamingId = newMessageId;
      streamingTextRef.current = '';
      streamingMessageIdRef.current = newMessageId;
      setMessages((prev) => [...prev, { id: newMessageId, text: '', isUser: false, timestamp: new Date() }]);

      await sendChatMessageStreaming(
        {
          messages: [...messages, userMessage],
          context: currentContext,
          userPlanData: {
            monthlyIncome,
            monthlyExpenses,
            monthlyNeeds,
            monthlyWants,
            monthlySavings,
            savingsRate,
            savingsBreakdown,
            debtTotal: totalDebt,
            monthlyDebtPayments,
            expenseBreakdown,
            debtBreakdown,
            assetsBreakdown,
            goalsBreakdown,
            actualSpending,
            planData: savingsHelperData?.recommendedPlan ? {
              planNeeds: savingsHelperData.recommendedPlan.needsAmount,
              planWants: savingsHelperData.recommendedPlan.wantsAmount,
              planSavings: savingsHelperData.recommendedPlan.savingsAmount,
            } : (planDataContext),
            savingsHelperBarGraphs: savingsHelperData,
            emergencyFund: emergencyFundInfo,
            netWorth: netWorthInfo,
            savingsAllocation,
            safetyStrategy: store.safetyStrategy ? {
              emergencyFundTargetMonths: store.safetyStrategy.efTargetMonths,
              liquidity: store.safetyStrategy.liquidity,
              retirementFocus: store.safetyStrategy.retirementFocus,
              match401kPerMonth: store.safetyStrategy.match401kPerMonth$ ? store.safetyStrategy.match401kPerMonth$ * paychecksPerMonth : 0,
              onIDR: store.safetyStrategy.onIDR || false,
            } : undefined,
            payrollContributions: payrollContributionsData,
            currentLeaps,
          },
        },
        {
          onChunk(text) {
            streamingTextRef.current += text;
            setStreamingTick((t) => t + 1);
          },
        }
      );
    } catch (error) {
      console.error('Error getting AI response:', error);
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (error) {
        errorMessage = String(error);
      }
      let userMessage = errorMessage;
      if (errorMessage.includes('API key') || errorMessage.includes('not configured')) {
        userMessage = "I'm having trouble connecting to the AI service. The OpenAI API key may not be configured correctly.";
      } else if (errorMessage.includes('404') || errorMessage.includes('static hosting') || errorMessage.includes('server environment')) {
        userMessage = "The chat feature is not available in this deployment. API routes require a server environment and cannot run on static hosting like GitHub Pages. Please run the app locally or deploy to a platform like Vercel or Netlify.";
      } else if (errorMessage.includes('Network error') || errorMessage.includes('fetch')) {
        userMessage = "Network error: Unable to connect to the chat service. Please check your connection and try again.";
      } else {
        userMessage = `I'm having trouble connecting right now: ${errorMessage}. Please try again in a moment.`;
      }
      const errStreamingId = (Date.now() + 1).toString();
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && !last.isUser && last.text === '') {
          return prev.map((m) => (m.id === last.id ? { ...m, text: userMessage } : m));
        }
        return [...prev, { id: errStreamingId, text: userMessage, isUser: false, timestamp: new Date() }];
      });
    } finally {
      setMessages((prev) =>
        prev.map((m) => (streamingId != null && m.id === streamingId ? { ...m, text: streamingTextRef.current } : m))
      );
      streamingMessageIdRef.current = null;
      setIsLoading(false);
    }
  };

  // Closed: show trigger (floating button for modal/below; split is always open)
  if (!isOpen && !isEmbedded) {
    return (
      <div className="fixed bottom-4 left-0 right-0 z-30 px-4">
        <div className="mx-auto w-full max-w-lg">
          <button
            onClick={() => setIsOpen(true)}
            className="w-full rounded-full border border-slate-300 bg-white px-4 py-3 shadow-sm transition-all hover:border-slate-400 hover:shadow-md dark:border-slate-600 dark:bg-slate-800"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white dark:bg-slate-700">
                <img src={withBasePath('images/ribbit.png')} alt="Ribbit" className="h-10 w-10 object-cover" />
              </div>
              <span className="flex-1 text-left text-sm font-medium text-slate-600 dark:text-slate-400">
                Click to chat with your sidekick
              </span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  const panelContent = (
    <>
        {/* Header — Ribbit image at top like onboarding */}
        <div className="relative flex flex-col items-center border-b border-slate-200 dark:border-slate-700 px-4 pt-4 pb-3 flex-shrink-0 bg-white dark:bg-slate-900 sticky top-0 z-10">
          {showCloseButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="absolute right-2 top-2 h-9 w-9 shrink-0 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Close sidekick"
          >
            <X className="h-5 w-5 text-slate-900 dark:text-white" />
          </Button>
          )}
          <div className="mx-auto h-20 w-20 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden p-2">
            <img
              src={withBasePath('images/ribbit.png')}
              alt="Ribbit, your financial sidekick"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Ribbit</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mt-1">Your Financial Sidekick</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">One smart move at a time.</p>
        </div>

        {/* Main Content — min-h-0 so it scrolls when in split panel */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {!showChat ? (
            <>
              {/* Top Recommendation (0 or 1) */}
              <section className="mb-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Top recommendation</h3>
                {topLeap ? (
                  <SidekickLeapCard
                    leap={topLeap}
                    isTop
                    onOpenTool={handleOpenTool}
                    onDismiss={handleDismissLeap}
                  />
                ) : (
                  <Card className="border-slate-200 dark:border-slate-700">
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        You&apos;re in good shape right now. Want to review anything?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleQuickActionClick('/app/tools/savings-helper')}>
                          Review income
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleQuickActionClick('/app/tools/savings-allocator')}>
                          Review savings
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleQuickActionClick('/app/tools/savings-allocator')}>
                          Set up sweeps
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </section>

              {/* Other Recommendations (0–2) */}
              {otherLeaps.length > 0 && (
                <section className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Other recommendations</h3>
                  <div className="space-y-2">
                    {otherLeaps.map((leap) => (
                      <SidekickLeapCard
                        key={leap.leapId}
                        leap={leap}
                        onOpenTool={handleOpenTool}
                        onDismiss={handleDismissLeap}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Quick Actions */}
              <section className="mb-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Quick actions</h3>
                <div className="space-y-2">
                  {quickActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleQuickActionClick(action.path)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-left text-sm transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                    >
                      <span className="text-slate-900 dark:text-white">{action.label}</span>
                      <Search className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : (
            /* Chat Messages */
            <div className="space-y-4">
              {messages.map((message) => {
                const isStreamingThis = message.id === streamingMessageIdRef.current && isLoading;
                const displayText = isStreamingThis ? streamingTextRef.current : (message.text ?? '');
                return (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.isUser
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {message.isUser ? (
                      <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                    ) : (
                      <ChatMarkdown size="sm">{displayText}</ChatMarkdown>
                    )}
                  </div>
                </div>
                );
              })}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg bg-slate-100 px-4 py-2 dark:bg-slate-800">
                    <ChatLoadingDots />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Chat Input Bar */}
        <div className="border-t bg-white p-4 dark:bg-slate-900">
          {!showChat && (
            <div className="mb-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowChat(true)}
                className="flex-1"
              >
                Start Chat
              </Button>
            </div>
          )}
          <div className="flex items-center gap-3 rounded-full border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white dark:bg-slate-700">
              <img src={withBasePath('images/ribbit.png')} alt="Ribbit" className="h-8 w-8 object-cover" />
            </div>
            {/* Input Field */}
            <input
              ref={inputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleChatSubmit();
                }
              }}
              placeholder={showChat ? "Type your message..." : "How can I help you?"}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400"
              disabled={isLoading}
            />
            {/* Send Button */}
            <button
              onClick={handleChatSubmit}
              disabled={!chatInput.trim() || isLoading}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white transition-all hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {showChat ? (
                <Send className="h-4 w-4" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
    </>
  );

  // Split: always-visible side panel (side-by-side)
  if (variant === 'split') {
    return (
      <aside className="w-full max-w-md shrink-0 border-l border-slate-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-900 h-full min-h-0 overflow-hidden">
        {panelContent}
      </aside>
    );
  }

  // Below: embedded panel under main content (split screen); fills container so parent controls height
  if (isBelow) {
    return (
      <div className="w-full h-full min-h-0 border-t border-slate-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
        {panelContent}
      </div>
    );
  }

  // Modal: overlay when open
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="flex h-full w-full sm:max-h-[90vh] sm:max-w-2xl flex-col rounded-none sm:rounded-lg bg-white shadow-xl dark:bg-slate-900 overflow-hidden">
        {panelContent}
      </div>
    </div>
  );
}
