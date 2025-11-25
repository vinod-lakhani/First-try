/**
 * Recommendation Card Component
 * 
 * Personalized suggestions that improve the user's financial situation.
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import type { FeedCard } from '@/lib/feed/types';

interface RecommendationCardProps {
  card: FeedCard;
  onAction?: (action: FeedCard['ctaAction']) => void;
}

export function RecommendationCard({ card, onAction }: RecommendationCardProps) {
  return (
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {card.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {card.body}
              </p>
            </div>
          </div>
          {card.ctaLabel && card.ctaAction && (
            <Button
              size="sm"
              className="w-full"
              onClick={() => onAction?.(card.ctaAction!)}
            >
              {card.ctaLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

