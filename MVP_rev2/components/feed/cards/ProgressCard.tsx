/**
 * Progress Card Components
 * 
 * Displays goal progress (emergency fund, debt, savings streak).
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, TrendingUp } from 'lucide-react';
import type { FeedCard } from '@/lib/feed/types';
import { formatCurrency, formatPercent } from '@/lib/feed/utils';

interface ProgressCardProps {
  card: FeedCard;
  onAction?: (action: FeedCard['ctaAction']) => void;
}

export function ProgressEfCard({ card, onAction }: ProgressCardProps) {
  const metadata = card.metadata as any;
  const progressPct = metadata?.progressPct || 0;

  return (
    <Card className="border border-green-200 dark:border-green-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
          <CardTitle className="text-lg">{card.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-slate-700 dark:text-slate-300">{card.body}</p>
        
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">Progress</span>
            <span className="font-medium">{formatPercent(progressPct)}</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
        </div>

        {card.ctaLabel && card.ctaAction && (
          <Button
            onClick={() => onAction?.(card.ctaAction)}
            className="w-full"
            variant="outline"
          >
            {card.ctaLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function ProgressDebtCard({ card, onAction }: ProgressCardProps) {
  return (
    <Card className="border border-amber-200 dark:border-amber-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <CardTitle className="text-lg">{card.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-slate-700 dark:text-slate-300">{card.body}</p>
        {card.ctaLabel && card.ctaAction && (
          <Button
            onClick={() => onAction?.(card.ctaAction)}
            className="w-full"
            variant="outline"
          >
            {card.ctaLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function ProgressSavingsStreakCard({ card }: ProgressCardProps) {
  return (
    <Card className="border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          <CardTitle className="text-lg text-green-900 dark:text-green-100">{card.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-green-800 dark:text-green-200">{card.body}</p>
      </CardContent>
    </Card>
  );
}

