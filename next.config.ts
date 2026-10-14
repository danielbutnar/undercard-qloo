import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keeps the dev-mode badge out of the design shots and the demo video.
  devIndicators: false,
  // CLAUDE.md is this repository's agent guide; don't let `next dev` write an AGENTS.md.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
