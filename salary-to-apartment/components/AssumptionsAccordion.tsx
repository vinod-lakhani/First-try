'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface AssumptionsAccordionProps {
  taxSource: 'api_ninjas' | 'fallback';
}

export function AssumptionsAccordion({ taxSource }: AssumptionsAccordionProps) {
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="assumptions" className="border-[#D1D5DB]">
        <AccordionTrigger className="text-[#111827] hover:no-underline">
          Assumptions
        </AccordionTrigger>
        <AccordionContent className="text-sm text-[#111827]/80 space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Tax Calculation</h4>
            <p>
              {taxSource === 'api_ninjas' 
                ? 'Tax estimates based on API Ninjas Income Tax Calculator for 2026 tax year.'
                : 'Tax estimates based on conservative effective tax rates (fallback method used).'}
            </p>
            <p className="mt-2 text-xs text-[#111827]/60">
              Federal, state, and FICA taxes included. Actual taxes may vary based on deductions,
              filing status, and other factors.
            </p>
          </div>

          <div className="border-t border-[#D1D5DB] pt-4">
            <h4 className="font-semibold mb-2">Rent Range Rule</h4>
            <p>
              The safe rent range is calculated as 28–35% of your monthly take-home pay (after
              taxes and debt payments). This follows the common budgeting guideline that housing
              costs should not exceed one-third of your income.
            </p>
          </div>

          <div className="border-t border-[#D1D5DB] pt-4">
            <h4 className="font-semibold mb-2">Debt Adjustment</h4>
            <p>
              If you provide monthly debt payments, these are subtracted from your take-home pay
              before calculating the rent range. This ensures your rent budget accounts for existing
              financial obligations.
            </p>
          </div>

          <div className="border-t border-[#D1D5DB] pt-4">
            <h4 className="font-semibold mb-2">Disclaimer</h4>
            <p className="text-xs text-[#111827]/60">
              These are educational estimates only and do not constitute financial advice. Individual
              circumstances vary, and you should consult with a financial advisor for personalized
              guidance.
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
