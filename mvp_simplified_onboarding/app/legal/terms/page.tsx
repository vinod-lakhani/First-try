import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/onboarding/connect"
          className="text-primary hover:underline mb-6 inline-block"
        >
          ← Back to onboarding
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          Terms of Service
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Terms of Service placeholder. Add your full terms here.
        </p>
      </div>
    </div>
  );
}
