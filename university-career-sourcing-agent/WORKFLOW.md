# Complete End-to-End Workflow

## Step-by-Step Process

### Step 1: Generate Query Packs

Generate copy-paste ready search queries for each school:

```bash
cd university-career-sourcing-agent
python src/agent.py queries --config schools.json
```

**Output:** Query packs printed to console for each school:
- Google `site:linkedin.com` queries
- LinkedIn keyword searches
- Staff page search suggestions

### Step 2: Manual Searching (Human-in-the-Loop)

**For each school, manually:**

1. **Copy Google queries** from Step 1
2. **Paste into Google search** and browse results
3. **Copy LinkedIn keyword searches** from Step 1
4. **Paste into LinkedIn search** and browse profiles
5. **Copy staff page search queries** from Step 1
6. **Paste into Google** to find official university staff directories

**Goal:** Find LinkedIn profiles and gather:
- School name
- Contact name
- Job title
- LinkedIn URL

### Step 3: Collect Contacts in CSV

Create or edit a CSV file (`my_contacts.csv` or use `sample_input_contacts.csv`):

```csv
school,name,title,linkedin_url
UT Austin,John Smith,Director of Employer Relations,https://linkedin.com/in/johnsmith
UCSC,Jane Doe,Assistant Director Career Services,https://linkedin.com/in/janedoe
Stanford,Bob Johnson,Manager Experiential Learning,https://linkedin.com/in/bobjohnson
```

**Columns required:**
- `school`: Use short code from `schools.json` (e.g., "UT Austin", "UCSC", "Stanford")
- `name`: Full name
- `title`: Job title
- `linkedin_url`: Full LinkedIn profile URL

### Step 4: (Optional) Add Staff Pages for Enrichment

Edit `staff_pages.json` to add official university staff page URLs you found in Step 2:

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

**Important:** Only add URLs to official, public university pages. The agent will:
- Fetch only these URLs
- Extract emails/phones via regex
- Match contacts by name if found on page
- Not crawl or search beyond provided URLs

### Step 5: Run the Agent

Process your contacts:

```bash
python src/agent.py run \
  --input my_contacts.csv \
  --config schools.json \
  --staff staff_pages.json \
  --offer "WeLeap career planning tool"
```

**What happens:**
1. ✅ Loads contacts from CSV
2. ✅ Classifies personas (Employer Relations, Career Services, Experiential Learning)
3. ✅ Scores contacts (seniority + relevance)
4. ✅ Deduplicates (removes duplicates)
5. ✅ Enriches with email/phone from staff pages (if URLs provided)
6. ✅ Generates output files

### Step 6: Review Outputs

Check the `outputs/` directory:

**`outputs/contacts.csv`:**
- Deduplicated contacts
- Persona classifications
- Scores (0.5-2.5)
- Enriched email/phone (if available)
- Sort by `total_score` to find best contacts

**`outputs/outreach_drafts.md`:**
- Persona-tailored email templates
- LinkedIn connection notes (≤300 chars)
- Ready to customize and send

### Step 7: Customize & Outreach

1. Open `outputs/outreach_drafts.md`
2. Review drafts for top-scored contacts
3. Customize email/LinkedIn notes as needed
4. Replace `[Your Name]` and `[OFFER]` placeholders
5. Send outreach via email or LinkedIn

### Step 8: Iterate

Repeat Steps 1-7 as needed:
- Add more schools to `schools.json`
- Add more contacts to your CSV
- Update `staff_pages.json` with new URLs
- Re-run agent to process new data

---

## Quick Reference Commands

```bash
# 1. Generate queries
python src/agent.py queries --config schools.json

# 2. Process contacts
python src/agent.py run \
  --input my_contacts.csv \
  --config schools.json \
  --staff staff_pages.json \
  --offer "Your product/service description"

# 3. Or use Makefile
make queries
make run
```

---

## Example Workflow Session

```bash
# 1. Generate query packs
$ python src/agent.py queries --config schools.json

# [Copy queries for "UT Austin"]
# [Manually search Google/LinkedIn]
# [Find 5 contacts, add to contacts.csv]

# 2. Process contacts
$ python src/agent.py run \
    --input contacts.csv \
    --config schools.json \
    --staff staff_pages.json \
    --offer "WeLeap career planning tool"

# Output:
# ✅ Loaded 5 contacts
# ✅ Classified personas
# ✅ Deduplicated (5 -> 5)
# ✅ Generated outputs/contacts.csv
# ✅ Generated outputs/outreach_drafts.md

# 3. Review results
$ cat outputs/contacts.csv
$ cat outputs/outreach_drafts.md

# 4. Customize drafts and send outreach!
```

---

## Tips

- **Start small**: Test with 5-10 contacts first
- **Verify school codes**: Make sure CSV uses exact short codes from `schools.json`
- **Check outputs**: Review scores and personas before sending outreach
- **Customize templates**: Edit `src/outreach.py` to change email/LinkedIn note formats
- **Track progress**: Keep a log of which schools/contacts you've processed
- **Respect rate limits**: When enriching from staff pages, be patient with API calls
