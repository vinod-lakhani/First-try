import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for GitHub Pages
  output: 'export',
  // Set base path for GitHub Pages
  // If deploying to user.github.io (root domain), leave empty
  // If deploying to user.github.io/repo-name (project page), use '/repo-name'
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
