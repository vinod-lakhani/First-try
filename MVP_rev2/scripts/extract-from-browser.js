/**
 * Bookmarklet/Console Script to Extract Logs from Vercel Dashboard
 * 
 * Instructions:
 * 1. Open Vercel Dashboard → Deployments → Latest → Logs tab
 * 2. Open Browser DevTools (F12 or Cmd+Option+I)
 * 3. Go to Console tab
 * 4. Paste this entire script and press Enter
 * 5. It will download a file with all [LLM_QUESTION_LOG] entries
 */

(function() {
  console.log('🔍 Searching for LLM question logs...');
  
  // Find all text content on the page that might contain logs
  const allText = document.body.innerText || document.body.textContent || '';
  
  // Split by lines and find all lines with [LLM_QUESTION_LOG]
  const lines = allText.split('\n');
  const logEntries = [];
  
  let inLogEntry = false;
  let currentEntry = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.includes('[LLM_QUESTION_LOG]')) {
      // Start of a new log entry
      if (currentEntry.length > 0) {
        logEntries.push(currentEntry.join('\n'));
      }
      currentEntry = [line];
      inLogEntry = true;
    } else if (inLogEntry) {
      // Check if this is part of the JSON log entry
      if (line.startsWith('{') || line.startsWith('"') || currentEntry.length > 0) {
        currentEntry.push(line);
        
        // Check if we've reached the end of the JSON object
        if (line === '}' || (line.endsWith('}') && currentEntry.join('').match(/\{[\s\S]*\}/))) {
          logEntries.push(currentEntry.join('\n'));
          currentEntry = [];
          inLogEntry = false;
        }
      } else {
        // Not part of current entry, save it and start new
        if (currentEntry.length > 0) {
          logEntries.push(currentEntry.join('\n'));
        }
        currentEntry = [];
        inLogEntry = false;
      }
    }
  }
  
  // Save any remaining entry
  if (currentEntry.length > 0) {
    logEntries.push(currentEntry.join('\n'));
  }
  
  console.log(`✅ Found ${logEntries.length} log entries`);
  
  if (logEntries.length === 0) {
    console.warn('⚠️  No [LLM_QUESTION_LOG] entries found. Make sure you\'re on the logs page.');
    return;
  }
  
  // Combine all entries
  const output = logEntries.join('\n\n---\n\n');
  
  // Download as file
  const blob = new Blob([output], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vercel-logs-${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log(`✅ Downloaded ${logEntries.length} log entries to ${a.download}`);
  console.log(`\n📊 Next step: Run this command:`);
  console.log(`   node scripts/extract-questions.js --input ${a.download} --format csv --output questions.csv`);
})();

