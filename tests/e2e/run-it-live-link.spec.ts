// Daniel, 29 Oct (09:45): where "Run it live" doesn't stand under Watch (below 1250x960), the line
// under Watch ends on a link, "· or run it live ↓", that scrolls to the setlist's "Play it live"
// and focuses it. From 1250x960, where "Run it live" shows, the link isn't there.
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1366, height: 640 },
])
  test.describe(`the line under Watch at ${viewport.width}x${viewport.height}`, () => {
    test.skip(SYNTHETIC === "empty", "needs a saved build");
    test.use({ viewport });

    test("ends on a link to Play it live, which it scrolls to and focuses", async ({
      page,
    }) => {
      await page.goto("/");
      const link = page.getByRole("link", { name: "or run it live" });
      await expect(link).toBeVisible();
      await expect(page.locator(".watch-sub").first()).toContainText(
        "· or run it live ↓",
      );
      await link.click();
      const play = page.getByRole("button", { name: "Play it live" });
      await expect(play).toBeFocused();
      await expect(play).toBeInViewport();
    });
  });

test.describe("the line under Watch at 1920x1080", () => {
  test.skip(SYNTHETIC === "empty", "needs a saved build");
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("has no link: Run it live stands under Watch", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Run it live" })).toBeVisible();
    await expect(page.getByRole("link", { name: "or run it live" })).toBeHidden();
  });
});
