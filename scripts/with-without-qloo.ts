// With and Without Qloo as a number (docs/evidence.md section 31): for each of the 29 checked
// towns, the saved build's lineup and the model's own ten picks, each scored on the three tests
// every Qloo act passes (src/lib/pick-tests.ts). The build's lists come from the Qloo cache with
// no call; the model is asked only where the app has no saved answer (at most 27 calls), and
// each pick is searched on Qloo once (at most 290 attempts). The console gets counts only; the
// names go to .design/with-without-qloo/. DRY=1 calls nothing: it checks every build rebuilds
// and how many answers and searches are already saved. From the root:
//   node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/with-without-qloo.ts
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import type { RankedArtist } from "@/lib/assemble-lineup";
import { CHECKED_TOWNS } from "@/lib/checked-towns";
import { foundOnQloo, normalise, pickTests } from "@/lib/pick-tests";
import { checkedFestival } from "@/lib/towns";
import { createLlmOnlyModel, type LlmOnlyModel } from "@/server/ai";
import { createBuildStore } from "@/server/build-store";
import { handleLlmOnly } from "@/server/llm-only";
import { createQlooCache } from "@/server/qloo-cache";
import { createQlooClient, QlooCacheMiss } from "@/server/qloo";
import type { RateLimiter } from "@/server/rate-limit";
import { assemblyFromSaved } from "@/server/venue-switch";

const MAX_MODEL_CALLS = 27;
const MAX_SEARCHES = 290;
const DRY = process.env.DRY === "1";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const cache = createQlooCache();
if (cache.kind !== "upstash") throw new Error("no Upstash settings found");
const store = createBuildStore(cache);

// The builds' own lists: the cache only, never a call.
const saved = createQlooClient({
  apiKey: "",
  cache,
  cacheOnly: true,
  fetch: async () => {
    throw new Error("the builds' lists must come from the cache");
  },
});
// The picks' searches: each distinct search counts once against the cap; a retry after a 429
// is another attempt at the same search, counted apart.
const searched = new Set<string>();
let searches = 0;
const live = createQlooClient({
  apiKey: DRY ? "" : (process.env.QLOO_API_KEY ?? ""),
  cache,
  cacheOnly: DRY,
  fetch: async (input, init) => {
    searches++;
    searched.add(String(input));
    if (searched.size > MAX_SEARCHES)
      throw new Error(`over the ${MAX_SEARCHES} Qloo searches approved`);
    return fetch(input, init);
  },
});
let modelCalls = 0;
const model: LlmOnlyModel | null = DRY
  ? null
  : (() => {
      const llm = createLlmOnlyModel();
      return {
        suggest: (brief: string) => {
          if (++modelCalls > MAX_MODEL_CALLS)
            throw new Error(`over the ${MAX_MODEL_CALLS} model calls approved`);
          return llm.suggest(brief);
        },
      };
    })();
// An offline run, not a judge: the route's per-IP limit doesn't apply.
const limiter: RateLimiter = {
  kind: "memory",
  check: async () => ({ allowed: true }),
};

/** One festival's counts; `rebuilt` is false when its saved lists can't be read. */
const rows: ({ festival: string; rebuilt: boolean } & Record<
  string,
  unknown
>)[] = [];
const names: Record<string, unknown> = {};
for (const town of CHECKED_TOWNS) {
  const festival = checkedFestival(town);
  const build = await store.latest(festival.id);
  const input = build ? await assemblyFromSaved(build, festival, saved) : null;
  if (!build || !input) {
    rows.push({ festival: festival.id, rebuilt: false });
    continue;
  }
  // With Qloo: each booked act as its own venue's list has it.
  const qlooActs = build.lineup.acts.map((act) => {
    const listed = input.venueRuns
      .find(
        (run) =>
          run.band === act.band &&
          run.venue.entityId === act.anchorVenue.entityId,
      )
      ?.artists.find((artist) => artist.entityId === act.entityId);
    return { name: act.name, tests: listed ? pickTests(input, listed) : null };
  });
  // Without Qloo: the app's own answer, saved or asked once.
  const answer = await handleLlmOnly({
    festival,
    model: () => model,
    cache,
    limiter,
    ip: "offline-section-31",
  });
  const body = (await answer.json()) as {
    lineup?: { picks: { name: string }[] };
    cached?: boolean;
  };
  const picks = [];
  for (const pick of body.lineup?.picks ?? []) {
    let found: RankedArtist | null = null;
    let searched = true;
    try {
      // Section 18's normalising, as section 31 counted; the app folds accents too (WS18).
      found = foundOnQloo(
        pick.name,
        (await live.search({ query: pick.name })).data,
        undefined,
        normalise,
      );
    } catch (error) {
      if (!(error instanceof QlooCacheMiss)) throw error;
      searched = false;
    }
    picks.push({
      name: pick.name,
      searched,
      found: found?.name ?? null,
      tests: found ? pickTests(input, found) : null,
    });
  }
  const count = (
    list: { tests: ReturnType<typeof pickTests> | null }[],
    test: (t: ReturnType<typeof pickTests>) => boolean,
  ) => list.filter((item) => item.tests && test(item.tests)).length;
  rows.push({
    festival: festival.id,
    rebuilt: true,
    answerSaved: body.cached === true,
    qlooActs: qlooActs.length,
    qlooAllThree: count(qlooActs, (t) => t.passes),
    picks: picks.length,
    searched: picks.filter((pick) => pick.searched).length,
    found: picks.filter((pick) => pick.found !== null).length,
    inFeeRange: count(picks, (t) => t.inFeeRange),
    above: count(picks, (t) => t.range === "above"),
    below: count(picks, (t) => t.range === "below"),
    twoGenres: count(picks, (t) => t.genres >= 2),
    climbs: count(picks, (t) => t.climb !== null && t.climb > 0),
    allThree: count(picks, (t) => t.passes),
  });
  names[festival.id] = { qlooActs, picks };
  console.log(JSON.stringify(rows.at(-1)));
}
const sum = (key: string) =>
  rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
console.log(
  JSON.stringify({
    dry: DRY,
    festivals: rows.length,
    rebuilt: rows.filter((row) => row.rebuilt).length,
    modelCalls,
    searches: searched.size,
    searchAttempts: searches,
    qlooActs: sum("qlooActs"),
    qlooAllThree: sum("qlooAllThree"),
    picks: sum("picks"),
    found: sum("found"),
    inFeeRange: sum("inFeeRange"),
    above: sum("above"),
    below: sum("below"),
    twoGenres: sum("twoGenres"),
    climbs: sum("climbs"),
    allThree: sum("allThree"),
  }),
);
if (!DRY) {
  mkdirSync(".design/with-without-qloo", { recursive: true });
  writeFileSync(
    ".design/with-without-qloo/result.json",
    `${JSON.stringify({ ranAt: new Date().toISOString(), modelCalls, searches: searched.size, searchAttempts: searches, rows, names }, null, 1)}\n`,
  );
}
