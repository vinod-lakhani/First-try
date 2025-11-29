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

/**
 * Get user-friendly error message from HTTP status code
 */
function getErrorMessageFromStatus(status: number, statusText: string): string {
  if (status === 500) {
    return 'The chat service encountered an internal error. Please try again.';
  } else if (status === 503) {
    return 'The chat service is temporarily unavailable. Please try again later.';
  } else if (status === 401 || status === 403) {
    return 'Authentication failed. The chat service may not be properly configured.';
  } else if (status === 429) {
    return 'The chat service is temporarily rate-limited. Please try again in a moment.';
  } else if (status === 400) {
    return 'Invalid request. Please check your input and try again.';
  } else if (status >= 400 && status < 500) {
    return `The chat service returned an error (${status}). Please check your request and try again.`;
  } else if (status >= 500) {
    return `The chat service is experiencing issues (${status}). Please try again later.`;
  } else {
    return `The chat service returned an unexpected error (${status}: ${statusText}). Please try again.`;
  }
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
      // Get status info first (before trying to read body)
      const statusCode = response.status || 500;
      const statusText = response.statusText || 'Unknown Error';
      
      // Try to parse error response - read body once
      let errorMessage = `Failed to get response from chat API (${statusCode})`;
      
      // Try to get error details from response body
      let responseBody: string | null = null;
      try {
        responseBody = await response.text();
      } catch (readError) {
        // Response body is unreadable or already consumed
        const errorDetails: any = {
          status: statusCode,
          statusText: statusText,
        };
        
        if (readError instanceof Error) {
          errorDetails.readError = readError.message;
          errorDetails.readErrorStack = readError.stack;
        } else {
          errorDetails.readError = String(readError);
        }
        
        console.error('Chat API error - unable to read response body:', errorDetails);
      }
      
      // Try to parse as JSON if we got a body
      if (responseBody && typeof responseBody === 'string' && responseBody.trim().length > 0) {
        try {
          const errorData = JSON.parse(responseBody);
          errorMessage = errorData.error || errorMessage;
          console.error('Chat API error response:', {
            status: statusCode,
            statusText: statusText,
            error: errorData,
          });
        } catch (parseError) {
          // Not JSON - use the text as error message
          const trimmedBody = responseBody.trim();
          if (trimmedBody.length > 0) {
            // Check if it's an HTML error page (common Next.js error response)
            const trimmedLower = trimmedBody.trim().toLowerCase();
            if (trimmedLower.startsWith('<!doctype') || trimmedLower.startsWith('<html') || trimmedBody.includes('Internal Server Error')) {
              // This is an HTML error page, not a JSON response
              // This usually means the API route threw an uncaught error
              console.error('Chat API returned HTML error page instead of JSON (likely uncaught error in API route):', {
                status: statusCode,
                statusText: statusText,
                bodyPreview: trimmedBody.substring(0, 150),
                isHTML: true,
              });
              errorMessage = 'The chat service encountered an error. This may be due to a configuration issue. Please check the server logs or contact support.';
            } else {
              console.error('Chat API non-JSON error response:', {
                status: statusCode,
                statusText: statusText,
                body: trimmedBody.substring(0, 200), // First 200 chars
                bodyLength: trimmedBody.length,
              });
              errorMessage = trimmedBody || errorMessage;
            }
          } else {
            // Empty response body after trim - use status-based error message
            console.error('Chat API error - empty response body:', {
              status: statusCode,
              statusText: statusText,
            });
            errorMessage = getErrorMessageFromStatus(statusCode, statusText);
          }
        }
      } else {
        // No response body or empty - use status-based error message
        if (!responseBody || (typeof responseBody === 'string' && responseBody.trim().length === 0)) {
          console.error('Chat API error - no response body:', {
            status: statusCode,
            statusText: statusText,
            hasBody: !!responseBody,
            bodyType: typeof responseBody,
            bodyLength: typeof responseBody === 'string' ? responseBody.length : 0,
          });
        }
        errorMessage = getErrorMessageFromStatus(statusCode, statusText);
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

