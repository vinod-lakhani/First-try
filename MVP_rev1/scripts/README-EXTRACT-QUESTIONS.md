# Extract Questions and Responses from Logs

This script helps you extract and consolidate all LLM questions and responses from your Vercel logs into a single file for analysis.

## Quick Start

### Option 1: Export from Vercel Logs

1. **Download logs from Vercel:**
   - Go to your Vercel project dashboard
   - Click on **Deployments** tab
   - Click on a deployment
   - Click on **Logs** tab
   - Copy all log content (or download if available)

2. **Save logs to a file:**
   ```bash
   # Save logs to a file (paste the logs into vercel-logs.txt)
   # Or use Vercel CLI:
   vercel logs [deployment-url] > vercel-logs.txt
   ```

3. **Extract questions:**
   ```bash
   node scripts/extract-questions.js --input vercel-logs.txt --format csv --output questions.csv
   ```

### Option 2: Stream from Vercel CLI

```bash
# Extract questions directly from live logs
vercel logs [deployment-url] | node scripts/extract-questions.js --format csv --output questions.csv
```

## Output Formats

### CSV Format (Default)
```bash
node scripts/extract-questions.js --input logs.txt --format csv --output questions.csv
```

Opens in Excel/Google Sheets. Columns:
- Timestamp
- Context
- Status
- Question
- Response
- Response Length
- Model

### JSON Format
```bash
node scripts/extract-questions.js --input logs.txt --format json --output questions.json
```

Structured JSON format for programmatic access:
```json
{
  "exportDate": "2025-11-28T20:30:45.123Z",
  "totalQuestions": 150,
  "questions": [
    {
      "timestamp": "2025-11-28T20:30:45.123Z",
      "context": "financial-sidekick",
      "question": "How much cash will I have in 5 years?",
      "response": "Based on your current plan...",
      "status": "success",
      "responseLength": 234,
      "model": "gpt-4o-mini"
    }
  ]
}
```

### Plain Text Format
```bash
node scripts/extract-questions.js --input logs.txt --format txt --output questions.txt
```

Human-readable format:
```
[1] 11/28/2025, 3:30:45 PM | financial-sidekick | success
Q: How much cash will I have in 5 years?
A: Based on your current plan...
--------------------------------------------------------------------------------
```

## Filtering

### Filter by Context
```bash
# Only extract questions from financial-sidekick
node scripts/extract-questions.js --input logs.txt --filter-context financial-sidekick --output sidekick-questions.csv

# Only extract questions from savings-helper
node scripts/extract-questions.js --input logs.txt --filter-context savings-helper --output savings-questions.csv
```

## Examples

### Export All Questions to CSV
```bash
node scripts/extract-questions.js --input vercel-logs.txt --format csv --output all-questions.csv
```

### Export Onboarding Questions Only
```bash
node scripts/extract-questions.js --input vercel-logs.txt --filter-context onboarding --format csv --output onboarding-questions.csv
```

### Export as JSON for Analysis
```bash
node scripts/extract-questions.js --input vercel-logs.txt --format json --output questions.json
```

### Export Human-Readable Text
```bash
node scripts/extract-questions.js --input vercel-logs.txt --format txt --output questions.txt
```

## Advanced: Automated Export

You can set up a cron job or scheduled task to automatically export questions:

```bash
#!/bin/bash
# export-questions.sh

DATE=$(date +%Y-%m-%d)
vercel logs [your-deployment-url] | \
  node scripts/extract-questions.js \
    --format csv \
    --output "exports/questions-${DATE}.csv"
```

## Integration with External Services

If you've set up external logging (database, Axiom, etc.), you can query directly:

### From Database (PostgreSQL example)
```sql
COPY (
  SELECT 
    timestamp,
    context,
    response_status,
    question,
    response,
    response_length,
    model
  FROM llm_questions
  ORDER BY timestamp DESC
) TO '/path/to/questions.csv' WITH CSV HEADER;
```

### From Axiom
Use Axiom's export feature to download as CSV/JSON, then use the script to format.

## Tips

1. **Date Range Filtering**: If exporting from Vercel, filter logs by date in the dashboard first
2. **Large Files**: For large log files, consider processing in chunks
3. **Regular Exports**: Export questions weekly/monthly for trend analysis
4. **Privacy**: Remove or anonymize IP addresses if exporting for analysis outside your system

## Troubleshooting

**Script doesn't find any questions:**
- Check that logs contain `[LLM_QUESTION_LOG]` entries
- Verify log format hasn't changed
- Check for JSON parsing errors in console

**Memory issues with large files:**
- Process logs in smaller chunks
- Use streaming input instead of loading entire file

**Missing responses:**
- Responses are only logged for successful requests
- Error cases will show error messages instead

