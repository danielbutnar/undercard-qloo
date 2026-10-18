// M9b: town against town, one click from the bill. Locally every town's synthetic build is the
// same, so all acts are on both lineups; on a deployment Boise and Austin share some and not others.
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";

test("the bill links to two towns side by side, each act marked shared or only here", async ({
  page,
}) => {
  test.skip(SYNTHETIC === "empty", "needs saved builds");
  await page.goto("/");
  await page
    .getByRole("region", { name: "Undercard draft" })
    .getByRole("link", { name: "Compare with another town" })
    .click();
  await expect(page).toHaveURL(/\/compare$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Boise against Austin",
  );
  const boise = page.getByRole("region", { name: "Boise, Idaho" });
  const austin = page.getByRole("region", { name: "Austin, Texas" });
  await expect(boise.getByRole("listitem")).toHaveCount(10);
  await expect(austin.getByRole("listitem")).toHaveCount(10);
  if (!SYNTHETIC) {
    await expect(boise.getByText("On both lineups").first()).toBeVisible();
    await expect(boise.getByText("Only in Boise").first()).toBeVisible();
    await expect(austin.getByText("Only in Austin").first()).toBeVisible();
  }
  await page
    .getByRole("navigation", { name: "Compare with another town" })
    .getByRole("link", { name: "Denver, Colorado, United States" })
    .click();
  await expect(page.getByRole("region", { name: "Denver, Colorado" })).toBeVisible({
    timeout: 30_000,
  });
});
