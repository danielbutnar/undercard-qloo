// M9c and M10b: How it works, one click from the lineup; the video loads only when played; one
// act is followed through the saved build; the evidence and the five objections are one click on.
import { expect, test } from "@playwright/test";

test("How it works follows one act through the saved build, with the evidence a click away and no video loaded", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("banner")
    .getByRole("link", { name: "How it works" })
    .click();
  await expect(page).toHaveURL(/\/method$/, { timeout: 30_000 });
  await expect(
    page.getByRole("img", { name: /How Undercard drafts a lineup/ }),
  ).toBeVisible();
  await expect(page.locator("video, iframe")).toHaveCount(0);

  // One act, a step at a time: its row climbs, the rule checks it, it lands on the lineup.
  const follow = page.getByRole("region", { name: "Follow one act" });
  await expect(follow.getByRole("article").first()).toBeVisible();
  for (let step = 0; step < 3; step++)
    await follow.getByRole("button", { name: "Next step" }).click();
  await expect(
    follow.getByRole("region", { name: "Mid-size acts" }),
  ).toBeVisible();
  await expect(
    follow.getByRole("button", { name: "Next step" }),
  ).toBeDisabled();
  await expect(
    follow.getByRole("region", { name: "The AI agent's choices" }),
  ).toContainText(/acts? lifted|lifted none/);

  // Try it: the followed act's venue off, and the acts its fans lifted leave.
  const tryIt = page.getByRole("region", { name: "Try it" });
  const toggle = tryIt.getByRole("switch");
  await expect(toggle).toHaveAttribute("aria-checked", "true", {
    timeout: 30_000,
  });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(tryIt).toContainText(
    /^.*Without .+'s fans, .+ leaves? the lineup/,
  );

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
