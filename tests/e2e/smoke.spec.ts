// The daily smoke test (plan.md item 2, prompt A part 3), run by .github/workflows/smoke.yml
// against production: the five things a judge meets first, and that the first screen is still
// the saved build of 17 October, with no live Qloo build. Replays and saved builds only, so it
// spends nothing.
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";

test.skip(
  !process.env.E2E_BASE_URL,
  "runs against a deployment: set E2E_BASE_URL",
);

test("the home page shows Boise's ten acts", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Undercard draft" }).getByRole("article"),
  ).toHaveCount(10);
});

// Live runs no longer replace the saved builds (Daniel's brief of 2026-10-21, night), so the
// first screen stays the build the video, the stills and docs/evidence.md describe.
test("the home page still opens on the build saved Oct 17, 12:13 UTC", async ({
  page,
}) => {
  test.skip(
    SYNTHETIC !== null,
    "a local production build serves the synthetic build",
  );
  await page.goto("/");
  await expect(
    page
      .getByRole("region", { name: "Undercard draft" })
      .getByText("saved Oct 17, 12:13 UTC"),
  ).toBeVisible();
});

test("Watch reaches its last call within 30 seconds", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Watch the AI agent build it" })
    .click();
  await expect(page.getByText(/^Replayed the build saved/)).toBeVisible({
    timeout: 30_000,
  });
});

test("Your festival loads with the 29 checked towns", async ({ page }) => {
  await page.goto("/your-festival");
  await expect(
    page
      .getByRole("list", { name: "Towns Undercard has already read" })
      .getByRole("button"),
  ).toHaveCount(29);
});

test("a saved town other than Boise replays its lineup", async ({ page }) => {
  await page.goto("/towns/austin");
  await expect(
    page.getByRole("region", { name: "Undercard draft" }).getByRole("article"),
  ).toHaveCount(10, { timeout: 30_000 });
});

test("the evidence page opens on its three summary lines", async ({ page }) => {
  await page.goto("/method/evidence");
  const lines = page
    .getByRole("region", { name: "Evidence" })
    .getByRole("listitem");
  for (const [index, word] of ["Shown", "Partly shown", "Not shown"].entries())
    await expect(lines.nth(index)).toContainText(`${word}:`);
});
