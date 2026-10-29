// WS12 item 10: every page ends on the same about line: built for the Qloo Agentic Hackathon,
// Qloo's taste data, the model the AI agent plans with, and where the AI usage is written up.
import { expect, test } from "@playwright/test";

const PAGES = ["/", "/method", "/compare", "/your-festival", "/shortlist"];

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
])
  test.describe(`the footer at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("ends every page on the about line", async ({ page }) => {
      for (const path of PAGES) {
        await page.goto(path);
        const footer = page.getByRole("contentinfo");
        await expect(footer, path).toHaveCount(1);
        await expect(footer, path).toContainText(
          "Built for the Qloo Agentic Hackathon",
        );
        await expect(footer, path).toContainText(/Claude \w+ [\d.]+ \(claude-/);
        await expect(footer, path).toContainText("README's AI usage section");
        // It scrolls no wider than the page.
        const wide = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(wide, path).toBe(false);
      }
    });
  });
