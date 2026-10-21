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

  test.describe("at 390x844", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("says the fee range in plain words, and ends the first act's row above 664 px", async ({
      page,
    }) => {
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      const mid = page.getByRole("region", { name: "Mid-size acts" });
      await expect(mid.locator(".fee-plain")).toBeVisible();
      await expect(mid.locator(".fee-plain")).toHaveText(
        /^fee range: \d+(st|nd|rd|th)–\d+(st|nd|rd|th) percentile of Qloo popularity$/,
      );
      if (SYNTHETIC) return;
      const box = (await mid.getByRole("article").first().boundingBox())!;
      expect(box.y + box.height).toBeLessThan(664);
    });
  });
});
