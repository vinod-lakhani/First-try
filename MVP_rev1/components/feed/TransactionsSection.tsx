/**
 * Transactions Section Component
 * 
 * Displays recent bank and credit card transactions in the Feed.
 */

'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { TransactionsSection } from '@/lib/feed/types';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';

interface TransactionsSectionProps {
  data: TransactionsSection;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
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

function TransactionRow({ transaction }: { transaction: any }) {
  const isPositive = transaction.amount$ >= 0;
  const amountColor = isPositive 
    ? 'text-green-600 dark:text-green-400' 
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-slate-900 dark:text-white truncate">
            {transaction.merchant}
          </p>
          {transaction.category && (
            <span className="text-xs text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
              {transaction.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {transaction.accountName}
          </p>
          <span className="text-xs text-slate-400">·</span>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatDate(transaction.date)}
          </p>
        </div>
      </div>
      <div className={`flex items-center gap-1 font-semibold ${amountColor}`}>
        {isPositive ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        <span className="text-sm">{formatAmount(transaction.amount$)}</span>
      </div>
    </div>
  );
}

export function TransactionsSection({ data }: TransactionsSectionProps) {
  const router = useRouter();
  
  const bankTransactions = data.bankTransactions.slice(0, 5);
  const creditCardTransactions = data.creditCardTransactions.slice(0, 5);

  // Don't render if no transactions
  if (bankTransactions.length === 0 && creditCardTransactions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bank Accounts Section */}
        {bankTransactions.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Bank accounts
            </h3>
            <div className="space-y-0">
              {bankTransactions.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-primary hover:text-primary/80"
              onClick={() => router.push('/app/transactions?kind=bank')}
            >
              View all banking <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Credit Cards Section */}
        {creditCardTransactions.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Credit cards
            </h3>
            <div className="space-y-0">
              {creditCardTransactions.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-primary hover:text-primary/80"
              onClick={() => router.push('/app/transactions?kind=credit_card')}
            >
              View all credit cards <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

