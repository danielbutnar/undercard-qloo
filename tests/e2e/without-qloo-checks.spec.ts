// Daniel's brief of 2026-10-22 (prompt-4), step 4: on the Without Qloo view, every one of the
// model's picks shows how Qloo's cached data places it, the toggle's line counts each check, and
// a pick the Qloo cache doesn't hold says "not checked". The synthetic build's picks and their
// Qloo answers are invented (tests/e2e/synthetic-build.ts); the server reads them from its
// seeded cache and never reaches Qloo or the model.
import { expect, test, type Page } from "@playwright/test";
import { SYNTHETIC } from "./env";
import { SYNTHETIC_UNCHECKED_PICK, syntheticLlmOnly } from "./synthetic-build";

test.skip(SYNTHETIC === "empty", "needs a saved build");

const CHECK_LINE =
  /^Picked without Qloo; (on Qloo: popularity \d+\/100, (in|above|below) the (mid-size|opening) range · (no genres|1 genre|\d+ genres) shared · (a climb with one of|no climb with) .+'s venues|not found on Qloo|not checked on Qloo)$/;
const CHECKS_LINE =
  /^Across \d+ towns, the model alone picked \d+ acts; Qloo found \d+ of them\. Of those \d+, \d+ sit above the fee range, and \d+ share two genres with the headliners\.$/;

async function withoutQloo(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Without Qloo: an AI model's picks alone" })
    .click();
  const model = page.getByRole("region", {
    name: "Without Qloo: an AI model's picks alone",
  });
  const picks = model.getByRole("article");
  await expect(picks.first()).toBeVisible({ timeout: 60_000 });
  return { model, picks };
}

test("every Without Qloo card shows its check line, and the toggle's line counts each check", async ({
  page,
}) => {
  const { model, picks } = await withoutQloo(page);
  const count = await picks.count();
  expect(count).toBeGreaterThan(0);
  for (const pick of await picks.all()) {
    const line = pick.locator("p.pick-none");
    await expect(line).toHaveCount(1);
    await expect(line).toHaveText(CHECK_LINE);
  }
  await expect(model).not.toContainText("no venue data, no fee check");
  await expect(page.getByText(CHECKS_LINE)).toBeVisible();
});

test("on the synthetic build, a pick missing from the Qloo cache says not checked; the others are read", async ({
  page,
}) => {
  test.skip(SYNTHETIC !== "1", "the synthetic build's invented Qloo answers");
  const { picks } = await withoutQloo(page);
  const names = syntheticLlmOnly().lineup.picks.map((pick) => pick.name);
  await expect(picks).toHaveCount(names.length);
  const line = (name: string) =>
    page.getByRole("article", { name, exact: true }).locator("p.pick-none");

  await expect(line(SYNTHETIC_UNCHECKED_PICK)).toHaveText(
    "Picked without Qloo; not checked on Qloo",
  );
  for (const name of names.filter((n) => n !== SYNTHETIC_UNCHECKED_PICK))
    await expect(line(name)).not.toHaveText(/not checked/);
  await expect(line("Velvet Coyote")).toHaveText(
    "Picked without Qloo; on Qloo: popularity 96/100, above the mid-size range · 2 genres shared · no climb with Boise's venues",
  );
  await expect(line("Marigold Static")).toHaveText(
    "Picked without Qloo; on Qloo: popularity 86/100, in the mid-size range · 2 genres shared · a climb with one of Boise's venues",
  );
  await expect(line("Fern & Fable")).toHaveText(
    "Picked without Qloo; not found on Qloo",
  );
});
