// WS2, no fan data, carried to the screens: worked out on the server from the saved build and the
// Qloo cache only (never a Qloo call), on the first bill and How it works' story the way the
// agent's switches are. Invented data only.
import { describe, expect, it } from "vitest";
import { methodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createBuildStore } from "@/server/build-store";
import { noFanDataFor, withFanData } from "@/server/fan-data";
import { readFirstBill } from "@/server/first-bill";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { assemblyFromSaved } from "@/server/venue-switch";
import { syntheticSavedBuild } from "../../e2e/synthetic-build";

const build = syntheticSavedBuild();
const [, , COTTONWOOD] = build.context.anchors.mid!;
const raw = (entityId: string) => ({
  entity_id: entityId,
  name: `Act ${entityId}`,
  popularity: 0.85,
  query: { affinity: 0.5 },
});

// Qloo's answers, cached the way a build caches them: Cottonwood Social Hall's run is the
// headliners-only ranking itself; every other venue's run is a ranking of its own.
async function store({ runs = true } = {}) {
  const cache = createMemoryCache();
  const builds = createBuildStore(cache);
  await builds.save(build);
  if (runs)
    await assemblyFromSaved(
      build,
      SAGEBRUSH_SOUND,
      createQlooClient({
        apiKey: "test",
        cache,
        fetch: async (input) => {
          const url = new URL(String(input));
          const band =
            url.searchParams.get("filter.popularity.min") === "0.8"
              ? "mid"
              : "opener";
          const ranking = build.context.baselines[band]!;
          const own = (url.searchParams.get("signal.interests.entities") ?? "")
            .split(",")
            .includes(COTTONWOOD.entityId);
          return Response.json({
            results: {
              entities: (own ? ranking : [...ranking].reverse()).map(raw),
            },
          });
        },
      }),
    );
  const qloo = createQlooClient({
    apiKey: "",
    cache,
    cacheOnly: true,
    fetch: async () => {
      throw new Error("no Qloo call");
    },
  });
  return { store: builds, qloo };
}

describe("no fan data on the server", () => {
  it("finds the venue whose runs are the headliners-only ranking, from the cache", async () => {
    const deps = await store();
    expect(
      await noFanDataFor({
        ...deps,
        festival: SAGEBRUSH_SOUND,
        buildId: build.id,
      }),
    ).toEqual([COTTONWOOD.entityId]);
  });

  it("finds none when the cache can't rebuild the build's runs, or the build is another festival's", async () => {
    expect(
      await noFanDataFor({
        ...(await store({ runs: false })),
        festival: SAGEBRUSH_SOUND,
        buildId: build.id,
      }),
    ).toEqual([]);
    expect(
      await noFanDataFor({
        ...(await store()),
        festival: { ...SAGEBRUSH_SOUND, id: "sagebrush-sound-austin" },
        buildId: build.id,
      }),
    ).toEqual([]);
  });

  it("goes on the first bill and How it works' story, and stays off a bill with none", async () => {
    const deps = await store();
    const first = await readFirstBill(deps.store, SAGEBRUSH_SOUND.id);
    const bill = await withFanData(first, SAGEBRUSH_SOUND, deps);
    expect(bill?.noFanData).toEqual([COTTONWOOD.entityId]);
    expect(methodStory(SAGEBRUSH_SOUND, bill)?.noFanData).toEqual([
      COTTONWOOD.entityId,
    ]);

    const none = await withFanData(
      first,
      SAGEBRUSH_SOUND,
      await store({ runs: false }),
    );
    expect(none).toEqual(first);
    expect(await withFanData(null, SAGEBRUSH_SOUND, deps)).toBeNull();
  });
});
