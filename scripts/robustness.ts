// Robustness (M6b): runs the agent offline several times for one town, with a fresh memory
// cache each run so no run reuses another's Qloo answers, and reports per town: how often both
// bands filled, which rooms each run tested and how many acts each lifted, and how many acts
// repeat between runs. It never saves a build and never touches Upstash. The console gets
// counts and venue names only; the raw runs (act names and ids included) go to the --out file,
// which belongs in .design/evidence/ (gitignored). From the repository root:
//   node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/robustness.ts --city Boise --region Idaho --runs 5
//     --out .design/evidence/robustness-boise.json
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import type { BuildEvent } from "@/lib/build-events";
import { repeatStats } from "@/lib/robustness";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { runUndercardAgent } from "@/server/agent";
import { createAgentModel } from "@/server/ai";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";

const { values } = parseArgs({
  options: {
    city: { type: "string", default: SAGEBRUSH_SOUND.city },
    region: { type: "string", default: SAGEBRUSH_SOUND.region },
    runs: { type: "string", default: "3" },
    pause: { type: "string", default: "30" },
    out: { type: "string" },
  },
});
// Qloo answers HTTP 429 when calls come too fast; a run that met one is redone after a pause,
// so a rate limit is never counted as a band the rooms couldn't fill.
const pauseMs = Number(values.pause) * 1000;
const MAX_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const runs = Number(values.runs);
if (!Number.isInteger(runs) || runs < 1 || runs > 10)
  throw new Error("--runs takes a whole number from 1 to 10.");

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const apiKey = process.env.QLOO_API_KEY;
if (!apiKey) throw new Error("QLOO_API_KEY is not set (put it in .env.local).");

// Same festival, headliners, crowd and fee bands; only the town changes.
const festival = {
  ...SAGEBRUSH_SOUND,
  city: values.city!,
  region: values.region!,
};

const results = [];
// A refused call counts too: the agent re-asks within its 12 calls and tests fewer rooms.
const rateLimited = (events: BuildEvent[]) =>
  events.some(
    (event) =>
      (event.type === "error" && /HTTP 429/.test(event.message)) ||
      (event.type === "call" && /429/.test(event.call.error ?? "")),
  );
for (let run = 1; run <= runs; run++) {
  let events: BuildEvent[] = [];
  let started = Date.now();
  let result!: Awaited<ReturnType<typeof runUndercardAgent>>;
  let attempts = 0;
  do {
    if (attempts > 0 || run > 1) await sleep(pauseMs);
    attempts++;
    const attemptEvents: BuildEvent[] = [];
    events = attemptEvents;
    started = Date.now();
    result = await runUndercardAgent({
      festival,
      qloo: createQlooClient({
        apiKey,
        cache: createMemoryCache(),
        baseUrl: process.env.QLOO_BASE_URL || undefined,
      }),
      model: createAgentModel(),
      emit: (event) => attemptEvents.push(event),
    });
  } while (rateLimited(events) && attempts < MAX_ATTEMPTS);
  const acts = result.lineup?.acts ?? [];
  const tested = Object.fromEntries(
    festival.feeBands.map((band) => [
      band.id,
      (result.context.anchors[band.id] ?? []).map((venue) => venue.name),
    ]),
  );
  const rooms = [...new Set(Object.values(tested).flat())].map((room) => ({
    room,
    actsLifted: acts.filter((act) => act.anchorVenue.name === room).length,
  }));
  results.push({
    run,
    seconds: Math.round((Date.now() - started) / 1000),
    attempts,
    rateLimited: rateLimited(events),
    // Calls Qloo refused inside the run; the agent re-asks within its 12, so fewer rooms get tested.
    callErrors: events.filter(
      (event) => event.type === "call" && event.call.error,
    ).length,
    rateLimitedCalls: events.filter(
      (event) => event.type === "call" && /429/.test(event.call.error ?? ""),
    ).length,
    qlooCalls: events.filter((event) => event.type === "call").length,
    bothBandsFilled: result.complete,
    bands: Object.fromEntries(
      festival.feeBands.map((band) => [
        band.id,
        `${acts.filter((act) => act.band === band.id).length} of ${band.slots}`,
      ]),
    ),
    roomsTestedPerBand: tested,
    rooms,
    errors: events.flatMap((event) =>
      event.type === "error" ? [event.message] : [],
    ),
    // Raw, for the gitignored --out file only.
    acts: acts.map((act) => ({
      id: act.entityId,
      name: act.name,
      band: act.band,
      room: act.anchorVenue.name,
    })),
  });
  console.error(
    `  run ${run}: ${result.complete ? "both bands full" : "not full"}`,
  );
}

const stats = repeatStats(results.map((run) => run.acts.map((act) => act.id)));
const countsOnly = {
  town: `${festival.city}, ${festival.region}`,
  ranAt: new Date().toISOString(),
  runs,
  bothBandsFilled: results.filter((run) => run.bothBandsFilled).length,
  // Counts only on the console: act names and ids stay in the --out file.
  perRun: results.map((run) => Object.fromEntries(Object.entries(run).filter(([key]) => key !== "acts"))),
  repeats: stats,
};
console.log(JSON.stringify(countsOnly, null, 2));
if (values.out) {
  mkdirSync(dirname(values.out), { recursive: true });
  writeFileSync(
    values.out,
    `${JSON.stringify({ ...countsOnly, raw: results }, null, 2)}\n`,
  );
}
