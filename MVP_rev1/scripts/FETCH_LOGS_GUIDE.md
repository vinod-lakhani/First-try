# Fetch Logs Using Vercel API

Since copying logs from the dashboard is difficult, here's an easier way using the Vercel API.

## Step 1: Get Your Vercel Token

### Option A: Create a New Token (Recommended)

1. Go to: https://vercel.com/account/tokens
2. Click **"Create Token"**
3. Give it a name (e.g., "Log Export")
4. Set scope to **"Full Account"** (or at least read access)
5. Copy the token (you'll only see it once!)

### Option B: Use Existing CLI Token

If you're already logged in via CLI:

```bash
# macOS/Linux
cat ~/.vercel/auth.json | grep -A 1 '"token"'

# Or just view the file
cat ~/.vercel/auth.json
```

## Step 2: Set Environment Variables

```bash
export VERCEL_TOKEN=your-token-here

# Optional: If you're part of a team
export VERCEL_TEAM_ID=your-team-id
```

To find your team ID:
- Go to your team settings: https://vercel.com/teams
- The team ID is in the URL or settings

## Step 3: Run the Fetch Script

```bash
cd weleap-mockups

# Fetch logs for your deployment
node scripts/fetch-vercel-logs.js weleap-mvp.vercel.app vercel-logs.txt
```

The script will:
1. Find your deployment
2. Fetch all available logs
3. Save them to `vercel-logs.txt`

## Step 4: Extract Questions

```bash
node scripts/extract-questions.js --input vercel-logs.txt --format csv --output questions.csv
```

## Alternative: Use Deployment ID

If you know the deployment ID:

```bash
node scripts/fetch-vercel-logs.js dpl_xxxxxxxx vercel-logs.txt
```

You can find deployment IDs in:
- Vercel Dashboard → Deployments → Click on deployment → URL shows the ID
- Or use: `vercel ls --yes`

## Troubleshooting

**"VERCEL_TOKEN environment variable is required"**
- Make sure you've exported the token: `export VERCEL_TOKEN=your-token`
- Or add it to your `.env.local` file and source it

**"Could not find deployment"**
- Check the URL is correct
- Try using the deployment ID instead
- Make sure the deployment exists and isn't too old (logs expire after 7-30 days)

**"No logs found"**
- The deployment might be too old
- Or no requests have been made yet
- Try a more recent deployment

**"API error 403"**
- Your token might not have the right permissions
- Create a new token with "Full Account" scope

## Making It Permanent

Add to your `.env.local` or shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export VERCEL_TOKEN=your-token-here
```

Then reload: `source ~/.zshrc` (or restart terminal)

