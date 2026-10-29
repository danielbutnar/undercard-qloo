// WS12 item 9: every empty and error state designed: Qloo down, a limit reached, an unknown or
// thin town, a failed live run, and a tier the rule can't fill. Each is set up with the build
// route intercepted (no Qloo or Claude call), checked for its designed words, and photographed
// at 1440x900 and 390x844 into .design/shots/ws12/item9 (git-ignored).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { SYNTHETIC } from "./env";
import { LIMIT_MESSAGE, syntheticSavedBuild } from "./synthetic-build";

const NDJSON = "application/x-ndjson; charset=utf-8";
const ndjson = (events: unknown[]) =>
  events.map((event) => JSON.stringify(event)).join("\n");
const OUT = "C:/Users/danie/code/undercard/.design/shots/ws12/item9";
const fresh = (id: string) => ({
  type: "build",
  id,
  createdAt: "2026-10-28T20:00:00.000Z",
  replayed: false,
});

/** A live run from the setlist's "Play it live", answered with `answer`. */
async function liveRun(
  page: Page,
  answer: Parameters<Page["route"]>[1],
): Promise<Locator> {
  await page.route("**/api/undercard", async (route, request) => {
    const { fresh: isFresh } = (request.postDataJSON() ?? {}) as {
      fresh?: boolean;
    };
    if (isFresh) return answer(route, request);
    return route.fallback();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Play it live" }).click();
  return page.getByRole("complementary", { name: "Qloo calls" });
}

async function yourFestival(page: Page, events: unknown[], town: string) {
  await page.route("**/api/undercard", (route) =>
    route.fulfill({ status: 200, contentType: NDJSON, body: ndjson(events) }),
  );
  await page.goto("/your-festival");
  const form = page.locator("form");
  await form.getByLabel("Town", { exact: true }).fill(town);
  await form.getByLabel("State or country", { exact: true }).fill("England");
  await form.getByLabel("First headliner", { exact: true }).fill("Khruangbin");
  await form
    .getByLabel("Second headliner", { exact: true })
    .fill("Japanese Breakfast");
  await page.getByRole("button", { name: "Draft my undercard" }).click();
}

async function shoot(page: Page, name: string, at: Locator) {
  await at.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -120));
  await page.waitForTimeout(500);
  const { width } = page.viewportSize()!;
  await page.screenshot({
    path: `${OUT}/${name}-${width < 768 ? "phone" : "laptop"}.png`,
  });
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
])
  test.describe(`designed states at ${viewport.width}x${viewport.height}`, () => {
    test.skip(SYNTHETIC !== "1", "reads the synthetic build");
    test.use({ viewport });

    test("a limit reached: the live run is refused, the bill stays", async ({
      page,
    }) => {
      const trace = await liveRun(page, (route) =>
        route.fulfill({
          status: 429,
          contentType: NDJSON,
          body: ndjson([
            { type: "error", message: LIMIT_MESSAGE },
            { type: "done", calls: 0, ms: 0 },
          ]),
        }),
      );
      await expect(trace.getByRole("alert")).toHaveText(LIMIT_MESSAGE);
      await expect(
        page
          .getByRole("region", { name: "Undercard draft" })
          .getByRole("article"),
      ).toHaveCount(10);
      await shoot(page, "limit", trace.getByRole("alert"));
    });

    test("Qloo down: the live run stops, says so, and offers the saved build", async ({
      page,
    }) => {
      const busy =
        "Qloo is busy right now, so the live run stopped. The saved build still replays.";
      const trace = await liveRun(page, (route) =>
        route.fulfill({
          status: 200,
          contentType: NDJSON,
          body: ndjson([
            fresh("qloo-down"),
            { type: "error", code: "qloo-busy", message: busy },
            { type: "done", calls: 2, ms: 3000 },
          ]),
        }),
      );
      await expect(trace.getByRole("alert")).toHaveText(busy);
      // The bill is still the saved build's, and so is the setlist (it said "0 Qloo calls").
      await expect(
        page
          .getByRole("region", { name: "The AI agent's setlist" })
          .getByRole("listitem", { name: /^Call \d+/ }),
      ).not.toHaveCount(0);
      await expect(
        trace.getByRole("button", { name: "Watch the saved build instead" }),
      ).toBeVisible();
      await shoot(page, "qloo-down", trace.getByRole("alert"));
    });

    test("a failed live run: the connection drops, the page says so", async ({
      page,
    }) => {
      const trace = await liveRun(page, (route) => route.abort("failed"));
      await expect(trace.getByRole("alert")).toBeVisible();
      await expect(trace.getByRole("alert")).not.toHaveText("");
      await shoot(page, "live-run-failed", trace.getByRole("alert"));
    });

    test("a thin town: too few music rooms, the checked towns offered", async ({
      page,
    }) => {
      await yourFestival(
        page,
        [
          fresh("yours-thin"),
          {
            type: "error",
            code: "too-few-rooms",
            message:
              "Qloo lists only 1 live-music place in Brighton, too few for the agent to compare rooms.",
          },
          { type: "done", calls: 3, ms: 900 },
        ],
        "Brighton",
      );
      const offer = page.getByRole("list", {
        name: "Towns Undercard has already read in the United Kingdom",
      });
      await expect(offer).toBeVisible();
      await shoot(page, "thin-town", offer);
    });

    test("an unknown town: Qloo can't find it, the brief stays to fix", async ({
      page,
    }) => {
      const message = "Qloo couldn't find a town called Brightonn in England.";
      await yourFestival(
        page,
        [
          fresh("yours-unknown"),
          { type: "error", code: "town-not-found", message },
          { type: "done", calls: 1, ms: 400 },
        ],
        "Brightonn",
      );
      const said = page.getByText(message).first();
      await expect(said).toBeVisible();
      await shoot(page, "unknown-town", said);
    });

    test("a tier the rule can't fill: its slots stay open, saying why", async ({
      page,
    }) => {
      const saved = syntheticSavedBuild();
      const lineup = {
        ...saved.lineup,
        acts: saved.lineup.acts.filter((act) => act.band === "mid"),
      };
      await yourFestival(
        page,
        [
          fresh("yours-short"),
          ...saved.trace.map((call) => ({ type: "call", call })),
          { type: "lineup", lineup },
          {
            type: "error",
            code: "not-full",
            message:
              "No opening act the venues lifted clears the bar, so those 6 slots stay open.",
          },
          { type: "done", calls: 12, ms: 9000 },
        ],
        "Brighton",
      );
      const bands = page.getByRole("region", { name: "Opening acts" });
      await expect(bands).toBeVisible();
      await expect(bands).toContainText("Open slot");
      // The acts it drafted are counted, not "No undercard drafted yet."
      await expect(
        page.getByText(/^Drafted from \d+ Qloo calls the AI agent planned/),
      ).toBeVisible();
      await shoot(page, "tier-unfilled", bands);
    });
  });
