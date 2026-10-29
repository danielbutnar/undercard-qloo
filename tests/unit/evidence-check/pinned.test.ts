// WS17 phase 2a (Daniel, 29 October, 10:40): section 31 measured the 1.0 builds, so the claims
// that rest on it (With and Without Qloo, and the review's measures) read those builds by id from
// the pinned 1.0 record, src/data/pinned-builds-2026-10-21.json (committed on Daniel's yes of 11:40:
// each entry only the town, the build id and the build date), through the build store, read-only. When the deploy moves a festival's latest pointer to its 2.0 build, they
// still read the 1.0 build. Every other claim keeps reading the latest builds. Invented data
// throughout: the synthetic store, with Boise's pointer moved to a second build.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  describe as describeComputation,
  evaluate,
  loadEvidence,
  PINNED_RECORD,
  readPinned,
  type PinnedBuilds,
} from "../../../scripts/evidence-check";
import { createBuildStore, type SavedBuild } from "@/server/build-store";
import { createMemoryCache, type QlooCache } from "@/server/qloo-cache";
import { seedSynthetic } from "@/server/synthetic-seed";

const BOISE = "sagebrush-sound";

/**
 * A fresh synthetic store (Boise's build of 10 acts, its model answer and the picks' searches),
 * then a second Boise build of 6 acts, saved under its own id, with the latest pointer moved to
 * it, as the deploy will move each pointer to its 2.0 build.
 */
async function movedPointer() {
  const cache = createMemoryCache();
  await seedSynthetic(cache, { savedBuild: true });
  const first = (await createBuildStore(cache).latest(BOISE))!;
  const second: SavedBuild = {
    ...first,
    id: `${first.id}-2`,
    lineup: { ...first.lineup, acts: first.lineup.acts.slice(0, 6) },
  };
  await cache.set(`undercard:build:v1:id:${second.id}`, second, 600);
  await cache.set(`undercard:build:v1:latest:${BOISE}`, second.id, 600);
  return { cache, first, second };
}

/** A cache that lists the keys it was asked for and refuses every write. */
function watched(cache: QlooCache) {
  const keys: string[] = [];
  const wrapped: QlooCache = {
    kind: cache.kind,
    get: async <T>(key: string) => {
      keys.push(key);
      return cache.get<T>(key);
    },
    set: async () => {
      throw new Error("a write");
    },
  };
  return { cache: wrapped, keys };
}

const pin = (festivalId: string, buildId: string): PinnedBuilds => ({
  source: "the test's pinned record",
  ids: new Map([[festivalId, buildId]]),
});

const noReplays = async () => new Response("", { status: 503 });

describe("section 31's claims", () => {
  it("read the pinned 1.0 build even when the latest pointer names another build", async () => {
    const { cache, first, second } = await movedPointer();
    expect((await createBuildStore(cache).latest(BOISE))?.id).toBe(second.id);
    expect(first.lineup.acts).toHaveLength(10);

    const data = await loadEvidence({
      base: "http://synthetic.test",
      fetch: noReplays,
      store: cache,
      design: null,
      pinned: pin(BOISE, first.id),
    });
    const value = (computation: Parameters<typeof evaluate>[0]) =>
      evaluate(computation, data);
    // With Qloo: the pinned build's 10 acts, not the latest build's 6, each against the three
    // tests every act on a Qloo lineup passes.
    for (const count of [
      "acts",
      "found",
      "inRange",
      "twoGenres",
      "climbs",
      "allThree",
    ] as const)
      expect(value({ kind: "with-qloo", count })).toBe(10);
    // The review's measures read the same build's lineup.
    expect(value({ kind: "measure", of: "distinct-with" })).toBe(10);
    // Without Qloo: Boise's saved answer, tested against the pinned build.
    expect(value({ kind: "without", count: "towns" })).toBe(1);
    expect(value({ kind: "without", count: "picks" })).toBe(10);
  });

  it("read each pinned build by its id, and never a latest pointer, writing nothing", async () => {
    const { cache: moved, first } = await movedPointer();
    const { cache, keys } = watched(moved);
    await loadEvidence({
      base: "http://synthetic.test",
      fetch: noReplays,
      store: cache,
      design: null,
      pinned: pin(BOISE, first.id),
    });
    expect(keys).toContain(`undercard:build:v1:id:${first.id}`);
    expect(keys.filter((key) => key.includes(":latest:"))).toEqual([]);
  });

  it("have no data, saying why, when the pinned record can't be read", async () => {
    const { cache } = await movedPointer();
    const data = await loadEvidence({
      base: "http://synthetic.test",
      fetch: noReplays,
      store: cache,
      design: null,
      pinned: null,
    });
    for (const computation of [
      { kind: "without", count: "picks" },
      { kind: "with-qloo", count: "acts" },
      { kind: "measure", of: "distinct-with" },
    ] as const)
      expect(evaluate(computation, data)).toEqual({
        missing: `no pinned 1.0 record (${PINNED_RECORD}): section 31's builds are read by its ids`,
      });
  });
});

