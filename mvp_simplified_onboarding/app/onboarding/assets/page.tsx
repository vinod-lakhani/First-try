/**
 * Add Assets Page
 *
 * Collects investments, retirement, HSA, and other asset flags
 * (cash/savings come from linked accounts via Plaid).
 */

"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlanSmarterHeader } from "@/components/onboarding/PlanSmarterHeader";

const INVESTMENT_TYPES = ["Brokerage", "Crypto", "ETFs / mutual funds", "Other"];

const RETIREMENT_TYPES = [
  "401(k)",
  "Roth IRA",
  "Traditional IRA",
  "403(b)",
  "457",
  "SEP IRA",
  "Other",
];

const inputBase =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500";

function parseMoney(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function newId() {
  return String(Date.now()) + Math.random().toString(36).slice(2, 8);
}

type InvestmentEntry = { id: string; investmentType: string; value: string; label: string };
type RetirementEntry = {
  id: string;
  accountType: string;
  balance: string;
  label: string;
};

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl">{title}</h2>
      <p className="mt-2 text-base text-slate-500 dark:text-slate-400">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{children}</p>;
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="grid overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`border-r border-slate-300 py-3 text-sm font-semibold last:border-r-0 dark:border-slate-600 ${
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function AssetsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const savings = searchParams.get("savings") || "1362";
  const projected = searchParams.get("projected") || "2000000";

  const appBackHref = `/app?savings=${savings}&projected=${projected}`;

  const [trackAssets, setTrackAssets] = useState<"Yes" | "No">("Yes");

  const [hasInvestments, setHasInvestments] = useState<"Yes" | "No">("Yes");
  const [investments, setInvestments] = useState<InvestmentEntry[]>([
    { id: "1", investmentType: "Brokerage", value: "", label: "" },
  ]);

  const [hasRetirement, setHasRetirement] = useState<"Yes" | "No">("Yes");
  const [retirementAccounts, setRetirementAccounts] = useState<RetirementEntry[]>([
    { id: "1", accountType: "401(k)", balance: "", label: "" },
  ]);

  const [hasHsa, setHasHsa] = useState<"Yes" | "No">("Yes");
  const [hsaBalance, setHsaBalance] = useState("");
  const [hsaLabel, setHsaLabel] = useState("");

  const addInvestment = () =>
    setInvestments((prev) => [
      ...prev,
      { id: newId(), investmentType: "Brokerage", value: "", label: "" },
    ]);
  const removeInvestment = (id: string) => {
    if (investments.length <= 1) return;
    setInvestments((prev) => prev.filter((i) => i.id !== id));
  };
  const updateInvestment = (id: string, field: keyof InvestmentEntry, value: string) => {
    setInvestments((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const addRetirement = () =>
    setRetirementAccounts((prev) => [
      ...prev,
      { id: newId(), accountType: "401(k)", balance: "", label: "" },
    ]);
  const removeRetirement = (id: string) => {
    if (retirementAccounts.length <= 1) return;
    setRetirementAccounts((prev) => prev.filter((r) => r.id !== id));
  };
  const updateRetirement = (id: string, field: keyof RetirementEntry, value: string) => {
    setRetirementAccounts((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const estimatedTotal = useMemo(() => {
    let t = 0;
    if (trackAssets === "Yes") {
      if (hasInvestments === "Yes") {
        for (const i of investments) t += parseMoney(i.value);
      }
      if (hasRetirement === "Yes") {
        for (const r of retirementAccounts) t += parseMoney(r.balance);
      }
      if (hasHsa === "Yes") t += parseMoney(hsaBalance);
    }
    return t;
  }, [trackAssets, hasInvestments, investments, hasRetirement, retirementAccounts, hasHsa, hsaBalance]);

  const invValid =
    hasInvestments === "No" ||
    investments.every(
      (i) => i.investmentType && i.value.trim() !== "" && parseMoney(i.value) >= 0
    );
  const retValid =
    hasRetirement === "No" ||
    retirementAccounts.every(
      (r) => r.accountType && r.balance.trim() !== "" && parseMoney(r.balance) >= 0
    );
  const hsaValid = hasHsa === "No" || hsaBalance.trim() !== "";

  const canSubmit = trackAssets === "No" ? true : invValid && retValid && hsaValid;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (returnTo === "app") {
      const q = new URLSearchParams({ assets: "1", savings, projected });
      router.push(`/app?${q.toString()}`);
    } else {
      router.push(`/app?savings=${savings}&projected=${projected}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-6 pb-4 pt-8 dark:border-slate-700 sm:px-8">
          <PlanSmarterHeader title="Add Assets" backHref={appBackHref} />
          <div className="mt-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Assets
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Add what you already own so your net worth and growth plan stay accurate.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8 px-6 py-8 sm:px-8">
          <SectionCard
            title="Do you have assets to track?"
            subtitle="Investments and retirement accounts. Cash balances come from your linked bank accounts."
          >
            <Segmented<"Yes" | "No"> options={["Yes", "No"] as const} value={trackAssets} onChange={setTrackAssets} />
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Select Yes or No to continue.</p>
          </SectionCard>

          {trackAssets === "Yes" && (
            <>
              <SectionCard
                title="Investments"
                subtitle="Brokerage, crypto, or other non-retirement investments."
              >
                <FieldLabel>Do you have investments?</FieldLabel>
                <Segmented<"Yes" | "No"> options={["Yes", "No"] as const} value={hasInvestments} onChange={setHasInvestments} />

                {hasInvestments === "Yes" && (
                  <>
                    <div className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-slate-50/40 p-4 dark:border-slate-600 dark:bg-slate-800/40 sm:p-5">
                      {investments.map((inv, idx) => (
                        <div key={inv.id} className="space-y-4">
                          {investments.length > 1 && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Investment #{idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeInvestment(inv.id)}
                                className="text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Investment Type <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={inv.investmentType}
                                onChange={(e) => updateInvestment(inv.id, "investmentType", e.target.value)}
                                className={inputBase}
                              >
                                {INVESTMENT_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Current Value <span className="text-red-500">*</span>
                              </label>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={inv.value}
                                  onChange={(e) => updateInvestment(inv.id, "value", e.target.value)}
                                  placeholder="0.00"
                                  className={`${inputBase} pl-8`}
                                />
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                              Label (Optional)
                            </label>
                            <input
                              type="text"
                              value={inv.label}
                              onChange={(e) => updateInvestment(inv.id, "label", e.target.value)}
                              placeholder="e.g., Vanguard Taxable"
                              className={inputBase}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addInvestment}
                      className="mt-4 w-full rounded-lg border border-slate-300 bg-white py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      + Add New Investment
                    </button>
                  </>
                )}
              </SectionCard>

              <SectionCard
                title="Retirement"
                subtitle="401(k), Roth IRA, Traditional IRA, or other retirement accounts."
              >
                <FieldLabel>Do you have retirement accounts?</FieldLabel>
                <Segmented<"Yes" | "No"> options={["Yes", "No"] as const} value={hasRetirement} onChange={setHasRetirement} />

                {hasRetirement === "Yes" && (
                  <>
                    <div className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-slate-50/40 p-4 dark:border-slate-600 dark:bg-slate-800/40 sm:p-5">
                      {retirementAccounts.map((r, idx) => (
                        <div key={r.id} className="space-y-4">
                          {retirementAccounts.length > 1 && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Account #{idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeRetirement(r.id)}
                                className="text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Account Type <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={r.accountType}
                                onChange={(e) => updateRetirement(r.id, "accountType", e.target.value)}
                                className={inputBase}
                              >
                                {RETIREMENT_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Current Balance <span className="text-red-500">*</span>
                              </label>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={r.balance}
                                  onChange={(e) => updateRetirement(r.id, "balance", e.target.value)}
                                  placeholder="0.00"
                                  className={`${inputBase} pl-8`}
                                />
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                              Label (Optional)
                            </label>
                            <input
                              type="text"
                              value={r.label}
                              onChange={(e) => updateRetirement(r.id, "label", e.target.value)}
                              placeholder="e.g., Employer 401(k)"
                              className={inputBase}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addRetirement}
                      className="mt-4 w-full rounded-lg border border-slate-300 bg-white py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      + Add New Retirement Account
                    </button>
                  </>
                )}
              </SectionCard>

              <SectionCard title="Health savings account" subtitle="Include your HSA if you have one.">
                <FieldLabel>Do you have an HSA?</FieldLabel>
                <Segmented<"Yes" | "No"> options={["Yes", "No"] as const} value={hasHsa} onChange={setHasHsa} />

                {hasHsa === "Yes" && (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/40 p-4 dark:border-slate-600 dark:bg-slate-800/40 sm:p-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                          Current Balance <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={hsaBalance}
                            onChange={(e) => setHsaBalance(e.target.value)}
                            placeholder="0.00"
                            className={`${inputBase} pl-8`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                          Label (Optional)
                        </label>
                        <input
                          type="text"
                          value={hsaLabel}
                          onChange={(e) => setHsaLabel(e.target.value)}
                          placeholder="e.g., Fidelity HSA"
                          className={inputBase}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </SectionCard>
            </>
          )}

          {trackAssets === "Yes" && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-800/60 dark:bg-emerald-950/40">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div>
                  <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">What you&apos;ve already built</p>
                  <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200/90">
                    Once saved, Ribbit can use these balances to show your real net worth and recommend the next best move.
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  {estimatedTotal > 0
                    ? `~$${estimatedTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })} tracked`
                    : "Net worth ready"}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push(appBackHref)}
              className="flex-1 rounded-xl border border-slate-300 bg-white py-4 text-lg font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <Button type="submit" size="lg" disabled={!canSubmit} className="flex-1 py-6 text-lg font-semibold">
              Save assets
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 p-8 dark:bg-slate-950 animate-pulse" />}>
      <AssetsPageContent />
    </Suspense>
  );
}
