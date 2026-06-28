import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // handlebars is a server-only dependency (PDF generation). Externalizing it
  // avoids webpack bundling it — which otherwise emits a benign but noisy
  // "require.extensions is not supported by webpack" warning.
  serverExternalPackages: ['@sparticuz/chromium-min', 'puppeteer-core', 'handlebars'],
};

export default nextConfig;
