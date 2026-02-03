/**
 * Parse Vercel CSV Export and Extract Questions
 * 
 * This script parses the CSV format exported from Vercel dashboard
 * and extracts LLM questions/responses into a clean format.
 */

const fs = require('fs');

const inputFile = process.argv[2] || 'scripts/logs_result.csv';
const outputFile = process.argv[3] || 'questions.csv';

console.log(`📥 Reading: ${inputFile}`);

// Read the entire file as a string
const csvContent = fs.readFileSync(inputFile, 'utf-8');

// Properly parse CSV with multi-line fields
function parseCSV(content) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote in CSV ("" -> ")
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // End of row (outside quotes)
      if (char === '\n' || (char === '\r' && nextChar !== '\n')) {
        // Only process if it's actually a newline
        currentRow.push(currentField);
        if (currentRow.some(f => f.trim())) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      }
      // Skip \r before \n
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip the \n too
      }
    } else {
      currentField += char;
    }
  }
  
  // Add last row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(f => f.trim())) {
      rows.push(currentRow);
    }
  }
  
  return rows;
}

const rows = parseCSV(csvContent);
console.log(`✅ Parsed ${rows.length} CSV rows\n`);

// Find column indices
const header = rows[0] || [];
const messageIndex = header.findIndex(h => h && h.toLowerCase() === 'message');
const timeIndex = header.findIndex(h => h && (h.toLowerCase().includes('time') || h.toLowerCase().includes('timestamp')));

if (messageIndex === -1) {
  console.error('❌ Could not find "message" column in CSV');
  console.error('Available columns:', header.filter(h => h).slice(0, 10));
  process.exit(1);
}

console.log(`✅ Found message column at index ${messageIndex}`);

// Extract questions
const questions = [];

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length <= messageIndex) continue;
  
  const message = row[messageIndex] || '';
  
  // Look for LLM_QUESTION_LOG entries
  if (message.includes('[LLM_QUESTION_LOG]')) {
    try {
      // Extract JSON from the message
      const jsonStart = message.indexOf('{');
      if (jsonStart === -1) continue;
      
      let jsonStr = message.substring(jsonStart);
      
      // Fix CSV escaping: "" -> " (already handled, but double-check)
      jsonStr = jsonStr.replace(/""/g, '"');
      
      // Try to parse the JSON
      const logData = JSON.parse(jsonStr);
      
      if (logData.type === 'LLM_QUESTION' && logData.question) {
        questions.push({
          timestamp: logData.timestamp || row[timeIndex] || '',
          context: logData.context || '',
          status: logData.responseStatus || 'unknown',
          question: logData.question || '',
          response: logData.response || logData.errorMessage || '',
          responseLength: logData.responseLength || 0,
          model: logData.model || '',
        });
      }
    } catch (parseError) {
      // Silent fail for non-JSON entries or parse errors
      // Uncomment to debug: console.warn(`Line ${i + 1} parse error:`, parseError.message);
    }
  }
}

console.log(`✅ Found ${questions.length} questions\n`);

if (questions.length === 0) {
  console.log('⚠️  No questions found.');
  console.log('   Searching for [LLM_QUESTION_LOG] in message column...');
  
  // Debug: Show first few messages
  let foundLogs = 0;
  for (let i = 1; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (row && row[messageIndex] && row[messageIndex].includes('LLM_QUESTION')) {
      foundLogs++;
      console.log(`   Found LLM log at row ${i + 1}:`, row[messageIndex].substring(0, 100));
    }
  }
  if (foundLogs === 0) {
    console.log('   No LLM_QUESTION entries found in any rows.');
  }
  process.exit(0);
}

// Write to CSV
const csvRows = [];

// Header
csvRows.push([
  'Timestamp',
  'Context',
  'Status',
  'Question',
  'Response',
  'Response Length',
  'Model',
].join(','));

// Data rows
questions.forEach(q => {
  const escapeCsv = (text) => {
    if (!text) return '';
    const str = String(text);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  let dateStr = '';
  try {
    dateStr = q.timestamp ? new Date(q.timestamp).toLocaleString() : '';
  } catch (e) {
    dateStr = q.timestamp || '';
  }
  
  csvRows.push([
    escapeCsv(dateStr),
    escapeCsv(q.context),
    escapeCsv(q.status),
    escapeCsv(q.question),
    escapeCsv(q.response),
    q.responseLength || 0,
    escapeCsv(q.model),
  ].join(','));
});

fs.writeFileSync(outputFile, csvRows.join('\n'));
console.log(`✅ Saved ${questions.length} questions to: ${outputFile}`);
console.log(`\n📊 Open ${outputFile} in Excel or Google Sheets to view!`);
