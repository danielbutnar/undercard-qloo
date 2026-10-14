// The demo path from SPEC.md section 3, step by step. Later milestones add steps 2 to 5.
import { expect, test } from "@playwright/test";

test.describe("demo path", () => {
  test("step 1: Sagebrush Sound loads with its headliners, fee bands and presale, no login", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Sagebrush Sound" }),
    ).toBeVisible();
    await expect(
      page.getByText("Boise, Idaho · 3,000 capacity · crowd aged 25–34"),
    ).toBeVisible();

    const headliners = page.getByRole("list", { name: "Booked headliners" });
    await expect(headliners.getByRole("listitem")).toHaveText([
      "Khruangbin",
      "Japanese Breakfast",
    ]);

    await expect(page.getByRole("region", { name: /^Mid/ })).toBeVisible();
    await expect(page.getByRole("region", { name: /^Opener/ })).toBeVisible();
    await expect(
      page.getByText("4 slots · popularity 80th–92nd percentile"),
    ).toBeVisible();
    await expect(
      page.getByText("6 slots · popularity 55th–80th percentile"),
    ).toBeVisible();

    const sparkline = page.getByRole("img", {
      name: /Presale over the last 30 days/,
    });
    await expect(sparkline).toBeVisible();
    await expect(sparkline.locator("polyline")).toHaveCount(1);

    await expect(
      page.getByRole("button", { name: "Build undercard" }),
    ).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });
});
