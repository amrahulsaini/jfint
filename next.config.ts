import type { NextConfig } from "next";

// Set to '/jecrcfoundation' on the VM, which serves the app under that path.
// Unset on Vercel and in local dev, where the app owns the root.
const basePath = String(process.env.NEXT_PUBLIC_BASE_PATH || '').trim().replace(/\/+$/, '');

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  // No 'output: standalone' — the VM runs `next start` off .next, and Vercel
  // builds its own output. Emitting standalone only bloated the build.
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
