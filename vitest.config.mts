import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    environment: "node",
    // No unit test may reach Qloo, the model or the network (tests/unit/guard).
    setupFiles: ["tests/unit/setup.ts"],
    // The jsdom screens take seconds to set up on a busy machine; 5 s timed out under load.
    testTimeout: 20_000,
  },
});
