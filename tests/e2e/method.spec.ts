// M9c: the method page, one click from the lineup; the video loads only when played.
import { expect, test } from "@playwright/test";

test("How it works opens the method page, with the five objections and no video loaded", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "How it works" }).click();
  await expect(page).toHaveURL(/\/method$/, { timeout: 30_000 });
  await expect(page.getByRole("img", { name: /How Undercard drafts a lineup/ })).toBeVisible();
  for (const question of [
    "Does the town know these acts?",
    "Why venues?",
    "Why trust a pick?",
  ])
    await expect(page.getByRole("region", { name: question })).toBeVisible();
  await expect(page.locator("video, iframe")).toHaveCount(0);
  await page.getByRole("link", { name: "Back to the lineup" }).click();
  await expect(page.getByRole("region", { name: "Undercard draft" })).toBeVisible();
});
