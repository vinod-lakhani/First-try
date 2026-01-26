# Salary-to-Apartment Translator

A Next.js 14 (App Router) web application that helps users translate their job offers into safe rent ranges.

## Features

- Calculate take-home pay after federal, state, and FICA taxes
- Determine safe rent range based on 28-35% rule
- Optional debt adjustment for rent calculations
- 50/30/20 budget breakdown (needs/wants/savings)
- Email waitlist capture

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file (optional, for API Ninjas tax calculation):
```
API_NINJAS_KEY=your_api_key_here
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `app/` - Next.js app router pages and API routes
- `components/` - React components
- `lib/` - Utility functions and business logic
- `data/` - Local JSON storage for waitlist (created at runtime)

## Environment Variables

- `API_NINJAS_KEY` (optional) - API key for API Ninjas Income Tax Calculator. If not provided, the app will use fallback tax calculations.

## Build

```bash
npm run build
npm start
```
