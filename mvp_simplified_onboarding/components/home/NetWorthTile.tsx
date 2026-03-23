"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import dynamic from "next/dynamic";
import { NET_WORTH_CHIPS, toRibbitChips } from "@/lib/ribbit/chips";

const NetWorthChart = dynamic(
  () => import("@/components/charts/NetWorthChart").then((m) => ({ default: m.NetWorthChart })),
  { ssr: false, loading: () => <div className="h-[220px] w-full animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" /> }
);

function formatMoney(n: number, compact = false) {
  if (compact && n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (compact && n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

type NetWorthTileProps = {
  projectedWithSteps: number;
  labels: string[];
  netWorth: number[];
  /** When provided with expanded, parent controls the state */
  expanded?: boolean;
  onToggle?: () => void;
  onChipClick?: (question: string) => void;
};

const netWorthChips = toRibbitChips(NET_WORTH_CHIPS);

export function NetWorthTile({
  projectedWithSteps,
  labels,
  netWorth,
  expanded: controlledExpanded,
  onToggle,
  onChipClick,
}: NetWorthTileProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isControlled = controlledExpanded !== undefined && onToggle;
  const expanded = isControlled ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    if (isControlled) {
      onToggle?.();
    } else {
      setInternalExpanded((v) => !v);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-slate-700 dark:bg-slate-800">
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-5 pt-5 mb-0">
        NET WORTH
      </h2>
      <button
        type="button"
        onClick={handleToggle}
        className="w-full cursor-pointer p-5 text-left transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-700/30"
      >
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
          Projected net worth
        </p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">
          {formatMoney(projectedWithSteps, true)}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Based on assumptions — your actual spending will change this
        </p>
        <p className="text-xs text-primary mt-2 font-medium flex items-center gap-1">
          {expanded ? "Hide chart" : "Show Chart"}
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </p>
      </button>
      {expanded && (
        <div className="px-5 pb-5 pt-4 border-t border-slate-200 dark:border-slate-600" style={{ minHeight: 240 }}>
          <NetWorthChart labels={labels} netWorth={netWorth} height={220} />
          {onChipClick && netWorthChips.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {netWorthChips.map((chip) => (
                <button
                  key={chip.question}
                  type="button"
                  onClick={() => onChipClick(chip.question)}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
