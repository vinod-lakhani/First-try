/**
 * Simple net worth projection
 * FV of annuity: monthly savings + compound growth over time
 */

export function projectNetWorth(
  monthlySavings: number,
  years: number = 30,
  annualReturnPct: number = 7.5
): { labels: string[]; netWorth: number[] } {
  const months = years * 12;
  const monthlyRate = annualReturnPct / 100 / 12;
  const labels: string[] = [];
  const netWorth: number[] = [];
  let nw = 0;

  const start = new Date();
  for (let i = 0; i <= months; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    labels.push(d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }));
    netWorth.push(Math.round(nw));
    nw = nw * (1 + monthlyRate) + monthlySavings;
  }

  return { labels, netWorth };
}
