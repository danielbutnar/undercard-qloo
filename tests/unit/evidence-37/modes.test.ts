import { describe, expect, it } from "vitest";
import { memoryRecord, type RunRecord } from "@/server/control-test-37-client";
import {
  planCalls,
  runControlTest37,
  settingsFrom,
  type Settings,
} from "@/server/control-test-37-run";
import { createMemoryCache } from "@/server/qloo-cache";
import { BUILDS, FESTIVALS, TOWNS, worldFetch } from "./world";

const PINNED = {
  festivals: BUILDS.map((build) => ({
    festivalId: build.festivalId,
    buildId: build.id,
  })),
};

async function serverCache() {
  const cache = createMemoryCache();
  for (const build of BUILDS) {
    await cache.set(`undercard:build:v1:id:${build.id}`, build, 3600);
    await cache.set(
      `undercard:build:v1:latest:${build.festivalId}`,
      build.id,
      3600,
    );
  }
  return cache;
}

const LIVE: Settings = {
  mode: "live",
  maxCalls: 100,
  resume: false,
  spacingMs: 0,
};

async function run({
  settings = LIVE,
  fetch = worldFetch().fetch,
  record = memoryRecord(),
}: {
  settings?: Settings;
  fetch?: typeof globalThis.fetch;
  record?: RunRecord;
} = {}) {
  const lines: Record<string, unknown>[] = [];
  const files = new Map<string, string>();
  const outcome = await runControlTest37({
    settings,
    serverCache: await serverCache(),
    pinned: PINNED,
    towns: TOWNS,
    record,
    fetch,
    apiKey: "test-key",
    log: (line) => lines.push(line as Record<string, unknown>),
    write: (name, text) => void files.set(name, text),
    now: () => Date.parse("2026-10-28T10:00:00.000Z"),
    sleep: async () => {},
  });
  return { ...outcome, lines, files, record };
}

const noFetch = (async () => {
  throw new Error("a dry run never calls Qloo");
}) as typeof globalThis.fetch;

describe("settingsFrom", () => {
  it("runs dry unless LIVE=1, and LIVE=1 needs MAX_CALLS", () => {
    expect(settingsFrom({})).toEqual({
      mode: "dry",
      maxCalls: null,
      resume: false,
      spacingMs: 1200,
    });
    expect(settingsFrom({ DRY: "1" }).mode).toBe("dry");
    expect(() => settingsFrom({ LIVE: "1" })).toThrow(/MAX_CALLS/);
    expect(() => settingsFrom({ LIVE: "1", MAX_CALLS: "0" })).toThrow(
      /MAX_CALLS/,
    );
    expect(() => settingsFrom({ LIVE: "1", MAX_CALLS: "ten" })).toThrow(
      /MAX_CALLS/,
    );
    expect(() => settingsFrom({ DRY: "1", LIVE: "1", MAX_CALLS: "5" })).toThrow(
      /DRY/,
    );
    expect(
      settingsFrom({
        LIVE: "1",
        MAX_CALLS: "400",
        RESUME: "1",
        SPACING_MS: "0",
      }),
    ).toEqual({ mode: "live", maxCalls: 400, resume: true, spacingMs: 0 });
    expect(() =>
      settingsFrom({ LIVE: "1", MAX_CALLS: "5", SPACING_MS: "-1" }),
    ).toThrow(/SPACING_MS/);
  });
});

describe("DRY: the plan, with no call", () => {
  it("plans each town's new calls in the run's order, a call planned for an earlier town not counted again", () => {
    expect(
      planCalls(FESTIVALS, TOWNS).map((row) => [row.city, row.calls]),
    ).toEqual([
      // Birch's and Alder's rooms, both tiers for the headliners alone, three venue runs,
      // and at most a control each.
      [
        "Alder",
        {
          findVenues: 2,
          headlinersOnly: 2,
          venues: 3,
          controlsAtMost: 3,
          total: 10,
        },
      ],
      // Cedar's rooms (Birch's were planned for Alder), one venue run, one control.
      [
        "Birch",
        {
          findVenues: 1,
          headlinersOnly: 0,
          venues: 1,
          controlsAtMost: 1,
          total: 3,
        },
      ],
      [
        "Cedar",
        {
          findVenues: 0,
          headlinersOnly: 0,
          venues: 1,
          controlsAtMost: 1,
          total: 2,
        },
      ],
    ]);
  });

  it("reads the builds, prints the plan per town and the total, and calls nothing, writes nothing", async () => {
    const record = memoryRecord();
    const outcome = await run({
      settings: { ...LIVE, mode: "dry", maxCalls: null },
      fetch: noFetch,
      record,
    });
    expect(outcome.code).toBe(0);
    expect(record.answers()).toEqual([]);
    expect(record.attempts()).toEqual([]);
    expect(outcome.files.size).toBe(0);
    const towns = outcome.lines.filter((line) => "plan" in line);
    expect(towns.map((line) => [line.town, line.control])).toEqual([
      ["Alder", "Birch"],
      ["Birch", "Cedar"],
      ["Cedar", "Birch"],
    ]);
    expect(outcome.lines.find((line) => line.dry === true)).toMatchObject({
      towns: 3,
      findVenues: 3,
      headlinersOnly: 2,
      venues: 5,
      controlsAtMost: 5,
      total: 15,
    });
    expect(outcome.lines.find((line) => "checks" in line)).toMatchObject({
      checks: {
        builds: 3,
        acts: 5,
        actsWithoutVenueRun: 0,
        headlinerSets: 1,
        agesUnlikeBrief: 0,
        venueTags: 1,
      },
    });
  });

  it("prints counts and town names only: no act or venue name, no entity id", async () => {
    const outcome = await run({
      settings: { ...LIVE, mode: "dry", maxCalls: null },
      fetch: noFetch,
    });
    const printed = JSON.stringify(outcome.lines);
    expect(printed).not.toMatch(/Act |Alder Club|Birch Cellar|v-a2|m20/);
  });
});

