// Moving the 29 latest pointers to the re-run builds, with the 2.0 deploy (Daniel, 2026-10-28
// 23:10). Saved production state fails closed: every pointer is read with getOrThrow inside a time
// limit, and nothing is written unless every festival's move is clean (memory
// saved-state-fails-closed). Invented builds in an in-memory cache.
import { describe, expect, it } from "vitest";
import { createBuildStore, type SavedBuild } from "@/server/build-store";
import { createMemoryCache, type QlooCache } from "@/server/qloo-cache";
import { applyMoves, planMoves } from "@/server/pointer-move";
import { inventedBuild } from "../explain/invented";

function store() {
  const memory = createMemoryCache();
  const cache: QlooCache = {
    ...memory,
    get: (key) => memory.get(key),
    getOrThrow: (key) => memory.get(key),
    set: (key, value, ttl) => memory.set(key, value, ttl),
  };
  return { cache, builds: createBuildStore(cache) };
}
const build = (id: string, festivalId: string): SavedBuild =>
  inventedBuild({ id, festivalId });

async function seeded() {
  const { cache, builds } = store();
  for (const [festival, one, two] of [
    ["festival-a", "a-1", "a-2"],
    ["festival-b", "b-1", "b-2"],
  ]) {
    await builds.save(build(one, festival)); // the first build becomes the latest
    await builds.keep(build(two, festival)); // the re-run is kept by its id
  }
  return { cache, builds };
}

describe("moving the latest pointers (2026-10-29)", () => {
  it("plans each festival as a move, already moved, a mismatch or a missing build", async () => {
    const { cache, builds } = await seeded();
    await builds.keep(build("c-2", "festival-c"));
    const rows = await planMoves(cache, [
      { festivalId: "festival-a", from: "a-1", to: "a-2" },
      { festivalId: "festival-b", from: "b-0", to: "b-2" },
      { festivalId: "festival-a", from: "a-1", to: "nowhere" },
      { festivalId: "festival-a", from: "a-1", to: "c-2" },
    ]);
    expect(rows.map((row) => row.status)).toEqual([
      "move",
      "mismatch",
      "missing",
      "missing",
    ]);
    expect(rows[1].current).toBe("b-1");
  });

  it("writes nothing unless every move is clean", async () => {
    const { cache, builds } = await seeded();
    const rows = await planMoves(cache, [
      { festivalId: "festival-a", from: "a-1", to: "a-2" },
      { festivalId: "festival-b", from: "b-0", to: "b-2" },
    ]);
    const report = await applyMoves(cache, rows);
    expect(report.written).toBe(0);
    expect(report.refused.map((row) => row.festivalId)).toEqual(["festival-b"]);
    expect((await builds.latest("festival-a"))?.id).toBe("a-1");
  });

  it("moves every pointer when all are clean, and a second plan finds them moved", async () => {
    const { cache, builds } = await seeded();
    const moves = [
      { festivalId: "festival-a", from: "a-1", to: "a-2" },
      { festivalId: "festival-b", from: "b-1", to: "b-2" },
    ];
    const report = await applyMoves(cache, await planMoves(cache, moves));
    expect(report).toEqual({ written: 2, refused: [] });
    expect((await builds.latest("festival-a"))?.id).toBe("a-2");
    expect((await builds.latest("festival-b"))?.id).toBe("b-2");
    expect((await planMoves(cache, moves)).map((row) => row.status)).toEqual([
      "already",
      "already",
    ]);
  });

  it("counts a read that throws as unreadable, and then writes nothing", async () => {
    const { cache } = await seeded();
    const failing: QlooCache = {
      ...cache,
      getOrThrow: async (key) => {
        if (key.includes("festival-b")) throw new Error("Upstash is down");
        return cache.get(key);
      },
    };
    const rows = await planMoves(failing, [
      { festivalId: "festival-a", from: "a-1", to: "a-2" },
      { festivalId: "festival-b", from: "b-1", to: "b-2" },
    ]);
    expect(rows.map((row) => row.status)).toEqual(["move", "unreadable"]);
    expect((await applyMoves(failing, rows)).written).toBe(0);
  });

  it("refuses a cache that can't fail a read", async () => {
    const memory = createMemoryCache();
    await expect(
      planMoves(memory, [{ festivalId: "festival-a", from: "a-1", to: "a-2" }]),
    ).rejects.toThrow(/getOrThrow/);
  });
});
