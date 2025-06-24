import pandas as pd

# Load raw emails
df = pd.read_csv("emails_to_verify.csv")

# Clean whitespace, drop blanks
df["email"] = df["email"].astype(str).str.strip()
df = df[df["email"] != ""]

# Save in a clean, minimal format (CRLF line endings, no index, no extra headers)
df.to_csv("emails_clean.csv", index=False, header=True, encoding="utf-8")