describe("LIVE: at most MAX_CALLS, stopping at the first 429, and RESUME", () => {
  it("runs every town, one call at a time, and writes the counts", async () => {
    const world = worldFetch();
    const outcome = await run({ fetch: world.fetch });
    expect(outcome.code).toBe(0);
    expect(world.requests).toHaveLength(18);
    expect(outcome.record.answers()).toHaveLength(18);
    expect(outcome.summary).toMatchObject({
      complete: true,
      acts: 5,
      atBar: 1,
      atFallback: 2,
      controlsSkipped: 6,
      stillClimb: 4,
    });
    const result = JSON.parse(outcome.files.get("result.json")!);
    expect(result).toMatchObject({
      complete: true,
      stopped: null,
      requests: { thisRun: 18, all: 18 },
      window: {
        first: "2026-10-28T10:00:00.000Z",
        last: "2026-10-28T10:00:00.000Z",
      },
      summary: { atBar: 1, atFallback: 2 },
    });
    expect(result.festivals).toHaveLength(3);
    // The console gets counts, never an act's or venue's name.
    expect(JSON.stringify(outcome.lines)).not.toMatch(
      /Act |Alder Club|Birch Cellar|v-a2|m20/,
    );
  });

  it("stops before an attempt past MAX_CALLS, keeping what it has and saying where it stopped", async () => {
    const world = worldFetch();
    const outcome = await run({
      settings: { ...LIVE, maxCalls: 5 },
      fetch: world.fetch,
    });
    expect(outcome.code).toBe(2);
    expect(world.requests).toHaveLength(5);
    expect(outcome.record.answers()).toHaveLength(5);
    expect(outcome.lines.find((line) => "stopped" in line)).toMatchObject({
      stopped: "max calls",
      festival: "sagebrush-sound-alder",
      town: "Alder",
      townsDone: 0,
      requestsThisRun: 5,
    });
    expect(JSON.parse(outcome.files.get("result.json")!)).toMatchObject({
      complete: false,
      stopped: { reason: "max calls", town: "Alder" },
      summary: { complete: false, barMet: null, productBar: null },
    });
  });

  it("stops at the first 429, then RESUME carries on without repeating a call, to the same result", async () => {
    const record = memoryRecord();
    const busy = worldFetch((_, n) =>
      n === 15
        ? new Response(JSON.stringify({ error: "Too Many Requests" }), {
            status: 429,
          })
        : undefined,
    );
    const first = await run({ fetch: busy.fetch, record });
    expect(first.code).toBe(2);
    expect(busy.requests).toHaveLength(15);
    expect(first.lines.find((line) => "stopped" in line)).toMatchObject({
      stopped: "rate limit",
      town: "Birch",
      townsDone: 1,
      // Birch Bar's two answers, in the mid and opening ranges, said it wasn't found.
      notFoundWarnings: 2,
    });
    expect(record.answers()).toHaveLength(14);

    const later = worldFetch();
    const second = await run({
      settings: { ...LIVE, resume: true },
      fetch: later.fetch,
      record,
    });
    expect(second.code).toBe(0);
    expect(later.requests).toHaveLength(4);
    const firstKeys = new Set(busy.requests.slice(0, 14).map(String));
    expect(later.requests.some((url) => firstKeys.has(String(url)))).toBe(
      false,
    );
    expect(record.answers()).toHaveLength(18);
    expect(record.attempts()).toHaveLength(19);

    const straight = await run();
    expect(second.summary).toEqual(straight.summary);
    expect(JSON.parse(second.files.get("result.json")!)).toMatchObject({
      requests: { thisRun: 4, all: 19 },
    });
  });

  it("won't start over a record from an earlier run without RESUME", async () => {
    const record = memoryRecord();
    await run({ settings: { ...LIVE, maxCalls: 2 }, record });
    const world = worldFetch();
    await expect(run({ fetch: world.fetch, record })).rejects.toThrow(
      /RESUME=1/,
    );
    expect(world.requests).toHaveLength(0);
  });

  it("stops at an answer the run can't read, rather than guess", async () => {
    const world = worldFetch((url) =>
      url.searchParams.get("filter.type") === "urn:entity:artist"
        ? new Response(JSON.stringify({ success: true, results: {} }), {
            status: 200,
          })
        : undefined,
    );
    const outcome = await run({ fetch: world.fetch });
    expect(outcome.code).toBe(2);
    expect(outcome.lines.find((line) => "stopped" in line)).toMatchObject({
      stopped: "unreadable",
      town: "Alder",
    });
  });
});
