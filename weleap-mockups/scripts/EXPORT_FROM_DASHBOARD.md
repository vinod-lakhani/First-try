# Export Questions from Vercel Dashboard

Since `vercel logs` only streams live logs, here's how to get historical logs from the Vercel Dashboard:

## Method 1: Copy Logs from Dashboard (Easiest)

1. **Go to your Vercel Dashboard:**
   - Visit: https://vercel.com/vinod-lakhanis-projects/first-try
   - Or navigate to your project → **Deployments** tab

2. **Open the deployment logs:**
   - Click on the latest deployment (or any deployment you want)
   - Click on the **Logs** tab
   - You'll see all the logs for that deployment

3. **Copy the logs:**
   - Select all logs (Cmd+A on Mac, Ctrl+A on Windows)
   - Copy (Cmd+C / Ctrl+C)
   - Paste into a text file: `vercel-logs.txt`

4. **Extract questions:**
   ```bash
   cd weleap-mockups
   node scripts/extract-questions.js --input vercel-logs.txt --format csv --output questions.csv
   ```

## Method 2: Export Multiple Deployments

If you want logs from multiple deployments:

1. **For each deployment:**
   - Go to Deployments → Click on deployment → Logs tab
   - Copy all logs
   - Append to `vercel-logs.txt` (each deployment's logs in the same file)

2. **Extract all at once:**
   ```bash
   node scripts/extract-questions.js --input vercel-logs.txt --format csv --output all-questions.csv
   ```

## Method 3: Use Vercel Logs API (Advanced)

If you want to automate this, you can use the Vercel API to fetch logs programmatically. But the dashboard method is usually easier!

## Tips

- **Date Range**: Vercel shows logs for the last 7 days (free) or 30 days (Pro)
- **Search**: Use browser search (Cmd+F) in the logs to find `[LLM_QUESTION_LOG]` entries
- **Multiple Files**: You can save logs from different time periods to different files, then extract separately

