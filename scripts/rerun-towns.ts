// WS13 item 11: the re-runs of the 29 towns with Agent 2.0, Daniel's, in windows he names. The
// orchestrator runs this; WS13 never runs it live. The logic is in src/server/rerun.ts.
//
// DRY (the default): no Qloo or model call, nothing written. It reads each town's latest saved
// build (read-only) and prints, per town, its control town, the calls a run may make (Agent
// 2.0's cap) and, for the four demo towns, the saved 1.0 bill's fill per tier.
// LIVE=1 MAX_CALLS=<n>: re-runs the towns one at a time (the four demo towns, or every checked
// town with TOWNS=all, the demo towns first), each with the real planner and a Qloo client over
// PREFIX (default qloo:rerun1:), never the 1.0 builds' prefix. Every HTTP attempt counts against
// <n>; a town starts only while a whole run's cap is left; the first 429 stops the run. Each
// complete or partial 2.0 build is kept by its own id, recording its prefix: NO LATEST POINTER
// MOVES (moving one is a separate step, after Daniel's yes; the 1.0 builds stay saved). After the
// run it re-reads every pointer and says whether any changed. Counts to stdout; act names and
// Qloo's raw answers to OUT (default .design/ws13-rerun/<time>/), never the repository.
//   node --env-file=<main folder>/.env.local --experimental-transform-types
//     --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON
//     --import ./scripts/register-ts.mjs scripts/rerun-towns.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { QLOO_CALL_CAP } from "@/lib/agent-limits";
import { CHECKED_TOWNS } from "@/lib/checked-towns";
import { controlTownFor } from "@/lib/control-town";
import { checkedFestival } from "@/lib/towns";
import { MAX_AGENT_TURNS } from "@/server/agent";
import { createAgentModel } from "@/server/ai";
import { readOnlyCache } from "@/server/attribution-warm";
import { createBuildStore, type SavedBuild } from "@/server/build-store";
import { createQlooClient, QLOO_CACHE_PREFIX } from "@/server/qloo";
import { createQlooCache } from "@/server/qloo-cache";
import { billBeside, countingFetch, rerunTowns } from "@/server/rerun";

const DEMO = ["Boise", "Austin", "Denver", "Nashville"];
const live = process.env.LIVE === "1";
const all = process.env.TOWNS === "all";
const PREFIX = process.env.PREFIX ?? "qloo:rerun1:";
const OUT =
  process.env.OUT ??
  `.design/ws13-rerun/${new Date().toISOString().replace(/[:.]/g, "-")}`;
const print = (value: unknown) => console.log(JSON.stringify(value));

if (PREFIX === QLOO_CACHE_PREFIX || !/^qloo:[a-z0-9-]+:$/.test(PREFIX))
  throw new Error(
    `PREFIX must be a new prefix such as qloo:rerun1:, never ${QLOO_CACHE_PREFIX}.`,
  );
const cache = createQlooCache();
if (cache.kind !== "upstash")
  throw new Error(
    "No Upstash settings: run with node --env-file=<main folder>/.env.local.",
  );

// The four demo towns first, then (TOWNS=all) every other checked town in the list's order.
const towns = [
  ...CHECKED_TOWNS.filter((town) => DEMO.includes(town.city)),
  ...(all ? CHECKED_TOWNS.filter((town) => !DEMO.includes(town.city)) : []),
];
const festivals = towns.map(checkedFestival);
const reading = createBuildStore(readOnlyCache(cache));
const pointers = async () =>
  Promise.all(
    CHECKED_TOWNS.map(
      async (town) =>
        (await reading.latest(checkedFestival(town).id))?.id ?? null,
    ),
  );
const before = await pointers();
const saved = await Promise.all(festivals.map((f) => reading.latest(f.id)));

for (const [index, festival] of festivals.entries())
  print({
    festival: festival.id,
    control: controlTownFor(festival)?.city ?? null,
    savedBuild: saved[index]?.id ?? null,
    maxQlooCalls: QLOO_CALL_CAP,
    maxModelTurns: MAX_AGENT_TURNS,
    ...(DEMO.includes(festival.city)
      ? {
          saved1: Object.fromEntries(
            Object.entries(
              billBeside(saved[index], null, festival.feeBands),
            ).map(([tier, fill]) => [tier, fill.saved]),
          ),
        }
      : {}),
  });
print({
  towns: festivals.length,
  prefix: PREFIX,
  maxQlooCalls: festivals.length * QLOO_CALL_CAP,
  maxModelTurns: festivals.length * MAX_AGENT_TURNS,
  pointersRead: before.filter(Boolean).length,
});

if (!live) {
  console.log("DRY: no Qloo or model call made, nothing written.");
  process.exit(0);
}
const raw = process.env.MAX_CALLS;
if (!raw || !/^[1-9]\d*$/.test(raw))
  throw new Error(
    "LIVE=1 needs MAX_CALLS, the number of calls Daniel approved.",
  );

mkdirSync(`${OUT}/raw`, { recursive: true });
let answers = 0;
const budget = countingFetch({
  fetch: globalThis.fetch,
  maxCalls: Number(raw),
  onAnswer: (url, status, body) =>
    writeFileSync(
      `${OUT}/raw/${String(++answers).padStart(4, "0")}.json`,
      JSON.stringify({ url, status, body }),
    ),
});
const store = createBuildStore(cache);
const runs = await rerunTowns({
  festivals,
  qloo: () =>
    createQlooClient({
      apiKey: process.env.QLOO_API_KEY ?? "",
      cache,
      fetch: budget.fetch,
      prefix: PREFIX,
      baseUrl: process.env.QLOO_BASE_URL || undefined,
    }),
  model: () => createAgentModel(),
  store,
  budget,
});

const bills: unknown[] = [];
for (const run of runs) {
  const index = festivals.findIndex((f) => f.id === run.festivalId);
  const festival = festivals[index];
  const rerun: SavedBuild | null = run.buildId
    ? await reading.byId(run.buildId)
    : null;
  print({
    festival: run.festivalId,
    buildId: run.buildId,
    complete: run.complete,
    calls: run.calls,
    stoppedBy: run.stoppedBy?.message ?? null,
    ...(DEMO.includes(festival.city)
      ? { bill: billBeside(saved[index], rerun, festival.feeBands) }
      : {}),
  });
  // Act names, tier by tier, before and after: for Daniel's look, in .design/ only.
  bills.push({
    festival: run.festivalId,
    saved1: saved[index]?.lineup.acts.map(({ name, band }) => ({ name, band })),
    rerun2: rerun?.lineup.acts.map(({ name, band }) => ({ name, band })),
  });
}
writeFileSync(`${OUT}/bills.json`, JSON.stringify(bills, null, 1));

const after = await pointers();
const moved = CHECKED_TOWNS.flatMap((town, index) =>
  before[index] === after[index] ? [] : [checkedFestival(town).id],
);
print({
  qlooCalls: budget.used(),
  pointersUnchanged: moved.length === 0,
  moved,
  out: OUT,
});
