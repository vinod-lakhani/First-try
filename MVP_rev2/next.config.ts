import type { NextConfig } from "next";
import path from "path";

// Detect deployment platform
// Vercel sets VERCEL=1 during builds - this is the primary check
// Also check for DISABLE_STATIC_EXPORT to explicitly disable it
const isVercel = process.env.VERCEL === '1' || process.env.DISABLE_STATIC_EXPORT === 'true';
// GitHub Actions is used for GitHub Pages deployment
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

// CRITICAL: NEVER enable static export on Vercel
// Static export breaks API routes and client-side navigation
// Only enable static export if we're explicitly on GitHub Actions AND not on Vercel
const shouldUseStaticExport = isGitHubActions && !isVercel;

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

// Force Next.js to use this directory as project root (fixes ENOENT/missing .next/server when parent has lockfile)
const projectRoot = path.join(__dirname);

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,

  // CRITICAL: Only enable static export for GitHub Pages
  ...(shouldUseStaticExport ? { output: 'export' as const } : {}),

  // Set base path only for GitHub Pages (Vercel doesn't need it)
  ...(basePath ? { basePath } : {}),

  // Disable image optimization only for static export (GitHub Pages)
  images: {
    unoptimized: shouldUseStaticExport,
  },
};

export default nextConfig;
