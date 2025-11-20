import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for GitHub Pages (disabled for dev)
  // output: 'export',
  // Set base path for GitHub Pages (repo name is "First-try")
  // basePath: '/First-try', // Commented out for local development
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
