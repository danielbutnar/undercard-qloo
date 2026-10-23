// The review's three measures over the With and Without Qloo lineups (docs/evidence.md section
// 31, plan.md item 8), with no model or Qloo call: the saved builds, the app's saved Without Qloo
// answers and the cached searches of section 31's run. Prints counts only; writes the aggregate
// counts the toggle's line shows to src/data/with-without-qloo.json and the per-town detail to
// .design/with-without-qloo/measures.json (git-ignored). From the root:
//   node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/with-without-measures.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CHECKED_TOWNS } from "@/lib/checked-towns";
import { LlmOnlyLineupSchema } from "@/lib/llm-only";
import { checkedFestival } from "@/lib/towns";
import { lineupMeasures, type TownLineups } from "@/lib/with-without";
import { createBuildStore } from "@/server/build-store";
import { createQlooCache } from "@/server/qloo-cache";
import { createQlooClient, QlooCacheMiss } from "@/server/qloo";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const cache = createQlooCache();
if (cache.kind !== "upstash") throw new Error("no Upstash settings found");
const store = createBuildStore(cache);
let calls = 0;
const qloo = createQlooClient({
  apiKey: "",
  cache,
  cacheOnly: true,
  fetch: async () => {
    calls++;
    throw new Error("the measures must not call Qloo");
  },
});

/** Section 18's normalising: accents, case, a bracketed note and a leading "The" dropped. */
const normalise = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\([^)]*\)/g, "")
    .toLowerCase()
    .replace(/^\s*the\s+/, "")
    .replace(/[^\p{L}\p{N}]/gu, "");

const towns: (TownLineups & { festival: string })[] = [];
let resolved = 0;
let unresolved = 0;
for (const town of CHECKED_TOWNS) {
  const festival = checkedFestival(town);
  const build = await store.latest(festival.id);
  const answer = LlmOnlyLineupSchema.safeParse(
    await cache.get(`undercard:llm-only:v2:${festival.id}`),
  );
  if (!build || !answer.success)
    throw new Error(`${festival.id}: no saved build or no saved answer`);
  const without: string[] = [];
  for (const pick of answer.data.picks) {
    let id: string | null = null;
    try {
      id =
        (await qloo.search({ query: pick.name })).data.find(
          (entity) => normalise(entity.name) === normalise(pick.name),
        )?.entityId ?? null;
    } catch (error) {
      if (!(error instanceof QlooCacheMiss)) throw error;
    }
    if (id) resolved++;
    else unresolved++;
    without.push(id ? id.toUpperCase() : `name:${normalise(pick.name)}`);
  }
  towns.push({
    festival: festival.id,
    with: build.lineup.acts.map((act) => act.entityId.toUpperCase()),
    without,
  });
}
const m = lineupMeasures(towns);
// Section 31's own counts, from its run's output: the model's picks and how many pass the tests.
const run = JSON.parse(
  readFileSync(".design/with-without-qloo/result.json", "utf8"),
) as { rows: { picks?: number; allThree?: number }[] };
const total = (key: "picks" | "allThree") =>
  run.rows.reduce((sum, row) => sum + (row[key] ?? 0), 0);
const aggregate = {
  computedAt: new Date().toISOString().slice(0, 10),
  towns: towns.length,
  // Two decimals and the exact count: one decimal wrote 9.97 as 10 and hid Duluth's shared act.
  averageChanged: Number(m.averageChanged.toFixed(2)),
  sharedActs: m.sharedActs,
  townsSharingAnAct: m.townsSharingAnAct,
  townsChangedSeven: m.townsChangedSeven,
  distinctWith: m.distinctWith,
  distinctWithout: m.distinctWithout,
  inHalfOrMoreWithout: m.inHalfOrMoreWithout,
  barMet: m.barMet,
  picks: total("picks"),
  picksPassing: total("allThree"),
};
console.log(
  JSON.stringify({ ...aggregate, resolved, unresolved, qlooCalls: calls }),
);
mkdirSync("src/data", { recursive: true });
writeFileSync(
  "src/data/with-without-qloo.json",
  `${JSON.stringify(aggregate, null, 2)}\n`,
);
mkdirSync(".design/with-without-qloo", { recursive: true });
writeFileSync(
  ".design/with-without-qloo/measures.json",
  `${JSON.stringify({ aggregate, changed: m.changed, towns }, null, 1)}\n`,
);
