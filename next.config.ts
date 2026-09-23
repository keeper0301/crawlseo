import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone is for Docker; Vercel uses its own output
  output: process.env.VERCEL ? undefined : "standalone",
  // WSL worker hosts can reject Next's default high process fan-out with EAGAIN.
  // Keep production builds bounded and deterministic.
  experimental: { cpus: 2 },
};

export default nextConfig;
