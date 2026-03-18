/**
 * Add Debts Page
 *
 * Collects loans and credit card debt for the "Make your plan smarter" feedback loop.
 */

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlanSmarterHeader } from "@/components/onboarding/PlanSmarterHeader";

const LOAN_TYPES = [
  "Student Loan",
  "Mortgage",
  "Personal Loan",
  "Auto Loan",
  "Home Equity",
  "Other",
];

type LoanEntry = {
  id: string;
  type: string;
  balance: string;
  rate: string;
  months: string;
  label: string;
};

type CreditCardEntry = {
  id: string;
  name: string;
  balance: string;
  rate: string;
  minPayment: string;
};

const inputBase =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500";

function parseNum(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export default function DebtsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const savings = searchParams.get("savings") || "1362";
  const projected = searchParams.get("projected") || "2000000";

  const [hasLoans, setHasLoans] = useState(false);
  const [loans, setLoans] = useState<LoanEntry[]>([
    { id: "1", type: "", balance: "", rate: "", months: "", label: "" },
  ]);

  const [hasCreditCards, setHasCreditCards] = useState(false);
  const [creditCards, setCreditCards] = useState<CreditCardEntry[]>([
    { id: "1", name: "", balance: "", rate: "", minPayment: "" },
  ]);

  const appBackHref = `/app?savings=${savings}&projected=${projected}`;

  const addLoan = () => {
    setLoans((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        type: "",
        balance: "",
        rate: "",
        months: "",
        label: "",
      },
    ]);
  };

  const removeLoan = (id: string) => {
    if (loans.length <= 1) return;
    setLoans((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLoan = (id: string, field: keyof LoanEntry, value: string) => {
    setLoans((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  const addCreditCard = () => {
    setCreditCards((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: "",
        balance: "",
        rate: "",
        minPayment: "",
      },
    ]);
  };

  const removeCreditCard = (id: string) => {
    if (creditCards.length <= 1) return;
    setCreditCards((prev) => prev.filter((c) => c.id !== id));
  };

  const updateCreditCard = (
    id: string,
    field: keyof CreditCardEntry,
    value: string
  ) => {
    setCreditCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (returnTo === "app") {
      const q = new URLSearchParams({ debts: "1", savings, projected });
      router.push(`/app?${q.toString()}`);
    } else {
      router.push(`/onboarding/income?savings=${savings}&projected=${projected}`);
    }
  };

  const loansValid =
    !hasLoans ||
    loans.every(
      (l) =>
        l.type &&
        parseNum(l.balance) > 0 &&
        parseNum(l.rate) >= 0 &&
        parseNum(l.months) > 0
    );
  const cardsValid =
    !hasCreditCards ||
    creditCards.every(
      (c) =>
        parseNum(c.balance) > 0 &&
        parseNum(c.rate) >= 0 &&
        parseNum(c.minPayment) >= 0
    );
  const canSubmit = loansValid && cardsValid;

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8">
      <PlanSmarterHeader title="Add Debts" backHref={appBackHref} />

      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Loans
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-400 mb-4">
          Do you have any current Loans?
        </p>
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setHasLoans(true)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              hasLoans
                ? "bg-primary text-primary-foreground"
                : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setHasLoans(false)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              !hasLoans
                ? "bg-primary text-primary-foreground"
                : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
            }`}
          >
            No
          </button>
        </div>

        {hasLoans && (
          <div className="space-y-6">
            {loans.map((loan, idx) => (
              <div
                key={loan.id}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Loan #{idx + 1}
                  </h3>
                  {loans.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLoan(loan.id)}
                      className="text-xs text-slate-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Loan Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={loan.type}
                      onChange={(e) => updateLoan(loan.id, "type", e.target.value)}
                      className={inputBase}
                      required={hasLoans}
                    >
                      <option value="">Select Type</option>
                      {LOAN_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Outstanding Balance <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                        $
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={loan.balance}
                        onChange={(e) =>
                          updateLoan(loan.id, "balance", e.target.value)
                        }
                        placeholder="0.00"
                        className={`${inputBase} pl-8`}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Interest Rate <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                          %
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={loan.rate}
                          onChange={(e) =>
                            updateLoan(loan.id, "rate", e.target.value)
                          }
                          placeholder="0.00"
                          className={`${inputBase} pl-8`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Months Remaining <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={loan.months}
                        onChange={(e) =>
                          updateLoan(loan.id, "months", e.target.value)
                        }
                        placeholder="0"
                        className={inputBase}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Label (Optional)
                    </label>
                    <input
                      type="text"
                      value={loan.label}
                      onChange={(e) =>
                        updateLoan(loan.id, "label", e.target.value)
                      }
                      placeholder="e.g., Car Loan"
                      className={inputBase}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addLoan}
              className="w-full rounded-lg border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600 hover:border-primary hover:text-primary dark:border-slate-600 dark:text-slate-400 dark:hover:border-primary dark:hover:text-primary"
            >
              + Add New Loan
            </button>
          </div>
        )}
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Credit Cards with a balance
        </h2>
        <p className="text-base text-slate-600 dark:text-slate-400 mb-4">
          Do you have any Credit Cards?
        </p>
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setHasCreditCards(true)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              hasCreditCards
                ? "bg-primary text-primary-foreground"
                : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setHasCreditCards(false)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              !hasCreditCards
                ? "bg-primary text-primary-foreground"
                : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
            }`}
          >
            No
          </button>
        </div>

        {hasCreditCards && (
          <div className="space-y-6">
            {creditCards.map((card, idx) => (
              <div
                key={card.id}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Credit Card #{idx + 1}
                  </h3>
                  {creditCards.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCreditCard(card.id)}
                      className="text-xs text-slate-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Name
                    </label>
                    <input
                      type="text"
                      value={card.name}
                      onChange={(e) =>
                        updateCreditCard(card.id, "name", e.target.value)
                      }
                      placeholder="e.g., Chase Credit Card"
                      className={inputBase}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Balance Amount <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                        $
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={card.balance}
                        onChange={(e) =>
                          updateCreditCard(card.id, "balance", e.target.value)
                        }
                        placeholder="0.00"
                        className={`${inputBase} pl-8`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Interest Rate <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                        %
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={card.rate}
                        onChange={(e) =>
                          updateCreditCard(card.id, "rate", e.target.value)
                        }
                        placeholder="0.00"
                        className={`${inputBase} pl-8`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Minimum Payment <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                        $
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={card.minPayment}
                        onChange={(e) =>
                          updateCreditCard(card.id, "minPayment", e.target.value)
                        }
                        placeholder="0.00"
                        className={`${inputBase} pl-8`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addCreditCard}
              className="w-full rounded-lg border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600 hover:border-primary hover:text-primary dark:border-slate-600 dark:text-slate-400 dark:hover:border-primary dark:hover:text-primary"
            >
              + Add New Credit Card
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!canSubmit}
        >
          See my interest impact
        </Button>
      </form>
    </div>
  );
}
