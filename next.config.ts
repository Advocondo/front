import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is for the Docker image; Vercel uses its own build output.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
