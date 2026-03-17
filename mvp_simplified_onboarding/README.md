# MVP Simplified Onboarding

A streamlined onboarding flow for the WeLeap financial planning app. This project contains the first screen (Ribbit introduction) with a clean, minimal design.

## First Screen

- **Welcome** step with progress indicator (Welcome → Connect → Income → Savings → Plan)
- Ribbit mascot introduction
- Feature overview: Connect accounts, understand income/spending, build savings plan, personalized tips
- "Get Started" CTA

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/onboarding/ribbit-intro`.

## Project Structure

```
mvp_simplified_onboarding/
├── app/
│   ├── onboarding/
│   │   ├── layout.tsx       # Onboarding layout with WeLeap header
│   │   ├── page.tsx         # Redirects to ribbit-intro
│   │   └── ribbit-intro/
│   │       └── page.tsx     # First screen
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── onboarding/
│   │   ├── OnboardingProgress.tsx
│   │   └── RibbitIntro.tsx
│   └── ui/
│       ├── button.tsx
│       └── card.tsx
├── lib/
│   └── utils.ts
└── public/
    └── images/
        └── ribbit.png
```

## Third Screen: Income Allocation

- **50/30/20 rule**: Needs (50%), Wants (30%), Savings = leftover
- Adjustable Income, Needs, Wants with +/- buttons
- Expandable Needs breakdown: Rent/Housing, Utilities, Groceries, Transportation, Debt Minimum Payments, Other Needs
- Expandable Wants breakdown: Giving, Entertainment, Shopping, Travel, Subscriptions, Other Wants
- **Ask Ribbit** chat with predefined prompts (requires `OPENAI_API_KEY` in `.env.local`)

## Adding More Screens

When you add additional onboarding screens (Savings, Plan), update:

1. `app/onboarding/income/page.tsx` – change `handleAllocate` to navigate to the next screen
2. `components/onboarding/OnboardingProgress.tsx` – add back navigation for new steps
