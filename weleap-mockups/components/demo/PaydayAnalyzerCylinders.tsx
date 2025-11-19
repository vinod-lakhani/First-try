// @ts-nocheck
"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect } from "react";

const paycheck = 2669;

const computeDelta = (curr: any, prev: any) => {
  return {
    fixed: curr.fixed.funded - prev.fixed.funded,
    variable: curr.variable.funded - prev.variable.funded,
    savings: curr.savings.funded - prev.savings.funded,
  };
};

const computeCashBalance = (cards: any[]) => {
  let balances = [];
  let cash = cards[0].cashBalance || 0;
  balances.push(cash);

  for (let i = 1; i < cards.length; i++) {
    const prev = cards[i - 1].allocations;
    const curr = cards[i].allocations;
    const delta = computeDelta(curr, prev);

    if (
      cards[i].message.includes("Paycheck arrived") ||
      cards[i].message.includes("Paycheck allocated")
    ) {
      cash += paycheck;
    }

    cash -= delta.fixed + delta.variable + delta.savings;
    balances.push(cash);
  }

  return balances;
};

const baseCardData = [
  {
    date: "7/6/25",
    message: "Awaiting next paycheck of $2669 on 7/7",
    allocations: {
      fixed: { funded: 689, target: 3558 },
      variable: { funded: 0, spent: 300, target: 1069 },
      savings: { funded: 0, target: 1157 },
    },
    cashBalance: -689,
  },
  {
    date: "7/7/25",
    message:
      "Paycheck arrived for $2669 on 7/7. <span class='underline text-blue-600 cursor-pointer' id='edit-link'>Edit Here</span>",
    allocations: {
      fixed: { funded: 1779, target: 3558 },
      variable: { funded: 534, spent: 300, target: 1069 },
      savings: { funded: 356, target: 1157 },
    },
  },
  {
    date: "7/20/25",
    message: "Awaiting next paycheck of $2669 on 7/21",
    allocations: {
      fixed: { funded: 2296, target: 3558 },
      variable: { funded: 534, spent: 800, target: 1069 },
      savings: { funded: 356, target: 1157 },
    },
  },
  {
    date: "7/21/25",
    message:
      "Paycheck arrived for $2669 on 7/21. <span class='underline text-purple-600 cursor-pointer' id='edit-link-2'>Edit Here</span>",
    allocations: {
      fixed: { funded: 3558, target: 3558 },
      variable: { funded: 1068, spent: 800, target: 1069 },
      savings: { funded: 712, target: 1157 },
    },
  },
];

