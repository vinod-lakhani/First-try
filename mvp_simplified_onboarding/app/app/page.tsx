"use client";

import { Suspense, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { RibbitChat } from "@/components/onboarding/RibbitChat";
import { RibbitIcon } from "@/components/onboarding/RibbitIcon";
import type { PlanScreenContext } from "@/lib/ribbit/types";
import { projectNetWorth } from "@/lib/sim/projectNetWorth";
import {
  getCompletedSteps,
  addCompletedStep,
  getPlanCompletenessPercent,
  getNextStep,
  STEPS,
  type StepId,
} from "@/lib/app/completedSteps";
import { X, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { MonthlyPulseCard } from "@/components/home/MonthlyPulseCard";
import { NetWorthTile } from "@/components/home/NetWorthTile";
import { SavingsAdjustmentInsight } from "@/components/savings/SavingsAdjustmentInsight";
import { computeSavingsInsight } from "@/lib/postPlaid/savingsInsight";

function formatMoney(n: number, compact = false) {
  if (compact && n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (compact && n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}


const STEP_INSIGHTS: Record<
  StepId,
  { headline: string; subtext: string; ribbit: string; cta: string; ctaHref?: string; ctaQuestion?: string; ctaAction?: "openChart" }
> = {
  connect: {
    headline: "You can now see where your money is actually going",
    subtext: "",
    ribbit: "Your plan is now based on real spending, not estimates.",
    cta: "See your full monthly pulse →",
    ctaHref: "/app/income",
    ctaQuestion: "Now that I've connected my accounts, what should I focus on first?",
  },
  debts: {
    headline: "You're paying $312/month in interest",
    subtext: "That's $3,700/year lost",
    ribbit: "This is one of the fastest ways to improve your plan.",
    cta: "See how to reduce this →",
    ctaQuestion: "Help me reduce my interest costs. How should I change my savings allocation to include debt payoff? Give me specific, actionable steps I can take right now.",
  },
  payroll: {
    headline: "You're already investing $350/month automatically",
    subtext: "",
    ribbit: "This is doing more work for you than it looks.",
    cta: "See your full picture →",
    ctaQuestion: "I'm already investing through payroll (401k/HSA). How should I factor this into my plan and what should I do next? Give me specific, actionable steps to optimize my full picture.",
  },
  "savings-allocation": {
    headline: "You know where your next dollar should go",
    subtext: "",
    ribbit: "Your plan is now complete — you have a clear priority stack for your savings.",
    cta: "See your full plan →",
    ctaHref: "/app/income",
    ctaQuestion: "I've optimized my savings allocation. What should I focus on next?",
  },
};

const NEXT_ACTION_LABELS: Record<StepId, string> = {
  connect: "Unlock your real spending",
  debts: "See how much interest is costing you",
  payroll: "Account for payroll savings",
  "savings-allocation": "Optimize your savings plan",
};

const RIBBIT_TILE: Record<
  StepId | "complete",
  { message: string; subtext: string; cta: string; href: string }
> = {
  connect: {
    message: "You're off to a strong start — but this plan is still based on estimates.",
    subtext: "You might be leaving money on the table every month. Most people your age overspend in 2–3 categories without realizing it.",
    cta: "Where am I overspending right now?",
    href: "plaid-mock",
  },
  debts: {
    message: "You've connected your real spending. Add your debts next — interest is often the fastest leak to fix.",
    subtext: "Discover the real cost of your debt and how to reduce it.",
    cta: "Add my debts →",
    href: "debts",
  },
  payroll: {
    message: "Almost there. Account for payroll savings — 401(k) and HSA are doing more work for you than it looks.",
    subtext: "Include deductions so your plan reflects your full picture.",
    cta: "Add payroll details →",
    href: "payroll",
  },
  "savings-allocation": {
    message: "Your plan is complete. One final step: optimize where your savings should flow.",
    subtext: "Prioritize what your next dollar should do — 401k match, emergency fund, debt, then growth.",
    cta: "Optimize my savings plan →",
    href: "savings-allocation",
  },
  complete: {
    message: "Your plan is now based on real numbers.",
    subtext: "You're ready to see your full monthly pulse and track your progress.",
    cta: "See your full plan →",
    href: "income",
  },
};

const NEXT_UNLOCK_CARD: Record<
  StepId,
  { title: string; subtitle: string; cta: string; href: string; extra?: string }
> = {
  connect: {
    title: "Unlock your real spending",
    subtitle: "See where your money is going — and what to change this month",
    cta: "Unlock my real numbers →",
    href: "plaid-mock",
    extra: "Most users find $200–$500/month they didn't realize they could save",
  },
  debts: {
    title: "See how much interest is costing you",
    subtitle: "Add your debts to discover the real cost — and how to reduce it",
    cta: "Add my debts →",
    href: "debts",
    extra: "Interest is often the fastest leak to fix",
  },
  payroll: {
    title: "Include payroll savings",
    subtitle: "Account for 401(k), HSA, and other deductions",
    cta: "Add payroll details →",
    href: "payroll",
    extra: "This is doing more work for you than it looks",
  },
  "savings-allocation": {
    title: "Optimize your savings plan",
    subtitle: "Prioritize where your next dollar should go — 401k match, emergency fund, debt, then growth",
    cta: "Optimize my savings plan →",
    href: "savings-allocation",
    extra: "This is your final step to a complete plan",
  },
};

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const savingsParam = searchParams.get("savings");
  const projectedParam = searchParams.get("projected");
  const monthlySavings = savingsParam ? parseFloat(savingsParam) || 1362 : 1362;
  const projected30Y = projectedParam ? parseFloat(projectedParam) || 2000000 : 2000000;
  const [chartExpanded, setChartExpanded] = useState(false);
  const [ribbitOpen, setRibbitOpen] = useState(false);
  const [ribbitInitialQuestion, setRibbitInitialQuestion] = useState<string | null>(null);
  const [unlockMoreExpanded, setUnlockMoreExpanded] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<StepId[]>([]);
  const [insightPopupStep, setInsightPopupStep] = useState<StepId | null>(null);

  // Sync completed steps from localStorage + URL params
  useEffect(() => {
    let steps = getCompletedSteps();
    const connected = searchParams.get("connected");
    const debts = searchParams.get("debts");
    const payroll = searchParams.get("payroll");
    const savingsAllocation = searchParams.get("savingsAllocation");
    let justCompletedStep: StepId | null = null;
    const params = new URLSearchParams({ savings: String(monthlySavings), projected: String(projected30Y) });

    const skipInsight = searchParams.get("skipInsight") === "1";

    const toAdd: StepId[] = [];
    if (connected === "1" && !steps.includes("connect")) toAdd.push("connect");
    if (debts === "1" && !steps.includes("debts")) toAdd.push("debts");
    if (payroll === "1" && !steps.includes("payroll")) toAdd.push("payroll");
    if (savingsAllocation === "1" && !steps.includes("savings-allocation")) toAdd.push("savings-allocation");

    if (toAdd.length > 0) {
      for (const step of toAdd) {
        steps = addCompletedStep(step);
      }
      setCompletedSteps(steps);
      justCompletedStep = toAdd[toAdd.length - 1];
      // Don't replace URL when showing connect modal — it causes a re-render that can make the modal disappear
      if (justCompletedStep !== "connect") {
        router.replace("/app?" + params.toString());
      }
    } else {
      setCompletedSteps(steps);
    }
    if (justCompletedStep && !skipInsight) {
      setInsightPopupStep(justCompletedStep);
    }
  }, [searchParams, router, monthlySavings, projected30Y]);

  const planPct = getPlanCompletenessPercent(completedSteps);
  const nextStep = getNextStep(completedSteps);
  const projectedWithSteps = Math.round(projected30Y * (1 + completedSteps.length * 0.05));
  const { labels, netWorth } = projectNetWorth(monthlySavings, 30, 8);

  const ribbitScreenContext: PlanScreenContext = {
    screen: "plan",
    onboardingStage: "plan",
    hasLinkedAccounts: false,
    source: "estimated_from_income",
    monthlySavings,
    projectedNetWorth30Y: projected30Y,
    horizonYears: 30,
    milestones: {
      oneYear: Math.round(monthlySavings * 12 * 1.08),
      fiveYears: Math.round(monthlySavings * 12 * 5 * 1.08 * 2.5),
      tenYears: Math.round(monthlySavings * 12 * 10 * 1.08 * 5),
    },
    projectionAssumptionsLabel: "steady monthly saving and long-term market growth",
  };

  const plaidHref = `/onboarding/plaid-mock?returnTo=app&savings=${monthlySavings}&projected=${projected30Y}`;

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      {/* 0. MONTHLY PULSE — Show as soon as user connects Plaid */}
      {completedSteps.includes("connect") && <MonthlyPulseCard />}

      {/* 1. HERO — Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
          You&apos;re on track for {formatMoney(projected30Y, true)}
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-400">
          You&apos;re saving {formatMoney(monthlySavings)}/month — strong start
        </p>
      </div>

      {/* 2. NET WORTH — Under header, above Ribbit (expandable) */}
      <NetWorthTile
        projectedWithSteps={projectedWithSteps}
        labels={labels}
        netWorth={netWorth}
        expanded={chartExpanded}
        onToggle={() => setChartExpanded((v) => !v)}
      />

      {/* 3. RIBBIT TILE — Updates based on next step */}
      {(() => {
        const tileKey = nextStep ?? "complete";
        const tile = RIBBIT_TILE[tileKey];
        const tileHref =
          tile.href === "plaid-mock"
            ? plaidHref
            : tile.href === "debts"
              ? `/onboarding/debts?returnTo=app&savings=${monthlySavings}&projected=${projected30Y}`
              : tile.href === "payroll"
                  ? `/onboarding/payroll?returnTo=app&savings=${monthlySavings}&projected=${projected30Y}`
                  : tile.href === "savings-allocation"
                    ? `/onboarding/savings-allocation?savings=${monthlySavings}&projected=${projected30Y}`
                    : "/app/income";
        return (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
              <RibbitIcon size="sm" className="mr-1.5 align-middle" />
              <strong>Ribbit:</strong> {tile.message}
            </p>
            <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
              {tile.subtext}
            </p>
            <Link
              href={tileHref}
              className="block w-full rounded-full border-2 border-primary/30 bg-primary/10 px-4 py-2.5 text-center text-sm font-medium text-slate-800 transition-colors hover:bg-primary/20 hover:border-primary/50 dark:text-slate-100 dark:hover:bg-primary/20"
            >
              {tile.cta}
            </Link>
          </div>
        );
      })()}

      {/* 4. COMBINED TILE — Plan completeness + Next unlock + Make plan smarter (hide when 100%) */}
      {nextStep !== null && (
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          {/* Section 1: Plan completeness */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Plan completeness</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{planPct}% complete</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${planPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              This improves as we learn your real numbers
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              Every step makes your plan more real
            </p>
          </div>

          {/* Section 2: Next unlock */}
          <div className="mb-6 pt-6 border-t border-slate-200 dark:border-slate-600">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              Next: {NEXT_ACTION_LABELS[nextStep]}
            </h2>
            {nextStep === "connect" ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-600 dark:bg-slate-800/50">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
              Unlock your real spending
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              See where your money is going — and what to change this month
            </p>
            <Link href={plaidHref} className={buttonVariants({ size: "lg", className: "w-full" })}>
              Unlock my real numbers →
            </Link>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
              Most users find $200–$500/month they didn&apos;t realize they could save
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Takes ~30 seconds • Secure via Plaid
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Bank-level security. We never move your money.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">You&apos;ll unlock:</p>
              <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                <li>• Where your money is actually going</li>
                <li>• Hidden spending leaks</li>
                <li>• A more accurate version of your plan</li>
              </ul>
            </div>
          </div>
        ) : nextStep ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-600 dark:bg-slate-800/50">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
              {NEXT_UNLOCK_CARD[nextStep].title}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {NEXT_UNLOCK_CARD[nextStep].subtitle}
            </p>
            {NEXT_UNLOCK_CARD[nextStep].href === "debts" ? (
              <Link
                href={`/onboarding/debts?returnTo=app&savings=${monthlySavings}&projected=${projected30Y}`}
                className={buttonVariants({ size: "lg", className: "w-full" })}
              >
                {NEXT_UNLOCK_CARD[nextStep].cta}
              </Link>
            ) : NEXT_UNLOCK_CARD[nextStep].href === "payroll" ? (
              <Link
                href={`/onboarding/payroll?returnTo=app&savings=${monthlySavings}&projected=${projected30Y}`}
                className={buttonVariants({ size: "lg", className: "w-full" })}
              >
                {NEXT_UNLOCK_CARD[nextStep].cta}
              </Link>
            ) : NEXT_UNLOCK_CARD[nextStep].href === "savings-allocation" ? (
              <Link
                href={`/onboarding/savings-allocation?savings=${monthlySavings}&projected=${projected30Y}`}
                className={buttonVariants({ size: "lg", className: "w-full" })}
              >
                {NEXT_UNLOCK_CARD[nextStep].cta}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setRibbitInitialQuestion(`How do I ${NEXT_UNLOCK_CARD[nextStep].title.toLowerCase()}?`);
                  setRibbitOpen(true);
                }}
                className={buttonVariants({ size: "lg", className: "w-full" })}
              >
                {NEXT_UNLOCK_CARD[nextStep].cta}
              </button>
            )}
            {NEXT_UNLOCK_CARD[nextStep].extra && (
              <p className="mt-2 text-center text-xs font-medium text-slate-700 dark:text-slate-300">
                {NEXT_UNLOCK_CARD[nextStep].extra}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-600 dark:bg-slate-800/50">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
              Your first real plan
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              You&apos;ve connected your real numbers. Your plan is now based on actual spending, debts, and cash flow.
            </p>
            <Link href="/app/income" className={buttonVariants({ size: "lg", className: "w-full" })}>
              See your full plan →
            </Link>
          </div>
        )}
          </div>

          {/* Section 3: Make your plan smarter */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-600">
            <button
              type="button"
              onClick={() => setUnlockMoreExpanded((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-left transition-colors hover:bg-slate-100/50 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:bg-slate-700/50"
            >
              <h2 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Make your plan smarter
              </h2>
              {unlockMoreExpanded ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>
            {unlockMoreExpanded && (
              <div className="mt-2 space-y-3">
                {(STEPS as unknown as readonly StepId[]).map((stepId) => {
                  const insight = STEP_INSIGHTS[stepId];
                  const isComplete = completedSteps.includes(stepId);
                  const stepLabels: Record<StepId, { title: string; subtitle: string }> = {
                    connect: { title: "Unlock your real spending", subtitle: "See where your money is actually going" },
                    debts: { title: "Understand your debt impact", subtitle: "See how much interest is costing you" },
                    payroll: { title: "Include payroll savings", subtitle: "Account for 401(k), HSA, and deductions" },
                    "savings-allocation": { title: "Optimize your savings plan", subtitle: "Prioritize where your next dollar should go" },
                  };
                  const labels = stepLabels[stepId];
                  const question = insight.ctaQuestion ?? `How do I ${labels.title.toLowerCase()}?`;

                  if (isComplete) {
                    return (
                      <div
                        key={stepId}
                        className="rounded-lg border border-primary/20 bg-primary/5 p-4 dark:border-primary/30 dark:bg-primary/10"
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{insight.headline}</p>
                        {insight.subtext && (
                          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{insight.subtext}</p>
                        )}
                        <div className="mt-3 rounded-lg border border-slate-200 bg-white/80 p-2.5 dark:border-slate-600 dark:bg-slate-800/80">
                          <p className="text-xs text-slate-700 dark:text-slate-300">
                            <RibbitIcon size="sm" className="mr-1.5 align-middle" />
                            <strong>Ribbit:</strong> {insight.ribbit}
                          </p>
                        </div>
                        {insight.ctaAction === "openChart" ? (
                          <button
                            type="button"
                            onClick={() => setChartExpanded(true)}
                            className="mt-3 text-left text-sm font-medium text-primary hover:underline"
                          >
                            {insight.cta}
                          </button>
                        ) : insight.ctaHref ? (
                          <Link
                            href={insight.ctaHref.startsWith("/onboarding/plaid-mock") ? `${insight.ctaHref}?returnTo=app&savings=${monthlySavings}&projected=${projected30Y}` : insight.ctaHref}
                            className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                          >
                            {insight.cta}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setRibbitInitialQuestion(question);
                              setRibbitOpen(true);
                            }}
                            className="mt-3 text-left text-sm font-medium text-primary hover:underline"
                          >
                            {insight.cta}
                          </button>
                        )}
                      </div>
                    );
                  }

                  const stepHref =
                    stepId === "connect"
                      ? plaidHref
                      : stepId === "debts"
                        ? `/onboarding/debts?returnTo=app&savings=${monthlySavings}&projected=${projected30Y}`
                        : stepId === "payroll"
                            ? `/onboarding/payroll?returnTo=app&savings=${monthlySavings}&projected=${projected30Y}`
                            : stepId === "savings-allocation"
                              ? `/onboarding/savings-allocation?savings=${monthlySavings}&projected=${projected30Y}`
                              : null;
                  return stepHref ? (
                    <Link
                      key={stepId}
                      href={stepHref}
                      className="flex w-full flex-col gap-0.5 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-left transition-colors hover:bg-slate-100/50 dark:border-slate-700/50 dark:bg-slate-800/30 dark:hover:bg-slate-800/50"
                    >
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{labels.title}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-500">{labels.subtitle}</span>
                    </Link>
                  ) : (
                    <button
                      key={stepId}
                      type="button"
                      onClick={() => {
                        setRibbitInitialQuestion(question);
                        setRibbitOpen(true);
                      }}
                      className="flex w-full flex-col gap-0.5 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-left hover:bg-slate-100/50 dark:border-slate-700/50 dark:bg-slate-800/30 dark:hover:bg-slate-800/50"
                    >
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{labels.title}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-500">{labels.subtitle}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Insight popup — connect shows savings card; others show step-specific insight */}
      {insightPopupStep && (() => {
        const MONTHLY_INCOME = 6810;
        const savingsInsight = insightPopupStep === "connect" ? computeSavingsInsight(MONTHLY_INCOME) : null;

        if (insightPopupStep === "connect" && savingsInsight) {
          const adjustPlanHref = `/app/adjust-plan?income=${MONTHLY_INCOME}&targetSavings=${savingsInsight.recommendedSavings}&currentSavings=${savingsInsight.currentSavings}`;
          const closeModal = () => {
            setInsightPopupStep(null);
            router.replace(`/app?savings=${monthlySavings}&projected=${projected30Y}`);
          };
          return (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
              onClick={closeModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="savings-insight-title"
            >
              <div
                className="relative w-full max-w-md rounded-2xl border-2 border-primary/30 bg-white p-6 shadow-2xl dark:border-primary/40 dark:bg-slate-800"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={closeModal}
                  className="absolute right-4 top-4 rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
                <div id="savings-insight-title">
                  <SavingsAdjustmentInsight insight={savingsInsight} adjustPlanHref={adjustPlanHref} />
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="mt-4 w-full py-2 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Got it
                </button>
              </div>
            </div>
          );
        }

        const insight = STEP_INSIGHTS[insightPopupStep];
        const stepLabels: Record<StepId, { title: string }> = {
          connect: { title: "See your real spending" },
          debts: { title: "Understand your debt impact" },
          payroll: { title: "Include payroll savings" },
          "savings-allocation": { title: "Optimize your savings plan" },
        };
        const defaultQuestion = `How do I ${stepLabels[insightPopupStep].title.toLowerCase()}?`;
        const question = insight.ctaQuestion ?? defaultQuestion;
        return (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setInsightPopupStep(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="insight-popup-title"
          >
            <div
              className="relative w-full max-w-md rounded-2xl border-2 border-primary/30 bg-white p-6 shadow-2xl dark:border-primary/40 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setInsightPopupStep(null)}
                className="absolute right-4 top-4 rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              <p id="insight-popup-title" className="pr-8 text-xl font-bold text-slate-900 dark:text-white">
                {insight.headline}
              </p>
              {insight.subtext && (
                <p className="mt-1 text-base text-slate-600 dark:text-slate-400">
                  {insight.subtext}
                </p>
              )}
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-800/80">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  <RibbitIcon size="sm" className="mr-1.5 align-middle" />
                  <strong>Ribbit:</strong> {insight.ribbit}
                </p>
              </div>
              <div className="mt-5 flex flex-col gap-2">
                {insight.ctaAction === "openChart" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setInsightPopupStep(null);
                      setChartExpanded(true);
                    }}
                    className={buttonVariants({ size: "lg", className: "w-full" })}
                  >
                    {insight.cta}
                  </button>
                ) : insight.ctaHref ? (
                  <Link
                    href={insight.ctaHref.startsWith("/onboarding/plaid-mock") ? `${insight.ctaHref}?returnTo=app&savings=${monthlySavings}&projected=${projected30Y}` : insight.ctaHref}
                    onClick={() => setInsightPopupStep(null)}
                    className={buttonVariants({ size: "lg", className: "w-full" })}
                  >
                    {insight.cta}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setInsightPopupStep(null);
                      setRibbitInitialQuestion(question);
                      setRibbitOpen(true);
                    }}
                    className={buttonVariants({ size: "lg", className: "w-full" })}
                  >
                    {insight.cta}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInsightPopupStep(null)}
                  className="w-full py-2 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <RibbitChat
        screenContext={ribbitScreenContext}
        open={ribbitOpen}
        onOpenChange={(o) => {
          setRibbitOpen(o);
          if (!o) setRibbitInitialQuestion(null);
        }}
        initialQuestion={ribbitInitialQuestion}
        onInitialQuestionSent={() => setRibbitInitialQuestion(null)}
        chips={[
          { label: "What should I do next?", question: "What's my most impactful next step?" },
          { label: "Is this realistic?", question: "Is this realistic?" },
          { label: "How do I reach this faster?", question: "How do I reach this faster?" },
        ]}
      />
    </div>
  );
}

export default function AppHomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
