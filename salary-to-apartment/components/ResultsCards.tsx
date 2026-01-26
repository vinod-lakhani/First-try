'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { formatCurrency } from '@/lib/rounding';

interface TaxBreakdown {
  grossAnnual: number;
  federalTaxAnnual: number;
  stateTaxAnnual: number;
  ficaTaxAnnual: number;
  totalTaxAnnual: number;
  netIncomeAnnual: number;
}

interface ResultsCardsProps {
  takeHomeMonthly: number;
  takeHomeAnnual: number;
  rentRange: string;
  daysUntilStart: number;
  taxBreakdown?: TaxBreakdown;
}

export function ResultsCards({
  takeHomeMonthly,
  takeHomeAnnual,
  rentRange,
  daysUntilStart,
  taxBreakdown,
}: ResultsCardsProps) {
  return (
    <div className="space-y-6">
      {/* Card A: Monthly Take-Home */}
      <Card className="border-[#D1D5DB] bg-white">
        <CardHeader>
          <CardTitle className="text-lg text-[#111827]">Your Real Monthly Take-Home</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-4xl font-bold text-[#111827]">{formatCurrency(takeHomeMonthly)}</p>
              <p className="text-sm text-[#111827]/70">
                {formatCurrency(takeHomeAnnual)} annually
              </p>
            </div>

            {/* Tax Breakdown Accordion */}
            {taxBreakdown && (
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="breakdown" className="border-t border-[#D1D5DB] pt-4">
                  <AccordionTrigger className="text-sm text-[#111827]/80 hover:no-underline py-2">
                    View breakdown (gross → take-home)
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-[#111827]/70">Gross annual income</span>
                        <span className="font-semibold text-[#111827]">
                          {formatCurrency(taxBreakdown.grossAnnual)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center pt-2 border-t border-[#D1D5DB]/50">
                        <span className="text-[#111827]/70">Federal tax</span>
                        <span className="text-[#111827]">
                          -{formatCurrency(taxBreakdown.federalTaxAnnual)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-[#111827]/70">State tax</span>
                        <span className="text-[#111827]">
                          -{formatCurrency(taxBreakdown.stateTaxAnnual)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-[#111827]/70">FICA (Social Security + Medicare)</span>
                        <span className="text-[#111827]">
                          -{formatCurrency(taxBreakdown.ficaTaxAnnual)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center pt-2 border-t border-[#D1D5DB]">
                        <span className="font-semibold text-[#111827]/70">Total taxes</span>
                        <span className="font-semibold text-[#111827]">
                          -{formatCurrency(taxBreakdown.totalTaxAnnual)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center pt-2 border-t-2 border-[#D1D5DB]">
                        <span className="font-semibold text-[#111827]">Take-home (annual)</span>
                        <span className="text-xl font-bold text-[#111827]">
                          {formatCurrency(taxBreakdown.netIncomeAnnual)}
                        </span>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card B: Safe Rent Range */}
      <Card className="border-[#D1D5DB] bg-white">
        <CardHeader>
          <CardTitle className="text-lg text-[#111827]">Safe Rent Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-4xl font-bold text-[#111827]">{rentRange}</p>
            <p className="text-sm text-[#111827]/70">
              Based on 28–35% of your take-home pay
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Card C: Timing Pressure */}
      <Card className="border-[#D1D5DB] bg-white">
        <CardHeader>
          <CardTitle className="text-lg text-[#111827]">Timing Pressure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-2xl font-semibold text-[#111827]">
              {daysUntilStart} {daysUntilStart === 1 ? 'day' : 'days'} until start date
            </p>
            <p className="text-sm text-[#111827]/70">
              Lease costs often hit before the first paycheck, which makes early rent decisions more sensitive.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
