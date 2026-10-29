// Plan.md item 8 (prompt B, the display part): the With and Without Qloo line renders with its
// numbers on How it works (evidence section 31); since prompt-4 the toggle carries the line that
// counts each check.
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";

test.skip(SYNTHETIC === "empty", "needs a saved build");

// Recounted from the 2.0 re-runs (Daniel, 29 Oct): the shared acts only, in How it works' fold.
const LINE = /^Across \d+ towns, the model alone and Qloo share [^,]+, in [^,]+\.$/;
// Prompt-4: under the toggle, the line counts each check.
const CHECKS_LINE =
  /^Across \d+ towns, the model alone picked \d+ acts; Qloo found \d+ of them\. Of those \d+, \d+ sit above the fee range, and \d+ share two genres with the headliners\.$/;

test("the per-check line sits under the toggle, and the With and Without Qloo line on How it works", async ({
  page,
}) => {
  await page.goto("/");
  const toggle = page.getByRole("group", { name: "Which bill" });
  await expect(toggle).toBeVisible();
  await expect(page.getByText(CHECKS_LINE)).toBeVisible();
  await expect(page.getByText(LINE)).toHaveCount(0);
  await page.goto("/method");
  // Daniel, 29 Oct: the line moved out of the stamps into the method fold under them.
  const tested = page.getByRole("region", { name: "What was tested" });
  await tested.getByText("The method", { exact: true }).click();
  await expect(tested.getByText(LINE)).toBeVisible();
});
