/**
 * Pulse Card Component
 * 
 * Displays monthly pulse summary with N/W/S breakdown.
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { FeedCard, PulseCardMetadata } from '@/lib/feed/types';
import { formatCurrency, formatPercent } from '@/lib/feed/utils';

interface PulseCardProps {
  card: FeedCard;
  onAction?: (action: FeedCard['ctaAction']) => void;
}

export function PulseCard({ card, onAction }: PulseCardProps) {
  const metadata = card.metadata as PulseCardMetadata | undefined;
  
  if (!metadata) return null;

  const needsActual = metadata.needsPct;
  const wantsActual = metadata.wantsPct;
  const savingsActual = metadata.savingsPct;
  const needsTarget = metadata.targetNeedsPct;
  const wantsTarget = metadata.targetWantsPct;
  const savingsTarget = metadata.targetSavingsPct;

  const savingsDelta = metadata.savingsDelta$;
  const savingsDeltaAbs = Math.abs(savingsDelta);

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader>
        <CardTitle className="text-xl">{card.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-slate-700 dark:text-slate-300">{card.body}</p>
        
        {/* N/W/S Bars */}
        <div className="space-y-2">
          {/* Needs */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-600 dark:text-slate-400">Needs</span>
              <span className="font-medium">{formatPercent(needsActual)}</span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all"
                style={{ width: `${needsActual}%` }}
              />
            </div>
            {Math.abs(needsActual - needsTarget) > 1 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Target: {formatPercent(needsTarget)}
              </p>
            )}
          </div>

          {/* Wants */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-600 dark:text-slate-400">Wants</span>
              <span className="font-medium">{formatPercent(wantsActual)}</span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${wantsActual}%` }}
              />
            </div>
            {Math.abs(wantsActual - wantsTarget) > 1 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Target: {formatPercent(wantsTarget)}
              </p>
            )}
          </div>

          {/* Savings */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-600 dark:text-slate-400">Savings</span>
              <span className="font-medium">{formatPercent(savingsActual)}</span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${savingsActual}%` }}
              />
            </div>
            {Math.abs(savingsActual - savingsTarget) > 1 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Target: {formatPercent(savingsTarget)}
              </p>
            )}
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

