import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/First-try';

const nextConfig: NextConfig = {
  // Enable static export for GitHub Pages
  output: 'export',
  // Set base path for GitHub Pages (repo name is "First-try")
  // Deployed to vinod-lakhani.github.io/First-try (project page)
  basePath,
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
