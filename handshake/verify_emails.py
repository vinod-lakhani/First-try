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

# Email permutation function
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

# Verify with NeverBounce
def verify_email(email):
    url = "https://api.neverbounce.com/v4/single/check"
    params = {
        "key": NEVERBOUNCE_API_KEY,
        "email": email,
        "timeout": 10
    }
    try:
        response = requests.get(url, params=params, timeout=5)
        result = response.json()
        if result.get("result") == "valid":
            return email
    except Exception as e:
        print(f"Error verifying {email}: {e}")
    return None

# Process each row
verified_emails = []
for idx, row in df.iterrows():
    full_name = row[0]
    school = row[2]
    school_domain = school_domains.get(school)

    if not school_domain or not isinstance(full_name, str):
        verified_emails.append("")
        continue

    parts = full_name.strip().split()
    if len(parts) < 2:
        verified_emails.append("")
        continue

    first, last = parts[0].lower(), parts[-1].lower()
    guesses = generate_email_permutations(first, last, school_domain)

    verified = None
    for guess in guesses:
        print(f"🔍 Checking: {guess}")
        verified = verify_email(guess)
        if verified:
            print(f"✅ Verified: {verified}")
            break
        else:
            print(f"❌ Not valid: {guess}")
    time.sleep(1)

    verified_emails.append(verified if verified else "")

# Add to dataframe
df[3] = verified_emails

# Save result
df.to_csv("output_with_verified_emails.csv", index=False, header=False)
print("✅ Done! Verified emails saved to output_with_verified_emails.csv")

