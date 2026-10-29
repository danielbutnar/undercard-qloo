// M9c, M10b and WS12 item 2: How it works, one click from the lineup, as the director's cut of
// Watch; the video loads only when played; the evidence and the five objections are one click on.
import { expect, test } from "@playwright/test";

test("How it works plays Watch in four scenes, with the evidence a click away and no video loaded", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Other screens" })
    .getByRole("link", { name: "How it works" })
    .click();
  await expect(page).toHaveURL(/\/method$/, { timeout: 30_000 });
  // The director's cut: four scenes made of the landing's own objects.
  for (const n of [1, 2, 3, 4])
    await expect(
      page.getByRole("region", { name: new RegExp(`^Scene ${n}: `) }),
    ).toBeVisible();
  await expect(page.locator("video, iframe")).toHaveCount(0);

  // The venue's switch inside scene 2: off, the act stays where the headliners' fans put it.
  const two = page.getByRole("region", { name: /^Scene 2: / });
  const toggle = two.getByRole("button", { name: /'s fans/ });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(two).toContainText("no climb, so no slot");

  // The evidence and the five objections, on their own page.
  await page.getByRole("link", { name: /^The evidence/ }).click();
  await expect(page).toHaveURL(/\/method\/evidence$/, { timeout: 30_000 });
  for (const question of [
    "Does the town know these acts?",
    "Why venues?",
    "Why trust a pick?",
  ])
    await expect(page.getByRole("region", { name: question })).toBeVisible();
  await page.getByRole("link", { name: "Back to How it works" }).click();
  await expect(page).toHaveURL(/\/method$/, { timeout: 30_000 });
  await page.getByRole("link", { name: "Back to the lineup" }).click();
  await expect(
    page.getByRole("region", { name: "Undercard draft" }),
  ).toBeVisible();
});

test("a scene's old step link opens How it works on that scene, in view", async ({
  page,
}) => {
  await page.goto("/method?step=3");
  await expect(page.getByRole("region", { name: /^Scene 3: / })).toBeInViewport({
    timeout: 30_000,
  });
});
