// Screenshots for the frontend-anti-slop critique. It records; it doesn't assert.
// Run: pnpm e2e tests/e2e/design-shots.spec.ts   Output: .design/shots (the run before: .design/previous)
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { test } from "@playwright/test";

// The demo-path routes from SPEC.md section 3, in order, served with seeded data.
const ROUTES = ["/"];
const VIEWPORTS = [
  { name: "video", width: 1440, height: 810, fullPage: false },
  { name: "mobile", width: 390, height: 844, fullPage: true },
];

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  rmSync(".design/previous", { recursive: true, force: true });
  if (existsSync(".design/shots"))
    renameSync(".design/shots", ".design/previous");
  mkdirSync(".design/shots", { recursive: true });
});

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`design shot ${route} ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto(route, { waitUntil: "load" });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await page.waitForTimeout(300);
      const name =
        route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      if (overflow > 0)
        console.log(
          `${name}-${viewport.name}: ${overflow}px horizontal overflow`,
        );
      await page.screenshot({
        path: `.design/shots/${name}-${viewport.name}.png`,
        fullPage: viewport.fullPage,
        animations: "disabled",
        caret: "hide",
      });
    });
  }
}
