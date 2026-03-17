"use client";

import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { RibbitChat } from "@/components/onboarding/RibbitChat";
import type { PlanScreenContext } from "@/lib/ribbit/types";
import { projectNetWorth } from "@/lib/sim/projectNetWorth";
import { X } from "lucide-react";

const NetWorthChart = dynamic(
  () => import("@/components/charts/NetWorthChart").then((m) => ({ default: m.NetWorthChart })),
  { ssr: false, loading: () => <div className="h-[280px] w-full animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" /> }
);

function formatMoney(n: number, compact = false) {
  if (compact && n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (compact && n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}


function HomeContent() {
  const searchParams = useSearchParams();
  const savingsParam = searchParams.get("savings");
  const projectedParam = searchParams.get("projected");
  const monthlySavings = savingsParam ? parseFloat(savingsParam) || 1362 : 1362;
  const projected30Y = projectedParam ? parseFloat(projectedParam) || 2000000 : 2000000;
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [ribbitOpen, setRibbitOpen] = useState(false);
  const [ribbitInitialQuestion, setRibbitInitialQuestion] = useState<string | null>(null);

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

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      {/* 1. HERO — USER WIN */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
          You&apos;re on track for {formatMoney(projected30Y, true)}
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-400 mb-4">
          You&apos;re saving {formatMoney(monthlySavings)}/month — strong start
        </p>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
            <span className="mr-1" aria-hidden>🐸</span>
            <strong>Ribbit:</strong> You&apos;re off to a strong start — but this plan is still based on estimates.
            <br />
            Want to see what&apos;s actually happening with your money?
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Am I overspending right now?", question: "Am I overspending right now?" },
              { label: "How much could I actually be saving?", question: "How much could I actually be saving?" },
              { label: `What would change in my ${formatMoney(projected30Y, true)} plan?`, question: "What would change in my plan?" },
              { label: "Where is my money going each month?", question: "Where is my money going each month?" },
            ].map((chip) => (
              <button
                key={chip.question}
                type="button"
                onClick={() => {
                  setRibbitInitialQuestion(chip.question);
                  setRibbitOpen(true);
                }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {chip.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            People like you often overspend $200–$400/month without realizing it
          </p>
        </div>

        {/* Plan Progress */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Plan strength</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">40% complete · Starter</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: "40%" }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Add more data to unlock better moves
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
            Every step makes your plan more real
          </p>
        </div>
      </div>

      {/* 2. NEXT UNLOCK */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          NEXT UNLOCK
        </h2>
        <div className="rounded-xl border-2 border-primary/20 bg-white p-5 dark:border-primary/30 dark:bg-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
            Unlock your real spending
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Find out if you&apos;re overspending — and what to fix immediately
          </p>
          <Link
            href="/onboarding/connect"
            className={buttonVariants({ size: "lg", className: "w-full" })}
          >
            Unlock my real numbers →
          </Link>
          <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
            Takes ~30 seconds • Secure via Plaid
          </p>
          <p className="mt-1 text-center text-[11px] text-slate-500 dark:text-slate-400">
            <span aria-hidden>🔒</span> Bank-level security. We never move your money.
          </p>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-600 dark:bg-slate-800/50">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              You&apos;ll unlock:
            </p>
            <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
              <li>• Where your money is actually going</li>
              <li>• Hidden spending leaks</li>
              <li>• A more accurate version of your plan</li>
            </ul>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <span className="mr-1" aria-hidden>🐸</span>
            <strong>Ribbit:</strong> Most people think they&apos;re saving enough — until they see their real numbers.
          </p>
        </div>
      </div>

      {/* 3. NET WORTH */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          NET WORTH
        </h2>
        <button
          type="button"
          onClick={() => setChartModalOpen(true)}
          className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-5 text-left transition-all hover:shadow-md hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
            Projected net worth
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatMoney(projected30Y, true)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Still based on estimates — your real numbers could change this
          </p>
          <p className="text-xs text-primary mt-2 font-medium">
            See what could change this →
          </p>
        </button>
      </div>

      {/* Net Worth Chart Modal */}
      {chartModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setChartModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Net worth projection chart"
        >
          <div
            className="relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Projected net worth
              </h3>
              <button
                type="button"
                onClick={() => setChartModalOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NetWorthChart labels={labels} netWorth={netWorth} height={280} />
          </div>
        </div>
      )}

      {/* 4. UNLOCK MORE */}
      <div className="mb-8">
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          The more you unlock, the better Ribbit gets at telling you what to do next.
        </p>
        <h2 className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
          Unlock more
        </h2>
        <div className="space-y-1.5">
          {[
            { title: "Unlock your real spending", subtitle: "See where your money actually goes", tag: "+20% plan strength", action: "connect" as const, question: "How do I see where my money is actually going?" },
            { title: "Unlock debt impact", subtitle: "See how much interest is costing you", tag: "high value", action: "ribbit" as const, question: "How much is interest costing me? How do I add my debts?" },
            { title: "Unlock cash flow", subtitle: "See what you really have left each month", tag: "+clarity", action: "ribbit" as const, question: "How do I see my real cash flow each month?" },
            { title: "Unlock real net worth", subtitle: "Replace estimates with actual balances", tag: "+confidence", action: "ribbit" as const, question: "How do I see my real net worth instead of estimates?" },
            { title: "Unlock payroll savings", subtitle: "Account for 401(k), HSA, and deductions", tag: "+precision", action: "ribbit" as const, question: "How do I account for my 401(k) and HSA in my plan?" },
          ].map((item) => (
            item.action === "connect" ? (
              <Link
                key={item.title}
                href="/onboarding/connect"
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-left transition-colors hover:bg-slate-100/50 dark:border-slate-700/50 dark:bg-slate-800/30 dark:hover:bg-slate-800/50"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {item.title}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-500">
                    {item.subtitle}
                  </span>
                </div>
                <span className="shrink-0 text-[10px] font-medium text-primary">
                  {item.tag}
                </span>
              </Link>
            ) : (
              <button
                key={item.title}
                type="button"
                onClick={() => {
                  setRibbitInitialQuestion(item.question);
                  setRibbitOpen(true);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-left hover:bg-slate-100/50 dark:border-slate-700/50 dark:bg-slate-800/30 dark:hover:bg-slate-800/50"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {item.title}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-500">
                    {item.subtitle}
                  </span>
                </div>
                <span className="shrink-0 text-[10px] font-medium text-primary">
                  {item.tag}
                </span>
              </button>
            )
          ))}
        </div>
      </div>

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
