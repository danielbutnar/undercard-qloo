// Screenshots for the frontend-anti-slop critique. It records; it doesn't assert.
// Run: pnpm e2e tests/e2e/design-shots.spec.ts   Output: .design/shots (the run before: .design/previous)
// The local server runs in synthetic mode, so the bill is the synthetic saved build. The
// fallback (no saved build) is shot against a server seeded with UNDERCARD_E2E_SYNTHETIC=empty:
// see README, Running locally. That run adds its shots without moving the others to .design/previous.
import { planRunningOrder } from "../../src/lib/running-order";
import { SAGEBRUSH_SOUND } from "../../src/lib/sagebrush";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { LIVE_QLOO, SYNTHETIC } from "./env";
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
    name: "Boise venues whose fans shaped this lineup",
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
  /** The page to open; the home page when unset. */
  path?: string;
  prepare?: (page: Page) => Promise<void>;
}[] = [
  { name: "home", viewports: [JUDGE, VIDEO, MOBILE] },
  {
    // Step 2, mid-replay: the trace streams while the undercard waits in open slots.
    name: "home-watching",
    viewports: [VIDEO, MOBILE],
    prepare: async (page) => {
      await page
        .getByRole("button", { name: "Watch how it picked these acts" })
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
        .getByRole("button", { name: "Watch how it picked these acts" })
        .click();
      await page.getByText(/^Replayed the build saved/).waitFor();
      // M9a: the climb plays first on a deployment; skip to the reprinted lineup.
      const skip = bill(page).getByRole("button", {
        name: "Skip to the lineup",
      });
      if (await skip.isVisible()) await skip.click();
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
        .getByRole("button", {
          name: "Without Qloo: an AI model's picks alone",
        })
        .click();
      await page
        .getByRole("region", {
          name: "Without Qloo: an AI model's picks alone",
        })
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
        .getByRole("button", {
          name: "Without Qloo: an AI model's picks alone",
        })
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
        .getByRole("button", {
          name: "Without Qloo: an AI model's picks alone",
        })
        .click();
      await page.getByRole("button", { name: "Try again" }).waitFor();
    },
  },
  {
    // Loading: the replay request is held open, so Watch waits on its first edition.
    name: "home-replay-loading",
    viewports: [VIDEO],
    prepare: async (page) => {
      await page.route("**/api/undercard", never);
      await page
        .getByRole("button", { name: "Watch how it picked these acts" })
        .click();
      await page
        .getByText("Waiting for this band's first ranking…")
        .first()
        .waitFor();
    },
  },
  {
    // The venue switch: the venue that lifted most acts switched off, the lineup re-formed.
    name: "home-whatif",
    viewports: [VIDEO, MOBILE],
    prepare: async (page) => {
      const toggle = page
        .getByRole("button", { name: /: on, \d+ acts? lifted$/ })
        .first();
      await toggle.waitFor();
      await test.expect(toggle).toBeEnabled({ timeout: 15_000 });
      await toggle.click();
      await bill(page)
        .getByText(/^What if /)
        .waitFor();
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
  // M9c: the method page.
  { name: "method", path: "/method", viewports: [VIDEO, MOBILE] },
  // M9b: town against town, Boise and Austin side by side.
  { name: "compare", path: "/compare", viewports: [JUDGE, VIDEO, MOBILE] },
  {
    // M8a: the running order, answered in the browser with made-up scores unless the run may
    // call Qloo (E2E_LIVE_QLOO=1 against a deployment).
    name: "home-running-order",
    viewports: [VIDEO, MOBILE],
    prepare: async (page) => {
      if (SYNTHETIC || !LIVE_QLOO)
        await page.route("**/api/running-order", async (route) => {
          const { acts } = route.request().postDataJSON() as {
            acts: Parameters<typeof planRunningOrder>[0];
          };
          await route.fulfill({
            status: 200,
            contentType: NDJSON,
            body: [
              {
                type: "running-order",
                slots: planRunningOrder(
                  acts,
                  (a, b) => 0.8 + ((a + b).length % 9) / 100,
                  SAGEBRUSH_SOUND.feeBands,
                ),
              },
              { type: "done", calls: 8, ms: 900 },
            ]
              .map((event) => JSON.stringify(event))
              .join("\n"),
          });
        });
      await bill(page).getByRole("button", { name: "Running order" }).click();
      await page.getByRole("region", { name: "Running order" }).waitFor();
    },
  },
  {
    // M8c: three acts kept, Redraft the rest under the bands.
    name: "home-kept",
    viewports: [VIDEO, MOBILE],
    prepare: async (page) => {
      const names = await bill(page)
        .getByRole("article")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("aria-label")!),
        );
      for (const name of [names[0], names[4], names[5]]) {
        await bill(page).getByRole("button", { name, exact: true }).click();
        await page
          .getByRole("region", { name: "Act card" })
          .getByRole("button", { name: "Keep" })
          .click();
      }
    },
  },
  {
    // M6n: a typed town too thin to draft offers the checked towns in its country.
    name: "your-festival-thin",
    path: "/your-festival",
    viewports: [VIDEO, MOBILE],
    prepare: async (page) => {
      await page.route("**/api/undercard", (route) =>
        route.fulfill({
          status: 200,
          contentType: NDJSON,
          body: [
            {
              type: "build",
              id: "yours-shot",
              createdAt: "2026-10-17T10:00:00.000Z",
              replayed: false,
            },
            {
              type: "error",
              code: "too-few-rooms",
              message:
                "Qloo lists only 1 live-music place in Brighton, too few for the agent to compare rooms.",
            },
            { type: "done", calls: 3, ms: 900 },
          ]
            .map((event) => JSON.stringify(event))
            .join("\n"),
        }),
      );
      const form = page.locator("form");
      await form.getByLabel("Town", { exact: true }).fill("Brighton");
      await form
        .getByLabel("State or country", { exact: true })
        .fill("England");
      await form.getByRole("button", { name: "Draft my undercard" }).click();
      await page
        .getByRole("list", {
          name: "Towns Undercard has already read in the United Kingdom",
        })
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
      await page.goto(scene.path ?? "/", { waitUntil: "load" });
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
