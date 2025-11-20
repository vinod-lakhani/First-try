/**
 * Financial Sidekick Component
 * 
 * Full-screen overlay with open cards, quick questions, and chat input.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, ArrowRight, Search, Zap } from 'lucide-react';

const quickQuestions = [
  {
    id: 'save',
    label: 'How much can I save?',
    scenario: 'save_more',
  },
  {
    id: 'rent',
    label: 'How much rent can I afford?',
    scenario: 'rent',
  },
  {
    id: 'allocate_income',
    label: 'Help me allocate my income',
    scenario: 'allocate_income',
  },
  {
    id: 'allocate_savings',
    label: 'Help me allocate my savings',
    scenario: 'allocate_savings',
  },
];

const openCards = [
  {
    id: 'hysa',
    title: 'Create HYSA',
    description: 'In just 1 year, you could earn over $500 with ~5% interest and a $200 signup bonus.',
  },
  {
    id: '401k',
    title: '401K Advisor',
    description: 'Increase your 401k 3% over the next oc in order to gain a co',
  },
];

interface FinancialSidekickProps {
  inline?: boolean;
}

export function FinancialSidekick({ inline = false }: FinancialSidekickProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const router = useRouter();

  const handleQuestionClick = (scenario: string) => {
    if (scenario === 'rent') {
      router.push(`/app/tools/net-worth-analyzer?scenario=rent`);
    } else if (scenario === 'save_more') {
      router.push(`/app/tools/savings-optimizer`);
    } else if (scenario === 'allocate_savings') {
      router.push(`/app/tools/savings-allocator`);
    } else if (scenario === 'allocate_income') {
      router.push(`/app/tools/income-allocator`);
    } else if (scenario === 'debt_extra') {
      router.push(`/app/tools/net-worth-analyzer?scenario=debt_extra`);
    }
    setIsOpen(false);
  };

  const handleChatSubmit = () => {
    if (chatInput.trim()) {
      // Handle custom chat input
      // For now, just clear the input
      setChatInput('');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="flex h-full max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-xl font-semibold">Sidekick Overlay</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Open Cards Section */}
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-white">Open Cards</h3>
              <ArrowRight className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {openCards.map((card) => (
                <Card key={card.id} className="cursor-pointer transition-all hover:shadow-md">
                  <CardContent className="p-4">
                    <h4 className="mb-2 font-semibold text-slate-900 dark:text-white">
                      {card.title}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {card.description}
                    </p>
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
                  onClick={() => handleQuestionClick(question.scenario)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  <span className="text-slate-900 dark:text-white">{question.label}</span>
                  <Search className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Input Bar */}
        <div className="border-t bg-white p-4 dark:bg-slate-900">
          <div className="flex items-center gap-3 rounded-full border border-slate-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
            {/* Frog Icon */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600">
              <span className="text-lg">🐸</span>
            </div>
            {/* Input Field */}
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleChatSubmit();
                }
              }}
              placeholder="How can I help you?"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400"
            />
            {/* Lightning Bolt Button */}
            <button
              onClick={handleChatSubmit}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white transition-all hover:bg-green-700"
            >
              <Zap className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
