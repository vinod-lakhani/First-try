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
  
  const tosVersion = "1.0.0"; // TODO: Auto-version from Git or manual update
  const lastUpdated = "2025-01-20";

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
                <h2 className="mb-4 text-xl font-semibold">1. Acceptance of Terms</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  By accessing or using WeLeap ("Service"), you agree to be bound by these Terms of Service ("Terms").
                  If you disagree with any part of these terms, then you may not access the Service.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">2. Description of Service</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  WeLeap is a financial planning and budgeting application that helps users manage their income,
                  expenses, savings, and financial goals. The Service includes:
                </p>
                <ul className="ml-6 list-disc space-y-2 text-slate-700 dark:text-slate-300">
                  <li>Income allocation and budgeting tools</li>
                  <li>Savings optimization recommendations</li>
                  <li>Debt payoff planning</li>
                  <li>Net worth tracking and projections</li>
                  <li>Financial goal tracking</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">3. Financial Information</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  WeLeap may connect to your financial accounts through third-party services (such as Plaid) to
                  provide accurate financial data. You are responsible for maintaining the security of your account
                  credentials and for all activities that occur under your account.
                </p>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  WeLeap provides financial planning tools and recommendations, but does not provide financial,
                  investment, legal, or tax advice. You should consult with qualified professionals for such advice.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">4. User Responsibilities</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  You are responsible for:
                </p>
                <ul className="ml-6 list-disc space-y-2 text-slate-700 dark:text-slate-300">
                  <li>Providing accurate and complete information</li>
                  <li>Maintaining the security of your account</li>
                  <li>All activities under your account</li>
                  <li>Compliance with all applicable laws and regulations</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">5. Privacy and Data</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  Your use of the Service is also governed by our Privacy Policy. Please review our Privacy Policy
                  to understand our practices regarding the collection and use of your information.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">6. Limitation of Liability</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  WeLeap and its affiliates shall not be liable for any indirect, incidental, special, consequential,
                  or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other
                  intangible losses, resulting from your use of the Service.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">7. Changes to Terms</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  We reserve the right to modify these Terms at any time. If we make material changes, we will notify
                  you through the Service or by email. Your continued use of the Service after such modifications
                  constitutes your acceptance of the updated Terms.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">8. Contact Information</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  If you have any questions about these Terms, please contact us at:
                </p>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  Email: legal@weleap.com<br />
                  Address: WeLeap, Inc., San Francisco, CA
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