/** A record under a temporary root, as the committed one sits under the repository's. */
function recordAt(builds: unknown[]) {
  const dir = mkdtempSync(join(tmpdir(), "evidence-pinned-"));
  mkdirSync(join(dir, dirname(PINNED_RECORD)), { recursive: true });
  writeFileSync(
    join(dir, PINNED_RECORD),
    JSON.stringify({
      about: "The test's record.",
      readAt: "2026-10-21T20:47:37.594Z",
      builds,
    }),
  );
  return dir;
}

describe("the pinned 1.0 record", () => {
  it("gives each checked town's festival its build id, by town", () => {
    const dir = recordAt([
      { town: "Boise", buildId: "b-1", createdAt: "2026-10-17T12:13:02.971Z" },
      { town: "Austin", buildId: "a-1", createdAt: "2026-10-17T14:57:06.405Z" },
    ]);
    const pinned = readPinned(dir);
    expect(pinned?.ids).toEqual(
      new Map([
        [BOISE, "b-1"],
        [`${BOISE}-austin`, "a-1"],
      ]),
    );
    expect(pinned?.source).toContain(PINNED_RECORD);
    expect(pinned?.source).toContain("2026-10-21T20:47:37.594Z");
    expect(readPinned(join(tmpdir(), "no-such-root-dir"))).toBeNull();
  });

  it("refuses an entry with more than its town, build id and date, or a town not checked", () => {
    const extra = {
      town: "Boise",
      buildId: "b-1",
      createdAt: "2026-10-17T12:13:02.971Z",
    };
    expect(readPinned(recordAt([{ ...extra, acts: ["An act"] }]))).toBeNull();
    expect(
      readPinned(recordAt([{ ...extra, town: "Springfield" }])),
    ).toBeNull();
  });

  it("reads the committed record: the 29 checked towns' 1.0 builds", () => {
    const pinned = readPinned(
      fileURLToPath(new URL("../../../", import.meta.url)),
    );
    expect(pinned?.ids.size).toBe(29);
    expect(pinned?.ids.get(BOISE)).toBe("27de886f-1ddf-48f1-856d-d2cb5493443d");
  });
});

// Daniel, 29 October 13:30: every claim about earlier builds reads the builds it measured, by id,
// as section 31's do, failing closed without the record. The pinned 1.0 builds are replayed
// in-process from the store, through the app's own replay handler, with no Qloo or model call.
describe("claims about earlier builds", () => {
  const boiseFull = {
    kind: "full-lineups",
    towns: ["Boise"],
    builds: "pinned-1.0",
  } as const;

  it("read the build the record pins, by id, even when the latest pointer names another", async () => {
    const { cache, first, second } = await movedPointer();
    const load = (id: string) =>
      loadEvidence({
        base: "http://synthetic.test",
        fetch: noReplays,
        store: cache,
        design: null,
        pinned: pin(BOISE, id),
      });
    // The latest replays fail here, so only the pinned build can answer: the first build of 10
    // acts fills the bill, the second of 6 doesn't.
    expect(evaluate(boiseFull, await load(first.id))).toBe(1);
    expect(evaluate(boiseFull, await load(second.id))).toBe(0);
    const data = await load(first.id);
    expect(
      evaluate({ kind: "full-lineups", towns: ["Boise"] }, data),
    ).toHaveProperty("missing");
    expect(describeComputation(boiseFull)).toContain("the pinned 1.0 build");
  });

  it("read the pinned builds by id and never a latest pointer, writing nothing", async () => {
    const { cache: moved, first } = await movedPointer();
    const { cache, keys } = watched(moved);
    const data = await loadEvidence({
      base: "http://synthetic.test",
      fetch: noReplays,
      store: cache,
      design: null,
      pinned: pin(BOISE, first.id),
    });
    expect(evaluate(boiseFull, data)).toBe(1);
    expect(keys).toContain(`undercard:build:v1:id:${first.id}`);
    expect(keys.filter((key) => key.includes(":latest:"))).toEqual([]);
  });

  it("have no data, saying why, without the record or the store", async () => {
    const { cache, first } = await movedPointer();
    const noRecord = await loadEvidence({
      base: "http://synthetic.test",
      fetch: noReplays,
      store: cache,
      design: null,
      pinned: null,
    });
    expect(evaluate(boiseFull, noRecord)).toEqual({
      missing: `no pinned 1.0 record (${PINNED_RECORD}): claims about the 1.0 builds read them by id`,
    });
    const noStore = await loadEvidence({
      base: "http://synthetic.test",
      fetch: noReplays,
      store: null,
      design: null,
      pinned: pin(BOISE, first.id),
    });
    expect(evaluate(boiseFull, noStore)).toEqual({
      missing:
        "no store: the pinned 1.0 builds are read from it by id, read-only",
    });
  });
});
