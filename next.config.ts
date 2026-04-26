import type { NextConfig } from "next";
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
export default process.env.NODE_ENV === "production" ? withPWA(nextConfig) : nextConfig;
