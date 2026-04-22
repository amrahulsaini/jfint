import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  // Ignore ESLint and TS errors during build to heavily speed up remote server builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // If your server has limited RAM (e.g. 1GB VPS), you can disable experimental workers
  // to avoid Out-Of-Memory (OOM) crashes which cause builds to hang infinitely.
  experimental: {
    // optimizeCss: true,
    // memoryBasedWorkersCount: true,
  }
};

export default nextConfig;

