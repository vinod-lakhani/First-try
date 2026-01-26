/**
 * Rounding utilities for financial calculations
 */

/**
 * Round to nearest multiple of a given number
 * @param value The value to round
 * @param multiple The multiple to round to (e.g., 10, 25, 100)
 */
export function roundToNearest(value: number, multiple: number): number {
  return Math.round(value / multiple) * multiple;
}

/**
 * Round to nearest $10
 */
export function roundToNearest10(value: number): number {
  return roundToNearest(value, 10);
}

/**
 * Round to nearest $25
 */
export function roundToNearest25(value: number): number {
  return roundToNearest(value, 25);
}

/**
 * Round to nearest $100
 */
export function roundToNearest100(value: number): number {
  return roundToNearest(value, 100);
}

/**
 * Format currency with commas and $ sign
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format currency for display in ranges (e.g., "$1,300–$1,450")
 */
export function formatCurrencyRange(low: number, high: number): string {
  return `${formatCurrency(low)}–${formatCurrency(high)}`;
}
