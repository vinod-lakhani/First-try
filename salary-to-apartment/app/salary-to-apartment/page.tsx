import { OfferTool } from '@/components/OfferTool';

export const metadata = {
  title: 'Salary-to-Apartment Translator | WeLeap',
  description: 'Turn your job offer into a clear rent range — before you sign anything.',
};

export default function SalaryToApartmentPage() {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        {/* Hero Section */}
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-[#111827]">
            Salary-to-Apartment Translator
          </h1>
          <p className="text-xl text-[#111827]/80 max-w-2xl mx-auto">
            Turn your job offer into a clear rent range — before you sign anything.
          </p>
          <p className="text-sm text-[#111827]/60">
            No download. No jargon. Estimates only.
          </p>
          <a
            href="#calculator"
            className="inline-block mt-6 bg-[#3F6B42] text-white px-6 py-3 rounded-md font-medium hover:bg-[#3F6B42]/90 transition-colors"
          >
            Translate my offer
          </a>
        </div>

        {/* Calculator Section */}
        <div id="calculator" className="scroll-mt-8">
          <OfferTool />
        </div>
      </div>
    </div>
  );
}
