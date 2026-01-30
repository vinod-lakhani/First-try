# Running Locally & Side-by-Side

## Setup: Website on 3000, App on 3001, Simulator on 3002

Use **three terminals**:

| Terminal | Command | URL |
|----------|---------|-----|
| 1 – Website | `cd December-WeLeap-Website && npm run dev` | http://localhost:3000 |
| 2 – App | `cd weleap-mockups && npm run dev:3001` | http://localhost:3001 |
| 3 – Simulator | `cd mvp-simulator && npm run dev` | http://localhost:3002 |

- **3000** – December-WeLeap-Website (marketing site)
- **3001** – WeLeap app (onboarding, feed, home, profile, tools)
- **3002** – MVP Simulator (standalone project: run from **first-try/mvp-simulator**, not weleap-mockups)  

Chat (Ribbit) needs `OPENAI_API_KEY` in `weleap-mockups/.env.local` for the simulator Q&A.

---

## Run WeLeap Mockups alone (default port)

```bash
cd weleap-mockups
npm install
npm run dev
```

→ http://localhost:3000 (app + simulator at /app/tools/mvp-simulator)

---

## Scripts (weleap-mockups)

| Script | Port | Use |
|--------|------|-----|
| `npm run dev` | 3000 | Default (app only) |
| `npm run dev:3001` | 3001 | App (when website is on 3000) |
| `npm run dev:3002` | 3002 | Simulator (when app is on 3001) |
| `npm run start` | 3000 | Production (after `npm run build`) |
| `npm run start:3001` | 3001 | Production on 3001 |

Custom port: `npm run dev -- -p 4000`
