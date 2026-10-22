// On a 390x844 phone the first act shows on the first screen (Daniel's brief, 2026-10-21). A
// phone's browser keeps part of those 844 px for its own bars: Safari on a 390x844 iPhone shows
// about 664 of them with its bars in view (an estimate, not measured on a device), so the check
// runs at 390x664. The act's name is what has to show; on the saved Boise build its whole row
// fits too, but a long venue name set down a row's tab makes that row taller (the synthetic
// build's), so the whole row is checked only on a deployment.
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";

test.describe("the first screen on a phone", () => {
  test.skip(SYNTHETIC === "empty", "the empty board has no act");

  test.describe("with the browser's bars in view", () => {
    test.use({ viewport: { width: 390, height: 664 } });

    test("shows the first act's name before any scroll", async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      const first = page
        .getByRole("region", { name: "Mid-size acts" })
        .getByRole("article")
        .first();
      await expect(first.getByRole("button")).toBeInViewport({ ratio: 1 });
    });
  });

  // Daniel's second batch of 2026-10-22, item 5: on a 375 px phone an act's card names its
  // venue as the row's tab does ("V418"), so the line fits in two lines where that label is
  // short; the card's climb line keeps the full name.
  test.describe("at 375x812", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("an act's card names its venue as the row's tab does", async ({
      page,
    }) => {
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      const card = page.getByRole("region", { name: "Act card" });
      let shortened = 0;
      for (const row of await page
        .getByRole("region", { name: "Undercard draft" })
        .getByRole("article")
        .all()) {
        const name = (await row.getAttribute("aria-label"))!;
        const tab = (await row.locator(".row-venue").innerText()).trim();
        await row.getByRole("button", { name, exact: true }).click();
        const opened = card.getByRole("article", { name, exact: true });
        const line = opened.locator(".card-venue");
        await expect(line).toHaveText(`Climbs with ${tab}'s fans added`, {
          useInnerText: true,
        });
        const [, full] = /^with (.+)'s fans$/.exec(
          await opened.locator(".card-place small").last().innerText(),
        )!;
        if (tab !== full) {
          shortened += 1;
          const lines = await line.evaluate(
            (element) =>
              element.getBoundingClientRect().height /
              parseFloat(getComputedStyle(element).lineHeight),
          );
          expect(Math.round(lines)).toBeLessThanOrEqual(2);
        }
        await card.getByRole("button", { name: "Close the card" }).click();
      }
      expect(shortened).toBeGreaterThan(0);
    });
  });

  test.describe("at 390x844", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("says the fee range in plain words, shows each row's cover, and ends the first act's row above 664 px", async ({
      page,
    }) => {
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      const mid = page.getByRole("region", { name: "Mid-size acts" });
      await expect(mid.locator(".fee-plain")).toBeVisible();
      await expect(mid.locator(".fee-plain")).toHaveText(
        /^fee range: \d+(st|nd|rd|th)–\d+(st|nd|rd|th) percentile of Qloo popularity$/,
      );
      // Each row carries a small cover on a phone too: Qloo's photo, or the drawn one without it.
      const rows = mid.getByRole("article");
      await expect(mid.locator("article .row-sleeve")).toHaveCount(
        await rows.count(),
      );
      for (const cover of await mid.locator("article .row-sleeve").all())
        await expect(cover).toBeVisible();
      if (SYNTHETIC) return;
      const box = (await rows.first().boundingBox())!;
      expect(box.y + box.height).toBeLessThan(664);
    });

    // Plan.md item 3: Watch keeps the AI agent's line on a phone, the agent's own words from the
    // saved trace, or one fixed line on what it decides where the trace has none.
    test("Watch shows the AI agent's line for each venue", async ({ page }) => {
      test.skip(
        SYNTHETIC !== null,
        "the synthetic build has no venue editions to watch",
      );
      await page.goto("/");
      await page
        .getByRole("button", { name: "Watch how it picked these acts" })
        .click();
      const bill = page.getByRole("region", { name: "Undercard draft" });
      await expect(bill.getByText(/^\+ .+'s fans$/).first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(
        bill.getByText(/^The AI agent(: | chose which venues to read)/).first(),
      ).toBeVisible();
    });
  });
});
