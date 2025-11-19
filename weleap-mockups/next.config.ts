import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for GitHub Pages
  output: 'export',
  // Set base path if deploying to a subdirectory (e.g., /First-try)
  // basePath: '/First-try', // Uncomment if deploying to a subdirectory
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
