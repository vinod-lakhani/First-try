# LLM Question Logging

This document explains how to record and view all questions asked to the LLM (Ribbit) in your Vercel-hosted application.

## Overview

All questions asked to the LLM are automatically logged with the following information:
- **Question text**: The exact question the user asked
- **Timestamp**: When the question was asked
- **Context**: Which page/screen the question was asked from (e.g., `savings-helper`, `financial-sidekick`)
- **Response status**: Whether the response was successful or had an error
- **Metadata**: IP address, user agent, response length, etc.

## Where Logs Are Stored

### 1. Vercel Logs (Automatic - Current Implementation)

All questions are logged to the console with the prefix `[LLM_QUESTION_LOG]`. Vercel automatically captures these logs in their dashboard.

**To view logs:**
1. Go to your Vercel project dashboard
2. Click on the **Deployments** tab
3. Click on a deployment
4. Click on **Logs** tab
5. Filter/search for `[LLM_QUESTION]` to see all questions

**Log Format:**

Each question and response is logged in multiple formats:

1. **Simple, readable format** (easy to scan):
```
[LLM_QUESTION] ✅ [financial-sidekick] Q: "How much cash will I have in 5 years?" | Status: success | 11/28/2025, 3:30:45 PM
[LLM_RESPONSE] A: "Based on your current plan, your projected cash in 5 years is approximately $45,200..."
```

2. **Detailed JSON format** (for analysis - includes full response):
```json
[LLM_QUESTION_LOG] {
  "type": "LLM_QUESTION",
  "timestamp": "2025-11-28T20:30:45.123Z",
  "question": "How much cash will I have in 5 years?",
  "response": "Based on your current plan, your projected cash in 5 years is approximately $45,200. This includes your current cash balance of $11,700, plus monthly contributions and compound growth at 4% annually...",
  "context": "financial-sidekick",
  "responseStatus": "success",
  "responseLength": 234,
  "model": "gpt-4o-mini",
  "metadata": {
    "userAgent": "Mozilla/5.0...",
    "ipAddress": "192.168.1.1",
    "hasUserPlanData": true
  }
}
```

**Reading the simple format:**
- ✅ or ❌ = Success or error
- `[context]` = Which page/screen (e.g., `[savings-helper]`, `[financial-sidekick]`)
- `Q: "..."` = The actual question text
- `A: "..."` = The LLM's response (truncated if longer than 150 chars - full response in JSON)
- `Status: success/error` = Response status
- Timestamp = When the question was asked

### 2. Exporting Logs from Vercel

**Via Vercel Dashboard:**
- Logs are available for 7 days (free plan) or 30 days (Pro plan)
- You can view and search logs in the dashboard
- For longer retention, consider upgrading or using an external logging service

**Via Vercel CLI:**
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# View logs
vercel logs [deployment-url] --follow
```

### 3. Extracting Questions and Responses to a File

**Use the extraction script** to consolidate all questions and responses into a single file:

```bash
# Export to CSV (opens in Excel/Google Sheets)
vercel logs [deployment-url] | node scripts/extract-questions.js --format csv --output questions.csv

# Export to JSON
vercel logs [deployment-url] | node scripts/extract-questions.js --format json --output questions.json

# Export to human-readable text
vercel logs [deployment-url] | node scripts/extract-questions.js --format txt --output questions.txt
```

**Or from a saved log file:**
```bash
# Save logs first
vercel logs [deployment-url] > vercel-logs.txt

# Then extract
node scripts/extract-questions.js --input vercel-logs.txt --format csv --output questions.csv
```

**Filter by context:**
```bash
# Only extract questions from specific pages
node scripts/extract-questions.js --input vercel-logs.txt --filter-context financial-sidekick --output sidekick-questions.csv
```

See `scripts/README-EXTRACT-QUESTIONS.md` for full documentation on the extraction script.

## Optional: External Logging Services

For longer-term storage and better analytics, you can integrate with external logging services:

### Option 1: Axiom (Recommended for structured logs)
1. Sign up at [axiom.co](https://axiom.co)
2. Create a dataset for `llm_questions`
3. Add your Axiom API key to Vercel environment variables
4. Uncomment and configure the `sendToExternalLoggingService` function in `lib/chat/questionLogger.ts`

### Option 2: Logtail (Good for searchable logs)
1. Sign up at [logtail.com](https://logtail.com)
2. Create a source
3. Add your Logtail token to Vercel environment variables
4. Update the logger to send to Logtail

### Option 3: Database (For queryable storage)
1. Set up a database (Supabase, PlanetScale, MongoDB, etc.)
2. Create a `llm_questions` table
3. Create an API endpoint to store questions
4. Update the logger to send to your API endpoint

Example schema:
```sql
CREATE TABLE llm_questions (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  question TEXT NOT NULL,
  context VARCHAR(100),
  session_id VARCHAR(255),
  response_status VARCHAR(20),
  error_message TEXT,
  response_length INTEGER,
  model VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_timestamp ON llm_questions(timestamp);
CREATE INDEX idx_context ON llm_questions(context);
CREATE INDEX idx_response_status ON llm_questions(response_status);
```

## Analyzing Logs

### Common Questions to Answer:

1. **What questions are users asking most?**
   - Search/filter logs by question text
   - Group by similar questions

2. **Which screens generate the most questions?**
   - Filter by `context` field
   - Count questions per context

3. **Are there common errors?**
   - Filter by `responseStatus: 'error'`
   - Look at `errorMessage` patterns

4. **Are questions getting good responses?**
   - Check `responseLength` (longer = more detailed)
   - Look for error rates

### Example Queries (if using a database):

```sql
-- Most common questions
SELECT question, COUNT(*) as count
FROM llm_questions
GROUP BY question
ORDER BY count DESC
LIMIT 20;

-- Questions by context
SELECT context, COUNT(*) as count
FROM llm_questions
GROUP BY context
ORDER BY count DESC;

-- Error rate
SELECT 
  response_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM llm_questions
GROUP BY response_status;

-- Questions over time
SELECT 
  DATE(timestamp) as date,
  COUNT(*) as question_count
FROM llm_questions
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

## Privacy Considerations

- **IP Addresses**: Currently logged for security/debugging. Consider anonymizing or removing in production
- **User Data**: No personally identifiable information (PII) is logged by default
- **Session IDs**: Optional - add if you want to track user sessions
- **GDPR Compliance**: Ensure you have user consent for logging if required in your jurisdiction

## Next Steps

1. **View logs in Vercel** to see questions in real-time
2. **Export logs periodically** for analysis (if needed beyond retention period)
3. **Set up external logging** for long-term storage (optional but recommended)
4. **Create analytics dashboard** to visualize question patterns (optional)

## Questions?

All questions are logged! Check Vercel logs first, then consider setting up external logging for long-term analytics.

