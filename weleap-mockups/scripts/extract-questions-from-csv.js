/**
 * Extract LLM Questions from CSV Log File
 * 
 * This script extracts questions from logs_result.csv
 * It handles both [LLM_QUESTION] format and [LLM_QUESTION_LOG] JSON format
 */

const fs = require('fs');
const path = require('path');

// Get input file from command line or use default
const inputFile = process.argv[2] || 'logs_result.csv';
const outputFile = process.argv[3] || 'extracted-questions.csv';

console.log(`Reading from: ${inputFile}`);

// Read the entire CSV file
const csvContent = fs.readFileSync(inputFile, 'utf-8');

// Split into lines
const lines = csvContent.split('\n');

// Extract questions
const questions = [];
const seenQuestions = new Set(); // To avoid duplicates

// Method 1: Extract from [LLM_QUESTION] lines (simpler format)
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Look for [LLM_QUESTION] pattern
  if (line.includes('[LLM_QUESTION]')) {
    // Extract question from pattern: Q: "question text"
    const questionMatch = line.match(/Q:\s*""([^"]+)""/);
    if (questionMatch && questionMatch[1]) {
      const question = questionMatch[1];
      
      // Extract context
      const contextMatch = line.match(/\[([^\]]+)\]/);
      const context = contextMatch && contextMatch[1] !== 'LLM_QUESTION' ? contextMatch[1] : '';
      
      // Extract status
      const statusMatch = line.match(/Status:\s*(\w+)/);
      const status = statusMatch ? statusMatch[1] : 'unknown';
      
      // Extract timestamp from the line (first column)
      const timestampMatch = line.match(/^([^,]+),/);
      const timestamp = timestampMatch ? timestampMatch[1] : '';
      
      // Avoid duplicates
      if (!seenQuestions.has(question)) {
        seenQuestions.add(question);
        questions.push({
          timestamp: timestamp,
          context: context,
          question: question,
          response: '', // Will try to get from JSON if available
          status: status,
          responseLength: 0,
          model: 'gpt-4o-mini', // Default
        });
      }
    }
  }
}

// Method 2: Extract from [LLM_QUESTION_LOG] JSON blocks
// The JSON spans multiple lines - collect all lines until we find the closing brace
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  
  if (line.includes('[LLM_QUESTION_LOG]')) {
    // Find the start of JSON
    const jsonStart = line.indexOf('{');
    if (jsonStart === -1) {
      i++;
      continue;
    }
    
    // Collect all lines until we find the closing brace followed by comma
    let jsonLines = [];
    let braceCount = 0;
    let jsonPart = line.substring(jsonStart);
    
    // Check if JSON ends on same line
    const sameLineEnd = jsonPart.match(/^([^}]*\})\s*,/);
    if (sameLineEnd) {
      jsonPart = sameLineEnd[1];
      jsonLines.push(jsonPart);
    } else {
      jsonLines.push(jsonPart);
      braceCount += (jsonPart.match(/{/g) || []).length;
      braceCount -= (jsonPart.match(/}/g) || []).length;
      
      // Continue collecting lines
      i++;
      while (i < lines.length && braceCount > 0) {
        let nextLine = lines[i];
        // Check if this line ends the JSON
        const endMatch = nextLine.match(/^(\s*[^}]*\})\s*,/);
        if (endMatch) {
          jsonLines.push(endMatch[1]);
          braceCount += (endMatch[1].match(/{/g) || []).length;
          braceCount -= (endMatch[1].match(/}/g) || []).length;
          break;
        } else {
          jsonLines.push(nextLine);
          braceCount += (nextLine.match(/{/g) || []).length;
          braceCount -= (nextLine.match(/}/g) || []).length;
        }
        i++;
      }
    }
    
    // Reconstruct and parse JSON
    let jsonStr = jsonLines.join('\n').trim();
    
    // Remove any trailing content after the closing brace
    const braceIndex = jsonStr.lastIndexOf('}');
    if (braceIndex !== -1) {
      jsonStr = jsonStr.substring(0, braceIndex + 1);
    }
    
    // The CSV has "" for quotes (CSV escaping), convert to "
    jsonStr = jsonStr.replace(/""/g, '"');
    
    try {
      const logEntry = JSON.parse(jsonStr);
      
      if (logEntry.type === 'LLM_QUESTION' && logEntry.question) {
        const question = logEntry.question;
        
        // Update existing question if found, or add new one
        const existingIndex = questions.findIndex(q => q.question === question);
        
        if (existingIndex !== -1) {
          // Update existing entry with full data from JSON
          questions[existingIndex] = {
            timestamp: logEntry.timestamp || questions[existingIndex].timestamp,
            context: logEntry.context || questions[existingIndex].context,
            question: question,
            response: logEntry.response || '',
            status: logEntry.responseStatus || questions[existingIndex].status,
            responseLength: logEntry.responseLength || 0,
            model: logEntry.model || questions[existingIndex].model,
          };
        } else if (!seenQuestions.has(question)) {
          // Add new question
          seenQuestions.add(question);
          questions.push({
            timestamp: logEntry.timestamp || '',
            context: logEntry.context || '',
            question: question,
            response: logEntry.response || '',
            status: logEntry.responseStatus || 'unknown',
            responseLength: logEntry.responseLength || 0,
            model: logEntry.model || '',
          });
        }
      }
    } catch (parseError) {
      // If JSON parsing fails, try regex extraction as fallback
      const questionMatch = jsonStr.match(/"question"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const responseMatch = jsonStr.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      
      if (questionMatch && questionMatch[1]) {
        // Unescape the matched strings
        let question = questionMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        let response = '';
        if (responseMatch && responseMatch[1]) {
          response = responseMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
        
        if (!seenQuestions.has(question)) {
          seenQuestions.add(question);
          questions.push({
            timestamp: '',
            context: '',
            question: question,
            response: response,
            status: 'unknown',
            responseLength: response.length,
            model: '',
          });
        }
      }
    }
  }
  
  i++;
}

// Sort by timestamp (newest first)
questions.sort((a, b) => {
  if (!a.timestamp && !b.timestamp) return 0;
  if (!a.timestamp) return 1;
  if (!b.timestamp) return -1;
  
  // Try to parse timestamps
  try {
    const dateA = new Date(a.timestamp);
    const dateB = new Date(b.timestamp);
    if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
    if (isNaN(dateA.getTime())) return 1;
    if (isNaN(dateB.getTime())) return -1;
    return dateB - dateA;
  } catch {
    return 0;
  }
});

// Write to CSV
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
questions.forEach(entry => {
  const escapeCsv = (text) => {
    if (!text) return '';
    const str = String(text);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  const timestamp = entry.timestamp 
    ? (entry.timestamp.includes('T') ? new Date(entry.timestamp).toLocaleString() : entry.timestamp)
    : '';
  
  csvRows.push([
    timestamp,
    escapeCsv(entry.context),
    entry.status,
    escapeCsv(entry.question),
    escapeCsv(entry.response),
    entry.responseLength,
    escapeCsv(entry.model),
  ].join(','));
});

fs.writeFileSync(outputFile, csvRows.join('\n'));

console.log(`\n✅ Extracted ${questions.length} questions`);
console.log(`✅ Saved to: ${outputFile}`);

// Also create a simple text file with just questions
const questionsOnly = questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n');
const questionsFile = outputFile.replace('.csv', '-questions-only.txt');
fs.writeFileSync(questionsFile, questionsOnly);
console.log(`✅ Questions only saved to: ${questionsFile}`);
