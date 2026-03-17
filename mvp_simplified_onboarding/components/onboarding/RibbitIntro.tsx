/**
 * Ribbit Introduction Component
 *
 * First screen of onboarding - introduces Ribbit as the financial sidekick.
 * Matches the design: Meet Ribbit, feature list, Get Started CTA.
 */

"use client";

import { Link2, PiggyBank, Rocket, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OnboardingProgress } from "./OnboardingProgress";

export type RibbitIntroProps = {
  onPrimaryClick?: () => void;
};

const RibbitIntro: React.FC<RibbitIntroProps> = ({ onPrimaryClick }) => {
  return (
    <div className="w-full flex items-center justify-center p-4">
      <div className="w-full max-w-sm px-6 py-8 flex flex-col gap-6">
        {/* Progress header */}
        <OnboardingProgress />

        {/* Ribbit illustration */}
        <div className="flex flex-col items-center gap-2">
          <div className="mx-auto h-40 w-40 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center mb-2 overflow-hidden p-2">
            <img
              src="/images/ribbit.png"
              alt="Ribbit, your financial sidekick"
              className="w-full h-full object-contain"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target) {
                  target.style.display = "none";
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector(".fallback-emoji")) {
                    const fallback = document.createElement("div");
                    fallback.className =
                      "fallback-emoji h-full w-full rounded-full bg-primary/20 flex items-center justify-center";
                    fallback.innerHTML = '<span class="text-6xl">🐸</span>';
                    parent.appendChild(fallback);
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Headline + subheadline */}
        <div className="text-center space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Meet Ribbit, your new Financial sidekick
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            I&apos;m here to help you take control of your money, one smart leap
            at a time. We&apos;ll keep things simple, clear, and totally
            judgment-free.
          </p>
        </div>

        {/* Feature list */}
        <Card className="w-full">
          <CardContent className="pt-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Here&apos;s what we&apos;ll do together
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <Link2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 pt-2">
                  Connect your accounts so I can see the full picture
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <PiggyBank className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 pt-2">
                  Understand your income and spending, without spreadsheets
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <Rocket className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 pt-2">
                  Build your starting plan for savings and managing money
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 pt-2">
                  Set up your sidekick to get personalized tips and nudges
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-6 text-center">
              No stress. No lectures. Just guidance that fits your life.
            </p>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="flex flex-col gap-3 pt-2">
          <Button
            onClick={onPrimaryClick}
            size="lg"
            className="w-full bg-primary hover:bg-primary/90"
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RibbitIntro;
