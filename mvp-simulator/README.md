# MVP Simulator

Standalone tool to verify WeLeap onboarding outputs. Enter the same inputs as the manual onboarding flow and run the same engines (income allocation, savings allocation, net worth simulation) to compare results with the real app.

**Separate from weleap-mockups** – run this on its own (e.g. port 3002) alongside the website (3000) and app (3001) without sharing build caches.

## Quick start

```bash
cd mvp-simulator
npm install
npm run dev
```

Opens at **http://localhost:3002**.

## Chat (Ribbit)

Add `OPENAI_API_KEY` to `.env.local` (local) or to your host's environment (e.g. Vercel) to enable the chat.

## Deploy on Vercel

1. **Root directory:** If this repo has multiple apps, set **Root Directory** to `mvp-simulator` in the Vercel project settings.
2. **Environment variable:** In **Project Settings → Environment Variables**, add `OPENAI_API_KEY` (your OpenAI API key). Apply to Production, Preview, and/or Development as needed.
3. Redeploy after adding the variable. The chat will work once `OPENAI_API_KEY` is set.

## Scripts

| Script        | Port  | Description              |
|---------------|-------|--------------------------|
| `npm run dev` | 3002  | Development server       |
| `npm run build` | -   | Production build         |
| `npm run start` | 3002 | Run production build     |

To use another port: `npm run dev -- -p 4000`.

## Layout with other apps

| Port  | App                    |
|-------|------------------------|
| 3000  | December-WeLeap-Website |
| 3001  | weleap-mockups (app)   |
| 3002  | mvp-simulator (this)  |
