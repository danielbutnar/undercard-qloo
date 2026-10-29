// WS12 item 1 with WS13.8: the setlist's "Play it live" starts the live run, on the sizes where
// WS13's own "Run it live" is hidden (a phone, and a laptop 760 px tall or less).
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";

for (const [width, height] of [
  [390, 844],
  [1366, 640],
] as const)
  test.describe(`Play it live at ${width}x${height}`, () => {
    test.skip(
      SYNTHETIC !== "1",
      "the run is answered here, never by a deployment",
    );
    test.use({ viewport: { width, height } });

    test("starts a fresh live run of the AI agent", async ({ page }) => {
      const bodies: { fresh?: boolean }[] = [];
      await page.route("**/api/undercard", async (route) => {
        bodies.push(route.request().postDataJSON() as { fresh?: boolean });
        await route.fulfill({
          status: 200,
          contentType: "application/x-ndjson",
          body: "",
        });
      });
      await page.goto("/");
      const play = page.getByRole("button", { name: "Play it live" });
      await play.scrollIntoViewIfNeeded();
      await expect(play).toBeEnabled({ timeout: 15_000 });
      await play.click();
      await expect.poll(() => bodies.length).toBeGreaterThan(0);
      expect(bodies.at(-1)).toMatchObject({ fresh: true });
    });
  });
