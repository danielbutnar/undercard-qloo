// Plan.md item 8 (prompt B, the display part): the With and Without Qloo line renders with its
// numbers under the toggle and on How it works (evidence section 31).
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";

test.skip(SYNTHETIC === "empty", "needs a saved build");

const LINE =
  /^Across \d+ towns, .+, and \d+ of the model's \d+ picks pass the tests every Qloo act passes\.$/;

test("the With and Without Qloo line sits under the toggle and on How it works", async ({
  page,
}) => {
  await page.goto("/");
  const toggle = page.getByRole("group", { name: "Which bill" });
  await expect(toggle).toBeVisible();
  await expect(page.getByText(LINE)).toBeVisible();
  await page.goto("/method");
  await expect(
    page.getByRole("region", { name: "What was tested" }).getByText(LINE),
  ).toBeVisible();
});
