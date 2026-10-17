// Screenshots for the frontend-anti-slop critique. It records; it doesn't assert.
// Run: pnpm e2e tests/e2e/design-shots.spec.ts   Output: .design/shots (the run before: .design/previous)
// The local server runs in synthetic mode, so the bill is the synthetic saved build. The
// fallback (no saved build) is shot against a server seeded with UNDERCARD_E2E_SYNTHETIC=empty:
// see README, Running locally. That run adds its shots without moving the others to .design/previous.
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { SYNTHETIC } from "./env";
import {
  syntheticBuildStream,
  syntheticLimitStream,
  syntheticRefillStream,
} from "./synthetic-build";

const NDJSON = "application/x-ndjson; charset=utf-8";
const VIDEO = { name: "video", width: 1440, height: 810, fullPage: false };
const WIDE = { name: "wide", width: 1920, height: 1080, fullPage: false };
const MOBILE = { name: "mobile", width: 390, height: 844, fullPage: true };
// A judge's laptop, for the cold-reader test of the first screen.
const JUDGE = { name: "judge", width: 1280, height: 800, fullPage: false };

const bill = (page: Page) =>
  page.getByRole("region", { name: "Undercard draft" });
const never = () => new Promise<void>(() => {});

async function liftedTotal(page: Page): Promise<number> {
  const rail = page.getByRole("region", {
    name: "Boise venue crowds behind this bill",
  });
  const text = (await rail.getByRole("list").textContent()) ?? "";
  return [...text.matchAll(/(\d+) (?:acts? lifted|lifted none)/g)].reduce(
    (total, match) => total + Number(match[1]),
    0,
  );
}

async function openFirstAct(page: Page) {
  const first = bill(page)
    .getByRole("region", { name: /^Mid/ })
    .getByRole("article")
    .first();
  const name = (await first.getAttribute("aria-label"))!;
  await first.getByRole("button", { name, exact: true }).click();
  await page.getByRole("region", { name: "Act card" }).waitFor();
}

async function markFirstActUnavailable(page: Page) {
  await openFirstAct(page);
  await page
    .getByRole("region", { name: "Act card" })
    .getByRole("button", { name: "Unavailable" })
    .click();
  await page.getByRole("button", { name: "Radius clause" }).click();
}

// The demo-path screens from SPEC.md section 3, in order, each at the viewports it's judged
// at, then each screen's loading, empty and error states.
const SCENES: {
  name: string;
  viewports: (typeof VIDEO)[];
  /** The server these shots need: one with the saved build, or one with none. */
  server?: "bill" | "empty";
  prepare?: (page: Page) => Promise<void>;
}[] = [
  { name: "home", viewports: [JUDGE, VIDEO, MOBILE] },
  {
    // Step 2, mid-replay: the trace streams while the undercard waits in open slots.
    name: "home-watching",
    viewports: [VIDEO, MOBILE],
    prepare: async (page) => {
      await page
        .getByRole("button", { name: "Watch the agent build it" })
        .click();
      await page
        .getByRole("list", { name: "Qloo calls" })
        .locator(":scope > li")
        .nth(6)
        .waitFor();
    },
  },
  {
    name: "home-watched",
    viewports: [WIDE, VIDEO, MOBILE],
    prepare: async (page) => {
      await page
        .getByRole("button", { name: "Watch the agent build it" })
        .click();
      await page.getByText(/^Replayed the build saved/).waitFor();
      await test.expect.poll(() => liftedTotal(page)).toBe(10);
    },
  },
  { name: "home-card", viewports: [VIDEO, MOBILE], prepare: openFirstAct },
  {
    // The refill request is held open, so the stamp and the refill status show.
    name: "home-refilling",
    viewports: [VIDEO, MOBILE],
    prepare: async (page) => {
      await page.route("**/api/refill", never);
      await markFirstActUnavailable(page);
      await page.getByText(/^Finding a replacement for/).waitFor();
    },
  },
  {
    name: "home-refilled",
    viewports: [VIDEO, MOBILE],
    prepare: async (page) => {
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
      await markFirstActUnavailable(page);
      await bill(page).getByRole("article", { name: "Sego Lily" }).waitFor();
    },
  },
  {
    name: "home-without-qloo",
    viewports: [WIDE, VIDEO, MOBILE],
    prepare: async (page) => {
      await page
        .getByRole("button", { name: "Without Qloo: the model's picks" })
        .click();
      await page
        .getByRole("region", { name: "Without Qloo: the model's picks" })
        .getByRole("article")
        .first()
        .waitFor();
    },
  },
  {
    // Loading: the model's answer is held open.
    name: "home-without-qloo-loading",
    viewports: [VIDEO],
    prepare: async (page) => {
      await page.route("**/api/llm-only", never);
      await page
        .getByRole("button", { name: "Without Qloo: the model's picks" })
        .click();
      await page.getByText("Asking the model, without Qloo…").waitFor();
    },
  },
  {
    name: "home-without-qloo-error",
    viewports: [VIDEO, MOBILE],
    prepare: async (page) => {
      await page.route("**/api/llm-only", (route) =>
        route.fulfill({
          status: 502,
          json: { error: "The model didn't answer. Try again in a minute." },
        }),
      );
      await page
        .getByRole("button", { name: "Without Qloo: the model's picks" })
        .click();
      await page.getByRole("button", { name: "Try again" }).waitFor();
    },
  },
  {
    // Loading: the replay request is held open, so the bill waits in open slots.
    name: "home-replay-loading",
    viewports: [VIDEO],
    prepare: async (page) => {
      await page.route("**/api/undercard", never);
      await page
        .getByRole("button", { name: "Watch the agent build it" })
        .click();
      await page.getByText("Open slot").first().waitFor();
    },
  },
  {
    // Error: a live run refused at the per-IP limit keeps the bill and offers the replay.
    name: "home-limited",
    viewports: [VIDEO, MOBILE],
    prepare: async (page) => {
      await page.route("**/api/undercard", async (route) => {
        const { fresh } = (route.request().postDataJSON() ?? {}) as {
          fresh?: boolean;
        };
        await route.fulfill(
          fresh
            ? { status: 429, contentType: NDJSON, body: syntheticLimitStream() }
            : {
                status: 200,
                contentType: NDJSON,
                body: syntheticBuildStream({ replayed: true }),
              },
        );
      });
      await page
        .getByRole("button", { name: "Run the agent live instead" })
        .click();
      await page
        .getByRole("button", { name: "Replay the saved build" })
        .waitFor();
    },
  },
  // Empty: no saved build, or the store can't be reached.
  { name: "home-empty", server: "empty", viewports: [JUDGE, VIDEO, MOBILE] },
];

const runs = (scene: (typeof SCENES)[number]) =>
  (scene.server ?? "bill") === (SYNTHETIC === "empty" ? "empty" : "bill");

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  if (SYNTHETIC !== "empty") {
    rmSync(".design/previous", { recursive: true, force: true });
    if (existsSync(".design/shots"))
      renameSync(".design/shots", ".design/previous");
  }
  mkdirSync(".design/shots", { recursive: true });
});

for (const scene of SCENES) {
  for (const viewport of scene.viewports) {
    test(`design shot ${scene.name} ${viewport.name}`, async ({ page }) => {
      test.skip(!runs(scene), `needs the ${scene.server ?? "bill"} server`);
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
