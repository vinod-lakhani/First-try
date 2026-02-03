/**
 * Terms of Service Page
 * 
 * Legal terms and conditions for WeLeap.
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TermsOfServicePage() {
  const router = useRouter();
  
  const tosVersion = "1.0.0";
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
              <h1 className="text-2xl font-semibold">Terms of Service</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Version {tosVersion} · Last updated {lastUpdated}
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
                  Welcome to WeLeap! By using our services, you agree to these Terms of Service.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">What We Provide</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  WeLeap offers personalized financial insights, planning assistance, and product suggestions based on the information you provide.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">Not Financial Advice</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  We are not a registered investment advisor, broker, or tax professional. All insights are for informational purposes only and should not be considered financial advice.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">User Responsibilities</h2>
                <ul className="ml-6 list-disc space-y-2 text-slate-700 dark:text-slate-300">
                  <li>You agree to provide accurate information to get the best recommendations.</li>
                  <li>You're responsible for your own financial decisions.</li>
                  <li>You agree not to misuse the service or share misleading or harmful information.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">Data Use</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  We handle your data according to our Privacy Policy. You retain ownership of your data, and we use it only to serve you better.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">Service Changes</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  We may modify or discontinue our services at any time. We'll notify you of significant changes.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">Limitation of Liability</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  WeLeap is not liable for any financial loss, missed opportunity, or decision made based on our recommendations.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">Questions?</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  Contact us at <a href="mailto:support@weleap.ai" className="text-primary hover:underline">support@weleap.ai</a>
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

