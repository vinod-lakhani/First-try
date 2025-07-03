"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

const recommended = {
  fixed: 2000,
  variable: 1200,
  savings: 800,
};

const paycheckAmount = 2000;
const cashStarting = 500;
const cashThreshold = 100;

const alreadyFunded = {
  fixed: 1100,
  variable: 500,
  savings: 300,
};

export default function PaydayAnalyzerCylinders() {
  const [allocations, setAllocations] = useState({
    fixed: 900,
    variable: 700,
    savings: 400,
  });

  const totalAllocated = allocations.fixed + allocations.variable + allocations.savings;
  const overAllocation = totalAllocated - paycheckAmount;
  const cashAtHand = Math.max(0, cashStarting - Math.max(0, overAllocation));

  const handleSliderChange = (type, value) => {
    setAllocations((prev) => ({ ...prev, [type]: value[0] }));
  };

  const cylinderHeight = 140;
  const maxHeadroomFactor = 1.3;

  const Cylinder = ({ label, value, recommendedValue, funded, isCash = false }) => {
    const totalTarget = recommendedValue * maxHeadroomFactor;
    const fundedHeight = isCash ? 0 : (funded / totalTarget) * 100;
    const allocationHeight = (value / totalTarget) * 100;

    const barColor = isCash && value < cashThreshold ? "bg-red-500" : "bg-green-400";

    return (
      <div className="flex flex-col items-center space-y-2 w-24">
        <div className="relative overflow-visible" style={{ height: `${cylinderHeight}px`, width: '32px' }}>
          <div className="absolute bottom-0 w-full bg-gray-200 h-full" />

          {/* Funded (non-cash only) */}
          {!isCash && (
            <div
              className="absolute bottom-0 w-full bg-green-400"
              style={{ height: `${Math.min(fundedHeight, 100)}%` }}
            />
          )}

          {/* Allocation */}
          <div
            className={`absolute bottom-0 w-full ${isCash ? barColor : "bg-blue-500"}`}
            style={{
              height: `${Math.min(allocationHeight, 100 - fundedHeight)}%`,
              bottom: `${fundedHeight}%`,
            }}
          />

          {/* Dotted line (non-cash only) */}
          {!isCash && (
            <div
              className="absolute left-0 w-full border-t-2 border-dotted border-black"
              style={{ bottom: `${(recommendedValue / (recommendedValue * maxHeadroomFactor)) * 100}%` }}
            />
          )}
        </div>
        <div className="text-xs font-medium text-center">
          {label}
          <div className="text-[10px] text-muted-foreground">
            ${isCash ? value : funded + allocations[label.toLowerCase()]} / ${recommendedValue}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-sm mx-auto">
      <CardContent className="p-4 space-y-6">
        <h2 className="text-lg font-semibold">Payday Analyzer</h2>
        <p className="text-sm text-muted-foreground">
          Adjust your allocation sliders and see how they impact your monthly plan.
        </p>

        <div className="flex justify-between px-2">
          <Cylinder label="Fixed" value={allocations.fixed} recommendedValue={recommended.fixed} funded={alreadyFunded.fixed} />
          <Cylinder label="Variable" value={allocations.variable} recommendedValue={recommended.variable} funded={alreadyFunded.variable} />
          <Cylinder label="Savings" value={allocations.savings} recommendedValue={recommended.savings} funded={alreadyFunded.savings} />
          <Cylinder label="Cash" value={cashAtHand} recommendedValue={cashStarting} isCash={true} />
        </div>

        {overAllocation > 0 && (
          <div className="text-red-600 text-sm font-medium text-center">
            ⚠️ You're over-allocating by ${overAllocation}. Adjust your sliders to stay within your paycheck of ${paycheckAmount}.
          </div>
        )}

        <div className="space-y-4 pt-4">
          {Object.entries(allocations).map(([key, val]) => (
            <div key={key} className="space-y-1">
              <div className="text-sm font-medium capitalize">{key} - ${val}</div>
              <Slider
                min={0}
                max={recommended[key]}
                step={10}
                value={[val]}
                onValueChange={(v) => handleSliderChange(key, v)}
                className="w-full"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
