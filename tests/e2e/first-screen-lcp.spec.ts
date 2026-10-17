// Largest Contentful Paint of the first screen at a judge's 1280x800, on a production build:
// a deployment, or `next start` of your own (README, Running locally). The dev server compiles on
// demand, so it isn't measured.
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";

test.skip(
  !process.env.E2E_BASE_URL,
  "measures a production build: set E2E_BASE_URL",
);
test.skip(SYNTHETIC === "empty", "needs a saved build");

test("LCP on the first screen is under 2.5 s", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/", { waitUntil: "load" });
  const lcp = await page.evaluate(
    () =>
      new Promise<{ ms: number; element: string }>((resolve) => {
        new PerformanceObserver((list) => {
          const entry = list.getEntries().at(-1) as PerformanceEntry & {
            element?: Element | null;
          };
          resolve({
            ms: Math.round(entry.startTime),
            element: entry.element
              ? `${entry.element.tagName.toLowerCase()} "${entry.element.textContent?.trim().slice(0, 40)}"`
              : "unknown",
          });
        }).observe({ type: "largest-contentful-paint", buffered: true });
      }),
  );
  console.log(`LCP ${lcp.ms} ms on ${lcp.element}`);
  expect(lcp.ms).toBeLessThan(2500);
});
