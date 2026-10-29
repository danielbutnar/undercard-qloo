// WS12 item 4 (WS8's item 18): with an act's card open over the town, Watch stays reachable at
// every laptop width up to 1399 px, where the card used to hide it: in view, not covered by the
// card, and a click on it starts Watch.
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";

for (const width of [1100, 1280, 1366, 1399])
  test.describe(`Watch with a card open at ${width}x900`, () => {
    test.skip(SYNTHETIC !== "1", "reads the synthetic build");
    test.use({ viewport: { width, height: 900 } });

    test("stays in view, uncovered, and starts Watch", async ({ page }) => {
      await page.goto("/");
      await page
        .getByRole("region", { name: "Undercard draft" })
        .getByRole("button", { name: "Hollow Pines", exact: true })
        .click();
      await expect(
        page.getByRole("region", { name: "Act card" }),
      ).toBeVisible();

      const watch = page.getByRole("button", {
        name: "Watch the AI agent build it",
      });
      await expect(watch).toBeVisible();
      await expect(watch).toBeInViewport({ ratio: 1 });
      // Nothing sits over it: the topmost element at its centre is the button itself.
      const box = (await watch.boundingBox())!;
      const onTop = await page.evaluate(
        ({ x, y }) =>
          document.elementFromPoint(x, y)?.closest("button")?.textContent ?? "",
        { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      );
      expect(onTop).toContain("Watch the AI agent build it");

      await watch.click();
      await expect(page.getByRole("region", { name: "Act card" })).toHaveCount(
        0,
      );
    });
  });
