/**
 * Onboarding Chat Component
 * 
 * Simple chat interface for onboarding screens to help users ask questions.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Send } from 'lucide-react';
import { withBasePath } from '@/lib/utils/basePath';
import { sendChatMessage } from '@/lib/chat/chatService';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { getPaychecksPerMonth } from '@/lib/onboarding/usePlanData';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface OnboardingChatProps {
  context?: string; // Context about which page we're on
  inline?: boolean; // If true, show as inline button instead of floating
}

export function OnboardingChat({ context, inline = false }: OnboardingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState('/images/ribbit.png');
  const store = useOnboardingStore();
  const planData = usePlanData();
  
  useEffect(() => {
    setImageSrc(withBasePath('images/ribbit.png'));
  }, []);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm here to help you with any questions about your financial plan. What would you like to know?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputValue.trim();
    setInputValue('');
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

      // Get safety strategy with IDR status
      const safetyStrategy = store.safetyStrategy ? {
        emergencyFundTargetMonths: store.safetyStrategy.efTargetMonths,
        liquidity: store.safetyStrategy.liquidity,
        retirementFocus: store.safetyStrategy.retirementFocus,
        onIDR: store.safetyStrategy.onIDR || false,
      } : undefined;

      // Call ChatGPT API with comprehensive data
      const aiResponseText = await sendChatMessage({
        messages: [...messages, userMessage],
        context,
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
          planData: planDataContext,
          safetyStrategy,
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
      // Show error message or fallback to mock response
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: errorMessage.includes('API key')
          ? "I'm having trouble connecting to the AI service. Please check that the OpenAI API key is configured correctly."
          : generateResponse(currentInput, context), // Fallback to mock response
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Floating button variant (always shown when closed, regardless of inline prop)
  // Fixed position so it stays visible while scrolling, positioned outside content tile on desktop
  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50 group sm:left-[calc(50%+280px)] lg:left-[calc(50%+320px)] sm:right-auto">
        {/* Hover tooltip */}
        <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
            Questions? Tap Ribbit.
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
          </div>
        </div>
        
        {/* Ribbit Button */}
        <button
          onClick={() => setIsOpen(true)}
          className="relative flex items-center justify-center h-14 w-14 rounded-full bg-green-600 shadow-lg hover:bg-green-700 hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95"
          aria-label="Ask Ribbit a question"
        >
          <img
            src={imageSrc}
            alt="Ribbit"
            className="w-10 h-10 object-contain"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              // Fallback: hide image and show text
              const target = e.target as HTMLImageElement;
              if (target) {
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.fallback-text')) {
                  const fallback = document.createElement('span');
                  fallback.className = 'fallback-text text-white font-medium text-sm';
                  fallback.textContent = '🐸';
                  parent.appendChild(fallback);
                }
              }
            }}
          />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <Card className="flex h-full w-full sm:h-[600px] sm:max-w-md flex-col shadow-xl rounded-none sm:rounded-lg overflow-hidden">
        <div className="flex flex-row items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3 px-4 pt-4 flex-shrink-0 bg-white dark:bg-slate-800 sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Chat Assistant</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-9 w-9 shrink-0 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Close chat"
          >
            <X className="h-5 w-5 text-slate-900 dark:text-white" />
          </Button>
        </div>
        <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
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
                  {message.isUser ? (
                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                  ) : (
                    <div className="text-sm markdown-content">
                      <ReactMarkdown
                        components={{
                          h2: ({node, ...props}) => <h2 className="text-base font-semibold mt-3 mb-2 first:mt-0 text-slate-900 dark:text-slate-100" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-sm font-semibold mt-2 mb-1.5 first:mt-0 text-slate-900 dark:text-slate-100" {...props} />,
                          p: ({node, ...props}) => <p className="mb-1.5 last:mb-0 text-slate-900 dark:text-slate-100 leading-relaxed" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc list-inside my-1.5 space-y-0.5 ml-2 text-slate-900 dark:text-slate-100" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal list-inside my-1.5 space-y-0.5 ml-2 text-slate-900 dark:text-slate-100" {...props} />,
                          li: ({node, ...props}) => <li className="ml-2 text-slate-900 dark:text-slate-100" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-semibold text-slate-900 dark:text-slate-100" {...props} />,
                          table: ({node, ...props}) => <div className="overflow-x-auto my-2"><table className="min-w-full border-collapse text-xs" {...props} /></div>,
                          thead: ({node, ...props}) => <thead className="border-b border-slate-300 dark:border-slate-600" {...props} />,
                          tbody: ({node, ...props}) => <tbody {...props} />,
                          tr: ({node, ...props}) => <tr className="border-b border-slate-300 dark:border-slate-600" {...props} />,
                          th: ({node, ...props}) => <th className="px-2 py-1 text-left font-semibold text-slate-900 dark:text-slate-100" {...props} />,
                          td: ({node, ...props}) => <td className="px-2 py-1 text-slate-900 dark:text-slate-100" {...props} />,
                        }}
                      >
                        {message.text}
                      </ReactMarkdown>
                    </div>
                  )}
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

          {/* Input */}
          <div className="border-t p-4">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your question..."
                className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className="rounded-md bg-green-600 px-4 py-2 hover:bg-green-700"
                size="sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Simple response generator (in production, this would call an AI API)
