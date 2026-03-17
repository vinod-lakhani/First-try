/**
 * Simple net worth projection
 * FV of annuity: monthly savings + compound growth over time
 * Returns yearly data points with "Year 0", "Year 5", "Year 10", etc. labels
 */

export function projectNetWorth(
  monthlySavings: number,
  years: number = 30,
  annualReturnPct: number = 7.5
): { labels: string[]; netWorth: number[] } {
  const monthlyRate = annualReturnPct / 100 / 12;
  const labels: string[] = [];
  const netWorth: number[] = [];
  let nw = 0;

  const yearInterval = years <= 10 ? 2 : 5;
  for (let y = 0; y <= years; y++) {
    const label = y === 0 ? "Year 0" : y % yearInterval === 0 ? `Year ${y}` : "";
    labels.push(label);
    netWorth.push(Math.round(nw));
    for (let m = 0; m < 12; m++) {
      nw = nw * (1 + monthlyRate) + monthlySavings;
    }
  }

  return { labels, netWorth };
}
