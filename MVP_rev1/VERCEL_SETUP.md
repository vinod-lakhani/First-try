# Vercel Deployment Setup

## ⚠️ Fixing Build Issues

If your build completes in under 1 second (like 177ms), Vercel is NOT finding your Next.js project. Here's how to fix it:

### Issue: Build completes too quickly (no npm install, no build output)

**The Root Directory is NOT set correctly.** Here's how to fix it:

1. Go to your Vercel project dashboard
2. Click on **Settings** (in the top navigation)
3. Click on **General** (in the left sidebar)
4. Scroll down to **Root Directory**
5. Click **Edit**
6. Enter: `weleap-mockups`
7. Click **Save**
8. Go to **Deployments** tab
9. Click the **three dots (⋯)** on the latest deployment
10. Click **Redeploy**
11. Check the build logs - you should see:
    - "Installing dependencies..."
    - "Running npm run build"
    - "Creating an optimized production build..."
    - NOT just "Build Completed in /vercel/output [177ms]"

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
   
   - **Name**: `DISABLE_STATIC_EXPORT` (Optional but recommended)
     - **Value**: `true`
     - **Important for**: Explicitly disabling static export on Vercel to ensure API routes work
   
   To add them:
   - In the project settings, go to "Environment Variables"
   - Add `OPENAI_API_KEY` with your API key value
   - Optionally add `DISABLE_STATIC_EXPORT=true` to explicitly disable static export
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

