/**
 * Onboarding Progress Header
 *
 * Simplified progress: Welcome → Connect → Income → Savings → Plan
 * Matches the design with back arrow, step labels, progress bar, and optional X.
 */

"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";

const STAGES = [
  { id: "welcome", label: "Welcome" },
  { id: "connect", label: "Connect" },
  { id: "income", label: "Income" },
  { id: "savings", label: "Savings" },
  { id: "plan", label: "Plan" },
] as const;

export type OnboardingStep = (typeof STAGES)[number]["id"];

type OnboardingProgressProps = {
  currentStep?: OnboardingStep;
  showClose?: boolean;
  /** Custom back handler. If not provided, uses default navigation. */
  onBack?: () => void;
};

export function OnboardingProgress({
  currentStep = "welcome",
  showClose = false,
  onBack,
}: OnboardingProgressProps) {
  const router = useRouter();
  const currentStageIndex = STAGES.findIndex((s) => s.id === currentStep);
  const safeStageIndex = currentStageIndex >= 0 ? currentStageIndex : 0;
  const currentLabel = STAGES[safeStageIndex]?.label ?? "Welcome";

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (currentStep === "welcome") {
      router.push("/");
    } else if (currentStep === "connect") {
      router.push("/onboarding/ribbit-intro");
    } else if (currentStep === "income") {
      router.push("/onboarding/connect");
    } else if (currentStep === "savings") {
      router.push("/onboarding/income");
    } else if (currentStep === "plan") {
      router.push("/onboarding/savings");
    } else {
      router.push("/");
    }
  };

  const handleClose = () => {
    router.push("/");
  };

  return (
    <div className="w-full pb-4">
      {/* Header: Back arrow + step label (or spacer) + optional X */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Go back"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        {!showClose ? (
          <span className="text-sm font-medium text-slate-900 dark:text-white">
            {currentLabel}
          </span>
        ) : null}
        {showClose ? (
          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* Progress bar + step labels */}
      <div className="space-y-2">
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-slate-800 dark:bg-slate-400 transition-all duration-300"
            style={{
              width: `${((safeStageIndex + 1) / STAGES.length) * 100}%`,
            }}
          />
        </div>
        <div className="flex justify-between gap-1">
          {STAGES.map((stage, index) => (
            <span
              key={stage.id}
              className={`text-xs font-medium ${
                index <= safeStageIndex
                  ? "text-slate-900 dark:text-white"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {stage.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
