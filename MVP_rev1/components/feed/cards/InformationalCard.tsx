/**
 * Informational Card Component
 * 
 * Educational pieces that build understanding, confidence, and engagement.
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';
import type { FeedCard } from '@/lib/feed/types';

interface InformationalCardProps {
  card: FeedCard;
  onAction?: (action: FeedCard['ctaAction']) => void;
}

export function InformationalCard({ card, onAction }: InformationalCardProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <BookOpen className="h-5 w-5 text-slate-400 dark:text-slate-500" />
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
              variant="ghost"
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

