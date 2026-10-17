// The demo path from SPEC.md section 3, step by step, against a running app: the local
// synthetic server (playwright.config.ts) or a deployment (E2E_BASE_URL). The first screen and
// the replay come from the server's latest saved build. On a deployment the refill (step 4)
// calls Qloo, and Without Qloo (step 5) calls Claude the first time; on the synthetic server,
// which has no Qloo client, the refill is answered in the browser.
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { LIVE_QLOO, QLOO_SKIP_REASON, SYNTHETIC } from "./env";
import { syntheticRefillStream } from "./synthetic-build";

const NDJSON = "application/x-ndjson; charset=utf-8";
const REPLAY_TIMEOUT = 30_000;

const bill = (page: Page) =>
  page.getByRole("region", { name: "Undercard draft" });
const band = (page: Page, name: RegExp) =>
  bill(page).getByRole("region", { name });
const traceRows = (page: Page) =>
  page.getByRole("list", { name: "Qloo calls" }).locator(":scope > li");
const rooms = (page: Page) =>
  page.getByRole("region", { name: "Boise venues whose fans shaped this lineup" });
// Each act's mark, read out in words (the + and the room's initials are hidden from it).
const MARK = /crowd: (up \d+ places|new, from outside)/;

/** The acts each room lifted, from the rail: their sum is the acts on the bill. */
async function liftedTotal(page: Page): Promise<number> {
  const text = (await rooms(page).getByRole("list").textContent()) ?? "";
  return [...text.matchAll(/(\d+) (?:acts? lifted|lifted none)/g)].reduce(
    (total, match) => total + Number(match[1]),
    0,
  );
}

