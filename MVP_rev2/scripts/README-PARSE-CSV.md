# Parse Vercel CSV Export

## Quick Start

If you exported logs from Vercel Dashboard as CSV, use this script to extract questions:

```bash
# Copy your CSV file to the weleap-mockups folder first
cp /path/to/your/logs.csv weleap-mockups/vercel-export.csv

# Then run the parser
cd weleap-mockups
node scripts/parse-vercel-csv.js vercel-export.csv questions.csv
```

## What It Does

The script:
1. Reads your Vercel CSV export
2. Finds all `[LLM_QUESTION_LOG]` entries in the "message" column
3. Extracts questions, responses, context, timestamps, etc.
4. Outputs a clean CSV with just the questions/responses

## Output Format

The output CSV has these columns:
- **Timestamp**: When the question was asked
- **Context**: Which page (financial-sidekick, savings-helper, etc.)
- **Status**: success or error
- **Question**: User's question
- **Response**: LLM's full response
- **Response Length**: Character count
- **Model**: Which model was used

## Finding Your CSV File

If you're not sure where you saved it:

1. **Check your Downloads folder:**
   ```bash
   ls ~/Downloads/*.csv
   ```

2. **Check your Desktop:**
   ```bash
   ls ~/Desktop/*.csv
   ```

3. **Search everywhere:**
   ```bash
   find ~ -name "*log*.csv" -type f -mtime -1
   ```

4. **Or just tell me the filename and I can help find it!**

