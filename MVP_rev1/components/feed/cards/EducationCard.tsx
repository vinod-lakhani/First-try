/**
 * Education Card Component
 * 
 * Displays educational content cards.
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';
import type { FeedCard } from '@/lib/feed/types';

interface EducationCardProps {
  card: FeedCard;
  onAction?: (action: FeedCard['ctaAction']) => void;
}

export function EducationCard({ card, onAction }: EducationCardProps) {
  return (
    <Card className="border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          <CardTitle className="text-lg">{card.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-slate-700 dark:text-slate-300">{card.body}</p>
        {card.ctaLabel && card.ctaAction && (
          <Button
            onClick={() => onAction?.(card.ctaAction)}
            className="w-full"
            variant="ghost"
          >
            {card.ctaLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

