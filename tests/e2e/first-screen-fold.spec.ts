// WS9: what the first screen shows before any scroll, on the synthetic build, at what a laptop
// (1440x780) and a phone (390x664) show under the browser's bars, on Boise's page and on a
// town's. The checks come from the layout brief's own first screens (laptop-00 at 1440x780,
// phone-01 at 390x844): on a laptop the lead, the town with every venue's sign and Watch, and the
// whole poster down to its last act; on a phone the lead, the town picker, Watch and the top of
// the poster. Qloo is explained in plain words where it's first named, above the fold at both.
import { expect, test, type Page } from "@playwright/test";
import { SYNTHETIC } from "./env";

const PATHS = [
  { path: "/", town: "Boise" },
  { path: "/towns/austin", town: "Austin" },
];

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
}

async function aboveTheFold(page: Page, town: string, withPicker = true) {
  const banner = page.getByRole("banner");
  await expect(banner.getByRole("link", { name: /^Undercard/ })).toBeInViewport(
    {
      ratio: 1,
    },
  );
  // "AI agent" at first use, and Qloo in plain words where it's first named.
  const tagline = banner.getByText(
    /^An AI agent for festival bookers, built on Qloo, a taste-data service that maps what fans of one artist, venue or film also like\.$/,
  );
  await expect(tagline).toBeInViewport({ ratio: 1 });
  for (const name of ["How it works", "Your festival"])
    await expect(banner.getByRole("link", { name })).toBeInViewport({
      ratio: 1,
    });
  const lead = page.getByRole("region", { name: "What Undercard does" });
  await expect(lead.getByText("You booked the headliners.")).toBeInViewport({
    ratio: 1,
  });
  await expect(
    lead.getByText(
      `Undercard drafts the rest from what fans of ${town}'s music venues like.`,
    ),
  ).toBeInViewport({ ratio: 1 });
  const picker = page.getByRole("navigation", {
    name: "Same brief, other towns",
  });
  // On a phone the picker follows the poster (WS8, brief item 22).
  if (withPicker)
    for (const link of await picker.getByRole("link").all())
      await expect(link).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole("button", { name: "Watch the AI agent build it" }),
  ).toBeInViewport({ ratio: 1 });
  const poster = page.getByRole("region", { name: "Undercard draft" });
  await expect(
    poster.getByRole("group", { name: "Which bill" }),
  ).toBeInViewport({ ratio: 1 });
  await expect(
    poster.getByRole("heading", { level: 1, name: "Sagebrush Sound" }),
  ).toBeInViewport({ ratio: 1 });
}

