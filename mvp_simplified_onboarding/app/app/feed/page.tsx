"use client";

import { Suspense, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Trophy,
  AlertTriangle,
  Sparkles,
  Settings,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { LeapCard } from "@/components/feed/LeapCard";
import { RibbitIcon } from "@/components/onboarding/RibbitIcon";
import { FeedSection } from "@/components/feed/FeedSection";
import { RibbitChat } from "@/components/onboarding/RibbitChat";
import type { PlanScreenContext } from "@/lib/ribbit/types";
import { projectNetWorth } from "@/lib/sim/projectNetWorth";

type LeapData = {
  id: string;
  heading: string;
  headline: string;
  impactLine?: string;
  body: string;
  primaryHref: string;
  primaryCta: string;
  secondaryCta?: string;
  chips: { label: string; question: string }[];
};

const LEAPS_DATA: Omit<LeapData, "primaryHref">[] = [
  {
    id: "confirm-plan",
    heading: "Confirm Your Plan",
    headline: "Let's lock in your starting plan",
    impactLine: "Gives you a clear path forward",
    body: "I've created a plan based on your income and spending. Review it so I can guide you with the right next moves.",
    primaryCta: "Review my plan",
    secondaryCta: "Not now",
    chips: [],
  },
  {
    id: "connect-accounts",
    heading: "Make Your Sidekick Automatic",
    headline: "Make me smarter with your accounts",
    impactLine: "Unlocks personalized recommendations",
    body: "Right now I'm guessing. Connect your accounts so I can see your real income, spending, and balances.",
    primaryCta: "Connect accounts",
    chips: [
      { label: "How does this work?", question: "How does connecting my accounts work? What do you see?" },
      { label: "Is it secure?", question: "Is connecting my bank accounts secure?" },
    ],
  },
  {
    id: "emergency-fund",
    heading: "Start Emergency Fund",
    headline: "Start your safety buffer",
    impactLine: "Avoid stress when life hits",
    body: "You don't have an emergency fund yet. Even $25/week gets you protected faster than you think.",
    primaryCta: "Start my fund",
    chips: [
      { label: "Why do I need this?", question: "Why do I need an emergency fund?" },
      { label: "How much should I save?", question: "How much should I have in my emergency fund?" },
    ],
  },
  {
    id: "optimize-paycheck",
    heading: "Optimize Your Next Paycheck",
    headline: "Make your next paycheck work harder",
    impactLine: "+$X/year with better allocation",
    body: "A small shift in how you split your paycheck can increase your savings without changing your lifestyle.",
    primaryCta: "Optimize my paycheck",
    chips: [
      { label: "What would change?", question: "What would change if I optimize my paycheck allocation?" },
      { label: "How much could I save?", question: "How much could I save with better paycheck allocation?" },
    ],
  },
  {
    id: "debt-interest",
    heading: "See How Much Interest You're Losing",
    headline: "You're losing money to interest",
    impactLine: "Save $X by fixing this",
    body: "High-interest debt is quietly draining your future. Let's map it and find the fastest way out.",
    primaryCta: "Analyze my debt",
    chips: [
      { label: "How much am I losing?", question: "How much am I losing to interest each month?" },
      { label: "What's the fastest way out?", question: "What's the fastest way to pay off my debt?" },
    ],
  },
];

const LEAP_HREFS: Record<string, (p: { savings: string; projected: string }) => string> = {
  "confirm-plan": () => "/app/income",
  "connect-accounts": (p) => `/onboarding/plaid-mock?returnTo=app&savings=${p.savings}&projected=${p.projected}`,
  "emergency-fund": (p) => `/onboarding/savings-allocation?savings=${p.savings}&projected=${p.projected}`,
  "optimize-paycheck": (p) => `/onboarding/payroll?returnTo=app&savings=${p.savings}&projected=${p.projected}`,
  "debt-interest": (p) => `/onboarding/debts?returnTo=app&savings=${p.savings}&projected=${p.projected}`,
};

function getLeaps(savingsParam: string, projectedParam: string): LeapData[] {
  const params = { savings: savingsParam, projected: projectedParam };
  return LEAPS_DATA.map((l) => ({
    ...l,
    primaryHref: LEAP_HREFS[l.id]?.(params) ?? "#",
  }));
}

const WINS = [
  "Employer match fully captured in 401k",
  "No liabilities",
];

const CLARITY_ITEMS = [
  { title: "Income Plan Updated", subtext: "Income Plan Updated on Mar 19, 2026" },
];

const SIDEKICK_INSIGHTS = [
  "Why an emergency fund gives you freedom, not fear",
  "Why starting retirement savings early beats saving more later",
  "How Needs vs Wants helps you improve — without cutting joy",
  "How your 401(k) and employer match turn into free money",
];

function FeedContent() {
  const searchParams = useSearchParams();
  const savingsParam = searchParams.get("savings") || "1362";
  const projectedParam = searchParams.get("projected") || "2000000";
  const [ribbitOpen, setRibbitOpen] = useState(false);
  const [ribbitInitialQuestion, setRibbitInitialQuestion] = useState<string | null>(null);
  const [leapsExpanded, setLeapsExpanded] = useState(false);
  const [clarityExpanded, setClarityExpanded] = useState(false);
  const [insightExpanded, setInsightExpanded] = useState<number | null>(null);
  const [dismissedLeaps, setDismissedLeaps] = useState<Set<string>>(new Set());

  const monthlySavings = parseFloat(savingsParam) || 1362;
  const projected30Y = parseFloat(projectedParam) || 2000000;
  const { netWorth } = projectNetWorth(monthlySavings, 30, 8);

  const ribbitScreenContext: PlanScreenContext = useMemo(
    () => ({
      screen: "plan",
      onboardingStage: "plan",
      hasLinkedAccounts: false,
      source: "estimated_from_income",
      monthlySavings,
      projectedNetWorth30Y: projected30Y,
      horizonYears: 30,
      milestones: {
        oneYear: netWorth[1] ?? 0,
        fiveYears: netWorth[5] ?? 0,
        tenYears: netWorth[10] ?? 0,
      },
      projectionAssumptionsLabel: "steady monthly saving and long-term market growth",
    }),
    [monthlySavings, projected30Y, netWorth]
  );

  const leaps = useMemo(() => getLeaps(savingsParam, projectedParam), [savingsParam, projectedParam]);
  const visibleLeaps = leapsExpanded ? leaps : leaps.slice(0, 1);
  const hiddenLeapsCount = leaps.length - 1;
  const visibleLeapsFiltered = visibleLeaps.filter((l) => !dismissedLeaps.has(l.id));

  const handleChipClick = (question: string) => {
    setRibbitInitialQuestion(question);
    setRibbitOpen(true);
  };

  const handleDismissLeap = (id: string) => {
    setDismissedLeaps((prev) => new Set(prev).add(id));
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-6 space-y-6">
      {/* 1. Wins */}
      <FeedSection
        title="Wins"
        icon={<Trophy className="h-5 w-5 text-amber-500 dark:text-amber-400" />}
      >
        <ul className="space-y-2">
          {WINS.map((win) => (
            <li
              key={win}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800"
            >
              <Trophy className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
              <span className="text-sm text-slate-700 dark:text-slate-300">{win}</span>
            </li>
          ))}
        </ul>
      </FeedSection>

      {/* 2. Next Leaps */}
      <FeedSection
        title="Next Leaps"
        icon={<RibbitIcon size="sm" />}
        showMoreLabel={leapsExpanded ? "▲ Show less" : `▼ Show ${hiddenLeapsCount} more`}
        onShowMore={() => setLeapsExpanded((v) => !v)}
      >
        <div className="space-y-4">
          {visibleLeapsFiltered.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
              No leaps right now. Great job!
            </p>
          ) : (
            visibleLeapsFiltered.map((leap) => (
              <LeapCard
                key={leap.id}
                heading={leap.heading}
                headline={leap.headline}
                impactLine={leap.impactLine}
                body={leap.body}
                primaryHref={leap.primaryHref}
                primaryCta={leap.primaryCta}
                secondaryCta={leap.secondaryCta}
                secondaryOnClick={leap.secondaryCta ? () => {} : undefined}
                chips={leap.chips}
                onChipClick={handleChipClick}
                onComplete={() => {}}
                onSnooze={() => {}}
                onDismiss={() => handleDismissLeap(leap.id)}
                showActionChips={leap.id !== "confirm-plan"}
              />
            ))
          )}
        </div>
      </FeedSection>

      {/* 3. Risk Alerts */}
      <FeedSection
        title="Risk Alerts"
        icon={<AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400" />}
      >
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
          No risk alerts
        </p>
      </FeedSection>

      {/* 4. Clarity Notifications */}
      <FeedSection
        title="Clarity Notifications"
        icon={<Sparkles className="h-5 w-5 text-violet-500 dark:text-violet-400" />}
        showMoreLabel={clarityExpanded ? "▲ Show less" : "▼ Show 2 more"}
        onShowMore={() => setClarityExpanded((v) => !v)}
      >
        <ul className="space-y-2">
          {CLARITY_ITEMS.map((item) => (
            <li
              key={item.title}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-violet-500 dark:text-violet-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{item.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.subtext}</p>
              </div>
            </li>
          ))}
        </ul>
      </FeedSection>

      {/* 5. Sidekick Insights */}
      <FeedSection
        title="Sidekick Insights"
        icon={<Settings className="h-5 w-5 text-slate-600 dark:text-slate-400" />}
      >
        <ul className="space-y-2">
          {SIDEKICK_INSIGHTS.map((insight, idx) => (
            <li key={idx}>
              <button
                type="button"
                onClick={() => setInsightExpanded(insightExpanded === idx ? null : idx)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Settings className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                    {insight}
                  </span>
                </div>
                {insightExpanded === idx ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                )}
              </button>
              {insightExpanded === idx && (
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Tap &quot;Ask Ribbit&quot; to learn more about this topic.
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </FeedSection>

      <RibbitChat
        screenContext={ribbitScreenContext}
        chips={[]}
        open={ribbitOpen}
        onOpenChange={setRibbitOpen}
        initialQuestion={ribbitInitialQuestion}
        onInitialQuestionSent={() => setRibbitInitialQuestion(null)}
      />
    </div>
  );
}

export default function FeedTabPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-xl px-4 py-8 animate-pulse text-slate-500">Loading...</div>}>
      <FeedContent />
    </Suspense>
  );
}
