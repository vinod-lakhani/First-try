/**
 * Question Logging API Route
 * 
 * Stores LLM questions and responses to a database or external service.
 * This endpoint is called automatically by the question logger.
 */

import { NextRequest, NextResponse } from 'next/server';

export interface StoredQuestionLog {
  timestamp: string;
  question: string;
  response?: string;
  context?: string;
  sessionId?: string;
  responseStatus: 'success' | 'error';
  errorMessage?: string;
  responseLength?: number;
  model?: string;
  metadata?: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    const logData: StoredQuestionLog = await request.json();

    // Validate required fields
    if (!logData.question || !logData.timestamp) {
      return NextResponse.json(
        { error: 'Missing required fields: question, timestamp' },
        { status: 400 }
      );
    }

    // Option 1: Store in Supabase (if configured)
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      await storeInSupabase(logData);
    }
    // Option 2: Store in Axiom (if configured)
    else if (process.env.AXIOM_API_KEY && process.env.AXIOM_DATASET) {
      await storeInAxiom(logData);
    }
    // Option 3: Store in simple JSON file (fallback for development)
    else if (process.env.NODE_ENV !== 'production') {
      await storeInFile(logData);
    }
    // Option 4: No storage configured - just log
    else {
      console.warn('[Log Question API] No storage service configured. Question logged but not persisted.');
      return NextResponse.json({ success: true, stored: false, reason: 'No storage configured' });
    }

    return NextResponse.json({ success: true, stored: true });
  } catch (error) {
    console.error('[Log Question API] Error storing question:', error);
    // Don't fail the main request if logging fails
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Store in Supabase database
 */
async function storeInSupabase(logData: StoredQuestionLog): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/llm_questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        timestamp: logData.timestamp,
        question: logData.question,
        response: logData.response || null,
        context: logData.context || null,
        session_id: logData.sessionId || null,
        response_status: logData.responseStatus,
        error_message: logData.errorMessage || null,
        response_length: logData.responseLength || null,
        model: logData.model || null,
        metadata: logData.metadata || {},
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase error: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error('[Log Question API] Supabase storage failed:', error);
    throw error;
  }
}

/**
 * Store in Axiom
 */
async function storeInAxiom(logData: StoredQuestionLog): Promise<void> {
  const apiKey = process.env.AXIOM_API_KEY!;
  const dataset = process.env.AXIOM_DATASET!;
  const axiomUrl = process.env.AXIOM_URL || 'https://api.axiom.co';

  try {
    const response = await fetch(`${axiomUrl}/v1/datasets/${dataset}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify([{
        _time: logData.timestamp,
        question: logData.question,
        response: logData.response || null,
        context: logData.context || null,
        sessionId: logData.sessionId || null,
        responseStatus: logData.responseStatus,
        errorMessage: logData.errorMessage || null,
        responseLength: logData.responseLength || null,
        model: logData.model || null,
        ...(logData.metadata || {}),
      }]),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Axiom error: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error('[Log Question API] Axiom storage failed:', error);
    throw error;
  }
}

/**
 * Store in local file (development only)
 */
async function storeInFile(logData: StoredQuestionLog): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const logDir = path.join(process.cwd(), 'logs');
  const logFile = path.join(logDir, `questions-${new Date().toISOString().split('T')[0]}.jsonl`);

  try {
    // Ensure logs directory exists
    await fs.mkdir(logDir, { recursive: true });
    
    // Append to JSONL file (one JSON object per line)
    const logLine = JSON.stringify(logData) + '\n';
    await fs.appendFile(logFile, logLine, 'utf-8');
  } catch (error) {
    console.error('[Log Question API] File storage failed:', error);
    throw error;
  }
}

