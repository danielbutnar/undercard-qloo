// WS17 phase 2a (Daniel, 29 October, 10:40): section 31 measured the 1.0 builds, so the claims
// that rest on it (With and Without Qloo, and the review's measures) read those builds by id from
// the pinned 1.0 record, .design/pinned-builds/latest-pointers-2026-10-21.json, through the build
// store, read-only. When the deploy moves a festival's latest pointer to its 2.0 build, they
// still read the 1.0 build. Every other claim keeps reading the latest builds. Invented data
// throughout: the synthetic store, with Boise's pointer moved to a second build.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
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
        missing: `no pinned 1.0 record (.design/${PINNED_RECORD}): section 31's builds are read by its ids`,
      });
  });
});

describe("the pinned 1.0 record", () => {
  it("gives each festival's build id, from the design folder", () => {
    const dir = mkdtempSync(join(tmpdir(), "evidence-pinned-"));
    mkdirSync(join(dir, "pinned-builds"));
    writeFileSync(
      join(dir, PINNED_RECORD),
      JSON.stringify({
        readAt: "2026-10-21T20:47:37.594Z",
        festivals: [
          { city: "Boise", festivalId: BOISE, buildId: "b-1", replayed: true },
          {
            city: "Austin",
            festivalId: `${BOISE}-austin`,
            buildId: "a-1",
            replayed: true,
          },
        ],
      }),
    );
    const pinned = readPinned(dir);
    expect(pinned?.ids).toEqual(
      new Map([
        [BOISE, "b-1"],
        [`${BOISE}-austin`, "a-1"],
      ]),
    );
    expect(pinned?.source).toContain(join(dir, PINNED_RECORD));
    expect(pinned?.source).toContain("2026-10-21T20:47:37.594Z");
    expect(readPinned(join(tmpdir(), "no-such-design-dir"))).toBeNull();
  });
});
