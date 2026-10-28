// WS12 item 7 (Daniel: "the round-stamp fix comes with item 7"): the door check's round
// popularity stamp keeps all its text inside its ring, on a laptop and on a phone. Its line
// "popularity, inside 80–92" crossed the ring at its foot.
import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
])
  test.describe(`the round stamp at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("keeps its text inside its ring", async ({ page }) => {
      await page.goto("/");
      const stamp = page.locator(".door-check .stamp-pop");
      await stamp.scrollIntoViewIfNeeded();
      await expect(stamp).toBeVisible();
      const outside = await stamp.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const border = Number.parseFloat(
          getComputedStyle(element).borderTopWidth,
        );
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        // The ring's inner edge; the stamp leans 3 degrees, which moves a corner by a pixel or two.
        const inner = Math.min(box.width, box.height) / 2 - border + 2;
        const misses: string[] = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects())
            for (const [x, y] of [
              [rect.left, rect.top],
              [rect.right, rect.top],
              [rect.left, rect.bottom],
              [rect.right, rect.bottom],
            ])
              if (Math.hypot(x - cx, y - cy) > inner)
                misses.push(`"${node.textContent.trim()}"`);
        }
        return [...new Set(misses)];
      });
      expect(outside).toEqual([]);
    });
  });
