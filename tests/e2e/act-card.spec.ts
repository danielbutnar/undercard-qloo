// WS12 item 3: the finished act card on the landing, where it opens (over the town on a laptop).
// It makes the checks step 0's prototype card test made (tests/e2e/ws12-design-2.spec.ts), on
// the real card: one card, its rank beside its climb with its venue's fans added, its popularity
// on its tier's scale, Keep and Unavailable in view.
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";

test.describe("the act card, finished", () => {
  test.skip(SYNTHETIC !== "1", "reads the synthetic build's first act");
  test.use({ viewport: { width: 1440, height: 900 } });

  test("opens over the town with its rank beside its climb, its actions in view", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("region", { name: "Undercard draft" })
      .getByRole("button", { name: "Hollow Pines", exact: true })
      .click();
    const card = page.getByRole("region", { name: "Act card" });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(
      "in Qloo's ranking with The Lantern Room's fans added",
    );
    await expect(
      card.getByRole("img", { name: /on the mid-size tier's scale/ }),
    ).toBeVisible();
    await expect(card.getByRole("button", { name: "Keep" })).toBeInViewport();
    await expect(
      card.getByRole("button", { name: "Unavailable" }),
    ).toBeInViewport();
  });
});
