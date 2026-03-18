"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPercent(n: number) {
  return `${Math.round(n)}%`;
}

// Mock data - 50/30/20 allocation
const MOCK_MONTHLY_INCOME = 6810;
const MOCK_NEEDS = 3405;
const MOCK_WANTS = 2043;
const MOCK_SAVINGS = 1362;
const MOCK_NEEDS_BREAKDOWN = [
  { label: "Rent", amount: 1850 },
  { label: "Utilities", amount: 320 },
  { label: "Groceries", amount: 580 },
  { label: "Transportation", amount: 420 },
  { label: "Debt Minimums", amount: 235 },
];
const MOCK_WANTS_BREAKDOWN = [
  { label: "Entertainment", amount: 420 },
  { label: "Dining Out", amount: 380 },
  { label: "Shopping", amount: 350 },
  { label: "Subscriptions", amount: 250 },
];
const MOCK_SAVINGS_BREAKDOWN = [
  { label: "Emergency Fund", amount: 450 },
  { label: "401(k)", amount: 350 },
  { label: "Brokerage", amount: 362 },
];

export function MonthlyPulseCard() {
  const [savingsExpanded, setSavingsExpanded] = useState(false);

  const needsPct = (MOCK_NEEDS / MOCK_MONTHLY_INCOME) * 100;
  const wantsPct = (MOCK_WANTS / MOCK_MONTHLY_INCOME) * 100;
  const savingsPct = (MOCK_SAVINGS / MOCK_MONTHLY_INCOME) * 100;

  const savingsDelta = MOCK_SAVINGS - (0.2 * MOCK_MONTHLY_INCOME);
  const pulseHeadline =
    savingsDelta >= 0
      ? `You're on track this month: +${formatCurrency(Math.abs(savingsDelta))} vs your savings plan.`
      : `You're behind by ${formatCurrency(Math.abs(savingsDelta))} on your savings this month.`;

  return (
    <Card className="mb-8 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader>
        <CardTitle className="text-xl">Monthly Pulse</CardTitle>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Your income allocation this month
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="font-medium text-slate-900 dark:text-white">{pulseHeadline}</p>

        {/* N/W/S bars */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-600 dark:text-slate-400">Needs</span>
              <span className="font-medium">
                {formatPercent(needsPct)} ({formatCurrency(MOCK_NEEDS)})
              </span>
            </div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all"
                style={{ width: `${needsPct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Target: 50%</p>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-600 dark:text-slate-400">Wants</span>
              <span className="font-medium">
                {formatPercent(wantsPct)} ({formatCurrency(MOCK_WANTS)})
              </span>
            </div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${wantsPct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Target: 30%</p>
          </div>

          <div>
            <button
              onClick={() => setSavingsExpanded(!savingsExpanded)}
              className="w-full text-left"
            >
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600 dark:text-slate-400">Savings</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {formatPercent(savingsPct)} ({formatCurrency(MOCK_SAVINGS)})
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
                  style={{ width: `${savingsPct}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Target: 20%</p>
            </button>
            {savingsExpanded && (
              <div className="mt-3 space-y-2 pl-2 border-l-2 border-green-200 dark:border-green-800">
                {MOCK_SAVINGS_BREAKDOWN.map((item) => (
                  <div key={item.label} className="flex justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">{item.label}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <Link
          href="/app/income"
          className="block text-center text-sm font-medium text-primary hover:underline"
        >
          See full breakdown →
        </Link>
      </CardContent>
    </Card>
  );
}
