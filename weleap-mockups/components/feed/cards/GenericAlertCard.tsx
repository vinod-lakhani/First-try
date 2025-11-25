/**
 * Generic Alert Card Component
 * 
 * Time-sensitive, high-priority issues that may have financial consequences.
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import type { FeedCard } from '@/lib/feed/types';

interface GenericAlertCardProps {
  card: FeedCard;
  onAction?: (action: FeedCard['ctaAction']) => void;
}

export function GenericAlertCard({ card, onAction }: GenericAlertCardProps) {
  return (
    <Card className="border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
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
              variant="outline"
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

