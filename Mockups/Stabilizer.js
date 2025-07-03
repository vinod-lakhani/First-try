import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Bell, CalendarClock, DollarSign } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export default function Cluster2ReportMockups() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleExpand = (category: string) => {
    setExpanded(expanded === category ? null : category);
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

  return (
    <div className="grid grid-cols-1 gap-6 p-4 max-w-sm mx-auto">
      {/* Ink Cartridge-Style Fund Tracker */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="text-xl font-semibold"> July 2025 Allocation Status</h2>
          <div className="grid grid-cols-3 gap-4">
            {data.map(({ name, value, color }) => (
              <div key={name} className="space-y-2 text-center">
                <div
                  className="relative bg-gray-200 h-32 w-10 mx-auto rounded-full overflow-hidden cursor-pointer"
                  onClick={() => toggleExpand(name)}
                >
                  <div className="absolute inset-0 flex justify-center">
                    <DottedLine />
                  </div>
                  <div className="absolute bottom-0 w-full" style={{ ...animatedStyle(value / 20), backgroundColor: color }} />
                </div>
                <p className="text-sm font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">{name === "Variable" ? `${(100 - value / 20).toFixed(0)}% spent` : `${value / 20}% funded`}</p>
              </div>
            ))}
          </div>

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
          <Button className="w-full">Confirm Sweep</Button>
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
          <Button className="w-full">Edit Income Allocation</Button>
        </CardContent>
      </Card>

      {/* Weekly Pulse Report */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-xl font-semibold">Weekly Pulse Report (7/7/15)</h2>
          <ul className="text-sm list-disc pl-5 space-y-2">
            <li>🍔 You spent $184 on eating out — that’s +34% vs usual.</li>
            <li>⚠️ At this rate, you’ll be short $56 by the 24th.</li>
            <li>🔁 3 recurring charges: HBO Max, Calm, and Dropbox.</li>
            <li>✅ Suggested: Pause Calm? Move $20 to savings? Lower APR card?</li>
            <li>📉 Spending down 11% from last week. Nice work.</li>
            <li>🧠 Detected irregular Uber spend — want to cap next week’s ride budget?</li>
          </ul>
        </CardContent>
      </Card>

      {/* Paycheck Report */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-xl font-semibold">Paycheck Report (7/15/25)</h2>
          <ul className="text-sm list-disc pl-5 space-y-2">
            <li>💵 You got $2,134 — here’s how we recommend splitting it.</li>
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
