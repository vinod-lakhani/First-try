# Test Results Directory

This directory contains all test results from running the comprehensive LLM test suite.

## Files Generated

### After Each Test Run:

1. **`test-results-TIMESTAMP.json`**
   - Detailed JSON format with all test data
   - Includes: questions, responses, validations, timestamps
   - Best for: programmatic analysis, parsing, automation

2. **`test-summary-TIMESTAMP.txt`**
   - Human-readable text format
   - Includes: questions, full responses, validation results
   - Best for: quick review, sharing with team, documentation

## Viewing Results

### Latest Results (Most Recent)
```bash
# View latest summary
ls -t test-results/test-summary-*.txt | head -1 | xargs cat

# View latest detailed JSON
ls -t test-results/test-results-*.json | head -1 | xargs jq .
```

### All Results
```bash
# List all test runs
ls -lth test-results/

# View a specific test run
cat test-results/test-summary-2025-11-29T21-59-44.txt
```

### Search Results
```bash
# Find tests with failures
grep -l "❌" test-results/test-summary-*.txt

# Find tests with specific keywords
grep -l "cash" test-results/test-summary-*.txt
```

## JSON Structure

The JSON files contain:
```json
{
  "timestamp": "2025-11-29T21:59:44.123Z",
  "baseUrl": "http://localhost:3000",
  "summary": {
    "totalTests": 7,
    "passedValidations": 27,
    "totalValidations": 29,
    "passRate": "93.1%"
  },
  "results": [
    {
      "success": true,
      "question": "...",
      "context": "...",
      "answer": "...",
      "validations": {
        "Validation Name": {
          "pass": true,
          "message": "..."
        }
      }
    }
  ]
}
```

## Analyzing Results

### Compare Test Runs
```bash
# Compare pass rates
for file in test-results/test-results-*.json; do
  echo "$file:"
  jq -r '.summary.passRate' "$file"
done
```

### Extract Failed Validations
```bash
# Find all failed validations
jq -r '.results[] | select(.validations) | .validations | to_entries[] | select(.value.pass == false) | "\(.key): \(.value.message)"' test-results/test-results-*.json
```

### Extract All Responses
```bash
# Get all LLM responses
jq -r '.results[] | select(.answer) | "=== \(.question) ===\n\(.answer)\n"' test-results/test-results-*.json
```

## Notes

- Files are automatically created when running `node scripts/test-comprehensive.js`
- Timestamp format: `YYYY-MM-DDTHH-MM-SS`
- Files are not automatically deleted - manually clean up old results if needed
- The `.json` files can be parsed programmatically for analysis
- The `.txt` files are human-readable and easy to share

## Best Practices

1. **Review after each prompt change** - Run tests before and after prompt updates
2. **Track improvements** - Compare pass rates over time
3. **Focus on failures** - Use failed validations to identify prompt improvements
4. **Document decisions** - Note why prompts were changed based on test results

