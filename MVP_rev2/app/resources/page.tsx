/**
 * Resources Page
 *
 * Public-facing landing page listing WeLeap tools and calculators.
 * No authentication required.
 */

import Link from 'next/link';

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b bg-white dark:bg-slate-900">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            WeLeap
          </Link>
          <Link
            href="/onboarding"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Resources</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Free tools to help you make smarter money moves — no account needed.
        </p>

        {/* Tools grid */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {/* Ribbit Rent Tool card */}
          <Link
            href="/resources/rent-tool"
            className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
          >
            {/* Icon */}
            <div className="mb-4 h-12 w-12 overflow-hidden rounded-full bg-black shadow-sm">
              <img
                src="/ribbit.png"
                alt="Ribbit"
                className="h-full w-full object-cover"
                style={{ objectPosition: '50% 10%' }}
              />
            </div>

            {/* Content */}
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition-colors">
              Rent Affordability Tool
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Chat with Ribbit to find out what rent you can actually afford — and get a clear Day 0 plan before you sign anything.
            </p>

            <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span>Start the chat</span>
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </div>
          </Link>

          {/* Placeholder — more tools coming soon */}
          <div className="flex flex-col rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900/50">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl dark:bg-slate-800">
              ✨
            </div>
            <h2 className="text-lg font-semibold text-slate-400 dark:text-slate-600">More coming soon</h2>
            <p className="mt-1.5 text-sm text-slate-400 dark:text-slate-600 leading-relaxed">
              Savings calculators, budget planners, and more tools are on the way.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
