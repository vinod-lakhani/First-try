"use client";

import Link from "next/link";
import { RibbitIcon } from "@/components/onboarding/RibbitIcon";
import { Button } from "@/components/ui/button";
import { Check, Clock, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type LeapCardProps = {
  heading: string;
  headline: string;
  impactLine?: string;
  body: string;
  primaryHref?: string;
  primaryCta?: string;
  secondaryCta?: string;
  secondaryOnClick?: () => void;
  chips?: { label: string; question: string }[];
  onChipClick?: (question: string) => void;
  onComplete?: () => void;
  onSnooze?: () => void;
  onDismiss?: () => void;
  showActionChips?: boolean;
};

export function LeapCard({
  heading,
  headline,
  impactLine,
  body,
  primaryHref,
  primaryCta,
  secondaryCta,
  secondaryOnClick,
  chips = [],
  onChipClick,
  onComplete,
  onSnooze,
  onDismiss,
  showActionChips = true,
}: LeapCardProps) {
  return (
    <Card className="overflow-hidden border-slate-200 dark:border-slate-700">
      <CardContent className="p-4">
        <p className="font-semibold text-slate-900 dark:text-white mb-3">
          {heading}
        </p>
        <div className="flex items-center gap-2 mb-2">
          <RibbitIcon size="sm" className="shrink-0" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Ribbit says</span>
        </div>
        <div className="flex gap-3">
          <div className="shrink-0 w-5" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900 dark:text-white">
              {headline}
            </p>
            {impactLine && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {impactLine}
              </p>
            )}
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {body}
            </p>
            {((primaryHref && primaryCta) || secondaryCta) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {primaryHref && primaryCta && (
                  <Link href={primaryHref}>
                    <Button size="sm">{primaryCta}</Button>
                  </Link>
                )}
                {secondaryCta && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={secondaryOnClick}
                  >
                    {secondaryCta}
                  </Button>
                )}
              </div>
            )}
            {chips.length > 0 && onChipClick && (
              <div className="mt-3 flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <button
                    key={chip.question}
                    type="button"
                    onClick={() => onChipClick(chip.question)}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Action chips: check, snooze, dismiss */}
        {showActionChips && (
        <div className="mt-4 flex justify-end gap-2">
          {onComplete && (
            <button
              type="button"
              onClick={onComplete}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
              aria-label="Mark complete"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
          {onSnooze && (
            <button
              type="button"
              onClick={onSnooze}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
              aria-label="Snooze"
            >
              <Clock className="h-4 w-4" />
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
              aria-label="Dismiss"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
