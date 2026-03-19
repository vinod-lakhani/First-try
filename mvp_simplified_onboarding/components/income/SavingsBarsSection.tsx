"use client";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

type Item = { label: string; amount: number };

type SavingsBarsSectionProps = {
  totalSavings: number;
  preTaxItems: Item[];
  postTaxItems: Item[];
};

const PRE_TAX_SHADES = ["bg-emerald-300", "bg-emerald-400", "bg-emerald-500", "bg-emerald-600"];
const POST_TAX_SHADES = ["bg-green-300", "bg-green-400", "bg-green-500", "bg-green-600", "bg-green-700"];
const TOTAL_SHADES = ["bg-emerald-500", "bg-green-500"]; // Pre-tax | Post-tax

function BarBlock({
  title,
  items,
  shadePalette,
  total,
}: {
  title: string;
  items: Item[];
  shadePalette: readonly string[];
  total: number;
}) {
  const sorted = [...items].sort((a, b) => b.amount - a.amount);
  const itemsSum = sorted.reduce((s, i) => s + i.amount, 0);
  const largestLabel = sorted[0]?.label;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {title}: {formatCurrency(total)}
      </p>
      <div className="flex h-6 min-h-6 shrink-0 w-full overflow-hidden rounded-md">
        {sorted.map((item, idx) => {
          const pct = itemsSum > 0 ? (item.amount / itemsSum) * 100 : 0;
          const shadeClass = shadePalette[idx % shadePalette.length];
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
      <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
        {sorted.map((item, idx) => {
          const dotClass = shadePalette[idx % shadePalette.length];
          return (
            <li key={item.label} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0">
                <span className={`shrink-0 w-2 h-2 rounded-full ${dotClass}`} aria-hidden />
                <span className={item.label === largestLabel ? "font-medium text-slate-700 dark:text-slate-300" : ""}>
                  {item.label}
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

export function SavingsBarsSection({
  totalSavings,
  preTaxItems,
  postTaxItems,
}: SavingsBarsSectionProps) {
  const preTaxTotal = preTaxItems.reduce((s, i) => s + i.amount, 0);
  const postTaxTotal = postTaxItems.reduce((s, i) => s + i.amount, 0);

  const totalBarItems: Item[] = [
    { label: "Pre-tax", amount: preTaxTotal },
    { label: "Post-tax", amount: postTaxTotal },
  ].filter((i) => i.amount > 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Total savings: {formatCurrency(totalSavings)}
        </p>
      </div>

      {/* Bar 1: Total (Pre-tax + Post-tax) */}
      {totalBarItems.length > 0 && (
        <BarBlock
          title="Total (Pre-tax + Post-tax)"
          items={totalBarItems}
          shadePalette={TOTAL_SHADES}
          total={totalSavings}
        />
      )}

      {/* Bar 2: Pre-tax */}
      {preTaxItems.length > 0 && (
        <BarBlock
          title="Pre-tax"
          items={preTaxItems}
          shadePalette={PRE_TAX_SHADES}
          total={preTaxTotal}
        />
      )}

      {/* Bar 3: Post-tax */}
      {postTaxItems.length > 0 && (
        <BarBlock
          title="Post-tax"
          items={postTaxItems}
          shadePalette={POST_TAX_SHADES}
          total={postTaxTotal}
        />
      )}
    </div>
  );
}