function generateResponse(userMessage: string, context?: string): string {
  const lowerMessage = userMessage.toLowerCase();

  // Context-specific responses
  if (context === 'monthly-plan') {
    if (lowerMessage.includes('needs') || lowerMessage.includes('essential')) {
      return "Needs include essential expenses like rent, utilities, groceries, and minimum debt payments. These are expenses you must cover to maintain your basic lifestyle.";
    }
    if (lowerMessage.includes('wants') || lowerMessage.includes('discretionary')) {
      return "Wants are discretionary expenses for fun, dining out, entertainment, and lifestyle choices. These are flexible and can be adjusted based on your savings goals.";
    }
    if (lowerMessage.includes('savings') || lowerMessage.includes('save')) {
      return "Savings is money set aside for emergencies, debt payoff, retirement, and future goals. The more you save, the faster you can build wealth and achieve financial security.";
    }
  }

  if (context === 'savings-plan') {
    if (lowerMessage.includes('emergency') || lowerMessage.includes('ef')) {
      return "Your emergency fund is a safety net for unexpected expenses. We recommend 3-6 months of essential expenses. You can adjust the target using the slider.";
    }
    if (lowerMessage.includes('debt') || lowerMessage.includes('payoff')) {
      return "Paying off high-interest debt (APR > 10%) should be a priority as it saves you money on interest. The debt snowball method applies extra payments to your highest APR debt first.";
    }
    if (lowerMessage.includes('retirement') || lowerMessage.includes('401k')) {
      return "Retirement savings include employer 401(k) match (free money!), tax-advantaged accounts like IRA/401(k), and taxable brokerage accounts for long-term growth.";
    }
  }

  if (context === 'plan-final') {
    if (lowerMessage.includes('net worth') || lowerMessage.includes('projection')) {
      return "The net worth projection shows how your wealth grows over 40 years based on your current plan. It accounts for investment growth, debt payoff, and your savings rate.";
    }
    if (lowerMessage.includes('income') || lowerMessage.includes('allocation')) {
      return "Your income allocation shows how your take-home pay is distributed across Needs, Wants, and Savings. This plan will automatically adjust as your income or expenses change.";
    }
  }

  // General responses
  if (lowerMessage.includes('help') || lowerMessage.includes('confused')) {
    return "I'm here to help! You can ask me about any part of your financial plan - income allocation, savings strategy, debt payoff, retirement planning, or anything else.";
  }

  if (lowerMessage.includes('change') || lowerMessage.includes('adjust') || lowerMessage.includes('modify')) {
    return "You can adjust your plan using the sliders on this page. Changes will be saved when you click Continue. Don't worry - you can always come back and adjust later!";
  }

  return "That's a great question! I'm here to help you understand your financial plan. Could you provide a bit more detail about what you'd like to know?";
}

