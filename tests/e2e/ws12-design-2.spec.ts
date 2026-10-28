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
