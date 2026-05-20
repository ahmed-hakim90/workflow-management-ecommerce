import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  reloadOnOnline: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["bosta"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

// Only wrap with PWA in production (next build / next start). Skipping the
// Webpack plugin during `next dev --turbopack` avoids the Turbopack/Webpack
// mismatch warning; PWA is not needed in local dev.
const config =
  process.env.NODE_ENV === "production" ? withPWA(nextConfig) : nextConfig;

export default config;

if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}
