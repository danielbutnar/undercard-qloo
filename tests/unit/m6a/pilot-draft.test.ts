import { describe, expect, it } from "vitest";
import type { Act } from "@/lib/lineup";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { pilotDraft, pilotFestival, type PilotRun } from "@/lib/pilot";

// Invented acts and rooms: the draft's shape is what's under test, not Qloo's answers.
const act = (
  name: string,
  band: "mid" | "opener",
  room: string,
  reason: string,
): Act => ({
  entityId: `id-${name}`,
  name,
  band,
  affinity: 0.91,
  popularity: band === "mid" ? 0.86 : 0.7,
  anchorVenue: { entityId: `id-${room}`, name: room },
  reason,
  sharedTags: [
    { id: "urn:tag:genre:music:psych", name: "Psych" },
    { id: "urn:tag:genre:music:soul", name: "Soul" },
  ],
});

function run(): PilotRun {
  const festival = pilotFestival({
    city: "Tucson",
    region: "Arizona",
    headliners: ["Headliner One", "Headliner Two"],
    slots: { mid: 2, opener: 2 },
  });
  return {
    festival,
    ranAt: "2026-10-17T13:00:00.000Z",
    acts: [
      act(
        "Mesa Echo",
        "mid",
        "Venue 373 Room",
        "Venue 373 Room fans move it up 12 places.",
      ),
      act(
        "Dry Wash",
        "mid",
        "Club Sarape (CS)",
        "Club Sarape (CS) fans move it into the top 30.",
      ),
      act(
        "Saguaro Kid",
        "opener",
        "Venue 373 Room",
        "Venue 373 Room fans move it up 7 places.",
      ),
    ],
    roomsTested: {
      mid: ["Venue 373 Room", "Club Sarape (CS)"],
      opener: ["Venue 373 Room", "Hotel Lounge"],
    },
    log: [
      {
        kind: "call",
        n: 1,
        summary: 'Search for "Headliner One"',
        endpoint: "GET /search",
        resultCount: 3,
      },
      { kind: "note", text: "Anchors: Venue 373 Room, Club Sarape." },
      {
        kind: "call",
        n: 2,
        summary: "Mid-band artists for the headliners alone",
        endpoint: "GET /v2/insights",
        resultCount: 50,
      },
    ],
  };
}

describe("pilotFestival", () => {
  it("keeps the demo's crowd and fee ranges, and takes the buyer's town, headliners and slots", () => {
    const festival = pilotFestival({
      city: "Tucson",
      region: "Arizona",
      headliners: ["A", "B"],
      slots: { mid: 3, opener: 5 },
    });
    expect(festival.id).toBe("pilot-tucson");
    expect(festival.city).toBe("Tucson");
    expect(festival.headliners).toEqual(["A", "B"]);
    expect(festival.crowdAge).toEqual(SAGEBRUSH_SOUND.crowdAge);
    expect(
      festival.feeBands.map((band) => [
        band.id,
        band.slots,
        band.minPopularity,
        band.maxPopularity,
      ]),
    ).toEqual([
      ["mid", 3, 0.8, 0.92],
      ["opener", 5, 0.55, 0.8],
    ]);
  });
});

describe("pilotDraft", () => {
  const page = pilotDraft(run());

  it("names the town and the headliners, and says what the draft is not", () => {
    expect(page).toMatch(/^# Undercard draft for Tucson, Arizona/m);
    expect(page).toContain("Headliner One · Headliner Two");
    expect(page).toMatch(/popularity ranges stand in for fees/i);
  });

  it("lists every act under its band with its room and lift", () => {
    expect(page).toContain("**Mesa Echo**: Venue 373 Room, +12 places");
    expect(page).toContain(
      "**Dry Wash**: Club Sarape (CS), new (into the top 30)",
    );
    expect(page).toContain("**Saguaro Kid**: Venue 373 Room, +7 places");
  });

  it("shows a band that isn't full as open slots", () => {
    expect(page).toMatch(/### Opener: 1 of 2 slots/);
    expect(page).toContain(
      "- Open slot: no tested room lifted another act in this band.",
    );
  });

  it("counts what each tested room lifted, a zero included", () => {
    expect(page).toContain("| Venue 373 Room | Mid, Opener | 2 |");
    expect(page).toContain("| Club Sarape (CS) | Mid | 1 |");
    expect(page).toContain("| Hotel Lounge | Opener | 0 |");
  });

  it("summarises the calls in order, with the planner's lines between them", () => {
    expect(page).toContain("2 Qloo calls");
    const search = page.indexOf(
      '1. Search for "Headliner One" (GET /search): 3 results',
    );
    const note = page.indexOf("Agent: Anchors: Venue 373 Room, Club Sarape.");
    const mid = page.indexOf(
      "2. Mid-band artists for the headliners alone (GET /v2/insights): 50 results",
    );
    expect(search).toBeGreaterThan(-1);
    expect(note).toBeGreaterThan(search);
    expect(mid).toBeGreaterThan(note);
  });

  it("numbers calls that ran in parallel in call order, keeping the planner's lines in place", () => {
    const parallel = pilotDraft({
      ...run(),
      log: [
        {
          kind: "call",
          n: 4,
          summary: "Call four",
          endpoint: "/v2/insights",
          resultCount: 50,
        },
        {
          kind: "call",
          n: 3,
          summary: "Call three",
          endpoint: "/v2/insights",
          resultCount: 50,
        },
        { kind: "note", text: "Try another room." },
        {
          kind: "call",
          n: 5,
          summary: "Call five",
          endpoint: "/v2/insights",
          resultCount: 50,
        },
      ],
    });
    const order = [
      "3. Call three",
      "4. Call four",
      "Agent: Try another room.",
      "5. Call five",
    ].map((line) => parallel.indexOf(line));
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("prints no Qloo entity ids or scores", () => {
    expect(page).not.toMatch(/\bid-|urn:|0\.91/);
  });
});
