import { describe, expect, it } from "vitest";
import { memoryRecord, type RunRecord } from "@/server/control-test-37-client";
import {
  planSide,
  runControlTest37,
  SECTION_34_CONTROL_TOWNS,
  settingsFrom,
  type Settings,
} from "@/server/control-test-37-run";
import { createMemoryCache } from "@/server/qloo-cache";
import { BUILDS, FESTIVALS, TOWNS, worldFetch } from "./world";

// In the synthetic world, Alder's side control town is Cedar (its section 37 one is Birch).
const SIDE = { Alder: "Cedar" };

async function run(
  settings: Settings,
  {
    fetch = worldFetch().fetch,
    record = memoryRecord(),
    mainRecord,
  }: {
    fetch?: typeof globalThis.fetch;
    record?: RunRecord;
    mainRecord?: RunRecord;
  } = {},
) {
  const cache = createMemoryCache();
  for (const build of BUILDS) {
    await cache.set(`undercard:build:v1:id:${build.id}`, build, 3600);
    await cache.set(
      `undercard:build:v1:latest:${build.festivalId}`,
      build.id,
      3600,
    );
  }
  const lines: Record<string, unknown>[] = [];
  const files = new Map<string, string>();
  const outcome = await runControlTest37({
    settings,
    serverCache: cache,
    pinned: {
      festivals: BUILDS.map((build) => ({
        festivalId: build.festivalId,
        buildId: build.id,
      })),
    },
    towns: TOWNS,
    record,
    mainRecord,
    sideControls: SIDE,
    fetch,
    apiKey: "test-key",
    log: (line) => lines.push(line as Record<string, unknown>),
    write: (name, text) => void files.set(name, text),
    now: () => Date.parse("2026-10-28T10:00:00.000Z"),
    sleep: async () => {},
  });
  return { ...outcome, lines, files };
}

const LIVE: Settings = {
  mode: "live",
  maxCalls: 100,
  resume: false,
  spacingMs: 0,
  side: false,
};

describe("the side check (section 37's reading 5)", () => {
  it("reads SIDE=1 as its own phase, with its own MAX_CALLS and RESUME", () => {
    expect(settingsFrom({ SIDE: "1" })).toMatchObject({
      mode: "dry",
      side: true,
    });
    expect(
      settingsFrom({ SIDE: "1", LIVE: "1", MAX_CALLS: "30", RESUME: "1" }),
    ).toMatchObject({ mode: "live", side: true, maxCalls: 30, resume: true });
  });

  it("takes section 34's control towns for Bucharest, Montreal and Tallinn", () => {
    expect(SECTION_34_CONTROL_TOWNS).toEqual({
      Bucharest: "Calgary",
      Montreal: "Oslo",
      Tallinn: "Utrecht",
    });
  });

  it("plans only the calls the main run doesn't make: the side controls", () => {
    expect(
      planSide(FESTIVALS, TOWNS, SIDE).map((row) => [
        row.city,
        row.controlCity,
        row.calls,
      ]),
    ).toEqual([
      [
        "Alder",
        "Cedar",
        {
          findVenues: 0,
          entities: 0,
          headlinersOnly: 0,
          venues: 0,
          controlsAtMost: 3,
          total: 3,
        },
      ],
    ]);
  });

  it("reads each venue's control in the side town too, reusing the main run's answers, and reports each act's lift both ways", async () => {
    const mainRecord = memoryRecord();
    expect((await run(LIVE, { record: mainRecord })).code).toBe(0);

    const world = worldFetch();
    const sideRecord = memoryRecord();
    const side = await run(
      { ...LIVE, side: true, maxCalls: 5 },
      { fetch: world.fetch, record: sideRecord, mainRecord },
    );
    expect(side.code).toBe(0);
    // Only Cedar Yard's opening ranking is new: everything else is the main run's.
    expect(
      world.requests.map(
        (url) =>
          `${url.searchParams.get("filter.popularity.min")} ${url.searchParams.get("signal.interests.entities")}`,
      ),
    ).toEqual(["0.55 h-1,h-2,v-c2"]);
    expect(sideRecord.answers()).toHaveLength(1);
    expect(mainRecord.answers()).toHaveLength(18);

    const result = JSON.parse(side.files.get("side-result.json")!);
    expect(
      result.acts.map(
        (act: {
          entityId: string;
          main: number | null;
          side: number | null;
        }) => [act.entityId, act.main, act.side],
      ),
    ).toEqual([
      // In Cedar no room moves the mid range's ranking; Cedar Room moves the opening range's.
      ["m20", 8, null],
      ["m30", 4, null],
      ["o15", 2, 14],
    ]);
    const page = side.files.get("side-result.md")!;
    expect(page).toContain("| Alder | Birch | Cedar | 3 | 1 | 1 | 2 | 1 |");
    expect(page).not.toMatch(/Act |Alder Club|Cedar Room|v-a|v-c|m20|o15/);
  });

  it("won't start over its own earlier record without RESUME, and doesn't need the main run's to start", async () => {
    const sideRecord = memoryRecord();
    const first = await run(
      { ...LIVE, side: true, maxCalls: 2 },
      { record: sideRecord, mainRecord: memoryRecord() },
    );
    expect(first.code).toBe(2);
    await expect(
      run(
        { ...LIVE, side: true },
        { record: sideRecord, mainRecord: memoryRecord() },
      ),
    ).rejects.toThrow(/RESUME=1/);
  });
});
