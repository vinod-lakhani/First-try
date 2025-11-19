import Link from 'next/link';
import Cluster2ReportMockups from './Cluster2ReportMockups';
import PaydayAnalyzerCylinders from './PaydayAnalyzerCylinders';
import PaycheckTimelineVisualizer from './PaycheckTimelineVisualizer';
import MonthlyVisualizer from './MonthlyVisualizer';

export default function Home() {
  return (
    <div className="flex flex-col gap-8 items-center p-8">
      <div className="w-full max-w-4xl mb-8">
        <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-slate-800">
          <h1 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">
            WeLeap Mockups
          </h1>
          <div className="space-y-2">
            <Link
              href="/onboarding"
              className="block rounded-md bg-primary px-4 py-3 text-center font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              Start Onboarding Flow →
            </Link>
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center mt-2">
              Test the complete onboarding experience
            </p>
          </div>
        </div>
      </div>
      <Cluster2ReportMockups />
      <PaydayAnalyzerCylinders />
      <PaycheckTimelineVisualizer />
      <MonthlyVisualizer />
    </div>
  );
}
