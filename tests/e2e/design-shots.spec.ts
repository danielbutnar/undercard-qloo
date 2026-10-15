// Screenshots for the frontend-anti-slop critique. It records; it doesn't assert.
// Run: pnpm e2e tests/e2e/design-shots.spec.ts   Output: .design/shots (the run before: .design/previous)
// DESIGN_LIVE=1 adds a shot taken mid-way through a real build (it calls Qloo and Claude).
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import {
  syntheticBuildStream,
  syntheticLlmOnly,
  syntheticRefillStream,
} from "./synthetic-build";

const NDJSON = "application/x-ndjson; charset=utf-8";
const VIDEO = { name: "video", width: 1440, height: 810, fullPage: false };
const WIDE = { name: "wide", width: 1920, height: 1080, fullPage: false };
const MOBILE = { name: "mobile", width: 390, height: 844, fullPage: true };

// A finished board from a synthetic build stream: no Qloo or Claude calls.
async function builtBoard(page: Page) {
  await page.route("**/api/undercard", (route) =>
    route.fulfill({
      status: 200,
      contentType: NDJSON,
      body: syntheticBuildStream(),
    }),
  );
  await page.getByRole("button", { name: "Build undercard" }).click();
  await page.getByRole("article").nth(9).waitFor();
}

async function markFirstMidActUnavailable(page: Page) {
  const board = page.getByRole("region", { name: /^Mid/ });
  await board.getByRole("button", { name: "Unavailable" }).first().click();
}

// The demo-path screens from SPEC.md section 3, in order, each at the viewports it's judged at.
const SCENES: {
  name: string;
  viewports: (typeof VIDEO)[];
  prepare?: (page: Page) => Promise<void>;
  live?: boolean;
}[] = [
  { name: "home", viewports: [VIDEO, MOBILE] },
  {
    name: "home-building",
    viewports: [VIDEO, MOBILE],
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
  { name: "home-built", viewports: [WIDE, VIDEO, MOBILE], prepare: builtBoard },
  {
    // The refill request is held open, so the stamp and the refill status show.
    name: "home-refilling",
    viewports: [VIDEO, MOBILE],
    prepare: async (page) => {
      await builtBoard(page);
      await page.route("**/api/refill", () => new Promise(() => {}));
      await markFirstMidActUnavailable(page);
      await page.getByText(/^Finding a replacement for/).waitFor();
    },
  },
  {
    name: "home-refilled",
    viewports: [WIDE, VIDEO, MOBILE],
    prepare: async (page) => {
      await builtBoard(page);
      await page.route("**/api/refill", async (route) => {
        const body = route.request().postDataJSON() as {
          unavailableId: string;
        };
        await route.fulfill({
          status: 200,
          contentType: NDJSON,
          body: syntheticRefillStream(body.unavailableId),
        });
      });
      await markFirstMidActUnavailable(page);
      await page.getByRole("article", { name: "Sego Lily" }).waitFor();
    },
  },
  {
    name: "home-llm-only",
    viewports: [VIDEO, MOBILE],
    prepare: async (page) => {
      await builtBoard(page);
      await page.route("**/api/llm-only", (route) =>
        route.fulfill({ status: 200, json: syntheticLlmOnly() }),
      );
      await page.getByRole("button", { name: "LLM only" }).click();
      await page.getByText("No Qloo data").waitFor();
    },
  },
  {
    name: "poster",
    viewports: [WIDE, VIDEO, MOBILE],
    prepare: async (page) => {
      await builtBoard(page);
      await page.getByRole("button", { name: "Poster" }).click();
      await page.getByRole("region", { name: "Poster" }).waitFor();
    },
  },
];

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  rmSync(".design/previous", { recursive: true, force: true });
  if (existsSync(".design/shots"))
    renameSync(".design/shots", ".design/previous");
  mkdirSync(".design/shots", { recursive: true });
});

for (const scene of SCENES) {
  for (const viewport of scene.viewports) {
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
      await page.mouse.move(0, 0);
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
