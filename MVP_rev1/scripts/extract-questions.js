/**
 * Extract Questions and Responses from Logs
 * 
 * This script extracts all questions and responses from log files
 * and exports them to a consolidated format (CSV or JSON).
 * 
 * Usage:
 *   node scripts/extract-questions.js [options]
 * 
 * Options:
 *   --input <file>     Input log file (default: reads from stdin)
 *   --format <format>  Output format: csv, json, txt (default: csv)
 *   --output <file>    Output file path (default: questions-export.csv)
 *   --filter-context   Filter by context (e.g., financial-sidekick)
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

const inputFile = getArg('--input');
const format = getArg('--format') || 'csv';
const outputFile = getArg('--output') || `questions-export.${format === 'json' ? 'json' : format === 'txt' ? 'txt' : 'csv'}`;
const filterContext = getArg('--filter-context');

// Read input
let logContent = '';
if (inputFile) {
  logContent = fs.readFileSync(inputFile, 'utf-8');
} else {
  // Read from stdin
  logContent = fs.readFileSync(0, 'utf-8');
}

// Parse log entries
const questionEntries = [];

// Extract all [LLM_QUESTION_LOG] entries
const logPattern = /\[LLM_QUESTION_LOG\]\s*(\{[\s\S]*?\})/g;
let match;

while ((match = logPattern.exec(logContent)) !== null) {
  try {
    const logEntry = JSON.parse(match[1]);
    if (logEntry.type === 'LLM_QUESTION') {
      // Apply context filter if specified
      if (filterContext && logEntry.context !== filterContext) {
        continue;
      }
      
      questionEntries.push({
        timestamp: logEntry.timestamp,
        context: logEntry.context || '',
        question: logEntry.question || '',
        response: logEntry.response || logEntry.errorMessage || '',
        status: logEntry.responseStatus || 'unknown',
        responseLength: logEntry.responseLength || 0,
        model: logEntry.model || '',
      });
    }
  } catch (parseError) {
    console.error('Failed to parse log entry:', match[1].substring(0, 100));
  }
}

// Sort by timestamp (newest first)
questionEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

// Export based on format
if (format === 'json') {
  // JSON format
  const output = {
    exportDate: new Date().toISOString(),
    totalQuestions: questionEntries.length,
    questions: questionEntries,
  };
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`✅ Exported ${questionEntries.length} questions to ${outputFile} (JSON format)`);
  
} else if (format === 'txt') {
  // Plain text format (human-readable)
  let txt = `LLM Questions and Responses Export\n`;
  txt += `Generated: ${new Date().toLocaleString()}\n`;
  txt += `Total Questions: ${questionEntries.length}\n`;
  txt += `${'='.repeat(80)}\n\n`;
  
  questionEntries.forEach((entry, index) => {
    const date = new Date(entry.timestamp).toLocaleString();
    txt += `[${index + 1}] ${date} | ${entry.context || 'no-context'} | ${entry.status}\n`;
    txt += `Q: ${entry.question}\n`;
    txt += `A: ${entry.response || '(no response)'}\n`;
    txt += `${'-'.repeat(80)}\n\n`;
  });
  
  fs.writeFileSync(outputFile, txt);
  console.log(`✅ Exported ${questionEntries.length} questions to ${outputFile} (TXT format)`);
  
} else {
  // CSV format (default)
  const csvRows = [];
  
  // CSV header
  csvRows.push([
    'Timestamp',
    'Context',
    'Status',
    'Question',
    'Response',
    'Response Length',
    'Model',
  ].join(','));
  
  // CSV rows
  questionEntries.forEach(entry => {
    const escapeCsv = (text) => {
      if (!text) return '';
      const str = String(text);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    csvRows.push([
      new Date(entry.timestamp).toLocaleString(),
      escapeCsv(entry.context),
      entry.status,
      escapeCsv(entry.question),
      escapeCsv(entry.response),
      entry.responseLength,
      escapeCsv(entry.model),
    ].join(','));
  });
  
  fs.writeFileSync(outputFile, csvRows.join('\n'));
  console.log(`✅ Exported ${questionEntries.length} questions to ${outputFile} (CSV format)`);
}

// Print summary
console.log(`\nSummary:`);
console.log(`  Total questions: ${questionEntries.length}`);
if (filterContext) {
  console.log(`  Filtered by context: ${filterContext}`);
}
console.log(`  Output format: ${format}`);
console.log(`  Output file: ${outputFile}`);

