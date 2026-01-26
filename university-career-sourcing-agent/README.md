# University Career Contacts Sourcing Agent

A compliance-conscious tool for sourcing and managing university career services contacts. This tool is designed to be **human-in-the-loop** and respects platform terms of service.

## ⚠️ Compliance & Ethics

**IMPORTANT:** This tool:
- ✅ Does NOT automate LinkedIn browsing, scraping, login, or data extraction
- ✅ Requires manual input: users paste LinkedIn profile URLs and contact info into CSV
- ✅ Only enriches contacts from public, non-LinkedIn sources (official university staff pages) that **you provide**
- ✅ Does NOT bypass platform protections or ToS
- ✅ Generates search query packs for **manual** use in Google, LinkedIn, etc.

## Features

1. **Query Pack Generation**: Generates copy-paste ready search queries for each school
2. **Contact Classification**: Automatically classifies contacts into personas:
   - Employer Relations
   - Career Services
   - Experiential Learning
   - Unknown
3. **Scoring System**: Scores contacts based on title relevance and seniority
4. **Deduplication**: Removes duplicates by LinkedIn URL and fuzzy matching
5. **Optional Enrichment**: Enriches contacts with email/phone from official staff pages (URLs you provide)
6. **Outreach Drafts**: Generates persona-tailored email and LinkedIn connection notes

## Installation

1. **Prerequisites**: Python 3.10 or higher

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
   
   Or use the Makefile:
   ```bash
   make install
   ```

## Usage

### Step 1: Generate Query Packs

Generate search query packs for manual use:

```bash
python src/agent.py queries --config schools.json
```

This prints:
- Google `site:linkedin.com` queries
- LinkedIn keyword searches
- Staff page search suggestions

**Copy and paste these queries** into Google, LinkedIn, or your preferred search engine to manually find contacts.

### Step 2: Create Input CSV

Create a CSV file with your contacts. Required columns:
- `school`: School code (e.g., "UT Austin", "UCSC")
- `name`: Contact name
- `title`: Job title
- `linkedin_url`: LinkedIn profile URL

Example (`sample_input_contacts.csv`):
```csv
school,name,title,linkedin_url
UT Austin,John Smith,Director of Employer Relations,https://linkedin.com/in/johnsmith
UCSC,Jane Doe,Assistant Director Career Services,https://linkedin.com/in/janedoe
```

### Step 3: (Optional) Add Staff Pages for Enrichment

Edit `staff_pages.json` to add official university staff page URLs:

```json
{
  "UT Austin": [
    "https://careercenter.utexas.edu/staff",
    "https://careercenter.utexas.edu/employer-relations"
  ],
  "UCSC": [
    "https://careers.ucsc.edu/staff"
  ]
}
```

**Important**: Only add URLs to official, public university pages. The tool will:
- Fetch only these URLs
- Extract emails/phones via regex
- Match contacts by name (if found on page)
- Not crawl or search beyond provided URLs

### Step 4: Run the Agent

Process your contacts:

```bash
python src/agent.py run \
  --input sample_input_contacts.csv \
  --config schools.json \
  --staff staff_pages.json \
  --offer "WeLeap career planning tool"
```

Or use the Makefile:
```bash
make run
```

### Outputs

The agent generates two files in the `outputs/` directory:

1. **`outputs/contacts.csv`**: Deduplicated, scored, and persona-tagged contacts
   - Columns: school, name, title, persona, total_score, seniority_score, relevance_score, linkedin_url, email, phone

2. **`outputs/outreach_drafts.md`**: Persona-tailored outreach drafts
   - Email subject + body
   - LinkedIn connection note (≤300 chars)

## Configuration

### `schools.json`

Pre-filled with 10 schools. Add more as needed:

```json
{
  "School Code": {
    "name": "Full School Name",
    "domain": "school.edu"
  }
}
```

### `staff_pages.json`

Maps school codes to arrays of staff page URLs:

```json
{
  "School Code": [
    "https://example.com/staff-page-1",
    "https://example.com/staff-page-2"
  ]
}
```

## Project Structure

```
university-career-sourcing-agent/
├── README.md
├── requirements.txt
├── Makefile
├── schools.json              # School configuration
├── staff_pages.json          # Staff page URLs for enrichment
├── sample_input_contacts.csv # Example input
├── src/
│   ├── agent.py              # CLI entry point
│   ├── queries.py            # Query pack generation
│   ├── scoring.py            # Persona classification & scoring
│   ├── dedupe.py             # Deduplication logic
│   ├── enrich.py             # Email/phone enrichment
│   └── outreach.py           # Outreach draft generation
└── outputs/                  # Generated files (created automatically)
    ├── contacts.csv
    └── outreach_drafts.md
```

## Persona Classification

Contacts are classified based on title keywords:

- **Employer Relations**: Keywords like "employer relations", "employer partnerships", "corporate relations"
- **Career Services**: Keywords like "career services", "career center", "career counselor"
- **Experiential Learning**: Keywords like "experiential learning", "internship", "co-op"
- **Unknown**: No matching keywords

## Scoring System

Each contact receives:
- **Seniority Score** (0.5-3.0): Based on title keywords (Director=3.0, Manager=2.0, etc.)
- **Relevance Score** (0.5-2.0): How well title matches classified persona
- **Total Score** (0.5-2.5): Average of seniority + relevance

## Deduplication

Two-pass deduplication:
1. **Primary**: Exact match on LinkedIn URL (case-insensitive)
2. **Secondary**: Fuzzy match on school + name (rapidfuzz ratio ≥ 92%)

## Troubleshooting

**No contacts loaded**: Check that your CSV has required columns and is properly formatted.

**Enrichment not working**: 
- Verify `staff_pages.json` has URLs for the school
- Check that URLs are accessible and return 200 status
- Ensure contact names match names on the staff pages

**Low scores**: Titles that don't match persona keywords will score lower. This is expected.

## License

This tool is provided as-is for compliant, ethical contact sourcing.
