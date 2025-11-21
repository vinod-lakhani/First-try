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
  
  const ppVersion = "1.0.0"; // TODO: Auto-version from Git or manual update
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
                <h2 className="mb-4 text-xl font-semibold">1. Introduction</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  WeLeap ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy
                  explains how we collect, use, disclose, and safeguard your information when you use our Service.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">2. Information We Collect</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  We collect information that you provide directly to us, including:
                </p>
                <ul className="ml-6 list-disc space-y-2 text-slate-700 dark:text-slate-300">
                  <li><strong>Account Information:</strong> Email address, password, and profile information</li>
                  <li><strong>Financial Information:</strong> Income, expenses, debts, assets, and financial goals</li>
                  <li><strong>Usage Data:</strong> How you interact with the Service</li>
                  <li><strong>Device Information:</strong> IP address, browser type, and device identifiers</li>
                </ul>
                <p className="mt-4 text-slate-700 dark:text-slate-300">
                  We may also receive financial information from third-party services (such as Plaid) when you
                  connect your financial accounts.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">3. How We Use Your Information</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  We use the information we collect to:
                </p>
                <ul className="ml-6 list-disc space-y-2 text-slate-700 dark:text-slate-300">
                  <li>Provide, maintain, and improve the Service</li>
                  <li>Generate personalized financial plans and recommendations</li>
                  <li>Process transactions and send related information</li>
                  <li>Send you technical notices and support messages</li>
                  <li>Respond to your comments and questions</li>
                  <li>Monitor and analyze trends and usage</li>
                  <li>Detect, prevent, and address technical issues</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">4. Information Sharing and Disclosure</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  We do not sell your personal information. We may share your information only in the following
                  circumstances:
                </p>
                <ul className="ml-6 list-disc space-y-2 text-slate-700 dark:text-slate-300">
                  <li><strong>Service Providers:</strong> With third-party vendors who perform services on our behalf</li>
                  <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                  <li><strong>Business Transfers:</strong> In connection with a merger or acquisition</li>
                  <li><strong>With Your Consent:</strong> When you explicitly authorize us to share information</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">5. Data Security</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  We implement appropriate technical and organizational measures to protect your personal information
                  against unauthorized access, alteration, disclosure, or destruction. This includes:
                </p>
                <ul className="ml-6 list-disc space-y-2 text-slate-700 dark:text-slate-300">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Regular security assessments and updates</li>
                  <li>Access controls and authentication measures</li>
                  <li>Employee training on data protection</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">6. Your Rights and Choices</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  You have the right to:
                </p>
                <ul className="ml-6 list-disc space-y-2 text-slate-700 dark:text-slate-300">
                  <li>Access and receive a copy of your personal data</li>
                  <li>Correct inaccurate or incomplete information</li>
                  <li>Request deletion of your personal data</li>
                  <li>Object to processing of your personal data</li>
                  <li>Request restriction of processing</li>
                  <li>Data portability</li>
                </ul>
                <p className="mt-4 text-slate-700 dark:text-slate-300">
                  To exercise these rights, please contact us at privacy@weleap.com.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">7. Data Retention</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  We retain your personal information for as long as necessary to provide the Service and fulfill
                  the purposes outlined in this Privacy Policy, unless a longer retention period is required or
                  permitted by law.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">8. Changes to This Privacy Policy</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  We may update this Privacy Policy from time to time. We will notify you of any changes by posting
                  the new Privacy Policy on this page and updating the "Last updated" date. You are advised to
                  review this Privacy Policy periodically for any changes.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">9. Contact Us</h2>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  If you have any questions about this Privacy Policy, please contact us at:
                </p>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                  Email: privacy@weleap.com<br />
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

