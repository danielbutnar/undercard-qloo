// The demo path from SPEC.md section 3, step by step, against a running app. A build replays
// the saved build when there is one; otherwise it runs the agent, which calls Qloo and Claude.
// The refill (step 4) calls Qloo; LLM only (step 5) calls Claude the first time.
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const BUILD_TIMEOUT = 140_000;

async function buildBoard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Build undercard" }).click();
  await expect(page.getByRole("article")).toHaveCount(10, {
    timeout: BUILD_TIMEOUT,
  });
  await expect(
    page.getByText(/^(Built with \d+ Qloo calls|Replayed the build saved)/),
  ).toBeVisible({
    timeout: BUILD_TIMEOUT,
  });
}

const traceRows = (page: Page) =>
  page.getByRole("list", { name: "Qloo calls" }).locator(":scope > li");

test.describe("demo path", () => {
  test.describe.configure({ mode: "serial" });

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
    await buildBoard(page);

    // Step 2: the trace lists the agent's Qloo calls with parameters and result counts.
    const trace = page.getByRole("list", { name: "Qloo calls" });
    const rows = traceRows(page);
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

  test("step 4: Unavailable refills the slot from the same fee band with a new Qloo call", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await buildBoard(page);
    const mid = page.getByRole("region", { name: /^Mid/ });
    const first = mid.getByRole("article").first();
    const gone = (await first.getAttribute("aria-label"))!;
    const before = await traceRows(page).count();

    await first.getByRole("button", { name: "Unavailable" }).click();

    // The new card swaps into the same slot, in the same band.
    await expect(
      page.getByRole("article", { name: gone, exact: true }),
    ).toHaveCount(0, { timeout: 60_000 });
    await expect(mid.getByRole("article")).toHaveCount(4);
    await expect(mid.getByRole("article").first()).toContainText(
      /Why Boise: .+ fans move it/,
    );

    // The refill shows in the trace: at most 3 new Qloo calls, excluding the board.
    const added = (await traceRows(page).count()) - before;
    expect(added).toBeGreaterThanOrEqual(1);
    expect(added).toBeLessThanOrEqual(3);
    await expect(page.getByText(/· [123] refill calls?$/)).toBeVisible();
    const refillRow = traceRows(page)
      .filter({ hasText: "Refill: Mid-band artists" })
      .last();
    await refillRow.getByRole("button", { name: "Parameters" }).click();
    await expect(refillRow).toContainText("filter.exclude.entities=");
    await expect(refillRow).toContainText(gone);
  });

  test("step 5: LLM only shows a lineup labeled No Qloo data; the Poster typesets by band and exports CSV", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await buildBoard(page);

    await page.getByRole("button", { name: "LLM only" }).click();
    const llm = page.getByRole("region", { name: /LLM only/ });
    await expect(llm.getByText("No Qloo data")).toBeVisible();
    const picks = llm.getByRole("article");
    await expect(picks.first()).toBeVisible({ timeout: 60_000 });
    for (const pick of await picks.all()) {
      await expect(pick).toContainText("Why Boise: No local link.");
      await expect(pick).not.toContainText(/affinity0\.\d\d/);
    }
    await expect(page.getByRole("region", { name: /^Mid/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Qloo" }).click();
    await expect(
      page.getByRole("region", { name: /^Mid/ }).getByRole("article"),
    ).toHaveCount(4);

    await page.getByRole("button", { name: "Poster" }).click();
    const poster = page.getByRole("region", { name: "Poster" });
    await expect(
      poster.getByRole("list", { name: "Mid" }).getByRole("listitem"),
    ).toHaveCount(4);
    await expect(
      poster.getByRole("list", { name: "Opener" }).getByRole("listitem"),
    ).toHaveCount(6);

    const download = page.waitForEvent("download");
    await poster.getByRole("button", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("sagebrush-sound-undercard.csv");
    const lines = (await readFile(await file.path(), "utf8"))
      .trimEnd()
      .split("\r\n");
    expect(lines[0]).toBe("act,band,affinity,popularity,anchor_venue,reason");
    expect(lines).toHaveLength(11);
  });

  test("the cached Sagebrush build renders the full board in under 5 seconds", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await buildBoard(page); // saves a build if none is saved yet
    await page.reload();

    const started = Date.now();
    await page.getByRole("button", { name: "Build undercard" }).click();
    await expect(page.getByRole("article")).toHaveCount(10, { timeout: 5_000 });
    expect(Date.now() - started).toBeLessThan(5_000);
    await expect(page.getByText(/^Replayed the build saved/)).toBeVisible();
  });
});
