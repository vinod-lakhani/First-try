/**
 * Transactions Page
 * 
 * Full view of bank and credit card transactions with filtering.
 */

'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { FeedTransaction, AccountKind } from '@/lib/feed/types';
import { ArrowLeft, TrendingDown, TrendingUp } from 'lucide-react';

// TODO: Replace with real data from Plaid transaction APIs via backend
// For now, using mocked data (static to avoid regeneration and improve performance)
const STATIC_MOCK_TRANSACTIONS: FeedTransaction[] = (() => {
  const now = new Date();
  const transactions: FeedTransaction[] = [];

  // Bank transactions - fixed amounts for performance
  const bankMerchants = ['Amazon', 'Starbucks', 'Whole Foods', 'Uber', 'Spotify', 'Netflix', 'Shell Gas', 'CVS Pharmacy', 'Target', 'Apple Store'];
  const bankCategories = ['Shopping', 'Food & Drink', 'Groceries', 'Transportation', 'Entertainment', 'Bills & Utilities', 'Gas', 'Healthcare', 'Shopping', 'Electronics'];
  const bankAmounts = [-125.50, -8.75, -89.32, -24.50, -9.99, -15.99, -45.00, -32.10, -67.89, -299.99];
  
  for (let i = 0; i < 15; i++) {
    transactions.push({
      id: `bank-${i}`,
      accountKind: 'bank',
      accountName: i % 3 === 0 ? 'Chase Checking' : 'Wells Fargo Savings',
      merchant: bankMerchants[i % 10],
      amount$: bankAmounts[i % 10],
      date: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
      category: bankCategories[i % 10],
    });
  }

  // Credit card transactions - fixed amounts for performance
  const ccMerchants = ['Restaurant', 'Airbnb', 'Delta Airlines', 'Best Buy', 'Costco', 'Home Depot', 'Petco', 'Nordstrom'];
  const ccCategories = ['Dining', 'Travel', 'Travel', 'Electronics', 'Wholesale', 'Home & Garden', 'Pets', 'Fashion'];
  const ccAmounts = [-85.20, -325.00, -450.00, -199.99, -145.50, -78.30, -42.10, -156.75];
  
  for (let i = 0; i < 12; i++) {
    transactions.push({
      id: `cc-${i}`,
      accountKind: 'credit_card',
      accountName: i % 2 === 0 ? 'Chase Sapphire' : 'Amex Gold',
      merchant: ccMerchants[i % 8],
      amount$: ccAmounts[i % 8],
      date: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
      category: ccCategories[i % 8],
    });
  }

  // Sort by date (newest first)
  return transactions.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
})();

function mockTransactions(): FeedTransaction[] {
  return STATIC_MOCK_TRANSACTIONS;
}

type FilterKind = 'all' | 'bank' | 'credit_card';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear() !== today.getFullYear() ? `, ${date.getFullYear()}` : '';
  return `${month} ${day}${year}`;
}

function formatAmount(amount: number): string {
  const isPositive = amount >= 0;
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(absAmount);
  return `${isPositive ? '+' : '-'}${formatted}`;
}

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get initial filter from URL param
  const urlKind = searchParams.get('kind') as AccountKind | null;
  const [filter, setFilter] = useState<FilterKind>(
    urlKind === 'bank' ? 'bank' : urlKind === 'credit_card' ? 'credit_card' : 'all'
  );

  // TODO: Replace with real data hook: useTransactions(kind)
  // For now, using static mocked data (memoized outside component for performance)
  const allTransactions = useMemo(() => mockTransactions(), []);

  // Filter transactions based on current filter
  const filteredTransactions = useMemo(() => {
    if (filter === 'all') return allTransactions;
    return allTransactions.filter(t => t.accountKind === filter);
  }, [allTransactions, filter]);

  const filterButtons: Array<{ label: string; value: FilterKind }> = [
    { label: 'All', value: 'all' },
    { label: 'Bank', value: 'bank' },
    { label: 'Credit cards', value: 'credit_card' },
  ];

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-4">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/app/feed')}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Transactions</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2">
            {filterButtons.map((btn) => (
              <Button
                key={btn.value}
                variant={filter === btn.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(btn.value)}
                className="flex-1"
              >
                {btn.label}
              </Button>
            ))}
          </div>

          {/* Transactions List */}
          <Card>
            <CardContent className="p-0">
              {filteredTransactions.length === 0 ? (
                <div className="p-6 text-center text-slate-500 dark:text-slate-400">
                  No transactions found.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTransactions.map((transaction) => {
                    const isPositive = transaction.amount$ >= 0;
                    const amountColor = isPositive 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400';

                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-slate-900 dark:text-white">
                              {transaction.merchant}
                            </p>
                            {transaction.category && (
                              <span className="text-xs text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                {transaction.category}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {transaction.accountName}
                            </p>
                            <span className="text-slate-400">·</span>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {formatDate(transaction.date)}
                            </p>
                          </div>
                        </div>
                        <div className={`flex items-center gap-1 font-semibold ml-4 ${amountColor}`}>
                          {isPositive ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          <span>{formatAmount(transaction.amount$)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Back Link */}
          <Button
            variant="ghost"
            onClick={() => router.push('/app/feed')}
            className="w-full"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Feed
          </Button>
        </div>
      </div>
    </div>
  );
}

