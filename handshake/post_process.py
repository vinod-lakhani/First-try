import pandas as pd
import json

# === CONFIG ===
INPUT_CSV = "input.csv"
VALID_EMAILS_CSV = "emails_to_verify.valids.csv"
DOMAINS_JSON = "school_domains.json"
OUTPUT_CSV = "output_with_verified_emails.csv"

# === LOAD INPUT FILES ===
df = pd.read_csv(INPUT_CSV, header=None)
valid_emails_df = pd.read_csv(VALID_EMAILS_CSV)
with open(DOMAINS_JSON, "r") as f:
    school_domains = json.load(f)

valid_emails = set(valid_emails_df["email"].str.lower())

# === GENERATE EMAIL PERMUTATIONS ===
def generate_email_permutations(first, last, domain):
    first_initial = first[0]
    last_initial = last[0]
    return list(set([
        f"{first}.{last}@{domain}",
        f"{first}{last}@{domain}",
        f"{first_initial}{last}@{domain}",
        f"{first}@{domain}",
        f"{last}@{domain}",
        f"{last}.{first}@{domain}",
        f"{first}_{last}@{domain}",
        f"{first}{last_initial}@{domain}",
        f"{first_initial}.{last}@{domain}"
    ]))

# === MATCH VALID EMAILS BACK TO USERS ===
results = []
for _, row in df.iterrows():
    full_name = row[0]
    school = row[2]
    domain = school_domains.get(school)

    if not domain or not isinstance(full_name, str):
        results.append([*row, ""])
        continue

    parts = full_name.strip().split()
    if len(parts) < 2:
        results.append([*row, ""])
        continue

    first, last = parts[0].lower(), parts[-1].lower()
    permutations = generate_email_permutations(first, last, domain)

    valid_guess = next((email for email in permutations if email in valid_emails), "")
    results.append([*row, valid_guess])

# === SAVE OUTPUT ===
final_df = pd.DataFrame(results)
final_df.to_csv(OUTPUT_CSV, index=False, header=False)
print(f"✅ Done! Merged file saved to {OUTPUT_CSV}")
