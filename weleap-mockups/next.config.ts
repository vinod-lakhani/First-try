import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for GitHub Pages
  output: 'export',
  // Set base path for GitHub Pages (repo name is "First-try")
  basePath: '/First-try',
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
