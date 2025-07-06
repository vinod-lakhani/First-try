import Cluster2ReportMockups from './Cluster2ReportMockups';
import PaydayAnalyzerCylinders from './PaydayAnalyzerCylinders';
import PaycheckTimelineVisualizer from './PaycheckTimelineVisualizer';
import MonthlyVisualizer from './MonthlyVisualizer';

export default function Home() {
  return (
    <div className="flex flex-col gap-8 items-center">
      <Cluster2ReportMockups />
      <PaydayAnalyzerCylinders />
      <PaycheckTimelineVisualizer />
      <MonthlyVisualizer />
    </div>
  );
}
