/**
 * Privacy Policy Page
 * 
 * Privacy policy for WeLeap.
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicyPage() {
  const router = useRouter();
  
  const ppVersion = "1.0.0";
  const lastUpdated = "2025-08-27";

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Privacy Policy</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Version {ppVersion} · Last updated {lastUpdated}
              </p>
            </div>
          </div>

          {/* Content */}
          <Card>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none pt-6">
              <section className="mb-8">
                <p className="mb-6 text-slate-700 dark:text-slate-300">
                  <strong>Effective Date: August 27, 2025</strong>
                </p>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  At WeLeap, your privacy is our priority. This Privacy Policy explains how we collect, use, and protect your information when you use our services.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">What We Collect</h2>
                <ul className="ml-6 list-disc space-y-2 text-slate-700 dark:text-slate-300">
                  <li><strong>Information you provide:</strong> name, email, financial goals, and basic demographic info.</li>
                  <li><strong>Financial data (with your consent):</strong> transaction and account data via integrations like Plaid.</li>
                  <li><strong>Usage data:</strong> how you interact with the service, so we can improve the experience.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">How We Use It</h2>
                <ul className="ml-6 list-disc space-y-2 text-slate-700 dark:text-slate-300">
                  <li>To generate personalized financial reports and recommendations.</li>
                  <li>To improve our models and services, in an anonymized and aggregated way.</li>
                  <li>To contact you with relevant updates or offers (you can opt out anytime).</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">What We Don't Do</h2>
                <ul className="ml-6 list-disc space-y-2 text-slate-700 dark:text-slate-300">
                  <li>We do not sell your personal information.</li>
                  <li>We do not access your financial accounts without your permission.</li>
                  <li>We do not share your data with third parties without your explicit consent.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">Your Rights</h2>
                <ul className="ml-6 list-disc space-y-2 text-slate-700 dark:text-slate-300">
                  <li>You can request to view, delete, or update your data at any time.</li>
                  <li>You can opt out of communications or data collection features.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">Security</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  We use bank-level encryption and secure servers to store and process your information.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">Questions?</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  Reach us at <a href="mailto:support@weleap.ai" className="text-primary hover:underline">support@weleap.ai</a>
                </p>
              </section>
            </CardContent>
          </Card>

          {/* Footer Actions */}
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => router.back()}>
              Back
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

