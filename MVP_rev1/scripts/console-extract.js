// Simple script to paste in browser console
// This extracts all text from the page that contains LLM logs

const allText = document.body.innerText;
const lines = allText.split('\n');
const logEntries = [];
let currentLog = [];

for (const line of lines) {
  if (line.includes('[LLM_QUESTION_LOG]')) {
    if (currentLog.length > 0) logEntries.push(currentLog.join('\n'));
    currentLog = [line];
  } else if (currentLog.length > 0) {
    currentLog.push(line);
    if (line.trim() === '}' || (line.includes('}') && currentLog.join('').includes('"type":"LLM_QUESTION"'))) {
      logEntries.push(currentLog.join('\n'));
      currentLog = [];
    }
  }
}

if (currentLog.length > 0) logEntries.push(currentLog.join('\n'));

console.log(`Found ${logEntries.length} log entries`);

if (logEntries.length > 0) {
  const blob = new Blob([logEntries.join('\n\n---\n\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vercel-logs.txt';
  a.click();
  console.log(`✅ Downloaded! Now run: node scripts/extract-questions.js --input vercel-logs.txt --format csv --output questions.csv`);
} else {
  console.log('No logs found. Make sure you scrolled through all the logs on the page.');
}

