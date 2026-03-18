/**
 * Add Assets Page
 *
 * Collects Cash, Investments, and Retirement balances for the "Make your plan smarter" feedback loop.
 */

"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlanSmarterHeader } from "@/components/onboarding/PlanSmarterHeader";

const ASSET_TYPES = [
  { id: "cash", label: "Cash", description: "Checking, savings, money market" },
  { id: "investments", label: "Investments", description: "Brokerage, stocks, bonds, ETFs" },
  { id: "retirement", label: "Retirement", description: "401(k), IRA, 403(b), etc." },
] as const;

const inputBase =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500";

function AssetsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const savings = searchParams.get("savings") || "1362";
  const projected = searchParams.get("projected") || "2000000";

  const [cash, setCash] = useState("");
  const [investments, setInvestments] = useState("");
  const [retirement, setRetirement] = useState("");

  const appBackHref = `/app?savings=${savings}&projected=${projected}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (returnTo === "app") {
      const q = new URLSearchParams({ assets: "1", savings, projected });
      router.push(`/app?${q.toString()}`);
    } else {
      router.push(`/app?savings=${savings}&projected=${projected}`);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8">
      <PlanSmarterHeader title="Track your net worth" backHref={appBackHref} />

      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Your assets
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-400 mb-6">
          Enter your current balances. Use estimates if you don&apos;t have exact numbers.
        </p>

        <div className="space-y-6">
          {ASSET_TYPES.map((asset) => {
            const value = asset.id === "cash" ? cash : asset.id === "investments" ? investments : retirement;
            const setValue = asset.id === "cash" ? setCash : asset.id === "investments" ? setInvestments : setRetirement;
            return (
              <div
                key={asset.id}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"
              >
                <label className="block">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {asset.label}
                  </span>
                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                    {asset.description}
                  </span>
                </label>
                <div className="relative mt-3">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0"
                    className={`${inputBase} pl-8`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Button type="submit" size="lg" className="w-full">
          See my net worth
        </Button>
      </form>
    </div>
  );
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-xl mx-auto px-4 py-8 animate-pulse" />}>
      <AssetsPageContent />
    </Suspense>
  );
}
