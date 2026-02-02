/**
 * Sidekick Leap card — Top Recommendation (full) or Other Recommendation (compact).
 * Uses Feed leapCopyMap + formatters; "Why this?" shows insight from insightsMap.
 * Sidekick does NOT invent recommendations; only displays Leaps from Feed Logic.
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Leap } from '@/lib/feed/leapTypes';
import { getLeapCopy } from '@/lib/feed/leapCopyMap';
import {
  renderLeapSubtitle,
  deriveImpactLine,
} from '@/lib/feed/formatters';
import { getInsightBlurb } from '@/lib/sidekick/insightsMap';

export interface SidekickLeapCardProps {
  leap: Leap;
  isTop?: boolean;
  onOpenTool: (leap: Leap) => void;
  onDismiss: (leap: Leap) => void;
}

export function SidekickLeapCard({
  leap,
  isTop = false,
  onOpenTool,
  onDismiss,
}: SidekickLeapCardProps) {
  const copy = getLeapCopy(leap.leapType);
  const subtitle = renderLeapSubtitle(leap);
  const previewMetric = leap.previewMetric;
  const impactLineFallback = deriveImpactLine(leap);
  const benefitLine = previewMetric ? previewMetric.value : impactLineFallback;
  const benefitLabel = previewMetric?.label;
  const insightBlurb = getInsightBlurb(leap.sidekickInsightId);

  const [whyExpanded, setWhyExpanded] = useState(false);

  if (!isTop) {
    // Compact card for "Other recommendations"
    return (
      <Card
        className="border-slate-200 dark:border-slate-700 cursor-pointer transition-all hover:border-slate-300 hover:shadow-sm"
        onClick={() => onOpenTool(leap)}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {copy.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                {subtitle}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onOpenTool(leap);
              }}
            >
              {copy.primaryCtaLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Top recommendation — full card with impact chip, Why this?, Not now
  return (
    <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30">
      <CardHeader className="pb-2">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          {copy.title}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          {subtitle}
        </p>
        {benefitLine && (
          <div className="flex flex-wrap gap-1.5 mt-2 items-center">
            {benefitLabel && (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {benefitLabel}:
              </span>
            )}
            <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300">
              {benefitLine}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="default" onClick={() => onOpenTool(leap)}>
            {copy.primaryCtaLabel}
          </Button>
          {insightBlurb && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setWhyExpanded((e) => !e)}
            >
              {whyExpanded ? (
                <ChevronUp className="h-4 w-4 mr-1" />
              ) : (
                <ChevronDown className="h-4 w-4 mr-1" />
              )}
              Why this?
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onDismiss(leap)}>
            Not now
          </Button>
        </div>
        {whyExpanded && insightBlurb && (
          <p className="text-xs text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
            {insightBlurb}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
