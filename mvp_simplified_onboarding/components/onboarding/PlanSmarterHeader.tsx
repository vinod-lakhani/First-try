"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";

type PlanSmarterHeaderProps = {
  title: string;
  backHref: string;
};

export function PlanSmarterHeader({ title, backHref }: PlanSmarterHeaderProps) {
  const router = useRouter();

  return (
    <div className="mb-6 flex items-center justify-between">
      <button
        type="button"
        onClick={() => router.push(backHref)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="Go back"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <span className="text-sm font-semibold text-slate-900 dark:text-white">
        {title}
      </span>
      <button
        type="button"
        onClick={() => router.push("/app")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>
    </div>
  );
}
