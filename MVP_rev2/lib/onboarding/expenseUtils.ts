/**
 * Expense Utilities
 * 
 * Ensures all expenses are stored as monthly amounts (single source of truth).
 * All expenses should have frequency: 'monthly' and amount$ in monthly terms.
 */

import type { FixedExpense } from './types';

/**
 * Converts an expense amount to monthly based on frequency
 */
function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly':
      return amount * 4.33;
    case 'biweekly':
      return amount * 2.17;
    case 'semimonthly':
      return amount * 2;
    case 'yearly':
      return amount / 12;
    case 'monthly':
      return amount;
    default:
      return amount; // Default to monthly if unknown
  }
}

/**
 * Normalizes a single expense to monthly format
 * This ensures all expenses in the store are monthly (single source of truth)
 */
export function normalizeExpenseToMonthly(expense: FixedExpense): FixedExpense {
  // If already monthly, return as-is
  if (expense.frequency === 'monthly') {
    return expense;
  }

  // Convert amount to monthly and set frequency to monthly
  return {
    ...expense,
    amount$: toMonthlyAmount(expense.amount$, expense.frequency),
    frequency: 'monthly',
  };
}

/**
 * Normalizes an array of expenses to monthly format
 */
export function normalizeExpensesToMonthly(expenses: FixedExpense[]): FixedExpense[] {
  return expenses.map(normalizeExpenseToMonthly);
}

/**
 * Gets the monthly amount from an expense (for backward compatibility)
 * Since all expenses should now be monthly, this just returns amount$
 */
export function getMonthlyExpenseAmount(expense: FixedExpense): number {
  // If frequency is not monthly, convert it (shouldn't happen if normalized, but safety check)
  if (expense.frequency !== 'monthly') {
    return toMonthlyAmount(expense.amount$, expense.frequency);
  }
  return expense.amount$;
}

