/**
 * Chat Service
 * 
 * Service for interacting with the ChatGPT API.
 */

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatRequest {
  messages: Message[];
  context?: string;
  userPlanData?: {
    monthlyIncome?: number;
    savingsRate?: number;
    debtTotal?: number;
    [key: string]: any;
  };
}

export async function sendChatMessage(request: ChatRequest): Promise<string> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to get response from chat API');
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error sending chat message:', error);
    throw error;
  }
}

