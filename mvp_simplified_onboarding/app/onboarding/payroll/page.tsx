/**
 * Add Payroll Deductions Page
 *
 * Collects 401(k) and HSA details for the "Make your plan smarter" feedback loop.
 */

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlanSmarterHeader } from "@/components/onboarding/PlanSmarterHeader";
import { Info } from "lucide-react";

const FREQUENCY_OPTIONS = [
  "Every Paycheck (Bi-weekly)",
  "Every Paycheck (Weekly)",
  "Twice per month",
  "Monthly",
];

const inputBase =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500";

export default function PayrollPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const savings = searchParams.get("savings") || "1362";
  const projected = searchParams.get("projected") || "2000000";

  const [has401kMatch, setHas401kMatch] = useState(false);
  const [matchPct, setMatchPct] = useState("");
  const [matchUpToPct, setMatchUpToPct] = useState("");
  const [contributing401k, setContributing401k] = useState(false);
  const [contribType401k, setContribType401k] = useState<"%" | "$">("%");
  const [contribPct401k, setContribPct401k] = useState("");
  const [contribAmount401k, setContribAmount401k] = useState("");
  const [freq401k, setFreq401k] = useState(FREQUENCY_OPTIONS[0]);

  const [employerOffersHsa, setEmployerOffersHsa] = useState(false);
  const [employerHsaContrib, setEmployerHsaContrib] = useState("");
  const [contributingHsa, setContributingHsa] = useState(false);
  const [contribTypeHsa, setContribTypeHsa] = useState<"%" | "$">("%");
  const [contribPctHsa, setContribPctHsa] = useState("");
  const [contribAmountHsa, setContribAmountHsa] = useState("");
  const [freqHsa, setFreqHsa] = useState(FREQUENCY_OPTIONS[0]);

  const appBackHref = `/app?savings=${savings}&projected=${projected}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (returnTo === "app") {
      const q = new URLSearchParams({ payroll: "1", savings, projected });
      router.push(`/app?${q.toString()}`);
    } else {
      router.push(`/app?savings=${savings}&projected=${projected}`);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8">
      <PlanSmarterHeader title="Payroll Deductions" backHref={appBackHref} />

      {/* Employer Retirement Plan (401k) */}
      <div className="mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-6">
          Employer Retirement Plan
        </h1>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Does your employer offer a 401(k) match?
            </p>
            <button
              type="button"
              className="rounded-full p-1 text-slate-400 hover:text-slate-600"
              aria-label="More info"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setHas401kMatch(true)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                has401kMatch
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setHas401kMatch(false)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                !has401kMatch
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
              }`}
            >
              No
            </button>
          </div>
        </div>

        {has401kMatch && (
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Match % (0-100)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={matchPct}
                  onChange={(e) => setMatchPct(e.target.value)}
                  placeholder="% Amount"
                  className={`${inputBase} pr-10`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                  %
                </span>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Up to % of Pay (0-15)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={matchUpToPct}
                  onChange={(e) => setMatchUpToPct(e.target.value)}
                  placeholder="% Amount"
                  className={`${inputBase} pr-10`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                  %
                </span>
              </div>
            </div>
          </div>
        )}
        {has401kMatch && (
          <p className="mb-6 text-xs text-slate-500 dark:text-slate-400">
            Example: 50% Match up to 6% of Pay.
          </p>
        )}

        <div className="mb-6">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Are you contributing to 401(k)?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setContributing401k(true)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                contributing401k
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setContributing401k(false)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                !contributing401k
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
              }`}
            >
              No
            </button>
          </div>
        </div>

        {contributing401k && (
          <div className="mb-6 space-y-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              How much are you contributing?
            </p>
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="contrib401k"
                  checked={contribType401k === "%"}
                  onChange={() => setContribType401k("%")}
                  className="mt-1 h-4 w-4 border-slate-300 text-primary focus:ring-primary"
                />
                <div className="flex-1">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    % of Gross Income
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={contribPct401k}
                    onChange={(e) => setContribPct401k(e.target.value)}
                    placeholder="% of Gross Income"
                    className={`${inputBase} mt-2`}
                    disabled={contribType401k !== "%"}
                  />
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="contrib401k"
                  checked={contribType401k === "$"}
                  onChange={() => setContribType401k("$")}
                  className="mt-1 h-4 w-4 border-slate-300 text-primary focus:ring-primary"
                />
                <div className="flex-1">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    $ Amount
                  </span>
                  <div className="relative mt-2">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={contribAmount401k}
                      onChange={(e) => setContribAmount401k(e.target.value)}
                      placeholder="$ Amount"
                      className={`${inputBase} pl-8`}
                      disabled={contribType401k !== "$"}
                    />
                  </div>
                </div>
              </label>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Contribution Frequency
              </label>
              <select
                value={freq401k}
                onChange={(e) => setFreq401k(e.target.value)}
                className={inputBase}
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Health Savings Contribution (HSA) */}
      <div className="mb-10">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
          Health Savings Contribution
        </h2>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Does your employer offer HSA?
            </p>
            <button
              type="button"
              className="rounded-full p-1 text-slate-400 hover:text-slate-600"
              aria-label="More info"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEmployerOffersHsa(true)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                employerOffersHsa
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setEmployerOffersHsa(false)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                !employerOffersHsa
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
              }`}
            >
              No
            </button>
          </div>
        </div>

        {employerOffersHsa && (
          <div className="mb-6">
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Your employer contribution per month.
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={employerHsaContrib}
                onChange={(e) => setEmployerHsaContrib(e.target.value)}
                placeholder="0"
                className={`${inputBase} pl-8`}
              />
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Do you contribute to an HSA?
            </p>
            <button
              type="button"
              className="rounded-full p-1 text-slate-400 hover:text-slate-600"
              aria-label="More info"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setContributingHsa(true)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                contributingHsa
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setContributingHsa(false)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                !contributingHsa
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
              }`}
            >
              No
            </button>
          </div>
        </div>

        {contributingHsa && (
          <div className="mb-6 space-y-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              How much would you like to contribute?
            </p>
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="contribHsa"
                  checked={contribTypeHsa === "%"}
                  onChange={() => setContribTypeHsa("%")}
                  className="mt-1 h-4 w-4 border-slate-300 text-primary focus:ring-primary"
                />
                <div className="flex-1">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    % of Gross Income
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={contribPctHsa}
                    onChange={(e) => setContribPctHsa(e.target.value)}
                    placeholder="0"
                    className={`${inputBase} mt-2`}
                    disabled={contribTypeHsa !== "%"}
                  />
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="contribHsa"
                  checked={contribTypeHsa === "$"}
                  onChange={() => setContribTypeHsa("$")}
                  className="mt-1 h-4 w-4 border-slate-300 text-primary focus:ring-primary"
                />
                <div className="flex-1">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    $ Amount
                  </span>
                  <div className="relative mt-2">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={contribAmountHsa}
                      onChange={(e) => setContribAmountHsa(e.target.value)}
                      placeholder="$ Amount"
                      className={`${inputBase} pl-8`}
                      disabled={contribTypeHsa !== "$"}
                    />
                  </div>
                </div>
              </label>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Contribution Frequency
              </label>
              <select
                value={freqHsa}
                onChange={(e) => setFreqHsa(e.target.value)}
                className={inputBase}
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <Button type="submit" size="lg" className="w-full">
          See my automatic savings
        </Button>
      </form>
    </div>
  );
}
