# Vercel Deployment Setup

## ⚠️ Fixing 404 Error

If you're getting a 404 error, the Root Directory is NOT set correctly. Here's how to fix it:

1. Go to your Vercel project dashboard
2. Click on **Settings** (in the top navigation)
3. Click on **General** (in the left sidebar)
4. Scroll down to **Root Directory**
5. Click **Edit**
6. Enter: `weleap-mockups`
7. Click **Save**
8. Go to **Deployments** tab and redeploy (or push a new commit)

## Initial Setup Steps

1. **Connect Your Repository:**
   - Go to [vercel.com](https://vercel.com) and sign in with GitHub
   - Click "Add New Project"
   - Select your `First-try` repository

2. **Configure Project Settings (BEFORE clicking Deploy):**
   - Click **"Configure Project"** button
   - **Root Directory**: Click "Edit" and set to `weleap-mockups`
     - ⚠️ **THIS IS CRITICAL!** Without this, you'll get a 404 error.
     - Vercel needs to know your Next.js app is in a subdirectory, not the repo root
   - **Framework Preset**: Should auto-detect as Next.js (if not, select Next.js)
   - **Build Command**: Leave as default (`npm run build`)
   - **Output Directory**: Leave as default (Vercel handles this)
   - **Install Command**: Leave as default (`npm install`)

3. **Environment Variables:**
   Add the following environment variables:
   - **Name**: `OPENAI_API_KEY`
     - **Value**: Your OpenAI API key (the one you have in `.env.local`)
     - **Important for**: Chat feature to work
   
   - **Name**: `ENABLE_STATIC_EXPORT`
     - **Value**: Leave this UNSET or set to empty (do not set to "true")
     - **Important for**: Ensuring API routes work (static export disables them)
   
   To add them:
   - In the project settings, go to "Environment Variables"
   - Add `OPENAI_API_KEY` with your API key value
   - **DO NOT** add `ENABLE_STATIC_EXPORT=true` - it should be unset or empty
   - Make sure they're enabled for all environments (Production, Preview, Development)

4. **Deploy:**
   - Click "Deploy"
   - Vercel will automatically build and deploy your app
   - The chat feature will work because Vercel supports API routes!

## Important Notes

- **API Routes**: Will work on Vercel (unlike GitHub Pages)
- **Static Export**: Automatically disabled on Vercel (detected via `VERCEL=1` env var)
- **Environment Variables**: Make sure to add `OPENAI_API_KEY` in Vercel dashboard

## After Deployment

Your app will be available at: `https://your-project-name.vercel.app`

The chat feature will work because Vercel supports Next.js API routes!

