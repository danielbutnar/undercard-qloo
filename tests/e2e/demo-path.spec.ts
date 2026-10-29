// The demo path from SPEC.md section 3, step by step, against a running app: the local
// synthetic server (playwright.config.ts) or a deployment (E2E_BASE_URL). The first screen and
// the replay come from the server's latest saved build. On a deployment the refill (step 4)
// calls Qloo, and Without Qloo (step 5) calls Claude the first time; on the synthetic server,
// which has no Qloo client, the refill is answered in the browser. WS9: the same steps on the
// first screen "Your town prints your poster": the poster is the draft bill, the town beside it.
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { LIVE_QLOO, QLOO_SKIP_REASON, SYNTHETIC } from "./env";
import { syntheticRefillStream } from "./synthetic-build";
import { QLOO_CALL_CAP } from "../../src/lib/agent-limits";

const NDJSON = "application/x-ndjson; charset=utf-8";
const REPLAY_TIMEOUT = 30_000;

const bill = (page: Page) =>
  page.getByRole("region", { name: "Undercard draft" });
const band = (page: Page, name: RegExp) =>
  bill(page).getByRole("region", { name });
const traceRows = (page: Page) =>
  page.getByRole("list", { name: "Qloo calls" }).locator(":scope > li");
// The poster's key is the venue switch since WS12 item 1 (the switch panel went): each venue the
// build read, a switch for its fans, with the acts they lifted.
const rooms = (page: Page) =>
  page.getByRole("group", { name: "Venue fans used for this draft" });
// Each act's mark, read out in words (the + and the room's initials are hidden from it).
const MARK =
  /With .+'s fans added: (\d+(st|nd|rd|th) in Qloo's ranking, (up \d+ places|new from outside)|up \d+ places in Qloo's ranking|new in Qloo's ranking, from outside)/;

