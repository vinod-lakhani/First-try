"use client";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

type Item = { label: string; amount: number };

type SectionType = "needs" | "wants" | "savings";

const CHIPS = {
  dominance: [
    { label: "Why is this high?", question: "Why is this category so high relative to my spending?" },
    { label: "What can I realistically change?", question: "What can I realistically change about this spending?" },
    { label: "Is this a problem?", question: "Is this a problem for my finances?" },
  ],
  imbalanceLow: [
    { label: "How far off am I?", question: "How far off is my savings rate from recommended levels?" },
    { label: "What should I aim for?", question: "What savings rate should I aim for?" },
    { label: "How do I increase it?", question: "How do I increase my savings rate?" },
  ],
  imbalanceHealthy: [
    { label: "Can I save more?", question: "Can I save more than I currently am?" },
    { label: "Should I invest instead?", question: "Should I invest instead of keeping cash?" },
    { label: "What does this enable?", question: "What does this savings rate enable for me long-term?" },
  ],
  leak: [
    { label: "What counts as subscriptions?", question: "What counts as subscriptions in my spending?" },
    { label: "Is this too high?", question: "Is my subscription spending too high?" },
    { label: "Where can I cut?", question: "Where can I cut my subscription spending?" },
  ],
} as const;

type Insight = {
  icon: "⚠️" | "💡";
  text: string;
  actionHint: string;
  chips: { label: string; question: string }[];
};

function getInsight(
  sectionType: SectionType,
  total: number,
  items: Item[],
  totalIncome: number
): Insight | null {
  // Priority: Dominance > Imbalance (Savings) > Leak. One insight max.

  // Dominance: category > 50% of section total (Needs/Wants only)
  if (sectionType === "needs" || sectionType === "wants") {
    const sectionLabel = sectionType === "needs" ? "essential" : "discretionary";
    for (const item of items) {
      if (total > 0 && item.amount / total > 0.5) {
        const actionHint =
          item.label === "Rent"
            ? `Consider targeting <${formatCurrency(Math.round(totalIncome * 0.3))} rent to improve flexibility`
            : "Consider if you can reduce this share of your budget";
        return {
          icon: "⚠️",
          text: `${item.label} makes up over half of your ${sectionLabel} spending`,
          actionHint,
          chips: [...CHIPS.dominance],
        };
      }
    }
  }

  // Imbalance (Savings): < 10% warning, >= 15% positive
  if (sectionType === "savings" && totalIncome > 0) {
    const savingsRate = total / totalIncome;
    const savingsPct = Math.round(savingsRate * 100);
    if (savingsRate < 0.1) {
      return {
        icon: "⚠️",
        text: "Your savings rate is below recommended levels",
        actionHint: "Redirect a portion of discretionary spending toward savings",
        chips: [...CHIPS.imbalanceLow],
      };
    }
    if (savingsRate >= 0.15) {
      return {
        icon: "💡",
        text: `You're saving ${savingsPct}% of your income — strong position`,
        actionHint: "Consider increasing emergency fund or investment contributions",
        chips: [...CHIPS.imbalanceHealthy],
      };
    }
  }

  // Leak: subscriptions > threshold (Wants only)
  const subscriptions = items.find((i) => i.label === "Subscriptions");
  const SUBSCRIPTIONS_LEAK_THRESHOLD = 100;
  if (sectionType === "wants" && subscriptions && subscriptions.amount > SUBSCRIPTIONS_LEAK_THRESHOLD) {
    return {
      icon: "💡",
      text: `You're spending ${formatCurrency(subscriptions.amount)}/month on subscriptions`,
      actionHint: "Review and cancel unused subscriptions",
      chips: [...CHIPS.leak],
    };
  }

  return null;
}

function getInsights(
  sectionType: SectionType,
  total: number,
  items: Item[],
  totalIncome: number
): Insight[] {
  const insight = getInsight(sectionType, total, items, totalIncome);
  return insight ? [insight] : [];
}

const SHADE_PALETTES = {
  orange: ["bg-orange-300", "bg-orange-400", "bg-orange-500", "bg-orange-600", "bg-orange-700"],
  blue: ["bg-blue-300", "bg-blue-400", "bg-blue-500", "bg-blue-600"],
  green: ["bg-green-300", "bg-green-400", "bg-green-500", "bg-green-600"],
} as const;

const DOT_PALETTES = {
  orange: ["bg-orange-300", "bg-orange-400", "bg-orange-500", "bg-orange-600", "bg-orange-700"],
  blue: ["bg-blue-300", "bg-blue-400", "bg-blue-500", "bg-blue-600"],
  green: ["bg-green-300", "bg-green-400", "bg-green-500", "bg-green-600"],
} as const;

type ColorTheme = keyof typeof SHADE_PALETTES;

type DistributionSectionProps = {
  title: string;
  total: number;
  items: Item[];
  colorTheme: ColorTheme;
  sectionType: SectionType;
  totalIncome: number;
  /** Called when user taps a Ribbit chip — opens Ribbit with that question */
  onChipClick?: (question: string) => void;
};

export function DistributionSection({
  title,
  total,
  items,
  colorTheme,
  sectionType,
  totalIncome,
  onChipClick,
}: DistributionSectionProps) {
  const sorted = [...items].sort((a, b) => b.amount - a.amount);
  const itemsSum = sorted.reduce((s, i) => s + i.amount, 0);
  const largestLabel = sorted[0]?.label;
  const stripShades = SHADE_PALETTES[colorTheme];
  const dotShades = DOT_PALETTES[colorTheme];
  const insight = getInsights(sectionType, total, items, totalIncome)[0] ?? null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Total: {formatCurrency(total)}
        </p>
      </div>

      {/* What stands out — one insight + action hint + Ribbit chips */}
      {insight && (
        <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 flex items-start gap-2">
            <span className="shrink-0" aria-hidden>{insight.icon}</span>
            <span>{insight.text}</span>
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 pl-6">
            → {insight.actionHint}
          </p>
          {onChipClick && insight.chips.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {insight.chips.map((chip) => (
                <button
                  key={chip.question}
                  type="button"
                  onClick={() => onChipClick(chip.question)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Horizontal stacked strip — proportional segments, color-coded by subcategory. Always fills 100% width. */}
      <div className="flex h-8 min-h-8 shrink-0 w-full overflow-hidden rounded-md">
        {sorted.map((item, idx) => {
          const pct = itemsSum > 0 ? (item.amount / itemsSum) * 100 : 0;
          const shadeClass = stripShades[idx % stripShades.length];
          return (
            <div
              key={item.label}
              className={`${shadeClass} min-w-0 ${idx < sorted.length - 1 ? "border-r border-white/40" : ""}`}
              style={{ width: `${pct}%` }}
              title={`${item.label}: ${formatCurrency(item.amount)}`}
            />
          );
        })}
      </div>

      {/* Category list — secondary, clean */}
      <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
        {sorted.map((item, idx) => {
          const dotClass = dotShades[idx % dotShades.length];
          return (
            <li
              key={item.label}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className={`shrink-0 w-2 h-2 rounded-full ${dotClass}`}
                  aria-hidden
                />
                <span className={item.label === largestLabel ? "font-medium text-slate-700 dark:text-slate-300" : ""}>
                  {item.label}
                  {item.label === largestLabel && (
                    <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">
                      largest
                    </span>
                  )}
                </span>
              </span>
              <span className="shrink-0">{formatCurrency(item.amount)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
