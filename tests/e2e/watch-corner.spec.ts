// WS12 (Watch's look): Watch's corner of the town, with WS13.8's "Run it live" under Watch,
// never covers the town's own controls, no venue's sign stands under it, and every venue the
// build read (three in the synthetic build) keeps its sign. Found on item 6's
// shots: at 1440x900 the live run's line covered "Turn the town left", and at 1100 to 1280 px
// wide it covered up to five of the controls.
import { expect, test, type Page } from "@playwright/test";
import { SYNTHETIC } from "./env";

const CONTROLS = [
  "Turn the town left",
  "Turn the town right",
  "Zoom in",
  "Zoom out",
  "Show the whole town",
];

type Box = { left: number; top: number; right: number; bottom: number };
const meets = (a: Box, b: Box) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

async function boxOf(page: Page, selector: string): Promise<Box> {
  return page.locator(selector).evaluate((element) => {
    const { left, top, right, bottom } = element.getBoundingClientRect();
    return { left, top, right, bottom };
  });
}

for (const [width, height] of [
  [1100, 900],
  [1180, 900],
  [1280, 800],
  [1366, 768],
  [1440, 780],
  [1440, 900],
  [1536, 864],
  [1536, 960],
  [1920, 1080],
])
  test.describe(`Watch's corner at ${width}x${height}`, () => {
    test.skip(SYNTHETIC !== "1", "reads the synthetic build");
    test.use({ viewport: { width, height } });

    test("covers none of the town's controls and no sign", async ({ page }) => {
      await page.goto("/");
      const watch = page.getByRole("button", {
        name: "Watch the AI agent build it",
      });
      await expect(watch).toBeInViewport({ ratio: 1 });
      // Every venue the build read keeps its sign: Watch's corner hides none of them.
      await expect(page.locator(".town-sign")).toHaveCount(3);
      const corner = await boxOf(page, ".fs-watch");

      for (const name of CONTROLS) {
        const control = page.getByRole("button", { name, exact: true });
        if (!(await control.isVisible())) continue;
        const box = (await control.boundingBox())!;
        // The topmost element at the control's centre is the control itself.
        const onTop = await page.evaluate(
          ({ x, y }) =>
            document
              .elementFromPoint(x, y)
              ?.closest("button")
              ?.getAttribute("aria-label") ?? "",
          { x: box.x + box.width / 2, y: box.y + box.height / 2 },
        );
        expect(onTop, `${name} is covered`).toBe(name);
        expect(
          meets(corner, {
            left: box.x,
            top: box.y,
            right: box.x + box.width,
            bottom: box.y + box.height,
          }),
          `Watch's corner meets ${name}`,
        ).toBe(false);
      }

      const signs = page.locator(".town-sign");
      for (let index = 0; index < (await signs.count()); index++) {
        const sign = await signs.nth(index).evaluate((element) => {
          const { left, top, right, bottom } = element.getBoundingClientRect();
          return { left, top, right, bottom, text: element.textContent };
        });
        expect(meets(corner, sign), `${sign.text} is under Watch`).toBe(false);
      }
    });
  });
