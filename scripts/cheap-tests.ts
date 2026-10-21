// The two cheap tests (docs/evidence.md section 33, plan.md item 9). Each run goes through the
// agent offline with a fresh memory cache, so it reads today's Qloo and writes nothing to Redis;
// the saved builds are only read, to compare. The console gets counts and the chosen pair's
// names; act names and Qloo's values go to .design/cheap-tests/ (git-ignored). From the root:
//   node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/cheap-tests.ts --test pair | stability | second
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { BuildEvent } from "@/lib/build-events";
import { CHECKED_TOWNS } from "@/lib/checked-towns";
import type { Festival } from "@/lib/festival";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { checkedFestival } from "@/lib/towns";
import { runUndercardAgent } from "@/server/agent";
import { createAgentModel } from "@/server/ai";
import { createBuildStore } from "@/server/build-store";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache, createQlooCache } from "@/server/qloo-cache";

const { values } = parseArgs({ options: { test: { type: "string" } } });
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const apiKey = process.env.QLOO_API_KEY;
if (!apiKey) throw new Error("QLOO_API_KEY is not set (put it in .env.local).");
const OUT = ".design/cheap-tests";
mkdirSync(OUT, { recursive: true });

let qlooCalls = 0;
/** A client on today's Qloo with nothing cached, every network call counted. */
const freshQloo = () =>
  createQlooClient({
    apiKey,
    cache: createMemoryCache(),
    baseUrl: process.env.QLOO_BASE_URL || undefined,
    fetch: async (input, init) => {
      qlooCalls++;
      return fetch(input, init);
    },
  });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Section 18's normalising: accents, case, a bracketed note and a leading "The" dropped. */
const normalise = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\([^)]*\)/g, "")
    .toLowerCase()
    .replace(/^\s*the\s+/, "")
    .replace(/[^\p{L}\p{N}]/gu, "");

// A run that met Qloo's rate limit is redone after a pause, as in section 5.
const rateLimited = (events: BuildEvent[]) =>
  events.some(
    (event) =>
      (event.type === "error" && /HTTP 429/.test(event.message)) ||
      (event.type === "call" && /429/.test(event.call.error ?? "")),
  );
async function freshRun(festival: Festival) {
  for (let attempt = 1; ; attempt++) {
    const events: BuildEvent[] = [];
    const result = await runUndercardAgent({
      festival,
      qloo: freshQloo(),
      model: createAgentModel(),
      emit: (event) => events.push(event),
    });
    if (!rateLimited(events) || attempt === 3)
      return { result, attempts: attempt, rateLimited: rateLimited(events) };
    await sleep(30_000);
  }
}

const store = createBuildStore(createQlooCache());
async function compare(festival: Festival) {
  const saved = await store.latest(festival.id);
  if (!saved) throw new Error(`${festival.id}: no saved build`);
  const run = await freshRun(festival);
  const acts = run.result.lineup?.acts ?? [];
  const savedIds = new Set(
    saved.lineup.acts.map((act) => act.entityId.toUpperCase()),
  );
  const same = acts.filter((act) => savedIds.has(act.entityId.toUpperCase()));
  return {
    counts: {
      festival: festival.id,
      bothGroupsFilled: run.result.complete,
      acts: acts.length,
      sameAsSaved: same.length,
      differFromSaved: acts.length - same.length,
      attempts: run.attempts,
      rateLimited: run.rateLimited,
    },
    detail: {
      festival: festival.id,
      acts: acts.map((act) => act.name),
      saved: saved.lineup.acts.map((act) => act.name),
    },
  };
}

if (values.test === "pair") {
  const { mean } = JSON.parse(readFileSync(`${OUT}/headliners.json`, "utf8"));
  const PAIRS = [
    ["Fleet Foxes", "Bon Iver"],
    ["Alvvays", "Big Thief"],
    ["Turnstile", "IDLES"],
    ["Mitski", "Beach House"],
  ];
  const qloo = freshQloo();
  const checked = [];
  let chosen: string[] | null = null;
  for (const pair of PAIRS) {
    const found = [];
    for (const name of pair) {
      const hit = (await qloo.search({ query: name })).data.find(
        (entity) => normalise(entity.name) === normalise(name),
      );
      found.push({ name, popularity: hit?.popularity ?? null });
    }
    const within = found.every(
      (act) =>
        act.popularity !== null && Math.abs(act.popularity - mean) <= 0.005,
    );
    checked.push({ pair, found, within });
    if (within) {
      chosen = pair;
      break;
    }
  }
  writeFileSync(
    `${OUT}/pair.json`,
    `${JSON.stringify({ chosen, checked }, null, 1)}\n`,
  );
  console.log(
    JSON.stringify({ chosen, pairsChecked: checked.length, qlooCalls }),
  );
} else if (values.test === "stability") {
  const towns = ["Boise", "Austin", "Denver", "Nashville"].map((city) => {
    if (city === "Boise") return SAGEBRUSH_SOUND;
    const town = CHECKED_TOWNS.find((candidate) => candidate.city === city);
    if (!town) throw new Error(`${city} isn't a checked town`);
    return checkedFestival(town);
  });
  const rows = [];
  const detail = [];
  for (const festival of towns) {
    const { counts, detail: names } = await compare(festival);
    rows.push(counts);
    detail.push(names);
    console.log(JSON.stringify(counts));
  }
  writeFileSync(
    `${OUT}/stability.json`,
    `${JSON.stringify({ ranAt: new Date().toISOString(), rows, detail }, null, 1)}\n`,
  );
  console.log(JSON.stringify({ qlooCalls }));
} else if (values.test === "second") {
  const { chosen } = JSON.parse(readFileSync(`${OUT}/pair.json`, "utf8"));
  if (!chosen) throw new Error("no pair was chosen");
  const festival: Festival = { ...SAGEBRUSH_SOUND, headliners: chosen };
  const { counts, detail } = await compare(festival);
  writeFileSync(
    `${OUT}/second.json`,
    `${JSON.stringify({ ranAt: new Date().toISOString(), counts, detail }, null, 1)}\n`,
  );
  console.log(JSON.stringify({ ...counts, headliners: chosen, qlooCalls }));
} else throw new Error("--test takes pair, stability or second");
