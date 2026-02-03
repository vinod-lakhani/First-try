/**
 * Leap card — user-friendly (User View) or full debug (Debug View).
 * Single source for title, subtitle, impact, and CTAs via leapCopyMap + formatters.
 * Later Sidekick will render the top Leap conversationally.
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import type { Leap } from '@/lib/feed/leapTypes';
import { getLeapCopy } from '@/lib/feed/leapCopyMap';
import {
  renderLeapSubtitle,
  deriveImpactLine,
  toolLabel,
} from '@/lib/feed/formatters';

export type FeedDisplayMode = 'user' | 'debug';

export interface LeapCardProps {
  leap: Leap;
  mode: FeedDisplayMode;
  onOpenSidekick: () => void;
  onOpenTool: (leap: Leap) => void;
  onMarkComplete: (leapId: string) => void;
  onDismiss: (leap: Leap) => void;
  isTop?: boolean;
}

function isCooldownActive(leap: Leap): boolean {
  return Boolean(leap.cooldownUntil && new Date(leap.cooldownUntil) > new Date());
}

export function LeapCard({
  leap,
  mode,
  onOpenSidekick,
  onOpenTool,
  onMarkComplete,
  onDismiss,
  isTop = false,
}: LeapCardProps) {
  const copy = getLeapCopy(leap.leapType);
  const subtitle = renderLeapSubtitle(leap);
  const previewMetric = leap.previewMetric;
  const impactLineFallback = deriveImpactLine(leap);
  const toolHumanLabel = toolLabel(leap.originatingTool);
  const cooldownActive = isCooldownActive(leap);

  const benefitLine = previewMetric ? previewMetric.value : impactLineFallback;
  const benefitLabel = previewMetric?.label;

  const [detailsExpanded, setDetailsExpanded] = useState(mode === 'debug');
  
  // Use new normalized structure for debug info
  const debugInfo = leap.debug ?? {
    score: leap.priorityScore,
    reasonCode: leap.reasonCode,
    payload: leap.payload,
    dedupeKey: leap.dedupeKey,
  };
  const payloadJson = JSON.stringify(debugInfo.payload, null, 2);

  const isUserView = mode === 'user';

  return (
    <Card
      className={
        isTop
          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30'
          : 'border-slate-200 dark:border-slate-700'
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {leap.title || copy.title}
          </h2>
          {leap.fromUnimplementedFollowUp && (
            <span className="inline-flex items-center rounded-md bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              Follow-up
            </span>
          )}
          {leap.suppressed && !isUserView && (
            <span className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
              Suppressed
            </span>
          )}
          {cooldownActive && (
            <span className="inline-flex items-center rounded-md border border-amber-400 dark:border-amber-600 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-3 w-3 mr-0.5" />
              Cooldown
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          {leap.subtitle || subtitle}
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
          {isTop && (
            <Button size="sm" variant="outline" onClick={onOpenSidekick}>
              <MessageCircle className="h-4 w-4 mr-1" />
              Open Sidekick
            </Button>
          )}
          <Button size="sm" variant={isTop ? 'default' : 'outline'} onClick={() => onOpenTool(leap)}>
            {leap.primaryCta?.label || copy.primaryCtaLabel}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onOpenSidekick()}>
            {leap.secondaryCtas?.[0]?.label || copy.secondaryCtaLabel || 'Details'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDismiss(leap)}>
            Not now
          </Button>
          {!isUserView && (
            <Button size="sm" variant="outline" onClick={() => onMarkComplete(leap.leapId)}>
              Mark Completed
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
          Tool: {toolHumanLabel}
        </p>

        {/* Debug details — only in Debug View; collapsible, expanded by default */}
        {!isUserView && (
          <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-2">
            <button
              type="button"
              onClick={() => setDetailsExpanded((e) => !e)}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            >
              {detailsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Details
            </button>
            {detailsExpanded && (
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 space-y-1 font-mono">
                {leap.suppressed && (
                  <p className="text-amber-600 dark:text-amber-400 font-medium">
                    suppressedReason: {String(leap.payload?.suppressedReason ?? '—')}
                  </p>
                )}
                <p>leapType: {leap.leapType}</p>
                <p>priorityScore: {debugInfo.score}</p>
                <p>reasonCode: {debugInfo.reasonCode}</p>
                <p>dedupeKey: {debugInfo.dedupeKey}</p>
                {leap.leapType === 'EMERGENCY_FUND_GAP' && leap.payload && (
                  <div className="mt-2 p-2 rounded bg-slate-100 dark:bg-slate-900 text-[10px] space-y-0.5">
                    <p>efMonths: {String((leap.payload as Record<string, unknown>).efMonths ?? '')}</p>
                    <p>efTargetMonths: {String((leap.payload as Record<string, unknown>).efTargetMonths ?? '')}</p>
                    <p>efGapDollars: {String((leap.payload as Record<string, unknown>).efGapDollars ?? '')}</p>
                    <p>appliedPlanEfMonthly: {String((leap.payload as Record<string, unknown>).appliedPlanEfMonthly ?? '')}</p>
                    <p>efRequiredPerMonth: {String((leap.payload as Record<string, unknown>).efRequiredPerMonth ?? '')}</p>
                    <p>efOnTrack: {String(leap.payload.efOnTrack)}</p>
                    <p>recentlyApplied: {String(leap.payload.recentlyApplied)}</p>
                    <p>criticallyLow: {String(leap.payload.criticallyLow)}</p>
                  </div>
                )}
                {leap.sidekickInsightId && <p>insightId: {leap.sidekickInsightId}</p>}
                {leap.cooldownUntil && (
                  <p>cooldownUntil: {leap.cooldownUntil} {cooldownActive ? '(active)' : ''}</p>
                )}
                <pre className="mt-2 p-2 rounded bg-slate-100 dark:bg-slate-900 overflow-x-auto max-h-40 overflow-y-auto text-[10px]">
                  {payloadJson || '{}'}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
