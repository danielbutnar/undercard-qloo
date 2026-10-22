// WS2, no fan data in the synthetic seed (src/server/synthetic-seed.ts): the default build's
// Cottonwood Social Hall gets Qloo's headliners-only ranking back as its run, so the e2e meets the
// no-fan-data words; Nashville's build reads Linden Street Annex, whose ranking changes but moves
// no act 5 places, so it keeps the old words. Invented names and numbers.
import { describe, expect, it } from "vitest";
import { liftsOver, MIN_LIFT } from "@/lib/assemble-lineup";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { townBySlug } from "@/lib/towns";
import { createBuildStore } from "@/server/build-store";
import { noFanDataFor } from "@/server/fan-data";
import { createQlooClient } from "@/server/qloo";
import { createQlooCache, SYNTHETIC_ENV } from "@/server/qloo-cache";
import { assemblyFromSaved } from "@/server/venue-switch";
import {
  SYNTHETIC_BUILD_ID,
  SYNTHETIC_SWITCH_BUILD_ID,
  syntheticSavedBuild,
} from "../../e2e/synthetic-build";

const cache = createQlooCache({ [SYNTHETIC_ENV]: "1" });
const store = createBuildStore(cache);
const qloo = createQlooClient({
  apiKey: "",
  cache,
  cacheOnly: true,
  fetch: async () => {
    throw new Error("no Qloo call");
  },
});
const NASHVILLE = townBySlug("nashville")!.festival;
const COTTONWOOD = syntheticSavedBuild().context.anchors.mid![2];

describe("the synthetic seed's venue runs", () => {
  it("give Cottonwood Social Hall no fan data in the default build", async () => {
    expect(
      await noFanDataFor({
        store,
        qloo,
        festival: SAGEBRUSH_SOUND,
        buildId: SYNTHETIC_BUILD_ID,
      }),
    ).toEqual([COTTONWOOD.entityId]);
  });

  it("give Nashville's switch build a venue read for real that moves no act", async () => {
    const buildId = `${SYNTHETIC_SWITCH_BUILD_ID}-nashville`;
    expect(
      await noFanDataFor({ store, qloo, festival: NASHVILLE, buildId }),
    ).toEqual([]);
    const saved = (await store.byId(buildId))!;
    const input = (await assemblyFromSaved(saved, NASHVILLE, qloo))!;
    const idle = input.venueRuns.filter(
      (run) => run.venue.name === "Linden Street Annex",
    );
    expect(idle.map((run) => run.band)).toEqual(["mid"]);
    const ranking = saved.context.baselines.mid!;
    expect(idle[0].artists.map((artist) => artist.entityId)).not.toEqual(
      ranking,
    );
    expect(
      liftsOver(
        ranking.map((entityId) => ({ entityId })),
        idle[0].artists,
      ).filter((entry) => entry.lift >= MIN_LIFT),
    ).toEqual([]);
    expect(
      saved.lineup.acts.filter(
        (act) => act.anchorVenue.name === "Linden Street Annex",
      ),
    ).toEqual([]);
  });
});
