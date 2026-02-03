# Extract Logs from Vercel Dashboard Using Browser

Since selecting all logs is difficult, here are easier methods:

## Method 1: Use Browser Search to Find Questions (Easiest)

1. **Go to Vercel Dashboard → Deployments → Latest → Logs tab**

2. **Use browser search (Cmd+F or Ctrl+F)**

3. **Search for:** `[LLM_QUESTION_LOG]`

4. **For each match:**
   - Click on the log line
   - Select the entire JSON block (from `{` to `}`)
   - Copy it
   - Paste into a text file

5. **Save all as:** `vercel-logs.txt`

6. **Extract:**
   ```bash
   node scripts/extract-questions.js --input vercel-logs.txt --format csv --output questions.csv
   ```

## Method 2: Browser DevTools Console (Better for Many Logs)

1. **Open Vercel Dashboard → Deployments → Latest → Logs tab**

2. **Open Browser DevTools:**
   - Mac: `Cmd + Option + I`
   - Windows: `F12` or `Ctrl + Shift + I`

3. **Go to Console tab**

4. **Run this script in the console:**
   ```javascript
   // This extracts all log lines from the page
   const logs = [];
   const logElements = document.querySelectorAll('[class*="log"], [class*="Log"]');
   
   logElements.forEach(el => {
     const text = el.textContent || el.innerText;
     if (text.includes('[LLM_QUESTION_LOG]') || text.includes('LLM_QUESTION')) {
       logs.push(text);
     }
   });
   
   // Copy to clipboard
   const blob = new Blob([logs.join('\n\n')], { type: 'text/plain' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = 'vercel-logs.txt';
   a.click();
   
   console.log(`Extracted ${logs.length} log entries`);
   ```

5. **This will download `vercel-logs.txt`**

6. **Extract questions:**
   ```bash
   node scripts/extract-questions.js --input vercel-logs.txt --format csv --output questions.csv
   ```

## Method 3: Use Browser Extension

If you use a browser extension for copying text, you can:
1. Select the entire logs container
2. Use the extension to copy all text
3. Save to `vercel-logs.txt`

## Method 4: Use Vercel API (Most Automated)

See `scripts/FETCH_LOGS_GUIDE.md` for instructions on using the Vercel API to fetch logs automatically.

## Quick Alternative: Just Get Question/Response Pairs

If you just want to see questions and responses quickly:

1. **In Vercel Dashboard logs, search for:** `Q: "`
2. **For each question you see:**
   - Note the question text
   - Search for `A: "` right after it to find the response
   - Manually copy each pair

This is slower but works if other methods don't work.

