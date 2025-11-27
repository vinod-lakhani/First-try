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

    // Check if the response is 404 (API route doesn't exist - likely static export)
    if (response.status === 404) {
      throw new Error('The chat feature requires a server environment and is not available on static hosting like GitHub Pages. Please run the app locally or deploy to a platform that supports API routes (like Vercel or Netlify).');
    }

    if (!response.ok) {
      // Try to parse error response
      let errorMessage = `Failed to get response from chat API (${response.status})`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        console.error('Chat API error response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
      } catch (parseError) {
        // Response is not JSON, get text instead
        try {
          const text = await response.text();
          console.error('Chat API non-JSON error response:', {
            status: response.status,
            statusText: response.statusText,
            body: text.substring(0, 200), // First 200 chars
          });
          errorMessage = text || errorMessage;
        } catch (textError) {
          console.error('Chat API error - unable to read response:', {
            status: response.status,
            statusText: response.statusText,
          });
        }
      }
      throw new Error(errorMessage);
    }

    const data = await response.json().catch((parseError) => {
      console.error('Failed to parse chat API response as JSON:', parseError);
      throw new Error('Received invalid response from chat API');
    });

    if (data.error) {
      throw new Error(data.error);
    }
    return data.response || 'I apologize, I could not generate a response.';
  } catch (error) {
    console.error('Error sending chat message:', error);
    
    // Handle network/fetch errors
    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        throw new Error('Network error: Unable to connect to the chat service. API routes require a server environment and are not available on static hosting like GitHub Pages.');
      }
    }
    
    // Re-throw with better message for unknown errors
    if (!(error instanceof Error)) {
      throw new Error(`Unexpected error: ${String(error)}`);
    }
    
    throw error;
  }
}

