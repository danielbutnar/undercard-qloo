// WS12 step 0: the Design 2.0 prototype (/lab/design-2) on the synthetic build (invented acts and
// venues). Only `next dev` serves the lab: elsewhere it answers 404 and these checks skip.
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";

test.describe("Design 2.0 prototype", () => {
  test.skip(SYNTHETIC !== "1", "the checks read the synthetic build");
  // A cold dev server compiles each lab page on its first request.
  test.setTimeout(120_000);
  // The laptop the step's screenshots use: the card opens over the town there.
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the setlist lists every call and circles the first act's; pointing at an act makes the ticket and the circle its own", async ({
    page,
  }) => {
    const response = await page.goto("/lab/design-2");
    test.skip(response?.status() === 404, "the lab runs only under next dev");
    const setlist = page.getByRole("region", {
      name: "The AI agent's setlist",
    });
    await expect(setlist.locator(".d2-set > li")).toHaveCount(12);
    await expect(setlist.locator(".is-circled")).toContainText(
      "The Lantern Room",
    );
    await expect(
      page.getByRole("article", { name: "Hollow Pines's ticket" }),
    ).toBeVisible();
    // The poster is today's: an opening act from the other venue.
    await page.locator('.fs-poster article[aria-label="Owyhee Drift"]').hover();
    await expect(
      page.getByRole("article", { name: "Owyhee Drift's ticket" }),
    ).toBeVisible();
    await expect(setlist.locator(".is-circled")).toContainText(
      "Fort Street Ballroom",
    );
    await expect(setlist.locator(".is-circled")).toContainText("Opening");
    // Today's three panels below the fold are gone.
    await expect(
      page.getByRole("heading", { name: "Switch a venue off" }),
    ).toHaveCount(0);
    // The page ends on who decides, then one way on.
    const end = page.getByRole("region", { name: "Who decides" });
    await expect(end).toContainText("The buyer makes every call.");
    await expect(
      end.getByRole("link", { name: "Draft your own festival" }),
    ).toBeVisible();
  });

  test("How it works plays four scenes, and the venue's switch sends the act back down", async ({
    page,
  }) => {
    const response = await page.goto("/lab/design-2/how-it-works");
    test.skip(response?.status() === 404, "the lab runs only under next dev");
    for (const name of [
      "The headliners' fans alone",
      "+ The Lantern Room's fans",
      "The door check",
      "Onto the poster",
    ])
      await expect(page.getByRole("heading", { name })).toBeVisible();
    const scene = page.getByRole("region", {
      name: "+ The Lantern Room's fans",
    });
    const ranking = scene.getByRole("list", { name: /^Qloo's ranking/ });
    const lit = await ranking.getAttribute("aria-label");
    await scene
      .getByRole("button", { name: /The Lantern Room's fans/ })
      .click();
    await expect(ranking).not.toHaveAttribute("aria-label", lit ?? "");
    await expect(scene).toContainText("no climb, so no slot");
  });

  test("the finished card opens where today's card opens, its actions in view", async ({
    page,
  }) => {
    const response = await page.goto("/lab/design-2/card");
    test.skip(response?.status() === 404, "the lab runs only under next dev");
    const card = page.getByRole("region", { name: "Act card" });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(
      "in Qloo's ranking with The Lantern Room's fans added",
    );
    await expect(card.getByRole("button", { name: "Keep" })).toBeInViewport();
    await expect(
      card.getByRole("button", { name: "Unavailable" }),
    ).toBeInViewport();
  });
});