export default function JulyStatusCards() {
  const [isEditing, setIsEditing] = useState(false);
  const [sliders, setSliders] = useState({ fixed: 1090, variable: 534, savings: 356 });
  const [hasEdited, setHasEdited] = useState(false);
  const [isEditing21, setIsEditing21] = useState(false);
  const [sliders21, setSliders21] = useState({ fixed: 1262, variable: 534, savings: 356 });
  const [hasEdited21, setHasEdited21] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [workingCardData, setWorkingCardData] = useState(baseCardData);

  useEffect(() => {
    const updatedCards = JSON.parse(JSON.stringify(baseCardData));

    if (hasEdited) {
      updatedCards[1].allocations = {
        fixed: { funded: 689 + sliders.fixed, target: 3558 },
        variable: { funded: sliders.variable, spent: 300, target: 1069 },
        savings: { funded: sliders.savings, target: 1157 },
      };
      updatedCards[2].allocations = {
        fixed: { funded: updatedCards[1].allocations.fixed.funded, target: 3558 },
        variable: { funded: updatedCards[1].allocations.variable.funded, spent: 800, target: 1069 },
        savings: { funded: updatedCards[1].allocations.savings.funded, target: 1157 },
      };
    }
    if (hasEdited21) {
      updatedCards[3].allocations = {
        fixed: {
          funded: updatedCards[2].allocations.fixed.funded + sliders21.fixed,
          target: 3558,
        },
        variable: {
          funded: updatedCards[2].allocations.variable.funded + sliders21.variable,
          spent: 800,
          target: 1069,
        },
        savings: {
          funded: updatedCards[2].allocations.savings.funded + sliders21.savings,
          target: 1157,
        },
      };
    }

    const balances = computeCashBalance(updatedCards);
    updatedCards.forEach((card: any, idx: number) => (card.cashBalance = balances[idx]));
    setWorkingCardData(updatedCards);
    console.log('Card cash balances:', updatedCards.map((c: any) => c.cashBalance));
    console.log('Card allocations:', updatedCards.map((c: any) => c.allocations));
  }, [hasEdited, hasEdited21, sliders, sliders21]);

  const calcHeights = (base: number, overlay: number, target: number, spent = 0) => {
    const total = target * 1.3;
    return {
      basePct: (base / total) * 100,
      overlayPct: overlay ? (overlay / total) * 100 : 0,
      recommendedLine: (target / total) * 100,
      spentPct: (spent / total) * 100,
    };
  };

  
  return (
    <div className="space-y-6">
      {workingCardData.map((card, idx) => {
        const isCard7 = idx === 1;
        const isCard21 = idx === 3;
        const showSliders = (isCard7 && isEditing) || (isCard21 && isEditing21);
        const showEdited = (isCard7 && hasEdited && !isEditing) || (isCard21 && hasEdited21 && !isEditing21);
        const currentSliders = isCard7 ? sliders : sliders21;
        const totalAllocated = Object.values(currentSliders).reduce((a, b) => a + b, 0);
        const currentCash = card.cashBalance;
        const message = (isCard7 && hasEdited)
          ? "Paycheck allocated for $2669 on 7/7."
          : (isCard21 && hasEdited21)
          ? "Paycheck allocated for $2669 on 7/21."
          : card.message;

        return (
          <Card key={idx} className="w-full max-w-sm mx-auto">
            <CardContent className="p-4 space-y-4">
              <h2 className="text-lg font-semibold">July Allocation Status ({card.date})</h2>
              <div
                className="text-sm text-yellow-700 bg-yellow-100 p-2 rounded"
                dangerouslySetInnerHTML={{ __html: message }}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.id === "edit-link") {
                    setIsEditing(true);
                  }
                  if (target.id === "edit-link-2") {
                    setIsEditing21(true);
                  }
                }}
              />

              <div className="flex justify-between px-2 pt-2">
                {Object.entries(card.allocations).map(([key, a]) => {
                  const prevAlloc = idx > 0 ? (workingCardData[idx - 1].allocations as any)[key].funded : 0;
                  const base = idx === 3 ? prevAlloc : a.funded;
                  const overlay = idx === 3 ? a.funded - prevAlloc : 0;
                  const { basePct, overlayPct, recommendedLine, spentPct } = calcHeights(base, overlay, a.target, (a as any).spent || 0);

                  return (
                    <div key={key} className="flex flex-col items-center w-20 cursor-pointer" onClick={() => setExpanded(expanded === key ? null : key)}>
                      <div className="relative bg-gray-200 h-36 w-8 rounded-full overflow-hidden">
                        <div className="absolute w-full bg-green-500" style={{ height: `${basePct}%`, bottom: 0 }} />
                        {overlay > 0 && (
                          <div className="absolute w-full bg-purple-500" style={{ height: `${overlayPct}%`, bottom: `${basePct}%` }} />
                        )}
                        {key === "variable" && a.spent && <div className="absolute left-0 w-full border-t border-dotted border-red-600" style={{ bottom: `${spentPct}%` }} />}
                        <div className="absolute left-0 w-full border-t-2 border-dotted border-black" style={{ bottom: `${recommendedLine}%` }} />
                      </div>
                      <div className="text-xs text-center font-medium">
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                        <div className="text-[10px] text-muted-foreground">
                          ${a.funded} / ${a.target}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {showSliders && (
                <div className="space-y-2 pt-4">
                  {Object.keys(currentSliders).map((key) => (
                    <div key={key} className="text-sm">
                      {key.charAt(0).toUpperCase() + key.slice(1)} - ${currentSliders[key]}
                      <Slider
                        min={0}
                        max={(card.allocations as any)[key].target}
                        step={1}
                        value={[currentSliders[key]]}
                        onValueChange={([v]) => {
                          const updated = { ...currentSliders, [key]: v };
                          isCard7 ? setSliders(updated) : setSliders21(updated);
                          isCard7 ? setHasEdited(true) : setHasEdited21(true);
                        }}
                      />
                    </div>
                  ))}

                  {totalAllocated > paycheck && (
                    <div className="text-red-600 text-sm font-medium">
                      Warning: Paycheck is overallocated by ${totalAllocated - paycheck}
                    </div>
                  )}
                </div>
              )}

              <div className={`text-sm font-semibold text-center pt-2 ${currentCash < 0 ? "text-red-600" : "text-green-600"}`}>
                Cash Balance: {currentCash < 0 ? `-$${Math.abs(currentCash)}` : `$${currentCash}`}
              </div>

              {showSliders && (
                <div className="pt-2">
                  <button
                    className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700"
                    onClick={() => {
                      isCard7 ? setIsEditing(false) : setIsEditing21(false);
                      isCard7 ? setHasEdited(true) : setHasEdited21(true);
                    }}
                  >
                    Done
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

