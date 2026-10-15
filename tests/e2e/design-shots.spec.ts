// Screenshots for the frontend-anti-slop critique. It records; it doesn't assert.
// Run: pnpm e2e tests/e2e/design-shots.spec.ts   Output: .design/shots (the run before: .design/previous)
// DESIGN_LIVE=1 adds a shot taken mid-way through a real build (it calls Qloo and Claude).
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { syntheticBuildStream } from "./synthetic-build";

// The demo-path screens from SPEC.md section 3, in order. "built" replays a synthetic build
// stream, so the filled board is shot without calling Qloo or Claude.
const SCENES: {
  name: string;
  prepare?: (page: Page) => Promise<void>;
  live?: boolean;
}[] = [
  { name: "home" },
  {
    name: "home-building",
    live: true,
    prepare: async (page) => {
      await page.getByRole("button", { name: "Build undercard" }).click();
      await page
        .getByRole("list", { name: "Qloo calls" })
        .getByRole("listitem")
        .nth(5)
        .waitFor({ timeout: 60_000 });
    },
  },
  {
    name: "home-built",
    prepare: async (page) => {
      await page.route("**/api/undercard", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/x-ndjson; charset=utf-8",
          body: syntheticBuildStream(),
        }),
      );
      await page.getByRole("button", { name: "Build undercard" }).click();
      await page.getByRole("article").nth(9).waitFor();
    },
  },
];
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

for (const scene of SCENES) {
  for (const viewport of VIEWPORTS) {
    test(`design shot ${scene.name} ${viewport.name}`, async ({ page }) => {
      test.skip(
        Boolean(scene.live) && !process.env.DESIGN_LIVE,
        "set DESIGN_LIVE=1 to shoot a live build",
      );
      test.setTimeout(90_000);
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/", { waitUntil: "load" });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await scene.prepare?.(page);
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      if (overflow > 0)
        console.log(
          `${scene.name}-${viewport.name}: ${overflow}px horizontal overflow`,
        );
      await page.screenshot({
        path: `.design/shots/${scene.name}-${viewport.name}.png`,
        fullPage: viewport.fullPage,
        animations: "disabled",
        caret: "hide",
      });
    });
  }
}
