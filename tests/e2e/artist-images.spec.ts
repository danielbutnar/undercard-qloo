// Qloo's artist photos on a deployment (Daniel's briefs of 2026-10-21), on WS9's first screen:
// each act's photo from Qloo's image host on its card, named "Photo of" the act, each headliner's
// on the poster where Qloo has one cached, with the credit once; with the image host blocked,
// every picture falls back to its drawn cover. Never an empty grey box.
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";

test.skip(
  SYNTHETIC !== null,
  "the synthetic build has no Qloo images: run against a deployment",
);

const QLOO_IMAGE = /^https:\/\/images\.qloo\.com\//;

test("each act's card shows its Qloo photo, with the credit", async ({
  page,
}) => {
  await page.goto("/");
  const poster = page.getByRole("region", { name: "Undercard draft" });
  const card = page.getByRole("region", { name: "Act card" });
  for (const act of await poster.getByRole("article").all()) {
    const name = (await act.getAttribute("aria-label"))!;
    await act.getByRole("button", { name, exact: true }).click();
    const photo = card.locator("img.cover-photo");
    await expect(photo).toBeVisible();
    expect(await photo.getAttribute("src")).toMatch(QLOO_IMAGE);
    expect(await photo.getAttribute("alt")).toBe(`Photo of ${name}`);
    await card.getByRole("button", { name: "Close the card" }).click();
  }
  await expect(page.getByText("Artist images via Qloo")).toHaveCount(1);
});

test("each headliner shows Qloo's photo or its drawn cover, in a fixed box", async ({
  page,
}) => {
  await page.goto("/");
  const headliners = page.getByRole("list", { name: "Booked headliners" });
  for (const item of await headliners.getByRole("listitem").all()) {
    const picture = item.locator(".poster-head-photo").first();
    await expect(picture).toBeVisible();
    const photo = picture.locator("img.cover-photo");
    if (await photo.count())
      expect(await photo.getAttribute("src")).toMatch(QLOO_IMAGE);
    else await expect(picture.locator("svg.sleeve")).toBeVisible();
  }
  await expect(page.locator(".sleeve-blank")).toHaveCount(0);
});

// Daniel's brief of 2026-10-22, item 5: no picture is ever an empty grey box, Watch included.
test("Watch keeps every picture a photo or a drawn cover", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Watch the AI agent build it" })
    .click();
  await expect(page.getByText(/^\+ .+'s fans$/).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator(".sleeve-blank")).toHaveCount(0);
  for (const picture of await page.locator(".poster-head-photo").all())
    await expect(
      picture.locator("img.cover-photo, svg.sleeve").first(),
    ).toBeAttached();
});

test("with Qloo's image host blocked, every picture shows its drawn cover", async ({
  page,
}) => {
  await page.route("https://images.qloo.com/**", (route) => route.abort());
  await page.goto("/");
  const poster = page.getByRole("region", { name: "Undercard draft" });
  await expect(poster.getByRole("article").first()).toBeVisible();
  await expect(page.locator("img.cover-photo")).toHaveCount(0);
  for (const picture of await page.locator(".poster-head-photo").all())
    await expect(picture.locator("svg.sleeve")).toBeVisible();
  const first = poster.getByRole("article").first();
  const name = (await first.getAttribute("aria-label"))!;
  await first.getByRole("button", { name, exact: true }).click();
  const card = page.getByRole("region", { name: "Act card" });
  await expect(card.locator("img.cover-photo")).toHaveCount(0);
  await expect(card.locator("svg.sleeve").first()).toBeVisible();
});
