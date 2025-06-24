import pandas as pd
import requests
import time
import json

# Your NeverBounce API key
NEVERBOUNCE_API_KEY = "private_3e8733f88179e15c1c9e6f487bfe86b3"

# Load input data
df = pd.read_csv("/Users/vinodlakhani/Desktop/Coding/First-try/handshake/input.csv", header=None)

# Load school domains
with open("/Users/vinodlakhani/Desktop/Coding/First-try/handshake/school_domains.json", "r") as f:
    school_domains = json.load(f)

# Generate permutations
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

# Step 1: Generate email guesses
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
            "Guessed Email": email
        })

guess_df = pd.DataFrame(guesses)
emails = guess_df["Guessed Email"].unique().tolist()

# Step 2: Submit emails to NeverBounce bulk verification
upload_url = "https://api.neverbounce.com/v4/jobs/create"
resp = requests.post(upload_url, data={
    "key": NEVERBOUNCE_API_KEY,
    "input_location": "supplied",
    "input": ",".join(emails),
    "auto_parse": 1
})
upload_data = resp.json()
if upload_data.get("status") != "success":
    print("❌ Upload failed:", upload_data)
    exit()

job_id = upload_data["job_id"]
print(f"🚀 Job submitted: job_id = {job_id}")

# Step 3: Poll job status
status_url = "https://api.neverbounce.com/v4/jobs/status"
while True:
    status_resp = requests.get(status_url, params={
        "key": NEVERBOUNCE_API_KEY,
        "job_id": job_id
    }).json()

    state = status_resp.get("job_status")
    print(f"🔄 Job status: {state}")
    if state == "complete":
        break
    elif state == "failed":
        print("❌ Job failed.")
        exit()
    time.sleep(10)

# Step 4: Download results
results_url = "https://api.neverbounce.com/v4/jobs/results/download"
results_resp = requests.get(results_url, params={
    "key": NEVERBOUNCE_API_KEY,
    "job_id": job_id,
    "valid_results_only": "false",
    "limit": 10000
})
results = results_resp.json()
result_df = pd.DataFrame(results.get("results"))
result_df = result_df[["email", "result"]]

# Step 5: Merge verified status into guess list
merged = guess_df.merge(result_df, left_on="Guessed Email", right_on="email", how="left")

# Step 6: Select the first "valid" email per full name
valid_df = merged[merged["result"] == "valid"]
best_emails = valid_df.groupby("Full Name").first().reset_index()

# Step 7: Attach back to original input file
final_emails = df.merge(best_emails[["Full Name", "Guessed Email"]], left_on=0, right_on="Full Name", how="left")
final_emails = final_emails.drop(columns=["Full Name"])

# Step 8: Save result
final_emails.to_csv("output_with_verified_emails.csv", index=False, header=False)
print("✅ Done! Verified emails saved to output_with_verified_emails.csv")
