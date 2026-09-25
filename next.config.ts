import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker builds set BUILD_STANDALONE=1 to get a minimal self-contained server
  // in .next/standalone. Other builds, including Vercel's, use the default.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
};

export default nextConfig;
