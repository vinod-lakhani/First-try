/**
 * Question Logger
 * 
 * Records all questions asked to the LLM for analytics and improvement.
 * Logs are stored in a format that's easy to query and export.
 */

export interface QuestionLog {
  timestamp: string;
  question: string;
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

    // Log to console - Vercel will capture this in their logs dashboard
    console.log('[LLM_QUESTION_LOG]', JSON.stringify(logEntry, null, 2));

    // Optional: Send to external logging service
    // You can uncomment and configure one of these:
    
    // Option 1: Send to an API endpoint that stores in database
    // await sendToLoggingAPI(logEntry);
    
    // Option 2: Use Vercel KV (Redis) for temporary storage
    // await storeInVercelKV(logEntry);
    
    // Option 3: Send to Axiom, Logtail, or similar service
    // await sendToExternalLoggingService(logEntry);

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