test.describe("the first screen above the fold", () => {
  test.skip(SYNTHETIC !== "1", "reads the synthetic saved builds");

  test.describe("on a laptop, 1440x780", () => {
    test.use({ viewport: { width: 1440, height: 780 } });

    for (const { path, town } of PATHS)
      test(`${path}: the lead, the town with each venue's sign and Watch, and the whole poster`, async ({
        page,
      }) => {
        await open(page, path);
        await aboveTheFold(page, town);
        const scene = page.getByRole("region", { name: "Your town" });
        await expect(
          scene.getByText(/Qloo listed (at least )?\d+ live-music places? in /),
        ).toBeInViewport({ ratio: 1 });
        const signs = scene.getByRole("button", {
          name: /\. Show this venue$/,
        });
        await expect(signs).toHaveCount(3);
        for (const sign of await signs.all())
          await expect(sign).toBeInViewport({ ratio: 1 });
        await expect(
          scene.getByRole("group", { name: "Move around the town" }),
        ).toBeInViewport({ ratio: 1 });
        // The poster down to its last act: the headliners, the key and both bands' acts.
        const poster = page.getByRole("region", { name: "Undercard draft" });
        await expect(
          poster.getByRole("list", { name: "Booked headliners" }),
        ).toBeInViewport({ ratio: 1 });
        await expect(
          poster.getByRole("group", { name: "Venue fans used for this draft" }),
        ).toBeInViewport({ ratio: 1 });
        const acts = poster.getByRole("article");
        await expect(acts).toHaveCount(10);
        for (const act of await acts.all())
          await expect(act.getByRole("button")).toBeInViewport({ ratio: 1 });
        // The poster's tools wait below the fold.
        await expect(
          poster.getByRole("button", { name: "Export CSV" }),
        ).not.toBeInViewport();
      });
  });

  // WS8 (the brief's item 15): on a laptop an act's card over the town scrolls inside itself with
  // its head and its actions pinned, so Close, Keep and Unavailable stay in view, in each tier.
  test.describe("an act's card on a laptop, 1440x900", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("Keep, Unavailable and Close stay in view, for an act in each tier", async ({
      page,
    }) => {
      await open(page, "/");
      const poster = page.getByRole("region", { name: "Undercard draft" });
      for (const tier of ["Mid-size acts", "Opening acts"]) {
        const act = poster
          .getByRole("region", { name: tier })
          .getByRole("article")
          .first();
        const name = (await act.getAttribute("aria-label"))!;
        await act.getByRole("button", { name, exact: true }).click();
        const card = page.getByRole("region", { name: "Act card" });
        for (const button of ["Keep", "Unavailable", "Close the card"])
          await expect(
            card.getByRole("button", { name: button, exact: true }),
          ).toBeInViewport({ ratio: 1 });
        await card.getByRole("button", { name: "Close the card" }).click();
      }
    });
  });

  // WS8: a maximized browser on the commonest small laptops shows Watch before any scroll, with
  // the lead, the town picker and the top of the poster; the town is shorter there. 1280x720
  // too, where Watch was still cut off (Daniel, 2026-10-24).
  for (const [width, height] of [
    [1366, 640],
    [1280, 650],
    [1280, 720],
  ] as const)
    test.describe(`on a short laptop, ${width}x${height}`, () => {
      test.use({ viewport: { width, height } });

      for (const { path, town } of PATHS)
        test(`${path}: the lead, the town picker, Watch and the top of the poster`, async ({
          page,
        }) => {
          await open(page, path);
          await aboveTheFold(page, town);
          await expect(
            page.getByRole("region", { name: "Your town" }),
          ).toBeInViewport();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth - window.innerWidth,
            ),
          ).toBeLessThanOrEqual(0);
        });
    });

  // The poster's stamp sits in its corner beside the tabs; on a narrower phone it must not slide
  // under them (WS9's phone pass, at 375 px).
  for (const width of [375, 360])
    test.describe(`on a ${width} px phone`, () => {
      test.use({ viewport: { width, height: 812 } });

      test("the poster's stamp clears its tabs", async ({ page }) => {
        await open(page, "/");
        const stamp = (await page.locator(".poster-stamp").boundingBox())!;
        for (const tab of await page
          .getByRole("group", { name: "Which bill" })
          .getByRole("button")
          .all()) {
          const box = (await tab.boundingBox())!;
          const overlaps =
            stamp.x < box.x + box.width &&
            box.x < stamp.x + stamp.width &&
            stamp.y < box.y + box.height &&
            box.y < stamp.y + stamp.height;
          expect(overlaps).toBe(false);
        }
        await expect(page.locator(".poster-stamp")).toBeInViewport({
          ratio: 1,
        });
      });

      test("the wordmark clears the nav, with room between them", async ({
        page,
      }) => {
        await open(page, "/");
        const banner = page.getByRole("banner");
        const word = (await banner
          .getByRole("link", { name: /^Undercard/ })
          .boundingBox())!;
        const how = (await banner
          .getByRole("link", { name: "How it works" })
          .boundingBox())!;
        expect(how.x - (word.x + word.width)).toBeGreaterThanOrEqual(8);
        await expect(
          banner.getByRole("link", { name: "Your festival" }),
        ).toBeInViewport({ ratio: 1 });
      });
    });

  test.describe("on a phone, 390x664", () => {
    test.use({ viewport: { width: 390, height: 664 } });

    for (const { path, town } of PATHS)
      test(`${path}: the lead, Watch, the top of the poster and its first act`, async ({
        page,
      }) => {
        await open(page, path);
        await aboveTheFold(page, town, false);
        const first = page
          .getByRole("region", { name: "Mid-size acts" })
          .getByRole("article")
          .first();
        await expect(first.getByRole("button")).toBeInViewport({ ratio: 1 });
        // Nothing scrolls sideways.
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          ),
        ).toBeLessThanOrEqual(0);
      });
  });
});
