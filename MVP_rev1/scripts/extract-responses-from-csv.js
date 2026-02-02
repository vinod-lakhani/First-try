/**
 * Extract LLM Responses from CSV Log File
 *
 * This script extracts responses from logs_result.csv
 * It handles both [LLM_RESPONSE] format and [LLM_QUESTION_LOG] JSON format
 */

const fs = require('fs');
const path = require('path');

// Get input file from command line or use default
const inputFile = process.argv[2] || 'logs_result.csv';
const outputFile = process.argv[3] || 'extracted-responses.csv';

console.log(`Reading from: ${inputFile}`);

// Read the entire CSV file
const csvContent = fs.readFileSync(inputFile, 'utf-8');

// Split into lines
const lines = csvContent.split('\n');

const responses = [];
const seenResponses = new Set(); // To avoid duplicates

// Process each line
let skipUntil = -1; // Track lines to skip (already processed as part of multi-line JSON)
for (let i = 0; i < lines.length; i++) {
  // Skip lines that were already processed as part of multi-line JSON
  if (i <= skipUntil) continue;
  
  const line = lines[i];
  if (!line || !line.trim()) continue;

  let response = '';
  let question = '';
  let context = '';
  let status = 'unknown';
  let responseLength = 0;
  let model = 'gpt-4o-mini'; // Default model
  let timestamp = extractTimestamp(line);
  let foundInJson = false;

  // Method 1: Extract from [LLM_QUESTION_LOG] JSON blocks (PRIORITY - has full responses)
  if (line.includes('[LLM_QUESTION_LOG]')) {
    // Find the start of JSON
    const jsonStart = line.indexOf('{');
    if (jsonStart !== -1) {
      // Collect all lines until we find the closing brace
      let jsonLines = [];
      let braceCount = 0;
      let jsonPart = line.substring(jsonStart);
      
      // Check if JSON ends on same line (look for } followed by comma or end of quoted field)
      const sameLineEnd = jsonPart.match(/^([^}]*\})\s*[,"]/);
      if (sameLineEnd) {
        jsonPart = sameLineEnd[1];
        jsonLines.push(jsonPart);
      } else {
        jsonLines.push(jsonPart);
        braceCount += (jsonPart.match(/{/g) || []).length;
        braceCount -= (jsonPart.match(/}/g) || []).length;
        
        // Continue collecting lines until we find the closing brace
        let j = i + 1;
        while (j < lines.length && braceCount > 0) {
          let nextLine = lines[j];
          
          // Check if this line ends the JSON (closing brace followed by comma or quote)
          const endMatch = nextLine.match(/^([^}]*\})\s*[,"]/);
          if (endMatch) {
            jsonLines.push(endMatch[1]);
            braceCount += (endMatch[1].match(/{/g) || []).length;
            braceCount -= (endMatch[1].match(/}/g) || []).length;
            skipUntil = j; // Mark this line as processed
            break;
          } else {
            jsonLines.push(nextLine);
            braceCount += (nextLine.match(/{/g) || []).length;
            braceCount -= (nextLine.match(/}/g) || []).length;
          }
          j++;
        }
        skipUntil = j - 1; // Mark all processed lines
      }
      
      try {
        let jsonStr = jsonLines.join('\n');
        // Fix double-double quotes from CSV (but preserve escaped quotes in JSON strings)
        // First, handle the CSV escaping: "" becomes "
        jsonStr = jsonStr.replace(/""/g, '"');
        
        // Remove any trailing comma or quote that might be after the closing brace
        jsonStr = jsonStr.replace(/\}\s*[,"]\s*$/, '}');
        
        const logEntry = JSON.parse(jsonStr);
        
        if (logEntry.type === 'LLM_QUESTION' && logEntry.response) {
          question = logEntry.question || '';
          response = logEntry.response || logEntry.errorMessage || '';
          context = logEntry.context || '';
          status = logEntry.responseStatus || 'success';
          responseLength = logEntry.responseLength || response.length;
          model = logEntry.model || model;
          foundInJson = true; // Mark that we found it in JSON
        }
      } catch (parseError) {
        // Skip if JSON parsing fails
        console.error(`Failed to parse JSON at line ${i}:`, parseError.message);
      }
    }
  }
  
  // Method 2: Extract from [LLM_RESPONSE] simpler format (FALLBACK - may be truncated)
  // Only use this if we didn't already find a response in JSON format
  if (!foundInJson && line.includes('[LLM_RESPONSE]')) {
    // Method 2: Extract from [LLM_RESPONSE] simpler format
    const responseMatch = line.match(/\[LLM_RESPONSE\]\s*A:\s*""([^"]*(?:""[^"]*)*)""/);
    if (responseMatch && responseMatch[1]) {
      // Handle escaped quotes in the response
      response = responseMatch[1].replace(/""/g, '"');
      
      // Try to find corresponding question from same or previous lines
      // Look in current line first
      const questionMatch = line.match(/\[LLM_QUESTION\]\s*✅\s*\[([^\]]+)\]\s*Q:\s*""([^"]+)""/);
      if (questionMatch) {
        context = questionMatch[1];
        question = questionMatch[2];
      } else {
        // Look in previous lines (up to 5 lines back)
        for (let k = Math.max(0, i - 5); k < i; k++) {
          const prevLine = lines[k];
          const prevQuestionMatch = prevLine.match(/\[LLM_QUESTION\]\s*✅\s*\[([^\]]+)\]\s*Q:\s*""([^"]+)""/);
          if (prevQuestionMatch) {
            context = prevQuestionMatch[1];
            question = prevQuestionMatch[2];
            break;
          }
        }
      }
      
      status = 'success'; // Default for LLM_RESPONSE format
    }
  }

  // Only add if we have a response and haven't seen this exact response before
  // Prefer JSON entries over truncated LLM_RESPONSE entries
  if (response && response.trim().length > 0) {
    // Create a unique key based on question (since responses might be truncated)
    const responseKey = question || response.substring(0, 200);
    
    // If we already have this question, prefer the one from JSON (longer response)
    const existingIndex = responses.findIndex(r => (r.question === question && question) || 
                                                   (r.response.substring(0, 200) === response.substring(0, 200) && !question));
    
    if (existingIndex >= 0) {
      // Replace if current response is longer (likely from JSON)
      if (response.length > responses[existingIndex].response.length) {
        responses[existingIndex] = {
          timestamp: timestamp,
          context: context,
          question: question,
          response: response,
          status: status,
          responseLength: responseLength,
          model: model,
        };
      }
    } else if (!seenResponses.has(responseKey)) {
      seenResponses.add(responseKey);
      responses.push({
        timestamp: timestamp,
        context: context,
        question: question,
        response: response,
        status: status,
        responseLength: responseLength,
        model: model,
      });
    }
  }
}

// Helper function to extract message column from CSV line
function extractMessageColumn(line) {
  // The message column is typically near the end, before projectId
  // We'll look for the pattern that indicates the message field
  // Message is usually wrapped in quotes and contains [LLM_QUESTION_LOG] or [LLM_RESPONSE]
  const messageMatch = line.match(/,"([^"]*\[LLM_(?:QUESTION_LOG|RESPONSE)\][^"]*)"/);
  if (messageMatch) {
    return messageMatch[1];
  }
  // Try without quotes
  const messageMatch2 = line.match(/,\[LLM_(?:QUESTION_LOG|RESPONSE)\][^,]*/);
  if (messageMatch2) {
    return messageMatch2[0].substring(1); // Remove leading comma
  }
  return null;
}

// Helper function to extract timestamp from CSV line
function extractTimestamp(line) {
  const timestampMatch = line.match(/^([^,]+),/);
  return timestampMatch ? timestampMatch[1] : '';
}

// Sort by timestamp (newest first)
responses.sort((a, b) => {
  if (!a.timestamp && !b.timestamp) return 0;
  if (!a.timestamp) return 1;
  if (!b.timestamp) return -1;

  try {
    const dateA = new Date(a.timestamp);
    const dateB = new Date(b.timestamp);
    if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
    if (isNaN(dateA.getTime())) return 1;
    if (isNaN(dateB.getTime())) return -1;
    return dateB.getTime() - dateA.getTime();
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
responses.forEach(entry => {
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

console.log(`\n✅ Extracted ${responses.length} responses`);
console.log(`✅ Saved to: ${outputFile}`);

// Also create a simple text file with just responses
const responsesOnly = responses.map((r, i) => {
  const header = `\n${'='.repeat(80)}\nResponse ${i + 1}${r.question ? `\nQuestion: ${r.question}` : ''}${r.context ? `\nContext: ${r.context}` : ''}\n${'='.repeat(80)}\n`;
  return header + r.response;
}).join('\n\n');

const responsesFile = outputFile.replace('.csv', '-responses-only.txt');
fs.writeFileSync(responsesFile, responsesOnly);
console.log(`✅ Responses only saved to: ${responsesFile}`);

