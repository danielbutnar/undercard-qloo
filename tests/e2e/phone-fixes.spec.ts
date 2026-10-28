// WS12 item 7 (WS8's item 17, the panel's phone findings): on a phone every venue's sign stands
// inside the town's frame (Venue 418's sat on its left edge), and the poster's
// facts break only between their parts ("3,000 capacity" stays on one line). Also checked at
// laptop sizes, where the same rules hold.
import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 390, height: 844 },
  { width: 375, height: 812 },
  { width: 360, height: 780 },
  { width: 1440, height: 900 },
])
  test.describe(`at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("every sign stands inside the town's frame", async ({ page }) => {
      await page.goto("/");
      const view = page.locator(".fs-town .town-view");
      await view.scrollIntoViewIfNeeded();
      await expect(page.locator(".fs-town .town-sign").first()).toBeVisible();
      const outside = await view.evaluate((element) => {
        const frame = element.getBoundingClientRect();
        const border = Number.parseFloat(
          getComputedStyle(element).borderLeftWidth || "0",
        );
        return [...element.querySelectorAll(".town-sign-plate")].flatMap(
          (plate) => {
            const box = plate.getBoundingClientRect();
            const clear = 4;
            return box.left < frame.left + border + clear ||
              box.right > frame.right - border - clear
              ? [plate.textContent ?? ""]
              : [];
          },
        );
      });
      expect(outside).toEqual([]);
    });

    test("the poster's facts break only between their parts", async ({
      page,
    }) => {
      await page.goto("/");
      const facts = page.locator(".fs-poster .poster-sheet .facts");
      await expect(facts).toBeVisible();
      const broken = await facts.evaluate((element) => {
        // A part set on more than one line has more than one line box.
        const parts = element.querySelectorAll(".nowrap");
        if (parts.length === 0) return ["the facts aren't set in parts"];
        return [...parts].flatMap((part) => {
          const range = document.createRange();
          range.selectNodeContents(part);
          const tops = new Set(
            [...range.getClientRects()].map((rect) => Math.round(rect.top)),
          );
          return tops.size > 1 ? [part.textContent ?? ""] : [];
        });
      });
      expect(broken).toEqual([]);
    });
  });
