import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mastra and its transitive deps are server-only; keep them external so Next
  // doesn't try to bundle them into the serverless/runtime build.
  serverExternalPackages: ["@mastra/core", "@mastra/ai-sdk", "@mendable/firecrawl-js"],
  images: {
    // App Store assets are served from Apple's mzstatic CDN.
    remotePatterns: [{ protocol: "https", hostname: "*.mzstatic.com" }],
  },
};

export default nextConfig;
