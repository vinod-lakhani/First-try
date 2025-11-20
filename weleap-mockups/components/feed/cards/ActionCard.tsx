/**
 * Action Card Components
 * 
 * Displays actionable planning cards (income shift, savings rate, savings allocation).
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import type { FeedCard } from '@/lib/feed/types';

interface ActionCardProps {
  card: FeedCard;
  onAction?: (action: FeedCard['ctaAction']) => void;
}

export function ActionIncomeShiftCard({ card, onAction }: ActionCardProps) {
  return (
    <Card className="border border-blue-200 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="text-lg">{card.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-slate-700 dark:text-slate-300">{card.body}</p>
        {card.ctaLabel && card.ctaAction && (
          <Button
            onClick={() => onAction?.(card.ctaAction)}
            className="w-full"
            variant="default"
          >
            {card.ctaLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function ActionSavingsRateCard({ card, onAction }: ActionCardProps) {
  return (
    <Card className="border border-green-200 dark:border-green-800">
      <CardHeader>
        <CardTitle className="text-lg">{card.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-slate-700 dark:text-slate-300">{card.body}</p>
        {card.ctaLabel && card.ctaAction && (
          <Button
            onClick={() => onAction?.(card.ctaAction)}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {card.ctaLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function ActionSavingsAllocationCard({ card, onAction }: ActionCardProps) {
  return (
    <Card className="border border-purple-200 dark:border-purple-800">
      <CardHeader>
        <CardTitle className="text-lg">{card.title}</CardTitle>
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
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

