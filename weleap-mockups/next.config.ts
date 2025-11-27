import type { NextConfig } from "next";

// Detect deployment platform
// Vercel ALWAYS sets VERCEL=1 during builds - this is the primary check
const isVercel = process.env.VERCEL === '1';
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

// Build Next.js config - explicitly handle static export
const nextConfig: NextConfig = {
  // CRITICAL: Only enable static export for GitHub Pages
  // On Vercel, we MUST NOT use static export - it breaks everything
  // The spread operator conditionally adds output: 'export' only if shouldUseStaticExport is true
  // If shouldUseStaticExport is false (like on Vercel), this property is NOT added
  ...(shouldUseStaticExport ? { output: 'export' as const } : {}),
  
  // Set base path only for GitHub Pages (Vercel doesn't need it)
  ...(basePath ? { basePath } : {}),
  
  // Disable image optimization only for static export (GitHub Pages)
  images: {
    unoptimized: shouldUseStaticExport,
  },
};

export default nextConfig;

export default nextConfig;
