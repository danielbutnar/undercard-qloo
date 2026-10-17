// M6h: a pre-filled Your festival link fills the form and starts nothing. Mail clients and link
// previews open links by themselves, so a run waits for the visitor's press.
import { expect, test } from "@playwright/test";

test("a pre-filled link fills the form and runs nothing", async ({ page }) => {
  const builds: string[] = [];
  await page.route("**/api/undercard", async (route) => {
    builds.push(route.request().postData() ?? "");
    await route.abort();
  });
  await page.goto(
    "/your-festival?town=Tallinn&region=Estonia&headliner=Khruangbin&headliner=Japanese%20Breakfast",
  );
  const form = page.locator("form");
  await expect(form.getByLabel("Town", { exact: true })).toHaveValue("Tallinn");
  await expect(
    form.getByLabel("State or country", { exact: true }),
  ).toHaveValue("Estonia");
  await expect(form.getByLabel("First headliner", { exact: true })).toHaveValue(
    "Khruangbin",
  );
  await expect(
    form.getByLabel("Second headliner", { exact: true }),
  ).toHaveValue("Japanese Breakfast");
  await expect(form.getByText(/Filled in from your link/)).toBeVisible();

  // Give a run every chance to start on its own; none may.
  await page.waitForTimeout(2000);
  expect(builds).toHaveLength(0);
  await expect(
    page.getByRole("region", { name: "Undercard draft" }),
  ).toHaveCount(0);
  await expect(
    form.getByRole("button", { name: "Draft my undercard" }),
  ).toBeVisible();
});
