/**
 * Rent calculation utilities
 * Based on the 28-35% rule of take-home pay
 */

import { roundToNearest25, formatCurrencyRange } from './rounding';

export interface RentRange {
  low: number;
  high: number;
  formatted: string;
}

/**
 * Calculate safe rent range based on monthly take-home pay
 * 
 * Formula:
 * - Base = takeHomeMonthly - debtMonthly (minimum 0)
 * - Low = 28% of Base
 * - High = 35% of Base
 * - Both rounded to nearest $25
 * 
 * @param takeHomeMonthly Monthly take-home pay after taxes
 * @param debtMonthly Optional monthly debt payments
 */
export function calculateRentRange(
  takeHomeMonthly: number,
  debtMonthly: number = 0
): RentRange {
  // Base is take-home minus debt, clamped to minimum 0
  const base = Math.max(0, takeHomeMonthly - debtMonthly);
  
  // Calculate percentages
  const lowRaw = base * 0.28;
  const highRaw = base * 0.35;
  
  // Round to nearest $25
  const low = roundToNearest25(lowRaw);
  const high = roundToNearest25(highRaw);
  
  // Format for display
  const formatted = formatCurrencyRange(low, high);
  
  return {
    low,
    high,
    formatted,
  };
}

/**
 * Calculate needs/wants/savings breakdown
 * Based on 50/30/20 rule
 */
export interface BudgetBreakdown {
  needs: number;
  wants: number;
  savings: number;
}

/**
 * Calculate monthly budget breakdown using 50/30/20 rule
 * All values rounded to nearest $10
 */
export function calculateBudgetBreakdown(
  takeHomeMonthly: number
): BudgetBreakdown {
  const needs = Math.round(takeHomeMonthly * 0.5 / 10) * 10;
  const wants = Math.round(takeHomeMonthly * 0.3 / 10) * 10;
  const savings = takeHomeMonthly - needs - wants; // Remainder to ensure total adds up
  
  return {
    needs,
    wants,
    savings,
  };
}
