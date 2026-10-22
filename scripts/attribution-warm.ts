// WS7, Daniel's decision of 2026-10-22: Qloo's split of each lineup act's result (docs/evidence.md
// section 35) for every checked town's saved build, two calls per build (one per fee range), made
// through the app's cached client so the app then reads them from the Qloo cache only
// (src/server/attribution.ts). The logic is in src/server/attribution-warm.ts.
//
// With no flags it calls nothing and writes nothing. It reads each festival's latest saved build
// from the store, read only, and stops unless every one is the build pinned in
// .design/pinned-builds/latest-pointers-2026-10-21.json. Then it prints the plan: each build's
// calls, those the cache already holds, and the exact number a live run would make. It also checks
// Boise's two answers saved by section 35 (.design/explainability/{mid,opener}.json) against the
// calls this build sends, and prints what seeding them would write.
//   SEED_BOISE=1           writes those two cache entries from the saved answers, through the
//                          app's client (no Qloo call), then prints the plan again.
//   LIVE=1 MAX_CALLS=<n>   makes the calls the cache doesn't hold, one at a time. Every HTTP
//                          attempt, retries included, counts against <n>, and the run stops before
//                          an attempt past it; it doesn't start if the plan alone needs more.
// It prints festival ids and counts only, never Qloo data. From the repository root:
//   node --env-file=.env.local --experimental-transform-types
//     --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON
//     --import ./scripts/register-ts.mjs scripts/attribution-warm.ts
// From a worktree, point --env-file, PINNED and EXPLAIN_DIR at the main folder's files.
import { existsSync, readFileSync } from "node:fs";
import { CHECKED_TOWNS } from "@/lib/checked-towns";
import { FEE_BAND_IDS, type FeeBandId } from "@/lib/fee-bands";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { checkedFestival } from "@/lib/towns";
import {
  pinnedBuilds,
  readOnlyCache,
  seedFromSaved,
  warmLive,
  warmPlan,
  warmSettings,
} from "@/server/attribution-warm";
import { createBuildStore } from "@/server/build-store";
import { createQlooCache } from "@/server/qloo-cache";

const settings = warmSettings(process.env);
const cache = createQlooCache();
if (cache.kind !== "upstash")
  throw new Error(
    "No Upstash settings: run with node --env-file=<main folder>/.env.local.",
  );
const readOnly = readOnlyCache(cache);
const PINNED =
  process.env.PINNED ?? ".design/pinned-builds/latest-pointers-2026-10-21.json";
const EXPLAIN_DIR = process.env.EXPLAIN_DIR ?? ".design/explainability";
const print = (value: unknown) => console.log(JSON.stringify(value));

const builds = await pinnedBuilds({
  store: createBuildStore(readOnly),
  festivalIds: CHECKED_TOWNS.map((town) => checkedFestival(town).id),
  pinned: JSON.parse(readFileSync(PINNED, "utf8")),
});
const boise = builds.find((build) => build.festivalId === SAGEBRUSH_SOUND.id);
if (!boise) throw new Error("Boise's build isn't among the pinned builds.");

/** Section 35's saved answers, by fee range; a missing file leaves its range out. */
function savedAnswers(): Partial<Record<FeeBandId, unknown>> {
  const answers: Partial<Record<FeeBandId, unknown>> = {};
  for (const band of FEE_BAND_IDS) {
    const file = `${EXPLAIN_DIR}/${band}.json`;
    if (existsSync(file))
      answers[band] = JSON.parse(readFileSync(file, "utf8"));
  }
  return answers;
}

async function showPlan(summary: string) {
  const plan = await warmPlan(builds, readOnly);
  for (const build of builds)
    print({
      festival: build.festivalId,
      pinned: true,
      calls: plan
        .filter((row) => row.buildId === build.id)
        .map((row) => ({
          band: row.call.band,
          acts: row.call.actIds.length,
          inputs: row.call.signalEntityIds.length,
          ages: row.call.ages.length,
          cached: row.cached,
        })),
    });
  const needed = plan.filter((row) => !row.cached).length;
  print({
    summary,
    builds: builds.length,
    calls: plan.length,
    cached: plan.length - needed,
    needed,
  });
  return { plan, needed };
}

if (settings.seedBoise) {
  for (const row of await seedFromSaved({
    build: boise,
    answers: savedAnswers(),
    cache,
    write: true,
  }))
    print({ seed: "boise", ...row });
  await showPlan("after seeding Boise");
} else if (settings.live) {
  const apiKey = process.env.QLOO_API_KEY;
  if (!apiKey) throw new Error("QLOO_API_KEY is not set.");
  const { plan } = await showPlan("before the live run");
  const report = await warmLive({
    rows: plan,
    cache,
    apiKey,
    baseUrl: process.env.QLOO_BASE_URL || undefined,
    fetch: globalThis.fetch,
    maxCalls: settings.maxCalls!,
  });
  for (const row of report.rows) print(row);
  print({
    live: true,
    maxCalls: settings.maxCalls,
    attempts: report.attempts,
    fetched: report.fetched,
    alreadyCached: report.alreadyCached,
    stopped: report.stopped,
  });
} else {
  const { needed } = await showPlan("dry run: nothing called or written");
  const seed = await seedFromSaved({
    build: boise,
    answers: savedAnswers(),
    cache: readOnly,
    write: false,
  });
  for (const row of seed) print({ seed: "boise, dry", ...row });
  const seedable = seed.filter((row) => row.key !== null).length;
  print({
    dry: true,
    liveCallsNeeded: needed,
    boiseSeedable: seedable,
    liveCallsAfterSeedingBoise: needed - seedable,
  });
}
