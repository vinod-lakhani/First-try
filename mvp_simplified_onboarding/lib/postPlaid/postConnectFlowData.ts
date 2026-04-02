/**
 * Demo data for the post–bank-connection 3-card flow.
 * In production, estimated take-home and actual deposits would come from
 * income estimates + Plaid cash-flow analysis.
 */

import { estimateMonthlyTakeHome } from "@/lib/income/estimateTakeHome";

export type MomentOfTruthCard = {
  estimatedTakeHome: number;
  actualDeposits: number;
};

export type AllocationRow = {
  label: string;
  actualPct: number;
  status: "on-track" | "above" | "below";
  statusLabel: string;
};

export type VerdictCard = {
  verdictTitle: string;
  verdictIcon: "warning" | "success";
  rows: AllocationRow[];
  summary: string;
};

export type LeapOption = {
  id: string;
  shiftSummary: string;
  today: { savingsPct: number; wantsPct: number };
  after: { savingsPct: number; wantsPct: number };
  yearlyImpactDollars: number;
};

export type LeapCard = {
  options: LeapOption[];
};

export type PostConnectFlowData = {
  momentOfTruth: MomentOfTruthCard;
  verdict: VerdictCard;
  leap: LeapCard;
};

const DEFAULT_ANNUAL_FOR_DEMO = 72_000; // → ~$4,200/mo estimated take-home at ~70% / 12

/** Ratio used when we only have an estimate (matches spec: 4200 → 3650). */
const ACTUAL_TO_ESTIMATED_RATIO = 3650 / 4200;

export function getPostConnectFlowData(annualGross?: number): PostConnectFlowData {
  const annual = annualGross && annualGross > 0 ? annualGross : DEFAULT_ANNUAL_FOR_DEMO;
  const estimatedTakeHome = estimateMonthlyTakeHome(annual);
  const actualDeposits = Math.round(estimatedTakeHome * ACTUAL_TO_ESTIMATED_RATIO);

  return {
    momentOfTruth: {
      estimatedTakeHome,
      actualDeposits,
    },
    verdict: {
      verdictTitle: "Your plan needs a small adjustment",
      verdictIcon: "warning",
      rows: [
        { label: "Needs", actualPct: 52, status: "on-track", statusLabel: "On track" },
        { label: "Wants", actualPct: 38, status: "above", statusLabel: "8% above plan" },
        { label: "Savings", actualPct: 10, status: "below", statusLabel: "10% below plan" },
      ],
      summary:
        "More of your money is going to lifestyle than planned, which is reducing your savings.",
    },
    leap: {
      options: [
        {
          id: "shift-wants-savings",
          shiftSummary: "Shift 3% from Wants → Savings",
          today: { savingsPct: 10, wantsPct: 38 },
          after: { savingsPct: 13, wantsPct: 35 },
          yearlyImpactDollars: 580,
        },
      ],
    },
  };
}
