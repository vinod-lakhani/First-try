# External Logging Setup

This guide explains how to set up external storage for LLM questions and responses, so you can query and analyze them beyond what's available in Vercel logs.

## Overview

The logging system supports multiple storage backends:
1. **Supabase** (Database - recommended for queryable storage)
2. **Axiom** (Logging service - recommended for searchable logs)
3. **File storage** (Development only - stores in local `logs/` directory)

## Quick Start

### Step 1: Enable Question Storage

Add this environment variable in Vercel (Settings → Environment Variables):

```
ENABLE_QUESTION_STORAGE=true
```

### Step 2: Choose and Configure a Storage Backend

Pick one of the options below and follow its setup instructions.

---

## Option 1: Supabase (Recommended for Database Storage)

Supabase provides a free PostgreSQL database with a generous free tier.

### Setup Steps

1. **Create a Supabase account:**
   - Go to [supabase.com](https://supabase.com)
   - Sign up for free

2. **Create a new project:**
   - Click "New Project"
   - Give it a name (e.g., "weleap-logs")
   - Choose a database password (save it!)
   - Wait for the project to initialize (~2 minutes)

3. **Create the table:**
   - Go to the SQL Editor in your Supabase project
   - Run this SQL:

```sql
-- Create the llm_questions table
CREATE TABLE llm_questions (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  question TEXT NOT NULL,
  response TEXT,
  context VARCHAR(100),
  session_id VARCHAR(255),
  response_status VARCHAR(20) NOT NULL,
  error_message TEXT,
  response_length INTEGER,
  model VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_llm_questions_timestamp ON llm_questions(timestamp DESC);
CREATE INDEX idx_llm_questions_context ON llm_questions(context);
CREATE INDEX idx_llm_questions_response_status ON llm_questions(response_status);
CREATE INDEX idx_llm_questions_session_id ON llm_questions(session_id);

-- Enable Row Level Security (optional, but recommended)
ALTER TABLE llm_questions ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows service role to insert (for API)
-- This uses service role key, not anon key
CREATE POLICY "Allow service role to insert"
ON llm_questions
FOR INSERT
TO service_role
WITH CHECK (true);

-- Create a policy that allows authenticated users to read (if you want to build a UI)
-- CREATE POLICY "Allow authenticated users to read"
-- ON llm_questions
-- FOR SELECT
-- TO authenticated
-- USING (true);
```

4. **Get your Supabase credentials:**
   - Go to Project Settings → API
   - Copy:
     - **Project URL** (looks like `https://xxxxx.supabase.co`)
     - **Service Role Key** (keep this secret! Never expose in client code)

5. **Add environment variables in Vercel:**
   - Go to your Vercel project → Settings → Environment Variables
   - Add:
     ```
     SUPABASE_URL=https://xxxxx.supabase.co
     SUPABASE_SERVICE_KEY=your-service-role-key-here
     ENABLE_QUESTION_STORAGE=true
     ```
   - Deploy to apply changes

### Querying Your Data

Once set up, you can query questions in Supabase SQL Editor:

```sql
-- Get all questions from last 24 hours
SELECT * FROM llm_questions 
WHERE timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- Count questions by context
SELECT context, COUNT(*) as count
FROM llm_questions
GROUP BY context
ORDER BY count DESC;

-- Find error responses
SELECT question, error_message, timestamp
FROM llm_questions
WHERE response_status = 'error'
ORDER BY timestamp DESC;

-- Search for specific questions
SELECT question, response, timestamp
FROM llm_questions
WHERE question ILIKE '%net worth%'
ORDER BY timestamp DESC;
```

You can also export data:
- Use Supabase dashboard to export as CSV
- Use the `scripts/extract-questions.js` script with a database query
- Build a custom dashboard using Supabase client libraries

---

## Option 2: Axiom (Recommended for Searchable Logs)

Axiom is optimized for log analytics with powerful search and query capabilities.

### Setup Steps

1. **Create an Axiom account:**
   - Go to [axiom.co](https://axiom.co)
   - Sign up for free (generous free tier)

2. **Create a dataset:**
   - In the Axiom dashboard, go to Datasets
   - Click "Create Dataset"
   - Name it `llm_questions`
   - Keep the default settings

3. **Get your API key:**
   - Go to Settings → API Tokens
   - Click "Create Token"
   - Give it a name (e.g., "WeLeap Logging")
   - Select "Ingest" scope
   - Copy the token (you won't see it again!)

4. **Add environment variables in Vercel:**
   - Go to your Vercel project → Settings → Environment Variables
   - Add:
     ```
     AXIOM_API_KEY=your-api-token-here
     AXIOM_DATASET=llm_questions
     ENABLE_QUESTION_STORAGE=true
     ```
   - Optionally set `AXIOM_URL` if using Axiom self-hosted (default: `https://api.axiom.co`)
   - Deploy to apply changes

### Querying Your Data

Axiom has a powerful query language:

```
['llm_questions']
| where responseStatus == "success"
| summarize count() by context
| order by count desc
```

You can also use the dashboard to:
- Search logs by keyword
- Create charts and visualizations
- Set up alerts
- Export data

---

## Option 3: File Storage (Development Only)

For local development, questions can be stored in a local file. This is **not recommended for production**.

### Setup

1. **Add environment variable:**
   ```bash
   # .env.local
   ENABLE_QUESTION_STORAGE=true
   ```

2. **Files will be created in:**
   ```
   logs/questions-YYYY-MM-DD.jsonl
   ```

   Each line is a JSON object (JSONL format).

3. **Extract questions:**
   ```bash
   # Combine all log files
   cat logs/questions-*.jsonl > all-questions.jsonl
   
   # Extract to CSV using the script
   node scripts/extract-questions.js --input all-questions.jsonl --format csv --output questions.csv
   ```

**Note:** This option is automatically used in development when no Supabase or Axiom credentials are configured.

---

## Testing

After setting up, test that logging works:

1. **Ask a question in your chat:**
   - Open the financial sidekick or any chat interface
   - Ask any question (e.g., "What's my net worth?")

2. **Check storage:**
   - **Supabase**: Go to Table Editor → `llm_questions` and refresh
   - **Axiom**: Go to Datasets → `llm_questions` and search for recent logs
   - **File**: Check `logs/questions-YYYY-MM-DD.jsonl`

3. **Check logs:**
   - Console logs will still appear in Vercel logs
   - External storage is in addition to console logging, not a replacement

---

## Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `ENABLE_QUESTION_STORAGE` | Yes | Set to `true` to enable external storage |
| `SUPABASE_URL` | For Supabase | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | For Supabase | Your Supabase service role key |
| `AXIOM_API_KEY` | For Axiom | Your Axiom API token |
| `AXIOM_DATASET` | For Axiom | Dataset name (e.g., `llm_questions`) |
| `AXIOM_URL` | Optional | Custom Axiom URL (default: `https://api.axiom.co`) |
| `NEXT_PUBLIC_BASE_URL` | Optional | Base URL for API calls (auto-detected) |

---

## Troubleshooting

### Questions not being stored

1. **Check environment variables:**
   - Make sure `ENABLE_QUESTION_STORAGE=true` is set
   - Verify your storage backend credentials are correct
   - **Important**: Redeploy after changing environment variables!

2. **Check Vercel logs:**
   - Look for `[Log Question API]` messages
   - Check for errors like "No storage service configured"

3. **Check API endpoint:**
   - Try accessing `/api/log-question` directly (will fail without auth, but should return JSON)
   - Check that the route exists in your deployment

### Supabase errors

- **"relation llm_questions does not exist"**: Run the SQL to create the table
- **"new row violates row-level security policy"**: Check your RLS policies or disable RLS temporarily
- **"permission denied"**: Make sure you're using the Service Role key, not the anon key

### Axiom errors

- **"dataset not found"**: Create the dataset in Axiom dashboard first
- **"unauthorized"**: Check that your API key is correct and has "Ingest" scope
- **"invalid timestamp"**: Check that `_time` field is being sent correctly

### Performance

- External storage is **async and non-blocking** - it won't slow down chat responses
- If storage fails, the chat will still work (errors are logged but don't fail the request)
- Storage failures are logged to console for debugging

---

## Next Steps

Once questions are being stored:

1. **Export and analyze:**
   - Use `scripts/extract-questions.js` to export to CSV/JSON
   - Import into Excel/Google Sheets for analysis
   - Create dashboards in Supabase or Axiom

2. **Build a questions dashboard:**
   - Use Supabase client libraries to query and display questions
   - Create a `/admin/questions` page to view recent questions
   - Add filtering by context, date range, status, etc.

3. **Analyze patterns:**
   - What questions are asked most frequently?
   - Which contexts generate the most questions?
   - Are there common error patterns?
   - What's the average response length?

4. **Improve the LLM:**
   - Review questions that resulted in errors
   - Identify gaps in the prompt or context
   - Test prompt improvements based on real usage

---

## Cost Considerations

- **Supabase Free Tier**: 500MB database, unlimited API requests
- **Axiom Free Tier**: 2GB ingestion/month, 14-day retention
- **Vercel Logs**: 7 days (free) or 30 days (Pro)

For most use cases, the free tiers are sufficient. Monitor usage and upgrade as needed.

