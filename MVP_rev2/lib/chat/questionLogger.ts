/**
 * Question Logger
 * 
 * Records all questions asked to the LLM for analytics and improvement.
 * Logs are stored in a format that's easy to query and export.
 */

export interface QuestionLog {
  timestamp: string;
  question: string;
  response?: string; // The LLM's response text
  context?: string;
  userId?: string;
  sessionId?: string;
  responseStatus: 'success' | 'error';
  errorMessage?: string;
  responseLength?: number;
  model?: string;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    [key: string]: any;
  };
}

/**
 * Log a question to the system
 * 
 * This function logs questions in multiple ways:
 * 1. Structured console log (captured by Vercel Logs)
 * 2. Optional: Write to file/database for long-term storage
 */
export async function logQuestion(log: QuestionLog): Promise<void> {
  try {
    // Format for console log (structured JSON for easy parsing)
    const logEntry = {
      type: 'LLM_QUESTION',
      ...log,
    };

    // Log a simple, visible line with the question first (easy to read in logs)
    const timestamp = new Date(log.timestamp).toLocaleString();
    const contextLabel = log.context ? `[${log.context}]` : '';
    const statusIcon = log.responseStatus === 'success' ? '✅' : '❌';
    
    // Truncate long responses for single-line log (keep full response in JSON)
    const responsePreview = log.response 
      ? (log.response.length > 150 ? log.response.substring(0, 150) + '...' : log.response)
      : (log.errorMessage || 'No response');
    
    console.log(`[LLM_QUESTION] ${statusIcon} ${contextLabel} Q: "${log.question}" | Status: ${log.responseStatus} | ${timestamp}`);
    if (log.response) {
      console.log(`[LLM_RESPONSE] A: "${responsePreview}"`);
    }
    
    // Also log the full structured JSON for detailed analysis (includes full response)
    console.log('[LLM_QUESTION_LOG]', JSON.stringify(logEntry, null, 2));

    // Send to external logging API if enabled (runs async, doesn't block)
    if (process.env.ENABLE_QUESTION_STORAGE === 'true') {
      sendToLoggingAPI(logEntry).catch(error => {
        // Log error but don't fail the main request
        console.error('[QuestionLogger] Failed to send to logging API:', error);
      });
    }

  } catch (error) {
    // Don't fail the request if logging fails
    console.error('[QuestionLogger] Failed to log question:', error);
  }
}

/**
 * Extract the last user message (the question) from messages array
 */
export function extractUserQuestion(messages: any[]): string {
  if (!messages || !Array.isArray(messages)) {
    return '';
  }

  // Find the last user message
  const userMessages = messages
    .filter((msg: any) => msg?.isUser === true || msg?.role === 'user')
    .map((msg: any) => msg?.text || msg?.content || '');

  return userMessages[userMessages.length - 1] || '';
}

/**
 * Get IP address from request headers
 */
export function getIpAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

/**
 * Get user agent from request headers
 */
export function getUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'unknown';
}

/**
 * Send log entry to the logging API endpoint
 * This API route will then store it in the configured storage (Supabase, Axiom, etc.)
 */
async function sendToLoggingAPI(logEntry: QuestionLog): Promise<void> {
  try {
    // Get the base URL (works for both server and client)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    (typeof window !== 'undefined' ? window.location.origin : '');
    
    const apiUrl = `${baseUrl}/api/log-question`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logEntry),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Logging API error: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    // Re-throw so caller can handle it
    throw error;
  }
}

