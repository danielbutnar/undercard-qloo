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

async function aboveTheFold(page: Page, town: string) {
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
          scene.getByText(/Qloo found \d+ live-music venues in /),
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

  test.describe("on a phone, 390x664", () => {
    test.use({ viewport: { width: 390, height: 664 } });

    for (const { path, town } of PATHS)
      test(`${path}: the lead, the town picker, Watch and the top of the poster`, async ({
        page,
      }) => {
        await open(page, path);
        await aboveTheFold(page, town);
        // Nothing scrolls sideways.
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          ),
        ).toBeLessThanOrEqual(0);
      });
  });
});
