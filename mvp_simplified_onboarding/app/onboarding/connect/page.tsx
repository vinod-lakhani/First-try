/**
 * Connect / Setup Page
 *
 * Second step of onboarding - collects personal and financial details.
 */

"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";

const AGE_RANGES = [
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
];

const EMPLOYMENT_TYPES = [
  "Full-time",
  "Part-time",
  "Self-employed",
  "Contract",
  "Unemployed",
  "Retired",
  "Student",
];

const DEPENDENTS = ["0", "1", "2", "3", "4", "5+"];

const MARITAL_STATUSES = ["Single", "Married", "Domestic Partnership", "Divorced", "Widowed"];

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming",
];

function ConnectPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const savingsParam = searchParams.get("savings");
  const projectedParam = searchParams.get("projected");
  const [ageRange, setAgeRange] = useState("25-34");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [dependents, setDependents] = useState("0");
  const [maritalStatus, setMaritalStatus] = useState("Single");
  const [annualIncome, setAnnualIncome] = useState("");
  const [state, setState] = useState("California");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(annualIncome.replace(/[^0-9]/g, ""), 10);
    const annual = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    const savings = savingsParam || "1362";
    const projected = projectedParam || "2000000";

    if (returnTo === "app") {
      const q = new URLSearchParams({ connected: "1", savings, projected });
      if (annual) q.set("annualIncome", String(annual));
      router.push(`/app?${q.toString()}`);
    } else {
      const params = annual ? `?annualIncome=${annual}` : "";
      router.push(`/onboarding/income${params}`);
    }
  };

  const inputBase =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500";

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8">
      <OnboardingProgress currentStep="connect" showClose />

      {/* Title */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Let&apos;s Get You Set Up
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-400">
          We need a few required details to continue and ensure everything is set
          up correctly.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Form fields - 2 columns on larger screens */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Age Range <span className="text-red-500">*</span>
            </label>
            <select
              value={ageRange}
              onChange={(e) => setAgeRange(e.target.value)}
              className={inputBase}
              required
            >
              {AGE_RANGES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Employment Type <span className="text-red-500">*</span>
            </label>
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              className={inputBase}
              required
            >
              {EMPLOYMENT_TYPES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Number of Dependents <span className="text-red-500">*</span>
            </label>
            <select
              value={dependents}
              onChange={(e) => setDependents(e.target.value)}
              className={inputBase}
              required
            >
              {DEPENDENTS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Marital Status <span className="text-red-500">*</span>
            </label>
            <select
              value={maritalStatus}
              onChange={(e) => setMaritalStatus(e.target.value)}
              className={inputBase}
              required
            >
              {MARITAL_STATUSES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Annual Gross Income <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={annualIncome}
              onChange={(e) => setAnnualIncome(e.target.value)}
              placeholder="e.g. 85000"
              className={inputBase}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              State <span className="text-red-500">*</span>
            </label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className={inputBase}
              required
            >
              {US_STATES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Terms checkbox */}
        <div className="space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              I agree to the{" "}
              <Link
                href="/legal/terms"
                className="underline text-primary hover:no-underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/legal/privacy"
                className="underline text-primary hover:no-underline"
              >
                Privacy Policy
              </Link>
            </span>
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 pl-7">
            By checking this box, you acknowledge that you have read and agree to
            our Terms of Service and Privacy Policy.
          </p>
        </div>

        {/* CTA */}
        <Button type="submit" size="lg" className="w-full">
          How much could I save
        </Button>
      </form>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-xl mx-auto px-4 py-8 animate-pulse" />}>
      <ConnectPageContent />
    </Suspense>
  );
}
