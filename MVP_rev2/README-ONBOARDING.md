# WeLeap Onboarding Flow

This is the WeLeap onboarding flow built with Next.js, TypeScript, and Tailwind CSS.

## Local Development

```bash
cd weleap-mockups
npm install
npm run dev
```

Then open [http://localhost:3000/onboarding](http://localhost:3000/onboarding)

## GitHub Pages Deployment

The onboarding flow is configured for GitHub Pages deployment.

### Setup Instructions

1. **Enable GitHub Pages in your repository:**
   - Go to your repository on GitHub: https://github.com/vinod-lakhani/First-try
   - Click on **Settings** → **Pages**
   - Under "Source", select **GitHub Actions**
   - Save the settings

2. **The GitHub Actions workflow will automatically:**
   - Build the Next.js app when you push to `main`
   - Deploy it to GitHub Pages
   - Your site will be available at: `https://vinod-lakhani.github.io/First-try/`

3. **Access the onboarding flow:**
   - Main page: `https://vinod-lakhani.github.io/First-try/`
   - Onboarding flow: `https://vinod-lakhani.github.io/First-try/onboarding`

### If you need to deploy to a subdirectory:

If your GitHub Pages URL includes a subdirectory (e.g., `/First-try`), you may need to uncomment the `basePath` in `next.config.ts`:

```typescript
basePath: '/First-try',
```

Then rebuild and redeploy.

## Features

- **Income Collection**: Collect gross or take-home pay, per paycheck or monthly
- **Plaid Integration** (Mock): Simulate bank connection
- **Boost Hub**: Collect bills, debts, assets, and goals
- **Paycheck Plan**: Interactive allocation with sliders
- **Savings Plan**: Configure 401k match, IRA limits, liquidity preferences
- **Final Plan**: Comprehensive view with net worth projection

## Architecture

- **Engines**: `lib/alloc/income.ts`, `lib/alloc/savings.ts`, `lib/sim/netWorth.ts`
- **State Management**: Zustand store in `lib/onboarding/store.ts`
- **Components**: Chart components in `components/charts/`
- **Pages**: Onboarding flow pages in `app/onboarding/`

