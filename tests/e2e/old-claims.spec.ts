// Daniel's brief of 2026-10-22: before the test with real people, the words that claimed more
// than docs/evidence.md allows are gone from every screen a tester sees. Each check reads the
// page as it renders, screen-reader-only text included, since some of the words came from
// templates.
import { expect, test, type Page } from "@playwright/test";
import { SYNTHETIC } from "./env";

/** The retired words, each under the item of the brief that retired it. */
const RETIRED: Record<string, RegExp> = {
  "item 1, the card's badge": /fans like it/,
  "item 1, the card's Why line": /Why Boise/,
  // A town's crowd stays (the evidence page's limits name it); a venue's is retired.
  "item 2, a row's words for a screen reader": /(?<!town)'s crowd/,
  "item 3, the first screen's line":
    /the AI agent (drafted|will draft) the rest/,
  "item 3, the footer": /Drafted by the AI agent/,
  "item 4, the model's cards": /No Boise venue|fee range not checked/,
  "item 6, the evidence page": /too thin to build on/,
};

async function expectNoneOnScreen(page: Page) {
  const text = await page.locator("body").innerText();
  for (const [item, words] of Object.entries(RETIRED))
    expect(text, item).not.toMatch(words);
}

const bill = (page: Page) =>
  page.getByRole("region", { name: "Undercard draft" });

test.describe("the retired words", () => {
  test("the evidence page", async ({ page }) => {
    await page.goto("/method/evidence");
    await expect(
      page.getByRole("heading", { level: 1, name: "The evidence" }),
    ).toBeVisible();
    await expectNoneOnScreen(page);
  });

  test.describe("on the saved build", () => {
    test.skip(SYNTHETIC === "empty", "needs a saved build");

    test("the first screen", async ({ page }) => {
      await page.goto("/");
      await expect(bill(page).getByRole("article")).toHaveCount(10);
      await expectNoneOnScreen(page);
    });

    test("every act's card", async ({ page }) => {
      await page.goto("/");
      const card = page.getByRole("region", { name: "Act card" });
      for (const act of await bill(page).getByRole("article").all()) {
        const name = (await act.getAttribute("aria-label"))!;
        await act.getByRole("button", { name, exact: true }).click();
        await expect(
          card.getByRole("article", { name, exact: true }),
        ).toBeVisible();
        await expectNoneOnScreen(page);
        await card.getByRole("button", { name: "Close the card" }).click();
      }
    });

    test("Watch, while it plays and after", async ({ page }) => {
      await page.goto("/");
      await page
        .getByRole("button", { name: "Watch how it picked these acts" })
        .click();
      await expect(page.getByText(/^Replayed the build saved/)).toBeVisible({
        timeout: 30_000,
      });
      // On a deployment the venues' editions play now; the synthetic build has none.
      await expectNoneOnScreen(page);
      const skip = bill(page).getByRole("button", {
        name: "Skip to the lineup",
      });
      if (await skip.isVisible()) await skip.click();
      await expect(bill(page).getByRole("article")).toHaveCount(10);
      await expectNoneOnScreen(page);
    });

    test("Without Qloo", async ({ page }) => {
      test.setTimeout(90_000);
      await page.goto("/");
      await page
        .getByRole("button", {
          name: "Without Qloo: an AI model's picks alone",
        })
        .click();
      await expect(
        page
          .getByRole("region", {
            name: "Without Qloo: an AI model's picks alone",
          })
          .getByRole("article")
          .first(),
      ).toBeVisible({ timeout: 60_000 });
      await expectNoneOnScreen(page);
    });
  });
});
