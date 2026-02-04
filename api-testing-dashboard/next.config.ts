import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  // This creates a self-contained build in .next/standalone/
  output: 'standalone',

  // Disable image optimization (not needed for API-only service)
  images: {
    unoptimized: true,
  },

  // Environment variables for headless mode
  env: {
    // Set to 'true' to indicate headless deployment
    HEADLESS_MODE: process.env.HEADLESS_MODE || 'false',
  },

  // Disable telemetry in production
  experimental: {
    // Improve cold start performance
    optimizePackageImports: ['@anthropic-ai/sdk'],
  },
};

export default nextConfig;
