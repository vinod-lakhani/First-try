import type { NextConfig } from "next";

// Detect deployment platform
// Vercel sets VERCEL=1 during builds
const isVercel = process.env.VERCEL === '1';
// GitHub Actions is used for GitHub Pages deployment
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

// NEVER enable static export on Vercel - it breaks API routes and client-side routing
// Only enable static export if:
// 1. We're on GitHub Actions (for GitHub Pages)
// 2. We're NOT on Vercel
// 3. ENABLE_STATIC_EXPORT is not explicitly set to 'false'
const shouldUseStaticExport = isGitHubActions && !isVercel && process.env.ENABLE_STATIC_EXPORT !== 'false';

// Debug logging (only in build, not in runtime)
if (process.env.NODE_ENV === 'production') {
  console.log('[Next.js Config] Platform Detection:', {
    isVercel,
    isGitHubActions,
    shouldUseStaticExport,
    VERCEL: process.env.VERCEL,
    GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
    ENABLE_STATIC_EXPORT: process.env.ENABLE_STATIC_EXPORT,
  });
}

// Only use basePath for GitHub Pages
const basePath = shouldUseStaticExport && process.env.NODE_ENV === 'production'
  ? (process.env.NEXT_PUBLIC_BASE_PATH || '/First-try')
  : '';

const nextConfig: NextConfig = {
  // IMPORTANT: Only enable static export for GitHub Pages
  // Vercel MUST use server-side rendering for API routes to work
  ...(shouldUseStaticExport ? { output: 'export' as const } : {}),
  // Set base path only for GitHub Pages
  ...(basePath ? { basePath } : {}),
  // Disable image optimization only for static export
  images: {
    unoptimized: shouldUseStaticExport,
  },
};

export default nextConfig;
