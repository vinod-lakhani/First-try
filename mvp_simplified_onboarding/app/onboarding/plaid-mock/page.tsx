/**
 * Mock Plaid Integration Flow
 *
 * Simulates bank connection for demo. On "connect", redirects to app with connected=1.
 */

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlanSmarterHeader } from "@/components/onboarding/PlanSmarterHeader";
import { Loader2 } from "lucide-react";

const MOCK_BANKS = [
  { id: "chase", name: "Chase", logo: "🏦" },
  { id: "bofa", name: "Bank of America", logo: "🏛️" },
  { id: "wells", name: "Wells Fargo", logo: "🏢" },
  { id: "citi", name: "Citi", logo: "🏦" },
];

export default function PlaidMockPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const savings = searchParams.get("savings") || "1362";
  const projected = searchParams.get("projected") || "2000000";

  const [connecting, setConnecting] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);

  const appBackHref = `/app?savings=${savings}&projected=${projected}`;

  const handleConnect = async () => {
    if (!selectedBank) return;
    setConnecting(true);
    await new Promise((r) => setTimeout(r, 2500));
    if (returnTo === "app") {
      const q = new URLSearchParams({ connected: "1", savings, projected });
      router.push(`/app?${q.toString()}`);
    } else {
      router.push(`/onboarding/income?savings=${savings}&projected=${projected}`);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8">
      <PlanSmarterHeader title="Connect your bank" backHref={appBackHref} />

      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Connect your accounts
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-400 mb-6">
          We use Plaid to securely connect your bank. Your credentials are never stored.
        </p>

        {connecting ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Connecting to your bank...
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This usually takes a few seconds
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
              Select your bank
            </p>
            {MOCK_BANKS.map((bank) => (
              <button
                key={bank.id}
                type="button"
                onClick={() => setSelectedBank(bank.id)}
                className={`flex w-full items-center gap-4 rounded-xl border-2 px-4 py-4 text-left transition-colors ${
                  selectedBank === bank.id
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xl dark:bg-slate-700">
                  {bank.logo}
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {bank.name}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={handleConnect}
              disabled={!selectedBank}
              className="mt-6 w-full rounded-xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Connect
            </button>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        <span aria-hidden>🔒</span> Bank-level security · We never move your money
      </p>
    </div>
  );
}
