import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for GitHub Pages
  output: 'export',
  // Set base path for GitHub Pages (repo name is "First-try")
  // Deployed to vinod-lakhani.github.io/First-try (project page)
  // For v2 preview: NEXT_PUBLIC_BASE_PATH='/First-try/v2' (set in workflow)
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/First-try' : ''),
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
