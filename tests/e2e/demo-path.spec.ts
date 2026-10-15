// The demo path from SPEC.md section 3, step by step. Later milestones add steps 4 and 5.
// Steps 2 and 3 run a real build: they call Qloo and Claude through the app's server.
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

  test("steps 2 and 3: Build undercard traces every Qloo call, then fills 4 Mid and 6 Opener slots", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await page.goto("/");
    await page.getByRole("button", { name: "Build undercard" }).click();

    // Step 2: the trace streams the agent's Qloo calls with parameters and result counts.
    const trace = page.getByRole("list", { name: "Qloo calls" });
    const rows = trace.locator(":scope > li");
    await expect(rows.first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/^Built with \d+ Qloo calls in/)).toBeVisible({
      timeout: 140_000,
    });
    await expect(trace).toContainText('Search for "Khruangbin"');
    await expect(trace).toContainText('Search for "Japanese Breakfast"');
    await expect(trace).toContainText("Boise places tagged");
    await expect(trace).toContainText("artists for the headliners alone");
    await expect(trace).toContainText("artists for the headliners and");
    const callCount = await rows.count();
    expect(callCount).toBeGreaterThanOrEqual(9);
    expect(callCount).toBeLessThanOrEqual(12);
    await expect(trace.getByLabel(/^\d+ results$/)).toHaveCount(callCount);

    const venueRow = rows
      .filter({ hasText: "artists for the headliners and" })
      .first();
    await venueRow.getByRole("button", { name: "Parameters" }).click();
    await expect(venueRow).toContainText("filter.type=urn:entity:artist");
    await expect(venueRow).toContainText(
      "signal.interests.entities=Khruangbin, Japanese Breakfast, ",
    );

    // Step 3: the board fills; every card carries Qloo's numbers and its local link.
    await expect(
      page.getByRole("region", { name: /^Mid/ }).getByRole("article"),
    ).toHaveCount(4);
    await expect(
      page.getByRole("region", { name: /^Opener/ }).getByRole("article"),
    ).toHaveCount(6);
    for (const card of await page.getByRole("article").all()) {
      await expect(card).toContainText("Qloo affinity");
      // Card text runs together ("affinity0.94Popularity86th"), so no word boundaries.
      await expect(card).toContainText(/affinity0\.\d\d/);
      await expect(card).toContainText(/Popularity\d{1,2}(st|nd|rd|th)/);
      await expect(card).toContainText(
        /Why Boise: .+ fans move it (up \d+ places|into the top \d+)\./,
      );
      await expect(
        card
          .getByRole("list", { name: "Tags shared with the headliners" })
          .getByRole("listitem"),
      ).toHaveCount(2);
    }
  });
});
