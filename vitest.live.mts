import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Opt-in checks against real services (tests/live), never part of `pnpm gate`.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/live/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
  },
});
