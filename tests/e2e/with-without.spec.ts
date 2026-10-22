// Plan.md item 8 (prompt B, the display part): the With and Without Qloo line renders with its
// numbers on How it works (evidence section 31); since prompt-4 the toggle carries the line that
// counts each check.
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";

test.skip(SYNTHETIC === "empty", "needs a saved build");

const LINE =
  /^Across \d+ towns, .+, and \d+ of the model's \d+ picks pass the tests every Qloo act passes\.$/;
// Prompt-4: under the toggle, the line counts each check.
const CHECKS_LINE =
  /^Across \d+ towns, \d+ of the model's \d+ picks share two genres with the headliners, \d+ of the \d+ Qloo finds sit above the fee range, and \d+ climb with a town venue's fans, a check only Qloo data can pass\.$/;

test("the per-check line sits under the toggle, and the With and Without Qloo line on How it works", async ({
  page,
}) => {
  await page.goto("/");
  const toggle = page.getByRole("group", { name: "Which bill" });
  await expect(toggle).toBeVisible();
  await expect(page.getByText(CHECKS_LINE)).toBeVisible();
  await expect(page.getByText(LINE)).toHaveCount(0);
  await page.goto("/method");
  await expect(
    page.getByRole("region", { name: "What was tested" }).getByText(LINE),
  ).toBeVisible();
});
