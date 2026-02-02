/**
 * Ribbit Introduction Component
 * 
 * First screen of onboarding that introduces Ribbit, the user's financial sidekick.
 * Mobile-first design with friendly, young-adult-focused messaging.
 */

'use client';

import { useState, useEffect } from 'react';
import { Link, Wallet, Target, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { withBasePath } from '@/lib/utils/basePath';
import { OnboardingProgress } from './OnboardingProgress';

export type RibbitIntroProps = {
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
};

const RibbitIntro: React.FC<RibbitIntroProps> = ({
  onPrimaryClick,
  onSecondaryClick,
}) => {
  // Set image src after component mounts to avoid hydration issues
  const [imageSrc, setImageSrc] = useState('/images/ribbit.png');
  
  useEffect(() => {
    setImageSrc(withBasePath('images/ribbit.png'));
  }, []);

  return (
    <div className="w-full flex items-center justify-center p-4">
      <div className="w-full max-w-sm px-6 py-8 flex flex-col gap-6">
        {/* Progress Bar */}
        <OnboardingProgress />

        {/* Ribbit illustration */}
        <div className="flex flex-col items-center gap-2">
          <div className="mx-auto h-32 w-32 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center mb-2 overflow-hidden p-2">
            {/* Using regular img tag for static export compatibility with loading optimization */}
            <img
              src={imageSrc}
              alt="Ribbit, your financial sidekick"
              className="w-full h-full object-contain"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                // Fallback to emoji if image doesn't exist yet
                const target = e.target as HTMLImageElement;
                if (target) {
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('.fallback-emoji')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'fallback-emoji h-full w-full rounded-full bg-primary/20 flex items-center justify-center';
                    fallback.innerHTML = '<span class="text-4xl">🐸</span>';
                    parent.appendChild(fallback);
                  }
                }
              }}
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Ribbit</p>
        </div>

        {/* Headline + subheadline */}
        <div className="text-center space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Hi! I'm Ribbit — your financial sidekick.
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            I'm here to help you take control of your money, one smart leap at a time. We'll keep things simple, clear, and totally judgment-free.
          </p>
        </div>

        {/* Onboarding overview section */}
        <Card className="w-full">
          <CardContent className="pt-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Here's what we'll do together
            </h2>
            <div className="space-y-4">
              {/* Bullet 1 */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <Link className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Connect your accounts
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    so I can see the full picture
                  </p>
                </div>
              </div>

              {/* Bullet 2 */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Understand your income & spending
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    without spreadsheets
                  </p>
                </div>
              </div>

              {/* Bullet 3 */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <Target className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Build your starting plan
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    for saving and managing money
                  </p>
                </div>
              </div>

              {/* Bullet 4 */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Set up your sidekick
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    so I can send you personalized tips and nudges
                  </p>
                </div>
              </div>
            </div>

            {/* Reassurance line */}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-6 text-center italic">
              No stress. No lectures. Just guidance that fits your life.
            </p>
          </CardContent>
        </Card>

        {/* Primary action */}
        <div className="flex flex-col gap-3 pt-2">
          <Button
            onClick={onPrimaryClick}
            size="lg"
            className="w-full"
          >
            Let's get started
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RibbitIntro;

