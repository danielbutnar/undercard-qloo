import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { memoryRecord } from "@/server/control-test-37-client";
import {
  fillResult,
  resultValues,
  runControlTest37,
} from "@/server/control-test-37-run";
import type { Summary } from "@/server/control-test-37";
import { createMemoryCache } from "@/server/qloo-cache";
import { BUILDS, TOWNS, worldFetch } from "./world";

const TEMPLATE = readFileSync("scripts/control-test-37-result.md", "utf8");

async function liveRun(fetch = worldFetch().fetch, maxCalls = 100) {
  const cache = createMemoryCache();
  for (const build of BUILDS) {
    await cache.set(`undercard:build:v1:id:${build.id}`, build, 3600);
    await cache.set(
      `undercard:build:v1:latest:${build.festivalId}`,
      build.id,
      3600,
    );
  }
  const files = new Map<string, string>();
  const outcome = await runControlTest37({
    settings: { mode: "live", maxCalls, resume: false, spacingMs: 0 },
    serverCache: cache,
    pinned: {
      festivals: BUILDS.map((build) => ({
        festivalId: build.festivalId,
        buildId: build.id,
      })),
    },
    towns: TOWNS,
    record: memoryRecord(),
    fetch,
    apiKey: "test-key",
    log: () => {},
    write: (name, text) => void files.set(name, text),
    template: TEMPLATE,
    // 10:00 UTC on 28 October is 12:00 in Bucharest (EET since 25 October).
    now: () => Date.parse("2026-10-28T10:00:00.000Z"),
    sleep: async () => {},
  });
  return { ...outcome, page: files.get("result.md")! };
}

describe("the result page section 37 gets", () => {
  it("is filled from the run: every placeholder, with the counts by town and by tier", async () => {
    const { page } = await liveRun();
    expect(page).not.toMatch(/\{\{|\}\}/);
    expect(page).toContain(
      "2026-10-28 (10:00 to 10:00 UTC, 12:00 to 12:00 Bucharest)",
    );
    expect(page).toContain("| Alder | Birch | 3 | 1 | 2 | 3 | 0 |");
    expect(page).toContain("| Birch | Cedar | 1 | 0 | 0 | 1 | 1 |");
    expect(page).toContain("| Cedar | Birch | 1 | 0 | 0 | 0 | 0 |");
    expect(page).toContain("| Mid-size range | 3 | 1 | 2 |");
    expect(page).toContain("| Opening range | 2 | 0 | 0 |");
    expect(page).toMatch(/18 Qloo requests/);
  });

  it("carries counts only: no act's or venue's name, no entity id", async () => {
    const { page } = await liveRun();
    expect(page).not.toMatch(
      /Act |Alder Club|Alder Hall|Birch Cellar|Birch Loft|Cedar Yard|v-a|v-b|v-c|m20|o15|h-1/,
    );
  });

  it("says the run is incomplete, and sets no bar, when it stopped", async () => {
    const { page } = await liveRun(worldFetch().fetch, 5);
    expect(page).toMatch(/incomplete: 0 of 3 towns measured/);
    expect(page).toMatch(/max calls/);
    expect(page).not.toMatch(/Undercard 2\.0's bar is/);
  });
});

const summary = (atBar: number, atFallback: number): Summary => ({
  complete: true,
  towns: 29,
  acts: 290,
  atBar,
  atFallback,
  byTown: [],
  byTier: {
    mid: { acts: 116, atBar: 0, atFallback: 0 },
    opener: { acts: 174, atBar: 0, atFallback: 0 },
  },
  venueRuns: 125,
  controlsSkipped: 0,
  controlsSkippedByWarning: 0,
  controlsSkippedByEqualRanking: 0,
  venueRunsWithoutControl: 0,
  controlTownsWithoutFanData: 0,
  roomsSkipped: 0,
  noScoredControl: 0,
  stillClimb: 250,
  popularitySources: { find_venues: 0, entities: 0, none: 0 },
  townVenuesWithoutFanData: { warning: 0, equalRanking: 0 },
  actsWithTownVenueWithoutFanData: 0,
  actsWithTownVenueWithoutFanDataAtLift5: 0,
  barMet: atBar >= 145,
  productBar: atBar >= 145 ? 5 : 3,
});

const values = (atBar: number, atFallback: number) =>
  resultValues({
    summary: summary(atBar, atFallback),
    attempts: [
      { n: 1, at: "2026-10-28T10:00:00.000Z", key: "k", status: 200 },
      { n: 2, at: "2026-10-28T10:07:30.000Z", key: "k2", status: 200 },
    ],
    answers: 2,
    planned: 284,
    stopped: null,
  });

describe("the outcome, by the rule written before the run", () => {
  it("met: SHOWN with the share at 5, and a bar of 5 places for 2.0", () => {
    const filled = values(145, 200);
    expect(filled.verdict).toBe("bar met");
    expect(filled.productBar).toBe("5");
    expect(filled.outcome).toMatch(
      /SHOWN stamp gives the share at 5 places \(145 of 290, 50\.0%\)/,
    );
    expect(filled.outcome).toMatch(/at least 5 places/);
    expect(filled.outcome).not.toMatch(/PARTLY/);
  });

  it("not met: PARTLY SHOWN with both shares, the limit stated, and a bar of 3 places", () => {
    const filled = values(144, 200);
    expect(filled.verdict).toBe("bar not met");
    expect(filled.productBar).toBe("3");
    expect(filled.outcome).toMatch(
      /PARTLY SHOWN gives both shares \(144 of 290, 49\.7%, at 5 places; 200 of 290, 69\.0%, at 3\)/,
    );
    expect(filled.outcome).toMatch(/under 5 places/);
    expect(filled.outcome).toMatch(/at least 3 places/);
  });

  it("states the window in UTC and Bucharest time, and whether any request went unanswered", () => {
    const filled = values(10, 20);
    expect([filled.startUtc, filled.endUtc]).toEqual(["10:00", "10:07"]);
    expect([filled.startBucharest, filled.endBucharest]).toEqual([
      "12:00",
      "12:07",
    ]);
    expect(filled.requestsNote).toBe("every one answered, none retried");
  });
});

describe("fillResult", () => {
  it("fills each placeholder and refuses a page with one it has no value for", () => {
    expect(fillResult("{{a}} and {{b}}", { a: 1, b: "two" })).toBe("1 and two");
    expect(() => fillResult("{{a}} and {{c}}", { a: 1 })).toThrow(/c/);
  });
});
