import type { NextConfig } from "next";

// Only use basePath in production (for GitHub Pages deployment)
// In development, basePath should be empty so localhost:3000 works normally
const basePath = process.env.NODE_ENV === 'production' 
  ? (process.env.NEXT_PUBLIC_BASE_PATH || '/First-try')
  : '';

const nextConfig: NextConfig = {
  // Enable static export for GitHub Pages
  output: 'export',
  // Set base path for GitHub Pages (repo name is "First-try")
  // Deployed to vinod-lakhani.github.io/First-try (project page)
  // In development, basePath is empty so localhost:3000 works
  basePath,
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
