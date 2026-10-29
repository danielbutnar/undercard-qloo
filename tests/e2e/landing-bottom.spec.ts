// WS12 item 1: the landing's lower half, in a real browser. It makes the checks step 0's
// prototype landing test made (tests/e2e/ws12-design-2.spec.ts, removed with the prototype's
// landing in 110b2c2), on the real page: every call on the setlist, the first act's call ringed,
// a hover on the poster making the ticket and the ring another act's, the second venue switch
// gone, and the page's last line.
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";
import { syntheticSavedBuild } from "./synthetic-build";

test.describe("the landing's lower half", () => {
  test.skip(SYNTHETIC !== "1", "reads the synthetic build");
  test.use({ viewport: { width: 1440, height: 900 } });

  test("lists every call, rings the first act's, and follows the act pointed at", async ({
    page,
  }) => {
    await page.goto("/");
    const setlist = page.getByRole("region", {
      name: "The AI agent's setlist",
    });
    await expect(
      setlist
        .getByRole("list", { name: "The calls, in order" })
        .getByRole("listitem"),
    ).toHaveCount(syntheticSavedBuild().trace.length);
    const ring = setlist.locator(".setlist-item.is-circled");
    await expect(ring).toContainText("The Lantern Room");
    await expect(
      page.getByRole("article", { name: "Hollow Pines's ticket" }),
    ).toBeVisible();

    // A real pointer over an opening act from the other venue.
    await page
      .getByRole("region", { name: "Undercard draft" })
      .locator('article[aria-label="Owyhee Drift"]')
      .hover();
    await expect(
      page.getByRole("article", { name: "Owyhee Drift's ticket" }),
    ).toBeVisible();
    await expect(ring).toContainText("Fort Street Ballroom");
    await expect(ring).toContainText("Opening");

    await expect(
      page.getByRole("heading", { name: "Switch a venue off" }),
    ).toHaveCount(0);
    const end = page.getByRole("region", { name: "Who decides" });
    await expect(end).toContainText("The buyer makes every call.");
    await expect(
      end.getByRole("link", { name: "Draft your own festival" }),
    ).toBeVisible();
  });
});
