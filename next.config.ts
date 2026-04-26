import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
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
