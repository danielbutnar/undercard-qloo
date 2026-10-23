// The buyer's shortlist (WS4), step 5: Boise's example for /shortlist. The model's own ten picks
// from Boise's saved Without Qloo answer, checked against Boise's saved build the way a buyer's
// check is: the picks' searches come from the Qloo cache only (section 31's run left them there;
// one the cache lacks stays "not checked" and is never searched), and at most 4 /v2/insights
// calls are made, one for the headliners alone and one per anchor venue, through the app's own
// cached client, so the page reads the example from the cache alone. No model call, no search,
// no build or latest pointer written. The console gets counts only; the rows go to
// .design/shortlist-example/ (git-ignored). DRY=1 calls nothing: it says what the cache holds and
// what a run would call. From the root:
//   DRY=1 node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/shortlist-example.ts
// and the same without DRY=1 to make the calls.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { SHORTLIST_CALL_CAP, type Shortlist } from "@/lib/shortlist";
import { createBuildStore } from "@/server/build-store";
import { createQlooClient } from "@/server/qloo";
import { createQlooCache } from "@/server/qloo-cache";
import {
  callBudget,
  checkShortlist,
  EXAMPLE_INSIGHTS_CALLS,
  shortlistExample,
  writeShortlistExample,
} from "@/server/shortlist";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const DRY = process.env.DRY === "1";
const festival = SAGEBRUSH_SOUND;
const cache = createQlooCache();
if (cache.kind !== "upstash")
  throw new Error("no Upstash settings found (.env.local)");
// The build store is only read: this script never saves a build or moves a latest pointer.
const store = createBuildStore(cache);
const build = await store.latest(festival.id);
if (!build) throw new Error(`${festival.city} has no saved build`);

/** What a shortlist says, in counts: no names, ids or scores. */
function counts(shortlist: Shortlist) {
  const status = (name: string) =>
    shortlist.acts.filter((act) => act.status === name).length;
  return {
    found: status("found"),
    notFound: status("not-found"),
    notChecked: status("not-checked"),
    headliners: status("headliner"),
    climbing: shortlist.acts.filter(
      (act) => act.status === "found" && act.climb !== null && act.climb > 0,
    ).length,
    venuesRead: `${shortlist.venues.filter((venue) => venue.read).length} of ${shortlist.venues.length}`,
    venuesWithNoFanData: shortlist.venues.filter((venue) => venue.noFanData)
      .length,
    calls: shortlist.calls.length,
    cachedCalls: shortlist.calls.filter((call) => call.cached).length,
  };
}

const before = await shortlistExample({ festival, cache, store });
if (!before)
  throw new Error(`${festival.city} has no saved Without Qloo answer`);
console.log(
  JSON.stringify({
    build: build.id,
    builtAt: build.createdAt,
    picks: before.names.length,
    alreadyReadable: before.shortlist !== null,
  }),
);
if (before.shortlist) {
  console.log(JSON.stringify({ example: counts(before.shortlist) }));
  console.log(
    "The page already reads the example from the cache: no call made.",
  );
  process.exit(0);
}

if (DRY) {
  // The same check on a cache-only client: which searches and rankings the cache holds.
  const reader = createQlooClient({
    apiKey: "",
    cache,
    cacheOnly: true,
    fetch: async () => {
      throw new Error("a dry run never calls Qloo");
    },
  });
  const dry = await checkShortlist({
    festival,
    build,
    names: before.names,
    budget: callBudget({
      live: reader,
      cached: reader,
      cap: SHORTLIST_CALL_CAP,
    }),
  });
  const cachedOf = (tool: string) =>
    dry.calls.filter((call) => call.tool === tool).length;
  const rankings = dry.acts.some((act) => act.status === "found")
    ? 1 + dry.venues.length
    : 0;
  console.log(
    JSON.stringify({
      dryRun: true,
      searchesCached: `${cachedOf("shortlist_search")} of ${before.names.length}`,
      rankingsCached: `${cachedOf("shortlist_rank")} of ${rankings}`,
      wouldCall: `${rankings - cachedOf("shortlist_rank")} insights calls (at most ${EXAMPLE_INSIGHTS_CALLS}), no search, no model call`,
    }),
  );
  process.exit(0);
}

const apiKey = process.env.QLOO_API_KEY;
if (!apiKey) throw new Error("QLOO_API_KEY is not set (put it in .env.local)");
const run = await writeShortlistExample({
  festival,
  cache,
  store,
  apiKey,
  fetch: globalThis.fetch,
});
const after = await shortlistExample({ festival, cache, store });
console.log(
  JSON.stringify({
    insightsCalls: run.insightsCalls,
    attempts: run.attempts,
    example: counts(run.shortlist),
    readableByThePage: Boolean(after?.shortlist),
  }),
);
mkdirSync(".design/shortlist-example", { recursive: true });
writeFileSync(
  ".design/shortlist-example/boise.json",
  `${JSON.stringify(after, null, 2)}\n`,
);
console.log(
  "Rows written to .design/shortlist-example/boise.json (git-ignored).",
);
