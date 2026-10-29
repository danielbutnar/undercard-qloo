// The first screen on a phone (Daniel's brief of 2026-10-21, and WS9's layout brief). A phone's
// browser keeps part of its 844 px for its own bars: Safari on a 390x844 iPhone shows about 664 of
// them with its bars in view (an estimate, not measured on a device), so the fold checks run at
// 390x664. WS9's layout brief puts the lead, the town picker and Watch first, then the poster,
// whose top shows before any scroll (its own phone shot sets the first act below 664 px).
import { expect, test } from "@playwright/test";
import { roomShortName } from "../../src/lib/marks";
import { SYNTHETIC } from "./env";

test.describe("the first screen on a phone", () => {
  test.skip(SYNTHETIC === "empty", "the empty board has no act");

  test.describe("with the browser's bars in view", () => {
    test.use({ viewport: { width: 390, height: 664 } });

    // Daniel's decision of 2026-10-21 (brief item 22), restored by WS8 from c9064aa: the first
    // act's name shows before any scroll, and Watch with it.
    test("shows the first act's name before any scroll", async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      const first = page
        .getByRole("region", { name: "Mid-size acts" })
        .getByRole("article")
        .first();
      await expect(first.getByRole("button")).toBeInViewport({ ratio: 1 });
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
    });
  });

  // Daniel's second batch of 2026-10-22, item 5: on a 375 px phone an act's card names a long
  // venue by its short name ("V418"), so the line fits in two lines; the card's climb line keeps
  // the full name.
  test.describe("at 375x812", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("an act's card names a long venue by its short name", async ({
      page,
    }) => {
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      const card = page.getByRole("region", { name: "Act card" });
      let shortened = 0;
      for (const act of await page
        .getByRole("region", { name: "Undercard draft" })
        .getByRole("article")
        .all()) {
        const name = (await act.getAttribute("aria-label"))!;
        await act.getByRole("button", { name, exact: true }).click();
        const opened = card.getByRole("article", { name, exact: true });
        const [, full] = /^in Qloo's ranking with (.+)'s fans added$/.exec(
          await opened.locator(".card-rank-with").innerText(),
        )!;
        const short = roomShortName(full);
        const line = opened.locator(".card-venue");
        await expect(line).toHaveText(`Climbs with ${short}'s fans added`, {
          useInnerText: true,
        });
        if (short !== full) {
          shortened += 1;
          const lines = await line.evaluate(
            (element) =>
              element.getBoundingClientRect().height /
              parseFloat(getComputedStyle(element).lineHeight),
          );
          expect(Math.round(lines)).toBeLessThanOrEqual(2);
        }
        await card.getByRole("button", { name: "Close the card" }).click();
      }
      expect(shortened).toBeGreaterThan(0);
    });
  });

  test.describe("at 390x844", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    // WS9: each band says its Qloo popularity range in plain words, our stand-in for fee.
    test("says each band's popularity range in plain words, and scrolls no wider than the phone", async ({
      page,
    }) => {
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await expect(
        page
          .getByRole("region", { name: "Mid-size acts" })
          .getByText(/^· Qloo popularity \d+–\d+, our stand-in for fee$/),
      ).toBeVisible();
      await expect(
        page
          .getByRole("region", { name: "Opening acts" })
          .getByText(/^· Qloo popularity \d+–\d+$/),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
      ).toBeLessThanOrEqual(0);
    });

    // Plan.md item 3: Watch keeps the AI agent's line on a phone, the agent's own words from the
    // saved trace, or one fixed line on what it decides where the trace has none.
    test("Watch shows the AI agent's line for each venue", async ({ page }) => {
      test.skip(
        SYNTHETIC !== null,
        "the synthetic build has no venue editions to watch",
      );
      await page.goto("/");
      await page
        .getByRole("button", { name: "Watch the AI agent build it" })
        .click();
      const bill = page.getByRole("region", { name: "Undercard draft" });
      await expect(bill.getByText(/^\+ .+'s fans$/).first()).toBeVisible({
        timeout: 30_000,
      });
      // WS2: the agent's line is labelled "The AI agent's plan:".
      await expect(
        bill
          .getByText(/^The AI agent('s plan: | chose which venues to read)/)
          .first(),
      ).toBeVisible();
    });
  });
});
