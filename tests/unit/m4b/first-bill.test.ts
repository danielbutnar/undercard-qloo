import { describe, expect, it } from "vitest";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import type { BuildStore, SavedBuild } from "@/server/build-store";
import { readFirstBill } from "@/server/first-bill";
import { readEvents, syntheticServer } from "../m3/scripted";

// A real saved build, made by the agent loop against fake Qloo and a scripted planner.
async function savedBuild(): Promise<SavedBuild> {
  const server = syntheticServer();
  await readEvents(server.build());
  return (await server.store.latest(SAGEBRUSH_SOUND.id))!;
}

const storeWith = (latest: BuildStore["latest"]) => ({ latest });

describe("the first screen's server read", () => {
  it("reads the latest saved build: its acts, its id and date, its calls and the rooms it tested", async () => {
    const saved = await savedBuild();
    const bill = await readFirstBill(
      storeWith(async () => saved),
      SAGEBRUSH_SOUND.id,
    );
    expect(bill).not.toBeNull();
    expect(bill!.build).toEqual({ id: saved.id, createdAt: saved.createdAt });
    expect(bill!.acts).toEqual(saved.lineup.acts);
    expect(bill!.calls).toBe(saved.trace.length);
    expect(bill!.anchors).toEqual(saved.context.anchors);
    expect(bill!.baselineTop).toEqual({ mid: 50, opener: 50 });
  });

  it("counts the Boise places Qloo listed from the build's venue search", async () => {
    const saved = await savedBuild();
    const venueSearch = saved.trace.find((call) => call.tool === "find_venues");
    const bill = await readFirstBill(
      storeWith(async () => saved),
      SAGEBRUSH_SOUND.id,
    );
    expect(bill!.placesListed).toBe(venueSearch?.resultCount ?? null);
    const withoutSearch = await readFirstBill(
      storeWith(async () => ({
        ...saved,
        trace: saved.trace.filter((call) => call.tool !== "find_venues"),
      })),
      SAGEBRUSH_SOUND.id,
    );
    expect(withoutSearch!.placesListed).toBeNull();
  });

  it("asks the store for the festival's latest build", async () => {
    const asked: string[] = [];
    await readFirstBill(
      storeWith(async (festivalId) => {
        asked.push(festivalId);
        return null;
      }),
      SAGEBRUSH_SOUND.id,
    );
    expect(asked).toEqual([SAGEBRUSH_SOUND.id]);
  });

  it("falls back to no bill when nothing is saved", async () => {
    expect(
      await readFirstBill(
        storeWith(async () => null),
        SAGEBRUSH_SOUND.id,
      ),
    ).toBeNull();
  });

  it("falls back to no bill when the store throws", async () => {
    expect(
      await readFirstBill(
        storeWith(async () => {
          throw new Error("Upstash is unreachable");
        }),
        SAGEBRUSH_SOUND.id,
      ),
    ).toBeNull();
  });

  it("falls back to no bill when the store doesn't answer in time", async () => {
    const started = Date.now();
    const bill = await readFirstBill(
      storeWith(() => new Promise(() => {})),
      SAGEBRUSH_SOUND.id,
      { timeoutMs: 50 },
    );
    expect(bill).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
