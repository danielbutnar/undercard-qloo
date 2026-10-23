// WS8 (item 13): Watch's first act lands within 3 s of pressing Watch, and the end is a reveal:
// every lifting venue's sign lit at once and the acts pulsing in their venue colours, then the
// overview. Under reduced motion nothing pulses: the signs light and the acts take their colours.
import { expect, test, type Page } from "@playwright/test";
import { SYNTHETIC } from "./env";
import { syntheticReplayStream, syntheticSavedBuild } from "./synthetic-build";

const WATCH = "Watch the AI agent build it";
const poster = (page: Page) =>
  page.getByRole("region", { name: "Undercard draft" });

async function press(page: Page) {
  // The synthetic server's replay has no Qloo lists to climb from: Watch gets the synthetic
  // replay with its invented editions, as the other Watch specs do.
  await page.route("**/api/undercard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/x-ndjson; charset=utf-8",
      body: syntheticReplayStream(syntheticSavedBuild()),
    }),
  );
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: WATCH }).click();
  return Date.now();
}

/** The reveal's end state: each lifting venue's sign lit, each act in its venue's colour. */
async function revealed(page: Page) {
  const signs = page
    .getByRole("region", { name: "Your town" })
    .getByRole("button", { name: /, \d+ acts?\. Show this venue$/ });
  expect(await signs.count()).toBeGreaterThan(0);
  for (const sign of await signs.all())
    await expect(sign.locator(".town-sign-plate")).toHaveClass(/venue-\d/);
  const acts = poster(page).locator(".poster-act");
  await expect(acts).toHaveCount(10);
  for (const act of await acts.all()) await expect(act).toHaveClass(/venue-\d/);
}

test.describe("Watch's pace and its end", () => {
  test.skip(SYNTHETIC !== "1", "replays the synthetic saved build");

  test("the first act lands within 3 s, and the end reveals every lifting venue at once", async ({
    page,
  }) => {
    const pressed = await press(page);
    // The first act on the poster, stamped in (fully opaque).
    await page.waitForFunction(
      () =>
        [
          ...document.querySelectorAll(
            '[aria-label="Undercard draft"] .poster-act',
          ),
        ].some((act) => Number(getComputedStyle(act).opacity) > 0.95),
      undefined,
      { timeout: 10_000, polling: 50 },
    );
    expect(Date.now() - pressed).toBeLessThan(3_000);
    // The reveal: the poster pulses, every lifting venue's sign lit.
    await expect(poster(page)).toHaveClass(/is-revealing/, { timeout: 30_000 });
    await revealed(page);
    // Then the overview.
    await expect(poster(page)).not.toHaveClass(/is-revealing/, {
      timeout: 5_000,
    });
    await expect(page.getByRole("button", { name: WATCH })).toBeVisible();
  });

  test("under reduced motion the reveal lights the signs and colours the acts, with no pulse", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await press(page);
    await expect(poster(page)).toHaveClass(/is-revealing/, { timeout: 30_000 });
    await revealed(page);
    const moving = await poster(page)
      .locator(".poster-act")
      .evaluateAll(
        (acts) => acts.filter((act) => act.getAnimations().length > 0).length,
      );
    expect(moving).toBe(0);
  });
});
