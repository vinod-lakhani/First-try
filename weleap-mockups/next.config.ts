import type { NextConfig } from "next";

// Detect deployment platform
// Vercel sets VERCEL=1 during builds
const isVercel = process.env.VERCEL === '1';
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

// NEVER enable static export on Vercel - it breaks API routes and client-side routing
// Only enable for GitHub Pages builds
const shouldUseStaticExport = isGitHubPages && !isVercel;

// Debug logging (only in build, not in runtime)
if (process.env.NODE_ENV === 'production') {
  console.log('[Next.js Config] Platform Detection:', {
    isVercel,
    isGitHubPages,
    shouldUseStaticExport,
    VERCEL: process.env.VERCEL,
    GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
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
