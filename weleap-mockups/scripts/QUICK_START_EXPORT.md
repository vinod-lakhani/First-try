# Quick Start: Export Questions from Vercel Logs

## Step 1: Install Vercel CLI (if you haven't already)

```bash
npm install -g vercel
```

Then login:
```bash
vercel login
```

## Step 2: Get Your Deployment URL

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Click on your project
3. Copy the deployment URL (e.g., `your-project.vercel.app`)

Or use the Vercel CLI to list deployments:
```bash
vercel ls
```

## Step 3: Export Logs and Extract Questions

### Method A: Stream and Extract in One Command (Recommended)

```bash
# Replace YOUR-DEPLOYMENT-URL with your actual deployment URL
vercel logs YOUR-DEPLOYMENT-URL | node scripts/extract-questions.js --format csv --output questions.csv
```

### Method B: Save Logs First, Then Extract

```bash
# Step 1: Save logs to a file
vercel logs YOUR-DEPLOYMENT-URL > vercel-logs.txt

# Step 2: Extract questions to CSV
node scripts/extract-questions.js --input vercel-logs.txt --format csv --output questions.csv
```

## Step 4: View Your Questions

The questions will be in `questions.csv`. Open it in:
- Excel
- Google Sheets
- Any text editor

Columns:
- **Timestamp**: When the question was asked
- **Context**: Which page (e.g., `financial-sidekick`, `savings-helper`)
- **Status**: `success` or `error`
- **Question**: The user's question
- **Response**: The LLM's full response
- **Response Length**: Character count
- **Model**: LLM model used (e.g., `gpt-4o-mini`)

## Alternative Output Formats

### JSON Format
```bash
vercel logs YOUR-DEPLOYMENT-URL | node scripts/extract-questions.js --format json --output questions.json
```

### Plain Text Format (Human-Readable)
```bash
vercel logs YOUR-DEPLOYMENT-URL | node scripts/extract-questions.js --format txt --output questions.txt
```

## Filter by Context

Only get questions from specific pages:

```bash
# Only financial-sidekick questions
vercel logs YOUR-DEPLOYMENT-URL | node scripts/extract-questions.js --filter-context financial-sidekick --output sidekick-questions.csv

# Only savings-helper questions
vercel logs YOUR-DEPLOYMENT-URL | node scripts/extract-questions.js --filter-context savings-helper --output savings-questions.csv
```

## Troubleshooting

### "Command not found: vercel"
```bash
npm install -g vercel
```

### "No questions found"
- Make sure your logs contain `[LLM_QUESTION_LOG]` entries
- Check that you're using the correct deployment URL
- Try saving logs to a file first and inspecting it

### "Cannot find module"
Make sure you're in the `weleap-mockups` directory:
```bash
cd weleap-mockups
```

## Example Full Workflow

```bash
# 1. Navigate to project directory
cd weleap-mockups

# 2. Export all questions from today
vercel logs your-project.vercel.app | \
  node scripts/extract-questions.js \
    --format csv \
    --output "questions-$(date +%Y-%m-%d).csv"

# 3. Open in Excel/Google Sheets
open questions-2024-11-28.csv  # macOS
# or
xdg-open questions-2024-11-28.csv  # Linux
```

## Tips

1. **Filter by Date Range**: In Vercel dashboard, you can filter logs by date before copying
2. **Multiple Exports**: Export different contexts separately for focused analysis
3. **Regular Exports**: Set up a cron job to export questions daily/weekly automatically
4. **Large Files**: For very large log files, consider processing in chunks

