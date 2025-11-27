/**
 * Financial Sidekick Component
 * 
 * Full-screen overlay with open cards, quick questions, and chat input.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, ArrowRight, Search, Zap, Sparkles, Send } from 'lucide-react';
import { sendChatMessage } from '@/lib/chat/chatService';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { getPaychecksPerMonth } from '@/lib/onboarding/usePlanData';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const quickQuestions = [
  {
    id: 'savings_helper',
    label: 'Help me figure out how much I can save',
    scenario: 'savings_helper',
    path: '/app/tools/savings-helper',
  },
  {
    id: 'allocate_savings',
    label: 'Help me figure out what to do with my savings',
    scenario: 'allocate_savings',
    path: '/app/tools/savings-allocator',
  },
  {
    id: 'custom_scenario',
    label: 'Help me analyze a custom scenario',
    scenario: 'custom_scenario',
    path: '/app/tools/configurable-demo',
  },
];

// Recommendations from Feed Page
const recommendations = [
  {
    id: 'recommendation-1',
    title: "Let's review your savings allocation",
    body: "Your savings distribution may not match your goals. Tap to review and optimize.",
    ctaLabel: 'Review allocation',
    path: '/app/tools/savings-allocator',
  },
  {
    id: 'recommendation-2',
    title: 'Move $60 to savings?',
    body: 'You spent less than usual on dining this week. Tap to transfer $60 into your savings.',
    ctaLabel: 'Move to savings',
    path: '/app/tools/savings-allocator',
  },
];

interface FinancialSidekickProps {
  inline?: boolean;
}

export function FinancialSidekick({ inline = false }: FinancialSidekickProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm Ribbit, your financial sidekick. I can help you with questions about your financial plan, savings, budgeting, and more. What would you like to know?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false); // Toggle between recommendations and chat
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const store = useOnboardingStore();
  const planData = usePlanData();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && showChat) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [messages, isOpen, showChat]);

  const handleQuestionClick = (path: string) => {
    router.push(path);
    setIsOpen(false);
  };

  const handleRecommendationClick = (path: string) => {
    router.push(path);
    setIsOpen(false);
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isLoading) return;

    // Switch to chat view if not already there
    if (!showChat) {
      setShowChat(true);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: chatInput.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = chatInput.trim();
    setChatInput('');
    setIsLoading(true);

    try {
      // Calculate comprehensive user plan data for context
      const incomeAmount = store.income?.netIncome$ || store.income?.grossIncome$ || 0;
      const payFrequency = store.income?.payFrequency || 'biweekly';
      const paychecksPerMonth = getPaychecksPerMonth(payFrequency);
      const monthlyIncome = incomeAmount * paychecksPerMonth;

      // Calculate expenses from fixed expenses
      const monthlyExpenses = store.fixedExpenses.reduce((sum, expense) => {
        let monthly = expense.amount$;
        if (expense.frequency === 'weekly') monthly = expense.amount$ * 4.33;
        else if (expense.frequency === 'biweekly') monthly = expense.amount$ * 2.17;
        else if (expense.frequency === 'semimonthly') monthly = expense.amount$ * 2;
        else if (expense.frequency === 'yearly') monthly = expense.amount$ / 12;
        return sum + monthly;
      }, 0);

      // Calculate debt minimum payments per month
      const monthlyDebtPayments = store.debts.reduce((sum, debt) => {
        return sum + (debt.minPayment$ * paychecksPerMonth);
      }, 0);

      // Calculate total debt
      const totalDebt = store.debts.reduce((sum, d) => sum + d.balance$, 0);

      // Calculate needs and wants from expenses
      const monthlyNeeds = store.fixedExpenses
        .filter(e => e.category === 'needs' || !e.category)
        .reduce((sum, expense) => {
          let monthly = expense.amount$;
          if (expense.frequency === 'weekly') monthly = expense.amount$ * 4.33;
          else if (expense.frequency === 'biweekly') monthly = expense.amount$ * 2.17;
          else if (expense.frequency === 'semimonthly') monthly = expense.amount$ * 2;
          else if (expense.frequency === 'yearly') monthly = expense.amount$ / 12;
          return sum + monthly;
        }, 0) + monthlyDebtPayments; // Include debt payments in needs

      const monthlyWants = store.fixedExpenses
        .filter(e => e.category === 'wants')
        .reduce((sum, expense) => {
          let monthly = expense.amount$;
          if (expense.frequency === 'weekly') monthly = expense.amount$ * 4.33;
          else if (expense.frequency === 'biweekly') monthly = expense.amount$ * 2.17;
          else if (expense.frequency === 'semimonthly') monthly = expense.amount$ * 2;
          else if (expense.frequency === 'yearly') monthly = expense.amount$ / 12;
          return sum + monthly;
        }, 0);

      // Calculate savings (what's left after expenses)
      const monthlySavings = monthlyIncome - monthlyNeeds - monthlyWants;
      const savingsRate = monthlyIncome > 0 ? monthlySavings / monthlyIncome : 0;

      // Get expense breakdown
      const expenseBreakdown = store.fixedExpenses.map(expense => {
        let monthly = expense.amount$;
        if (expense.frequency === 'weekly') monthly = expense.amount$ * 4.33;
        else if (expense.frequency === 'biweekly') monthly = expense.amount$ * 2.17;
        else if (expense.frequency === 'semimonthly') monthly = expense.amount$ * 2;
        else if (expense.frequency === 'yearly') monthly = expense.amount$ / 12;
        return {
          name: expense.name,
          amount: monthly,
          category: expense.category || 'needs',
        };
      });

      // Get debt breakdown
      const debtBreakdown = store.debts.map(debt => ({
        name: debt.name || 'Debt',
        balance: debt.balance$,
        minPayment: debt.minPayment$ * paychecksPerMonth,
        apr: debt.aprPct || 0,
      }));

      // Get assets breakdown
      const assetsBreakdown = store.assets.map(asset => ({
        name: asset.name || 'Asset',
        value: (asset as any).balance$ || asset.value$ || 0,
        type: asset.type || 'other',
      }));

      // Get goals breakdown
      const goalsBreakdown = store.goals.map(goal => ({
        name: goal.name || 'Goal',
        target: (goal as any).target$ || goal.targetAmount$ || 0,
        current: (goal as any).current$ || 0,
        deadline: (goal as any).deadline || goal.targetDate,
      }));

      // Get actual spending from riskConstraints if available (3-month averages)
      let actualSpending = undefined;
      if (store.riskConstraints?.actuals3m) {
        const actuals = store.riskConstraints.actuals3m;
        actualSpending = {
          needsPct: actuals.needsPct * 100,
          wantsPct: actuals.wantsPct * 100,
          savingsPct: actuals.savingsPct * 100,
          monthlyNeeds: (actuals.needsPct * monthlyIncome),
          monthlyWants: (actuals.wantsPct * monthlyIncome),
          monthlySavings: (actuals.savingsPct * monthlyIncome),
        };
      }

      // If planData is available, use it for more accurate numbers
      let planDataContext = undefined;
      if (planData) {
        const needsCategories = planData.paycheckCategories.filter(c => 
          c.key === 'essentials' || c.key === 'debt_minimums'
        );
        const wantsCategories = planData.paycheckCategories.filter(c => 
          c.key === 'fun_flexible'
        );
        const savingsCategories = planData.paycheckCategories.filter(c => 
          c.key === 'emergency' || c.key === 'long_term_investing' || c.key === 'debt_extra'
        );

        const planNeedsPerPaycheck = needsCategories.reduce((sum, c) => sum + c.amount, 0);
        const planWantsPerPaycheck = wantsCategories.reduce((sum, c) => sum + c.amount, 0);
        const planSavingsPerPaycheck = savingsCategories.reduce((sum, c) => sum + c.amount, 0);

        planDataContext = {
          planNeeds: planNeedsPerPaycheck * paychecksPerMonth,
          planWants: planWantsPerPaycheck * paychecksPerMonth,
          planSavings: planSavingsPerPaycheck * paychecksPerMonth,
        };
      }

      // Get emergency fund info if available
      let emergencyFundInfo = undefined;
      if (planData?.emergencyFund) {
        emergencyFundInfo = {
          current: planData.emergencyFund.current || 0,
          target: planData.emergencyFund.target || 0,
          monthsTarget: planData.emergencyFund.monthsTarget || 3,
          monthsToTarget: planData.emergencyFund.monthsToTarget || 0,
        };
      }

      // Get net worth data if available
      let netWorthInfo = undefined;
      if (planData?.netWorthChartData) {
        const netWorth = planData.netWorthChartData.netWorth || [];
        const assets = planData.netWorthChartData.assets || [];
        const liabilities = planData.netWorthChartData.liabilities || [];
        
        // Current net worth (first value in array)
        const currentNetWorth = netWorth.length > 0 ? netWorth[0] : 0;
        // Current assets and liabilities
        const currentAssets = assets.length > 0 ? assets[0] : 0;
        const currentLiabilities = liabilities.length > 0 ? liabilities[0] : 0;
        
        // Net worth projections (milestones)
        const projections = planData.netWorthProjection || [];

        netWorthInfo = {
          current: currentNetWorth,
          currentAssets,
          currentLiabilities,
          projections: projections.map(p => ({
            label: p.label,
            months: p.months,
            value: p.value,
          })),
        };
      }

      // Get detailed savings allocation breakdown
      let savingsAllocation = undefined;
      if (planData) {
        // Find savings categories
        const emergencyCategory = planData.paycheckCategories.find(c => c.key === 'emergency');
        const debtExtraCategory = planData.paycheckCategories.find(c => c.key === 'debt_extra');
        const longTermCategory = planData.paycheckCategories.find(c => c.key === 'long_term_investing');
        
        // Convert per-paycheck to monthly
        const emergencyMonthly = emergencyCategory ? emergencyCategory.amount * paychecksPerMonth : 0;
        const debtExtraMonthly = debtExtraCategory ? debtExtraCategory.amount * paychecksPerMonth : 0;
        
        // Extract long-term investing subcategories
        let match401kMonthly = 0;
        let retirementTaxAdvMonthly = 0;
        let brokerageMonthly = 0;
        
        if (longTermCategory?.subCategories) {
          const matchSub = longTermCategory.subCategories.find(s => s.key === '401k_match');
          const retirementSub = longTermCategory.subCategories.find(s => s.key === 'retirement_tax_advantaged');
          const brokerageSub = longTermCategory.subCategories.find(s => s.key === 'brokerage');
          
          match401kMonthly = matchSub ? matchSub.amount * paychecksPerMonth : 0;
          retirementTaxAdvMonthly = retirementSub ? retirementSub.amount * paychecksPerMonth : 0;
          brokerageMonthly = brokerageSub ? brokerageSub.amount * paychecksPerMonth : 0;
        }
        
        // Calculate total monthly savings
        const totalMonthlySavings = emergencyMonthly + debtExtraMonthly + match401kMonthly + retirementTaxAdvMonthly + brokerageMonthly;
        
        savingsAllocation = {
          emergencyFund: {
            amount: emergencyMonthly,
            percent: totalMonthlySavings > 0 ? (emergencyMonthly / totalMonthlySavings) * 100 : 0,
          },
          debtPayoff: {
            amount: debtExtraMonthly,
            percent: totalMonthlySavings > 0 ? (debtExtraMonthly / totalMonthlySavings) * 100 : 0,
          },
          match401k: {
            amount: match401kMonthly,
            percent: totalMonthlySavings > 0 ? (match401kMonthly / totalMonthlySavings) * 100 : 0,
          },
          retirementTaxAdv: {
            amount: retirementTaxAdvMonthly,
            percent: totalMonthlySavings > 0 ? (retirementTaxAdvMonthly / totalMonthlySavings) * 100 : 0,
          },
          brokerage: {
            amount: brokerageMonthly,
            percent: totalMonthlySavings > 0 ? (brokerageMonthly / totalMonthlySavings) * 100 : 0,
          },
          total: totalMonthlySavings,
        };
      }

      // Call ChatGPT API with comprehensive data
      const aiResponseText = await sendChatMessage({
        messages: [...messages, userMessage],
        context: 'financial-sidekick',
        userPlanData: {
          monthlyIncome,
          monthlyExpenses,
          monthlyNeeds,
          monthlyWants,
          monthlySavings,
          savingsRate,
          debtTotal: totalDebt,
          monthlyDebtPayments,
          expenseBreakdown,
          debtBreakdown,
          assetsBreakdown,
          goalsBreakdown,
          actualSpending,
          planData: planDataContext,
          emergencyFund: emergencyFundInfo,
          netWorth: netWorthInfo,
          savingsAllocation,
          safetyStrategy: store.safetyStrategy ? {
            emergencyFundTargetMonths: store.safetyStrategy.efTargetMonths,
            liquidity: store.safetyStrategy.liquidity,
            retirementFocus: store.safetyStrategy.retirementFocus,
            match401kPerMonth: store.safetyStrategy.match401kPerMonth$ ? store.safetyStrategy.match401kPerMonth$ * paychecksPerMonth : 0,
          } : undefined,
        },
      });

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponseText,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      // Extract error message
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (error) {
        errorMessage = String(error);
      }
      
      // Provide user-friendly error message
      let userMessage = errorMessage;
      if (errorMessage.includes('API key') || errorMessage.includes('not configured')) {
        userMessage = "I'm having trouble connecting to the AI service. The OpenAI API key may not be configured correctly.";
      } else if (errorMessage.includes('404') || errorMessage.includes('static hosting') || errorMessage.includes('server environment')) {
        userMessage = "The chat feature is not available in this deployment. API routes require a server environment and cannot run on static hosting like GitHub Pages. Please run the app locally or deploy to a platform like Vercel or Netlify.";
      } else if (errorMessage.includes('Network error') || errorMessage.includes('fetch')) {
        userMessage = "Network error: Unable to connect to the chat service. Please check your connection and try again.";
      } else {
        userMessage = `I'm having trouble connecting right now: ${errorMessage}. Please try again in a moment.`;
      }
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: userMessage,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    const containerClass = inline 
      ? "w-full"
      : "fixed bottom-4 left-4 right-4 z-30 sm:left-auto sm:right-4 sm:w-96";
    
    return (
      <div className={containerClass}>
        <button
          onClick={() => setIsOpen(true)}
          className="w-full rounded-full border border-slate-300 bg-white px-4 py-3 shadow-sm transition-all hover:border-slate-400 hover:shadow-md dark:border-slate-600 dark:bg-slate-800"
        >
          <div className="flex items-center gap-3">
            {/* Frog Icon */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600">
              <span className="text-xl">🐸</span>
            </div>
            <span className="flex-1 text-left text-sm font-medium text-slate-600 dark:text-slate-400">
              Click to Open Chat
            </span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="flex h-full w-full sm:max-h-[90vh] sm:max-w-2xl flex-col rounded-none sm:rounded-lg bg-white shadow-xl dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex-shrink-0 bg-white dark:bg-slate-900 sticky top-0 z-10">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Sidekick Overlay</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-9 w-9 shrink-0 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Close sidekick"
          >
            <X className="h-5 w-5 text-slate-900 dark:text-white" />
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!showChat ? (
            <>
              {/* Recommendations Section */}
              <div className="mb-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Recommendations</h3>
                  <ArrowRight className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="space-y-3">
                  {recommendations.map((rec) => (
                    <Card 
                      key={rec.id} 
                      className="cursor-pointer border-blue-200 bg-blue-50 transition-all hover:shadow-md dark:border-blue-800 dark:bg-blue-950/20"
                      onClick={() => handleRecommendationClick(rec.path)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <h4 className="font-semibold text-slate-900 dark:text-white">
                              {rec.title}
                            </h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {rec.body}
                            </p>
                            {rec.ctaLabel && (
                              <p className="pt-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                                {rec.ctaLabel} →
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Quick Questions Section */}
              <div className="mb-6">
                <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">
                  What Personalized Actions can I Help with?
                </h3>
                <div className="space-y-2">
                  {quickQuestions.map((question) => (
                    <button
                      key={question.id}
                      onClick={() => handleQuestionClick(question.path)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                    >
                      <span className="text-slate-900 dark:text-white">{question.label}</span>
                      <Search className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Chat Messages */
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.isUser
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg bg-slate-100 px-4 py-2 dark:bg-slate-800">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]"></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]"></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Chat Input Bar */}
        <div className="border-t bg-white p-4 dark:bg-slate-900">
          {!showChat && (
            <div className="mb-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowChat(true)}
                className="flex-1"
              >
                Start Chat
              </Button>
            </div>
          )}
          <div className="flex items-center gap-3 rounded-full border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
            {/* Frog Icon */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600">
              <span className="text-lg">🐸</span>
            </div>
            {/* Input Field */}
            <input
              ref={inputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleChatSubmit();
                }
              }}
              placeholder={showChat ? "Type your message..." : "How can I help you?"}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400"
              disabled={isLoading}
            />
            {/* Send Button */}
            <button
              onClick={handleChatSubmit}
              disabled={!chatInput.trim() || isLoading}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white transition-all hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {showChat ? (
                <Send className="h-4 w-4" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
