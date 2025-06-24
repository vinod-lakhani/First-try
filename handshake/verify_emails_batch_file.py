import pandas as pd
import requests
import time
import json

# === CONFIG ===
NEVERBOUNCE_API_KEY = "private_3e8733f88179e15c1c9e6f487bfe86b3"
INPUT_CSV = "/Users/vinodlakhani/Desktop/Coding/First-try/handshake/input.csv"
DOMAINS_JSON = "/Users/vinodlakhani/Desktop/Coding/First-try/handshake/school_domains.json"
OUTPUT_CSV = "output_with_verified_emails.csv"
BULK_UPLOAD_CSV = "emails_to_verify.csv"

# === LOAD INPUTS ===
df = pd.read_csv(INPUT_CSV, header=None)
with open(DOMAINS_JSON, "r") as f:
    school_domains = json.load(f)

# === GENERATE EMAIL PERMUTATIONS ===
def generate_email_permutations(first, last, domain):
    first_initial = first[0]
    return [
        f"{first}.{last}@{domain}",  # first.last
        f"{first}@{domain}",         # first
        f"{first_initial}{last}@{domain}"  # fLast
    ]

# === BUILD GUESSES ===
guesses = []
for idx, row in df.iterrows():
    full_name = row[0]
    school = row[2]
    domain = school_domains.get(school)

    if not domain or not isinstance(full_name, str):
        continue

    parts = full_name.strip().split()
    if len(parts) < 2:
        continue

    first, last = parts[0].lower(), parts[-1].lower()
    email_perms = generate_email_permutations(first, last, domain)

    for email in email_perms:
        guesses.append({
            "Full Name": full_name,
            "School": school,
            "email": email  # ✅ Set correct column name here
        })

guess_df = pd.DataFrame(guesses)
emails_df = guess_df[["email"]].drop_duplicates()

# === SAVE TO FILE FOR BULK UPLOAD ===
emails_df.to_csv(BULK_UPLOAD_CSV, index=False, encoding="utf-8")

# === UPLOAD TO NEVERBOUNCE ===
with open(BULK_UPLOAD_CSV, "rb") as f:
    files = {
        'file': (BULK_UPLOAD_CSV, f, 'application/octet-stream')
    }
    resp = requests.post("https://api.neverbounce.com/v4/jobs/create", data={
        "key": NEVERBOUNCE_API_KEY,
        "input_location": "supplied",  # ✅ REQUIRED AND CORRECT
        "input": "placeholder",        # ✅ STILL REQUIRED
        "auto_parse": "1"              # ✅ MUST BE A STRING
    }, files=files)

upload_data = resp.json()
if upload_data.get("status") != "success":
    print("❌ Upload failed:", upload_data)
    exit()

job_id = upload_data["job_id"]
print(f"🚀 Job submitted: job_id = {job_id}")

# === POLL UNTIL COMPLETE ===
max_retries = 60
retry_delay = 10
for attempt in range(max_retries):
    status_resp = requests.get("https://api.neverbounce.com/v4/jobs/status", params={
        "key": NEVERBOUNCE_API_KEY,
        "job_id": job_id
    }).json()

    status = status_resp.get("job_status")
    print(f"⏱️ Job status: {status} (attempt {attempt + 1}/{max_retries})")
    if status == "complete":
        break
    elif status == "failed":
        print("❌ Job failed.")
        exit()
    time.sleep(retry_delay)
else:
    print("❌ Timed out waiting for job completion.")
    exit()

# === DOWNLOAD RESULTS ===
results_resp = requests.get("https://api.neverbounce.com/v4/jobs/results/download", params={
    "key": NEVERBOUNCE_API_KEY,
    "job_id": job_id,
    "valid_results_only": "false",
    "limit": 10000
})
results = results_resp.json()
result_list = results.get("results", [])
if not result_list:
    print("❌ No results returned.")
    exit()

result_df = pd.DataFrame(result_list)
result_df = result_df[["email", "result"]]

# === MERGE RESULTS BACK ===
merged = guess_df.merge(result_df, on="email", how="left")

# === GET FIRST VALID EMAIL PER USER ===
valid_df = merged[merged["result"] == "valid"]
best_emails = valid_df.groupby("Full Name").first().reset_index()

# === FINAL MERGE BACK TO INPUT FILE ===
final = df.merge(best_emails[["Full Name", "email"]], left_on=0, right_on="Full Name", how="left")
final = final.drop(columns=["Full Name"])

# === SAVE OUTPUT ===
final.to_csv(OUTPUT_CSV, index=False, header=False)
print(f"✅ All done! Saved to {OUTPUT_CSV}")
