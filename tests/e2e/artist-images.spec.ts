// Qloo's artist photos on a deployment (Daniel's briefs of 2026-10-21): each lineup row shows
// its act's photo from Qloo's image host, named "Photo of" the act, with the credit under the
// lineup; with the image host blocked, every row falls back to its drawn cover.
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";

test.skip(
  SYNTHETIC !== null,
  "the synthetic build has no Qloo images: run against a deployment",
);

test("the lineup's rows show each act's Qloo photo, with the credit", async ({
  page,
}) => {
  await page.goto("/");
  const mid = page.getByRole("region", { name: "Mid-size acts" });
  const photos = mid.locator("article img.cover-photo");
  await expect(photos.first()).toBeVisible();
  for (const photo of await photos.all()) {
    expect(await photo.getAttribute("src")).toMatch(
      /^https:\/\/images\.qloo\.com\//,
    );
    expect(await photo.getAttribute("alt")).toMatch(/^Photo of .+/);
  }
  await expect(page.getByText("Artist images via Qloo")).toHaveCount(1);
});

test("with Qloo's image host blocked, every row shows its drawn cover", async ({
  page,
}) => {
  await page.route("https://images.qloo.com/**", (route) => route.abort());
  await page.goto("/");
  const rows = page
    .getByRole("region", { name: "Mid-size acts" })
    .getByRole("article");
  await expect(rows.first()).toBeVisible();
  await expect(page.locator("article img.cover-photo")).toHaveCount(0);
  for (const row of await rows.all())
    await expect(row.locator(".row-sleeve")).toBeVisible();
});