/** The acts each venue lifted, from the poster's key: their sum is the acts on the bill. */
async function liftedTotal(page: Page): Promise<number> {
  const labels = await page
    .getByRole("group", { name: "Venue fans used for this draft" })
    .locator("[aria-label]")
    .evaluateAll((items) =>
      items.map((item) => item.getAttribute("aria-label") ?? ""),
    );
  return labels.reduce(
    (total, label) =>
      total + Number(/: (?:on, )?(\d+) acts?/.exec(label)?.[1] ?? 0),
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
      bill(page).getByText("Fictional festival · demo draft"),
    ).toBeVisible();
    // Daniel's brief of 2026-10-22, item 3: Undercard drafts from Qloo's numbers; the AI agent
    // plans the calls. WS9: booked by you over the headliners, drafted by Undercard from the
    // venues' fans over the rest; the poster keeps the build's saved date.
    await expect(
      // WS8 (item 12a): the note under the headliners, no "Booked by you" chip.
      bill(page).getByText(
        "The headliners, two bands, are already booked · Undercard drafted the rest of the lineup (the bill) from Qloo's numbers",
      ),
    ).toBeVisible();
    await expect(bill(page).getByText("Drafted by Undercard")).toBeVisible();
    await expect(
      page.getByText(
        /^Drafted from \d+ Qloo calls the AI agent planned · saved [A-Z][a-z]{2} \d{1,2}, \d\d:\d\d UTC$/,
      ),
    ).toBeVisible();

    // Every act is on the bill at first paint, in its fee band, with its mark.
    await expect(band(page, /^Mid/).getByRole("article")).toHaveCount(4);
    await expect(band(page, /^Opening acts/).getByRole("article")).toHaveCount(
      6,
    );
    // Each band says its Qloo popularity range, our stand-in for fee; the door check, under the
    // poster (WS12 item 1), says each fee range in words.
    await expect(
      band(page, /^Mid/).getByText(
        "· Qloo popularity 80–92, our stand-in for fee",
      ),
    ).toBeVisible();
    await expect(
      band(page, /^Opening acts/).getByText("· Qloo popularity 55–80"),
    ).toBeVisible();
    const rule = page.getByRole("region", { name: "The door check" });
    await expect(rule).toContainText(
      "4 slots · fee range (Mid): with no real fees to go on, how popular an act is on Qloo stands in for what it charges (80th–92nd percentile)",
    );
    await expect(rule).toContainText(
      "6 slots · fee range (Opener): with no real fees to go on, how popular an act is on Qloo stands in for what it charges (55th–80th percentile)",
    );
    for (const act of await bill(page).getByRole("article").all()) {
      await expect(act).toContainText(MARK);
      await expect(act.getByRole("button")).toHaveCount(1);
    }

    // Each act's climb beside its name (M10a), the poster's key saying what it counts, and the
    // first act's climb as a sentence. Qloo is explained where it's first named, in the top bar;
    // then the venues behind the lineup, in the town and under the poster.
    await expect(
      bill(page).getByRole("article").first().locator(".poster-climb"),
    ).toHaveText(/^(\d+(st|nd|rd|th) )?(↑\d+|NEW)$/);
    await expect(
      // NEW is defined there too when an act is new to the top 50 (WS12 item 7).
      bill(page).getByText(
        /^↑ = places it rose in Qloo's ranking with that venue's fans \(5\+ to qualify\); (NEW = rose into Qloo's top 50; )?the strongest Qloo match takes each slot$/,
      ),
    ).toHaveCount(1);
    await expect(bill(page).locator(".poster-example")).toContainText(
      /in Qloo's ranking once .+'s fans joined the headliners' fans\.|entered Qloo's top 50 at \d+(st|nd|rd|th) once/,
    );
    await expect(page.getByRole("banner")).toContainText(
      "built on Qloo, a taste-data service that maps what fans of one artist, venue or film also like.",
    );
    await expect(
      page
        .getByRole("region", { name: "Your town" })
        .getByRole("button", { name: /\. Show this venue$/ })
        .first(),
    ).toBeVisible();
    await expect(bill(page)).toContainText(
      "These venues' fans are the signal: the acts won't necessarily play there.",
    );
    expect(await liftedTotal(page)).toBe(10);

    await expect(
      page.getByRole("button", { name: "Watch the AI agent build it" }),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: /Presale/ })).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test("step 2: Watch the AI agent build it streams every Qloo call, then the lineup reprints", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Watch the AI agent build it" })
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

    // M9a: on a deployment the replay rebuilds the climb from the Qloo cache. Each venue's
    // acts land on the poster as it's read; Skip (Watch's own button) goes straight to the lineup.
    if (!SYNTHETIC) {
      await expect(page.getByText(/^\+ .+'s fans$/).first()).toBeVisible({
        timeout: REPLAY_TIMEOUT,
      });
      await expect(
        bill(page)
          .getByText(/^With .+'s fans added$/)
          .first(),
      ).toBeVisible();
      await page.getByRole("button", { name: "Skip to the lineup" }).click();
    }
    // A 2.0 build reads up to 28 calls (a 1.0 build stopped at 12).
    expect(callCount).toBeLessThanOrEqual(QLOO_CALL_CAP);
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
      page.getByRole("button", { name: "Play it live" }),
    ).toBeVisible();
  });

  test("step 3: an act's card opens with its venue's climb, its Why line, Qloo's numbers and two shared tags", async ({
    page,
  }) => {
    await page.goto("/");
    const card = page.getByRole("region", { name: "Act card" });
    for (const act of await bill(page).getByRole("article").all()) {
      const name = (await act.getAttribute("aria-label"))!;
      await act.getByRole("button", { name, exact: true }).click();
      const opened = card.getByRole("article", { name, exact: true });
      // Daniel's brief of 2026-10-22, item 1: the badge says what the venue's fans did, no more,
      // naming the venue in full on a laptop (a phone takes the row tab's label, item 5 of the
      // second batch).
      const [, venue] = /^in Qloo's ranking with (.+)'s fans added$/.exec(
        await opened.locator(".card-rank-with").innerText(),
      )!;
      await expect(
        opened
          .getByText(`Climbs with ${venue}'s fans added`, { exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      // Card text runs together ("Qloo affinity0.94Popularity86th"), so no word boundaries.
      await expect(opened).toContainText(/affinity0\.\d\d/);
      await expect(opened).toContainText(/Popularity\d{1,2}popularity on Qloo/);
      // Plan.md item 5: the why in one sentence from the saved places and climb; a build without
      // its places keeps its own line.
      await expect(opened).toContainText(
        /Why it's here: (With .+'s fans added to the headliners', Qloo ranks .+ \d+(st|nd|rd|th); for the headliners' fans alone, (\d+(st|nd|rd|th)\. That climb of \d+|it isn't in the top 50\. That climb into the top 50) is why .+ is here\.|.+ fans move it (up \d+ places|into the top \d+)\.)/,
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

  test("step 4: Unavailable on the card asks why, then refills the slot from the same tier, in at most 5 Qloo calls", async ({
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
    // WS18 item 3: the receipt on the poster names the act that went, why, and the act in its
    // slot, with Undo; the replacement is marked.
    const receipt = bill(page).getByRole("status", { name: "The last refill" });
    await expect(receipt).toContainText(`${gone} out (radius clause) → `);
    await expect(receipt.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(bill(page).locator(".poster-act.is-replacement")).toHaveCount(
      1,
    );

    // The refill shows in the trace, excluding the board. A 2.0 build refills from the rankings
    // it already holds first, at no call, then from up to two more venues with their controls: at
    // most 5 Qloo calls. The synthetic refill makes one.
    const added = await traceRows(page).count();
    expect(added).toBeLessThanOrEqual(5);
    if (SYNTHETIC || added > 0) {
      expect(added).toBeGreaterThanOrEqual(1);
      await expect(page.getByText(/^[1-5] refill calls?/)).toBeVisible();
      const refillRow = traceRows(page)
        .filter({ hasText: "Refill (radius clause): Mid-tier artists" })
        .last();
      await refillRow.getByRole("button", { name: "Parameters" }).click();
      await expect(refillRow).toContainText("filter.exclude.entities=");
      await expect(refillRow).toContainText(gone);
    }

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
    await expect(
      model.getByText("Picked by Claude Sonnet 5.5 alone"),
    ).toBeVisible();
    const picks = model.getByRole("article");
    await expect(picks.first()).toBeVisible({ timeout: 60_000 });
    // One list with the model's own count, never sorted into slots.
    await expect(model.getByText(/^The model's \d+ picks?$/)).toBeVisible();
    for (const pick of await picks.all()) {
      // Prompt-4: each pick's tag and line, how Qloo's cached data places it or why it can't.
      await expect(pick).toContainText(
        /(\d+(st|nd|rd|th) · (above|below) both ranges|\d+(st|nd|rd|th) · in the (mid-size|opening) range|not on Qloo|not checked on Qloo)/,
      );
      await expect(pick).toContainText(
        /Picked without Qloo; (on Qloo: popularity \d+|not found on Qloo|not checked on Qloo)/,
      );
      await expect(pick).not.toContainText(/affinity/);
    }
    // Each pick opens the model's own reason.
    const first = picks.first();
    const pickName = (await first.getAttribute("aria-label"))!;
    await first.getByRole("button", { name: pickName, exact: true }).click();
    await expect(
      page.getByRole("region", { name: "The model's pick" }),
    ).toContainText("The model's reason: ");
    // The town says the model can't see its venues.
    await expect(
      page.getByRole("note", { name: "Without Qloo" }),
    ).toContainText("Without Qloo, the model can't see Boise's venues.");
    await expect(model.locator(".sleeve-blank")).toHaveCount(0);
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
    // WS12 item 7: the demo festival's CSV says it's fictional, in its name and first line.
    expect(file.suggestedFilename()).toBe(
      "sagebrush-sound-fictional-demo-festival-undercard.csv",
    );
    const lines = (await readFile(await file.path(), "utf8"))
      .trimEnd()
      .split("\r\n");
    expect(lines[0]).toBe(
      '"Fictional demo festival: Sagebrush Sound in Boise, Idaho, drafted by Undercard"',
    );
    expect(lines[1]).toBe(
      "act,band,affinity,popularity,anchor_venue,reason,replaces,unavailable_reason",
    );
    expect(lines).toHaveLength(12);
  });

  test("the venue switch: a venue off re-forms the lineup from the saved build, with no Qloo call; on again brings it back", async ({
    page,
  }) => {
    const sent: string[] = [];
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith("/api/") && path !== "/api/venue-switch")
        sent.push(path);
    });
    await page.goto("/");
    const names = () =>
      bill(page)
        .getByRole("article")
        .evaluateAll((acts) =>
          acts.map((act) => act.getAttribute("aria-label")),
        );
    const saved = await names();
    expect(saved).toHaveLength(10);

    const switcher = rooms(page);
    const first = switcher
      .getByRole("button", { name: /'s fans: on, [1-9]\d* acts?\./ })
      .first();
    await expect(first).toBeEnabled({ timeout: 15_000 });
    const venue = (await first.getAttribute("aria-label"))!.split(
      "'s fans:",
    )[0];
    await first.click();

    await expect(
      switcher.getByRole("button", {
        name: `${venue}'s fans: off. Switch them on`,
      }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(bill(page).getByText(/^What if /)).toBeVisible();
    const reformed = await names();
    expect(reformed).not.toEqual(saved);
    // A slot nothing qualifies for stays open rather than padded (WS8): a band prints its acts,
    // then an open slot for each slot left; a band with no act left says why its slots stay open
    // instead, with the way back (the v6 board's laptop-09: Boise with V418 off).
    for (const [name, slots, words] of [
      [/^Mid/, 4, "mid-size"],
      [/^Opening/, 6, "opening"],
    ] as const) {
      const region = band(page, name);
      const acts = await region.getByRole("article").count();
      const open = region.locator(".poster-slot");
      if (acts > 0) {
        await expect(open).toHaveCount(slots - acts);
        continue;
      }
      await expect(open).toHaveCount(0);
      // The venues read for these slots and the one off (WS8, the brief's item 12).
      await expect(region.getByRole("status")).toContainText(
        new RegExp(
          `^The ${slots} ${words} slots stay open\\. (For ${words} acts this draft read .+'s fans(, and Qloo had no fan data for .+)?\\. )?With .+ off, no act passes the rule for these slots\\.`,
        ),
      );
      await expect(
        region.getByRole("button", { name: /^Switch .+ back on$/ }),
      ).toBeVisible();
    }
    if (SYNTHETIC) {
      // The Lantern Room off: Fort Street Ballroom's mid-size act and two openers stay, and the
      // other seven slots stay open.
      expect(venue).toBe("The Lantern Room");
      expect(reformed).toHaveLength(3);
      await expect(bill(page).locator(".poster-slot")).toHaveCount(7);
    }

    await bill(page)
      .getByRole("button", { name: "All venues on" })
      .first()
      .click();
    await expect.poll(names).toEqual(saved);
    expect(sent).toEqual([]);
  });

  // WS8: hovering the key's switches fades nothing; after a venue is switched off from the key,
  // the acts left are at full opacity with the mouse still on its switch.
  test("the venue switch: with the mouse on the key, the acts left aren't faded", async ({
    page,
  }) => {
    await page.goto("/");
    const key = bill(page).getByRole("group", {
      name: "Venue fans used for this draft",
    });
    const on = key.getByRole("button", { name: /'s fans: on, [1-9]/ }).first();
    await expect(on).toBeEnabled({ timeout: 15_000 });
    await on.hover();
    await on.click();
    await expect(bill(page).getByText(/^What if /)).toBeVisible();
    const acts = bill(page).locator(".poster-act");
    expect(await acts.count()).toBeGreaterThan(0);
    for (const act of await acts.all())
      await expect(act).toHaveCSS("opacity", "1");
  });

  // WS8: a room that alone fills a tier, switched off from the poster's key, empties that tier:
  // Denver's synthetic build credits all six openers to The Room, as Boise's credits its
  // openers to Venue 418. The mid-size tier keeps its other room's act.
  test("the venue switch: a room that fills a tier alone, switched off, empties it and says why", async ({
    page,
  }) => {
    test.skip(SYNTHETIC !== "1", "reads Denver's synthetic build");
    await page.goto("/towns/denver");
    const key = bill(page).getByRole("group", {
      name: "Venue fans used for this draft",
    });
    const larimer = key.getByRole("button", {
      name: /^The Room's fans: on/,
    });
    await expect(larimer).toBeEnabled({ timeout: 15_000 });
    await larimer.click();
    await page.mouse.move(0, 0);

    const mid = band(page, /^Mid/);
    await expect(mid.getByRole("article")).toHaveCount(1);
    await expect(mid.locator(".poster-slot")).toHaveCount(3);
    const openers = band(page, /^Opening/);
    await expect(openers.getByRole("article")).toHaveCount(0);
    await expect(openers.locator(".poster-slot")).toHaveCount(0);
    await expect(openers.getByRole("status")).toContainText(
      "The 6 opening slots stay open. For opening acts this draft read The Room's fans. With The Room off, no act passes the rule for these slots.",
    );
    await openers
      .getByRole("button", { name: "Switch The Room back on" })
      .click();
    await expect(bill(page).getByRole("article")).toHaveCount(10);
  });

  test("first paint: the server sends the whole bill, on screen in under 5 seconds with no click", async ({
    page,
  }) => {
    const html = await (await page.request.get("/")).text();
    // The poster's acts (each carries data-act; the door check's ticket is an article too).
    expect(html.match(/<article\b[^>]*\bdata-act=/g) ?? []).toHaveLength(10);

    const started = Date.now();
    await page.goto("/");
    await expect(bill(page).getByRole("article")).toHaveCount(10, {
      timeout: 5_000,
    });
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
