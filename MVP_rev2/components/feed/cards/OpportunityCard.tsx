/**
 * Opportunity Card Components
 * 
 * Displays optimization opportunities (rent optimizer, savings allocator, side income).
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp } from 'lucide-react';
import type { FeedCard } from '@/lib/feed/types';

interface OpportunityCardProps {
  card: FeedCard;
  onAction?: (action: FeedCard['ctaAction']) => void;
}

export function OppRentOptimizerCard({ card, onAction }: OpportunityCardProps) {
  return (
    <Card className="border border-slate-200 dark:border-slate-700">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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

export function OppSavingsAllocatorCard({ card, onAction }: OpportunityCardProps) {
  return (
    <Card className="border border-slate-200 dark:border-slate-700">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
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

export function OppSideIncomeCard({ card, onAction }: OpportunityCardProps) {
  return (
    <Card className="border border-slate-200 dark:border-slate-700">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
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

