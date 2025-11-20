/**
 * Alert Card Components
 * 
 * Displays critical alerts (savings gap, high APR debt, cash flow risk).
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import type { FeedCard } from '@/lib/feed/types';
import { formatCurrency, formatPercent } from '@/lib/feed/utils';

interface AlertCardProps {
  card: FeedCard;
  onAction?: (action: FeedCard['ctaAction']) => void;
}

export function AlertSavingsGapCard({ card, onAction }: AlertCardProps) {
  return (
    <Card className="border-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-900/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <CardTitle className="text-lg text-amber-900 dark:text-amber-100">{card.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-amber-800 dark:text-amber-200">{card.body}</p>
        {card.ctaLabel && card.ctaAction && (
          <Button
            onClick={() => onAction?.(card.ctaAction)}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
          >
            {card.ctaLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function AlertDebtHighAprCard({ card, onAction }: AlertCardProps) {
  return (
    <Card className="border-2 border-red-500/50 bg-red-50/50 dark:bg-red-900/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <CardTitle className="text-lg text-red-900 dark:text-red-100">{card.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-red-800 dark:text-red-200">{card.body}</p>
        {card.ctaLabel && card.ctaAction && (
          <Button
            onClick={() => onAction?.(card.ctaAction)}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            {card.ctaLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function AlertCashflowRiskCard({ card, onAction }: AlertCardProps) {
  return (
    <Card className="border-2 border-red-500/50 bg-red-50/50 dark:bg-red-900/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <CardTitle className="text-lg text-red-900 dark:text-red-100">{card.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-red-800 dark:text-red-200">{card.body}</p>
        {card.ctaLabel && card.ctaAction && (
          <Button
            onClick={() => onAction?.(card.ctaAction)}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            {card.ctaLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

