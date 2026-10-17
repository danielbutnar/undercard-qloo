// Runs the agent offline for a town, the way a live build would, and prints counts only:
// how many places Qloo tagged as live music venues, which rooms the agent tested per band,
// how many acts each room lifted, and whether both bands filled. It never saves a build and
// never touches Upstash: Qloo responses stay in this process's memory. Act names, entity IDs
// and scores are never printed or written (RULES.md: no Qloo response data in the repository).
// Needs QLOO_API_KEY and ANTHROPIC_API_KEY in .env.local. From the repository root:
//   node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/agent-offline.ts --city Austin --region Texas
//   add --out <file.json> to keep the summary, for example under .design/evidence/
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import type { BuildEvent } from "@/lib/build-events";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { runUndercardAgent } from "@/server/agent";
import { createAgentModel } from "@/server/ai";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";

const { values } = parseArgs({
  options: {
    city: { type: "string", default: SAGEBRUSH_SOUND.city },
    region: { type: "string", default: SAGEBRUSH_SOUND.region },
    out: { type: "string" },
  },
});

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const apiKey = process.env.QLOO_API_KEY;
if (!apiKey) throw new Error("QLOO_API_KEY is not set (put it in .env.local).");

// Same festival, headliners, crowd and fee bands; only the town changes.
const festival = {
  ...SAGEBRUSH_SOUND,
  city: values.city!,
  region: values.region!,
};
const events: BuildEvent[] = [];
const started = Date.now();
const result = await runUndercardAgent({
  festival,
  qloo: createQlooClient({
    apiKey,
    cache: createMemoryCache(),
    baseUrl: process.env.QLOO_BASE_URL || undefined,
  }),
  model: createAgentModel(),
  emit: (event) => events.push(event),
});

const calls = events.flatMap((event) =>
  event.type === "call" ? [event.call] : [],
);
const venueSearch = calls.find((call) => call.tool === "find_venues");
const acts = result.lineup?.acts ?? [];
const liftedBy = new Map<string, number>();
for (const act of acts)
  liftedBy.set(
    act.anchorVenue.name,
    (liftedBy.get(act.anchorVenue.name) ?? 0) + 1,
  );
const tested = Object.fromEntries(
  festival.feeBands.map((band) => [
    band.id,
    (result.context.anchors[band.id] ?? []).map((venue) => venue.name),
  ]),
);
const rooms = [...new Set(Object.values(tested).flat())].map((name) => ({
  room: name,
  actsLifted: liftedBy.get(name) ?? 0,
}));
const bands = Object.fromEntries(
  festival.feeBands.map((band) => [
    band.id,
    {
      filled: acts.filter((act) => act.band === band.id).length,
      slots: band.slots,
    },
  ]),
);

const summary = {
  town: `${festival.city}, ${festival.region}`,
  ranAt: new Date(started).toISOString(),
  seconds: Math.round((Date.now() - started) / 1000),
  qlooCalls: calls.length,
  taggedPlaces: venueSearch?.resultCount ?? null,
  roomsTestedPerBand: tested,
  rooms,
  bands,
  bothBandsFilled: result.complete,
  ageSentInArtistCalls: calls.filter((call) =>
    call.params.some((param) => param.key === "signal.demographics.age"),
  ).length,
  plannerLines: events.filter(
    (event) => event.type === "status" && event.planner,
  ).length,
  errors: events.flatMap((event) =>
    event.type === "error" ? [event.message] : [],
  ),
};

console.log(JSON.stringify(summary, null, 2));
if (values.out) {
  mkdirSync(dirname(values.out), { recursive: true });
  writeFileSync(values.out, `${JSON.stringify(summary, null, 2)}\n`);
}
