import { defineConfig, devices } from "@playwright/test";

// E2E_BASE_URL points the demo path at a deployed preview. Without it, Playwright starts the
// local dev server on its own port in synthetic mode: the server reads the synthetic saved build
// from tests/e2e/synthetic-build.ts and never calls Qloo, Claude or Upstash.
const deployedUrl = process.env.E2E_BASE_URL;
const SYNTHETIC_PORT = 3100;
const baseURL = deployedUrl ?? `http://localhost:${SYNTHETIC_PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: deployedUrl
    ? undefined
    : {
        command: `pnpm dev --port ${SYNTHETIC_PORT}`,
        url: baseURL,
        env: { UNDERCARD_E2E_SYNTHETIC: "1" },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
