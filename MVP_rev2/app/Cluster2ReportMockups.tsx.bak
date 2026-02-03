"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Bell, CalendarClock, DollarSign } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Slider } from "@/components/ui/slider";

export default function Cluster2ReportMockups() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [allocations, setAllocations] = useState({
    Fixed: 900,
    Variable: 700,
    Savings: 400,
  });

  const toggleExpand = (category: string) => {
    setExpanded(expanded === category ? null : category);
  };

  const handleSliderChange = (type: string, value: number[]) => {
    setAllocations((prev) => ({ ...prev, [type]: value[0] }));
  };

  const animatedStyle = (value: number) => ({
    height: `${value}%`,
    transition: "height 1s ease-in-out"
  });

  const DottedLine = () => (
    <div className="absolute top-1/4 w-full border-t border-dotted border-gray-400" />
  );

  const data = [
    { name: "Fixed", value: 1200, color: "#10B981" },
    { name: "Variable", value: 650, color: "#F59E0B" },
    { name: "Savings", value: 284, color: "#3B82F6" }
  ];

  const annualIncomeData = [
    { name: "Fixed Expenses", value: 3414 * 12, color: "#F59E0B" },
    { name: "Variable Expenses", value: 1212 * 12, color: "#3B82F6" },
    { name: "Savings", value: 1157 * 12, color: "#10B981" }
  ];

  const cartridgeSubcategories = {
    Fixed: ["Rent", "Utilities", "Transportation", "Groceries", "Debt Payment", "Others"],
    Variable: ["Shopping", "Travel", "Dining", "Entertainment", "Subs", "Other"],
    Savings: ["Emergency Fund", "401K", "Roth", "Investment", "Debt Payoff", "Other"]
  };

  // Set the target (dotted) line to a fixed percentage from the top (e.g., 25%)
  const targetPercentFromTop = 0.25; // 25% from the top
  const cylinderHeight = 128;
  const dottedLinePx = cylinderHeight * (1 - targetPercentFromTop); // px from bottom

  // Use the real current date
  const today = new Date();
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  // 0% = bottom, 100% = target line (dotted line)
  const todayPercent = (currentDay - 1) / (daysInMonth - 1); // day 1 = 0, last day = 1
  // Interpolate from 0px (bottom) to dottedLinePx (target line)
  const todayPx = todayPercent * dottedLinePx;

  // Add starting cash for July (match PaydayAnalyzerCylinders)
  const startingCash = 500;
  const totalAllocated = allocations.Fixed + allocations.Variable + allocations.Savings;
  const cashAtHand = Math.max(0, startingCash - totalAllocated);

  // Copy constants and logic from PaydayAnalyzerCylinders
  const recommended = {
    Fixed: 2000,
    Variable: 1200,
    Savings: 800,
  };
  const maxHeadroomFactor = 1.3;
  const alreadyFunded = {
    Fixed: 1100,
    Variable: 500,
    Savings: 300,
  };

  return (
    <div className="grid grid-cols-1 gap-6 p-4 max-w-xl mx-auto">
      {/* Ink Cartridge-Style Fund Tracker */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="text-xl font-semibold"> July 2025 Allocation Status</h2>
          <p className="text-sm text-muted-foreground text-center">
            Starting Cash Position for July: <span className="font-semibold">${cashAtHand}</span>
          </p>
          {/* Minimal robust cylinder row with date line and label */}
          {(() => {
            // Layout constants
            const labelWidth = 90; // px
            const cylinderWidth = 40; // px
            const gap = 80; // px
            const numCylinders = 3;
            const rowWidth = labelWidth + numCylinders * cylinderWidth + (numCylinders - 1) * gap;
            const lineLeft = labelWidth;
            const lineWidth = numCylinders * cylinderWidth + (numCylinders - 1) * gap;
            return (
              <div style={{ width: `${rowWidth}px`, margin: '0 auto', marginBottom: '32px' }}>
                {/* Cylinder area with relative positioning for line/label */}
                <div className="relative flex flex-row items-end justify-center" style={{ height: `${cylinderHeight}px` }}>
                  {/* Date label absolutely positioned */}
                  <span
                    className="absolute bg-white px-2 text-xs font-semibold text-blue-700 rounded shadow border border-blue-100"
                    style={{ left: 0, bottom: `${todayPx}px`, width: `${labelWidth}px`, textAlign: 'center', zIndex: 11 }}
                  >
                    Today: {today.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  {/* Date line absolutely positioned */}
                  <div
                    className="absolute border-t-2 border-blue-500"
                    style={{ left: `${lineLeft}px`, bottom: `${todayPx}px`, width: `${lineWidth}px`, zIndex: 10 }}
                  ></div>
                  {/* Cylinders: fixed width, fixed gap */}
                  <div className="flex flex-row gap-20" style={{ marginLeft: `${labelWidth}px` }}>
                    {Object.keys(recommended).map((name) => {
                      const key = name as keyof typeof allocations;
                      const allocated = allocations[key];
                      const recommendedValue = recommended[key];
                      const totalTarget = recommendedValue * maxHeadroomFactor;
                      const targetPercent = (recommendedValue / totalTarget) * 100;
                      const fillPercent = Math.max(0, Math.min((allocated / totalTarget) * 100, 100));
                      const greenHeight = Math.min(fillPercent, targetPercent);
                      const blueHeight = fillPercent > targetPercent ? fillPercent - targetPercent : 0;
                      return (
                        <div key={name} className="flex flex-col items-center" style={{ width: `${cylinderWidth}px` }}>
                          <div
                            className="relative bg-gray-200 h-32 w-10 rounded-full overflow-hidden cursor-pointer"
                            onClick={() => toggleExpand(name)}
                          >
                            {/* Dotted line inside the cylinder at target position */}
                            <div
                              className="absolute left-0 w-full border-t border-dotted border-gray-400"
                              style={{ bottom: `${targetPercent}%`, zIndex: 2 }}
                            ></div>
                            {/* Green fill up to target */}
                            {greenHeight > 0 && (
                              <div
                                className="absolute bottom-0 w-full"
                                style={{ height: `${greenHeight}%`, backgroundColor: '#10B981', zIndex: 1 }}
                              />
                            )}
                            {/* Blue fill above target */}
                            {blueHeight > 0 && (
                              <div
                                className="absolute w-full"
                                style={{
                                  height: `${blueHeight}%`,
                                  bottom: `${targetPercent}%`,
                                  backgroundColor: '#3B82F6',
                                  zIndex: 1
                                }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Labels row below cylinders */}
                <div className="flex flex-row gap-20 justify-center" style={{ marginLeft: `${labelWidth}px`, marginTop: '8px' }}>
                  {Object.keys(recommended).map((name) => (
                    <div key={name} className="flex flex-col items-center" style={{ width: `${cylinderWidth}px` }}>
                      <span className="font-semibold text-lg text-black">{name}</span>
                      <span className="text-gray-500 text-base mt-1">
                        {name === 'Fixed' && '60% funded'}
                        {name === 'Variable' && '68% spent'}
                        {name === 'Savings' && '14.2% funded'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Expanded Sub-Cartridges */}
          {expanded && (
            <div className="pt-4 space-y-2">
              <h3 className="text-sm font-semibold">{expanded} Breakdown</h3>
              <div className="grid grid-cols-2 gap-2">
                {cartridgeSubcategories[expanded as keyof typeof cartridgeSubcategories].map((sub, i) => (
                  <div key={i} className="flex flex-col items-center space-y-1">
                    <div className="bg-gray-200 h-16 w-6 rounded-full overflow-hidden">
                      <div className="bg-gray-500 h-1/2 w-full" />
                    </div>
                    <p className="text-xs text-center">{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Edit Mode Sliders */}
          {editMode && (
            <div className="space-y-4 pt-4">
              {Object.entries(allocations).map(([key, val]) => {
                const recommendedValue = recommended[key as keyof typeof recommended];
                const totalTarget = recommendedValue * maxHeadroomFactor;
                return (
                  <div key={key} className="space-y-1">
                    <div className="text-sm font-medium capitalize">{key} - ${val}</div>
                    <Slider
                      min={0}
                      max={totalTarget}
                      step={10}
                      value={[val]}
                      onValueChange={(v) => handleSliderChange(key, v)}
                      className="w-full"
                    />
                  </div>
                );
              })}
              <Button className="w-full bg-gray-800 text-white hover:bg-gray-900 mt-2" onClick={() => setEditMode(false)}>
                Done
              </Button>
            </div>
          )}
          {/* Edit Allocation Button */}
          {!editMode && (
            <Button className="w-full bg-gray-800 text-white hover:bg-gray-900 mt-4" onClick={() => setEditMode(true)}>
              Edit Allocation
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Donut Chart with Legend */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="text-xl font-semibold">Paycheck Breakdown (7/15/25)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="60%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pt-4 space-y-1 text-sm">
              {data.map((entry, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                  <span>{entry.name}: ${entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payday Sweep Card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="text-xl font-semibold">Payday Sweep Plan</h2>
          <ul className="text-sm list-disc pl-5 space-y-2">
            <li>💵 Paycheck received: $2,134</li>
            <li>🏠 Move $1,200 to Checking to cover Rent, Utilities, Loans</li>
            <li>🔄 Move $200 from Savings to Checking for Credit Card Bill</li>
            <li>📈 Sweep $284 to 401K, Roth, and Investment accounts</li>
            <li>💰 Allocate $150 for Emergency Fund</li>
          </ul>
          <Button className="w-full bg-gray-800 text-white hover:bg-gray-900">Confirm Sweep</Button>
        </CardContent>
      </Card>

      {/* Payday Sweep Card (detailed allocation, from user image) */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Payday Sweep</h2>
            <div className="bg-gray-100 rounded-full p-1">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect width="20" height="20" fill="none"/><path d="M12 8v4l3 3" stroke="#222" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="10" stroke="#222" strokeWidth="2"/></svg>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600 border-b pb-2">
            <div className="flex items-center gap-1"><CalendarClock className="w-4 h-4 mr-1 text-blue-500" /> Frequency</div>
            <div>Every 2 Weeks</div>
          </div>
          <div className="pt-4">
            <div className="text-center text-xl font-semibold mb-2">Allocate money towards</div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between"><span>High-Yield Savings</span><span className="font-semibold">$235</span></div>
              <div className="flex justify-between"><span>Roth IRA</span><span className="font-semibold">$124</span></div>
              <div className="flex justify-between"><span>Brokerage:</span><span className="font-semibold">$425</span></div>
              <div className="pl-4 flex justify-between"><span>VOO (Vanguard S&amp;P 500):</span><span className="font-semibold">$235</span></div>
              <div className="pl-4 flex justify-between"><span>VBR (Vanguard Small-Cap Value):</span><span className="font-semibold">$195</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Annual Income Allocation Donut Chart */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="text-xl font-semibold">Annual Income Allocation</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="60%">
              <PieChart>
                <Pie
                  data={annualIncomeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                >
                  {annualIncomeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pt-4 space-y-1 text-sm">
              {annualIncomeData.map((entry, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                  <span>{entry.name}: ${entry.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <Button className="w-full bg-gray-800 text-white hover:bg-gray-900">Edit Income Allocation</Button>
        </CardContent>
      </Card>

      {/* Weekly Pulse Report */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-xl font-semibold">Weekly Pulse Report (7/7/15)</h2>
          <ul className="text-sm list-disc pl-5 space-y-2">
            <li>🍔 You spent $184 on eating out — that's +34% vs usual.</li>
            <li>⚠️ At this rate, you'll be short $56 by the 24th.</li>
            <li>🔁 3 recurring charges: HBO Max, Calm, and Dropbox.</li>
            <li>✅ Suggested: Pause Calm? Move $20 to savings? Lower APR card?</li>
            <li>📉 Spending down 11% from last week. Nice work.</li>
            <li>🧠 Detected irregular Uber spend — want to cap next week's ride budget?</li>
          </ul>
        </CardContent>
      </Card>

      {/* Paycheck Report */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-xl font-semibold">Paycheck Report (7/15/25)</h2>
          <ul className="text-sm list-disc pl-5 space-y-2">
            <li>💵 You got $2,134 — here's how we recommend splitting it.</li>
            <li>📅 $1500 - Fixed Commitments: Rent, loans, utilities due before next paycheck.</li>
            <li>🔄 $86 - Bills: Netflix ($15.99) + Credit card minimum ($72).</li>
            <li>🔄 $548 - Variable Expenses</li>
            <li>🪙 Move $80 to emergency fund</li>
            <li>💡 You can save $50 this cycle by pacing dining + pausing Spotify.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Smart Notifications */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-xl font-semibold">Balance Alert</h2>
          <p className="text-sm text-muted-foreground">You may go below $50 by Wednesday.</p>
        </CardContent>
      </Card>

      {/* Reminders */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-xl font-semibold">Subscription Reminder</h2>
          <p className="text-sm text-muted-foreground">HBO due in 2 days ($65).</p>
        </CardContent>
      </Card>

      {/* To-Do */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-xl font-semibold">To-Do</h2>
          <ul className="text-sm list-disc pl-5">
            <li>Cancel gym subscription — save $35/month</li>
            <li>Review flagged Hulu subscription</li>
            <li>Apply for suggested 0% APR card</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
