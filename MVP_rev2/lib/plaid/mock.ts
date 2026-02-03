/**
 * Mock Plaid Integration
 * 
 * Simulates Plaid connection and returns realistic mock financial data.
 */

import type { FixedExpense, Debt, Asset, IncomeState, PayFrequency } from '@/lib/onboarding/types';

export interface MockPlaidData {
  income?: IncomeState;
  fixedExpenses: FixedExpense[];
  debts: Debt[];
  assets: Asset[];
}

/**
 * Mock Plaid connection - returns realistic financial data
 */
export async function mockPlaidConnect(): Promise<MockPlaidData> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Generate realistic mock data
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(now.getMonth() + 1);

  // Mock income (from detected paychecks)
  const income: IncomeState = {
    grossIncome$: 5200,
    netIncome$: 4000,
    payFrequency: 'biweekly' as PayFrequency,
    annualSalary$: 67600,
    incomeSingle$: 67600,
  };

  // Mock fixed expenses
  const fixedExpenses: FixedExpense[] = [
    {
      id: 'exp-1',
      name: 'Rent',
      amount$: 1800,
      frequency: 'monthly',
      category: 'needs',
      nextDueDate: nextMonth.toISOString().split('T')[0],
    },
    {
      id: 'exp-2',
      name: 'Electric Bill',
      amount$: 120,
      frequency: 'monthly',
      category: 'needs',
      nextDueDate: nextMonth.toISOString().split('T')[0],
    },
    {
      id: 'exp-3',
      name: 'Internet',
      amount$: 80,
      frequency: 'monthly',
      category: 'needs',
      isSubscription: true,
      nextDueDate: nextMonth.toISOString().split('T')[0],
    },
    {
      id: 'exp-4',
      name: 'Netflix',
      amount$: 15.99,
      frequency: 'monthly',
      category: 'wants',
      isSubscription: true,
      nextDueDate: nextMonth.toISOString().split('T')[0],
    },
    {
      id: 'exp-5',
      name: 'Spotify',
      amount$: 10.99,
      frequency: 'monthly',
      category: 'wants',
      isSubscription: true,
      nextDueDate: nextMonth.toISOString().split('T')[0],
    },
    {
      id: 'exp-6',
      name: 'Gym Membership',
      amount$: 50,
      frequency: 'monthly',
      category: 'wants',
      isSubscription: true,
      nextDueDate: nextMonth.toISOString().split('T')[0],
    },
    {
      id: 'exp-7',
      name: 'Dining & Entertainment',
      amount$: 2323.02,
      frequency: 'monthly',
      category: 'wants',
      nextDueDate: nextMonth.toISOString().split('T')[0],
    },
  ];

  // Mock debts
  const debts: Debt[] = [
    {
      id: 'debt-1',
      name: 'Chase Credit Card',
      balance$: 3500,
      aprPct: 22.99,
      minPayment$: 75,
      isHighApr: true,
      type: 'credit_card',
    },
    {
      id: 'debt-2',
      name: 'Student Loan',
      balance$: 25000,
      aprPct: 5.5,
      minPayment$: 280,
      isHighApr: false,
      type: 'student_loan',
    },
    {
      id: 'debt-3',
      name: 'Amex Credit Card',
      balance$: 1200,
      aprPct: 18.5,
      minPayment$: 45,
      isHighApr: true,
      type: 'credit_card',
    },
  ];

  // Mock assets
  const assets: Asset[] = [
    {
      id: 'asset-1',
      name: 'Checking Account',
      value$: 3200,
      type: 'cash',
      accountName: 'Chase Checking ••••1234',
    },
    {
      id: 'asset-2',
      name: 'Savings Account',
      value$: 2500,
      type: 'cash',
      accountName: 'Chase Savings ••••5678',
    },
    {
      id: 'asset-3',
      name: '401(k)',
      value$: 18500,
      type: 'retirement',
      accountName: 'Fidelity 401(k)',
    },
    {
      id: 'asset-4',
      name: 'Roth IRA',
      value$: 6200,
      type: 'retirement',
      accountName: 'Vanguard Roth IRA',
    },
    {
      id: 'asset-5',
      name: 'Brokerage Account',
      value$: 3400,
      type: 'brokerage',
      accountName: 'Robinhood',
    },
  ];

  return {
    income,
    fixedExpenses,
    debts,
    assets,
  };
}