test.describe("demo path", () => {
  test.skip(SYNTHETIC === "empty", "needs a saved build");
  test.describe.configure({ mode: "serial" });

  test("step 1: the saved draft bill loads, each act marked with its Boise room and lift, no login", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Sagebrush Sound" }),
    ).toBeVisible();
    await expect(
      page.getByText("Boise, Idaho · 3,000 capacity · crowd aged 25–34"),
    ).toBeVisible();
    await expect(
      page
        .getByRole("list", { name: "Booked headliners" })
        .getByRole("listitem"),
    ).toHaveText(["Khruangbin", "Japanese Breakfast"]);
    await expect(
      bill(page).getByText("Draft, not announced"),
    ).toBeVisible();

    // Every act is on the bill at first paint, in its fee band, with its mark.
    await expect(band(page, /^Mid/).getByRole("article")).toHaveCount(4);
    await expect(band(page, /^Opening acts/).getByRole("article")).toHaveCount(6);
    await expect(
      page.getByText(
        "4 slots · fee range (Mid): with no real fees to go on, how popular an act is on Qloo stands in for what it charges (80th–92nd percentile)",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "6 slots · fee range (Opener): with no real fees to go on, how popular an act is on Qloo stands in for what it charges (55th–80th percentile)",
      ),
    ).toBeVisible();
    for (const act of await bill(page).getByRole("article").all()) {
      await expect(act).toContainText(MARK);
      await expect(act.getByRole("button")).toHaveCount(1);
    }

    // The key beside the first mark, and the rooms behind the bill.
    await expect(
      page.getByRole("note", { name: "How to read the marks" }),
    ).toContainText(
      "Qloo: data on what people like, across music, places and more.",
    );
    await expect(rooms(page)).toContainText(
      "These venues stand for the town's taste: the acts won't necessarily play there.",
    );
    expect(await liftedTotal(page)).toBe(10);

    await expect(
      page.getByRole("button", { name: "Watch how it picked these acts" }),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: /Presale/ })).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test("step 2: Watch how it picked these acts streams every Qloo call, then the lineup reprints", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Watch how it picked these acts" })
      .click();

    const trace = page.getByRole("list", { name: "Qloo calls" });
    await expect(page.getByText(/^Replayed the build saved/)).toBeVisible({
      timeout: REPLAY_TIMEOUT,
    });
    await expect(trace).toContainText('Search for "Khruangbin"');
    await expect(trace).toContainText('Search for "Japanese Breakfast"');
    await expect(trace).toContainText("Boise places tagged");
    await expect(trace).toContainText("artists for the headliners alone");
    await expect(trace).toContainText("artists for the headliners and");
    const callCount = await traceRows(page).count();
    expect(callCount).toBeGreaterThanOrEqual(9);

    // M9a: on a deployment the replay rebuilds the climb from the Qloo cache. The venues'
    // lists re-sort with real moves; Skip goes straight to the lineup.
    if (!SYNTHETIC) {
      await expect(
        bill(page).getByText(/^How the town's venue crowds move acts up/),
      ).toBeVisible();
      await expect(
        bill(page).getByText(/^\+\d+, /).first(),
      ).toBeVisible({ timeout: REPLAY_TIMEOUT });
      await bill(page).getByRole("button", { name: "Skip to the lineup" }).click();
    }
    expect(callCount).toBeLessThanOrEqual(12);
    await expect(trace.getByLabel(/^\d+ results$/)).toHaveCount(callCount);
    // The planner's own lines replay with the calls (builds saved since 2026-10-17 carry them).
    await expect(trace.getByText(/^Agent:/).first()).toBeVisible();

    const venueRow = traceRows(page)
      .filter({ hasText: "artists for the headliners and" })
      .first();
    await venueRow.getByRole("button", { name: "Parameters" }).click();
    await expect(venueRow).toContainText("filter.type=urn:entity:artist");
    await expect(venueRow).toContainText(
      "signal.interests.entities=Khruangbin, Japanese Breakfast, ",
    );

    // The bill reprints, and the rooms' counts end at every act on it.
    await expect(bill(page).getByRole("article")).toHaveCount(10);
    await expect.poll(() => liftedTotal(page)).toBe(10);
    await expect(
      page.getByRole("button", { name: "Run the agent live instead" }),
    ).toBeVisible();
  });

  test("step 3: an act's card opens with its Why Boise line, Qloo's numbers and two shared tags", async ({
    page,
  }) => {
    await page.goto("/");
    const card = page.getByRole("region", { name: "Act card" });
    for (const act of await bill(page).getByRole("article").all()) {
      const name = (await act.getAttribute("aria-label"))!;
      await act.getByRole("button", { name, exact: true }).click();
      const opened = card.getByRole("article", { name, exact: true });
      // Card text runs together ("Qloo affinity0.94Popularity86th"), so no word boundaries.
      await expect(opened).toContainText(/affinity0\.\d\d/);
      await expect(opened).toContainText(/Popularity\d{1,2}(st|nd|rd|th)/);
      await expect(opened).toContainText(
        /Why Boise: .+ fans move it (up \d+ places|into the top \d+)\./,
      );
      await expect(
        opened
          .getByRole("list", { name: "Tags shared with the headliners" })
          .getByRole("listitem"),
      ).toHaveCount(2);
      await expect(
        opened.getByRole("button", { name: "Unavailable" }),
      ).toBeVisible();
      await card.getByRole("button", { name: "Close the card" }).click();
      await expect(card).toHaveCount(0);
    }
  });

  test("step 4: Unavailable on the card asks why, then refills the slot from the same fee band with a new Qloo call", async ({
    page,
  }) => {
    test.skip(!SYNTHETIC && !LIVE_QLOO, QLOO_SKIP_REASON);
    test.setTimeout(90_000);
    if (SYNTHETIC) {
      await page.route("**/api/refill", async (route) => {
        const body = route.request().postDataJSON() as {
          unavailableId: string;
          reason?: "radius" | "routing" | "fee";
        };
        await route.fulfill({
          status: 200,
          contentType: NDJSON,
          body: syntheticRefillStream(body.unavailableId, body.reason),
        });
      });
    }
    await page.goto("/");
    const mid = band(page, /^Mid/);
    const first = mid.getByRole("article").first();
    const gone = (await first.getAttribute("aria-label"))!;

    await first.getByRole("button", { name: gone, exact: true }).click();
    await page
      .getByRole("region", { name: "Act card" })
      .getByRole("button", { name: "Unavailable" })
      .click();
    // M6e: the buyer says why; the trace line and the CSV keep it.
    await page
      .getByRole("group", { name: "Why is it unavailable?" })
      .getByRole("button", { name: "Radius clause" })
      .click();

    // The replacement prints into the same slot, in the same band, with its mark.
    await expect(
      bill(page).getByRole("article", { name: gone, exact: true }),
    ).toHaveCount(0, { timeout: 60_000 });
    await expect(mid.getByRole("article")).toHaveCount(4);
    await expect(mid.getByRole("article").first()).toContainText(MARK);

    // The refill shows in the trace: at most 3 new Qloo calls, excluding the board.
    const added = await traceRows(page).count();
    expect(added).toBeGreaterThanOrEqual(1);
    expect(added).toBeLessThanOrEqual(3);
    await expect(page.getByText(/^[123] refill calls?$/)).toBeVisible();
    const refillRow = traceRows(page)
      .filter({ hasText: "Refill (radius clause): Mid-band artists" })
      .last();
    await refillRow.getByRole("button", { name: "Parameters" }).click();
    await expect(refillRow).toContainText("filter.exclude.entities=");
    await expect(refillRow).toContainText(gone);

    // The CSV names the act the replacement took over from, and why.
    const download = page.waitForEvent("download");
    // M6q: Export CSV sits below the bill.
    await page.getByRole("button", { name: "Export CSV" }).click();
    const csv = await readFile(await (await download).path(), "utf8");
    const replacementRow = csv
      .split("\r\n")
      .find((line) => line.endsWith(`,${gone},radius clause`));
    expect(replacementRow).toBeTruthy();
  });

  test("step 5: Without Qloo reprints the bill with the model's picks; Export CSV in the bar downloads the agent's bill", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/");

    await page
      .getByRole("button", { name: "Without Qloo: an AI model's picks alone" })
      .click();
    const model = page.getByRole("region", {
      name: "Without Qloo: an AI model's picks alone",
    });
    await expect(model.getByText("No Qloo data")).toBeVisible();
    const picks = model.getByRole("article");
    await expect(picks.first()).toBeVisible({ timeout: 60_000 });
    for (const pick of await picks.all()) {
      await expect(pick).toContainText("No Boise venue · fee range not checked");
      await expect(pick).not.toContainText(/affinity/);
    }
    await expect(page.locator("main")).not.toContainText(/\d+\s*\/\s*\d+/);
    await expect(bill(page)).toHaveCount(0);

    await page
      .getByRole("button", { name: "With Qloo: the AI agent's lineup" })
      .click();
    await expect(band(page, /^Mid/).getByRole("article")).toHaveCount(4);

    const download = page.waitForEvent("download");
    // M6q: Export CSV sits below the bill.
    await page.getByRole("button", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("sagebrush-sound-undercard.csv");
    const lines = (await readFile(await file.path(), "utf8"))
      .trimEnd()
      .split("\r\n");
    expect(lines[0]).toBe(
      "act,band,affinity,popularity,anchor_venue,reason,replaces,unavailable_reason",
    );
    expect(lines).toHaveLength(11);
  });

  test("first paint: the server sends the whole bill, on screen in under 5 seconds with no click", async ({
    page,
  }) => {
    const html = await (await page.request.get("/")).text();
    expect(html.match(/<article\b/g) ?? []).toHaveLength(10);

    const started = Date.now();
    await page.goto("/");
    await expect(bill(page).getByRole("article")).toHaveCount(10, {
      timeout: 5_000,
    });
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
