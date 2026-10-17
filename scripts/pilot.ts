// Pilot runner (M6a): runs the agent offline for a buyer's town, two headliners and band
// sizes, and writes a one-page draft to .design/pilots/<town>.md (gitignored: it holds real
// Qloo results). It never saves a build and never touches Upstash: Qloo responses stay in this
// process's memory. Needs QLOO_API_KEY and ANTHROPIC_API_KEY in .env.local. From the root:
//   node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/pilot.ts --city Boise --region Idaho --headliner Khruangbin
//     --headliner "Japanese Breakfast" --mid 4 --opener 6
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { BuildEvent } from "@/lib/build-events";
import { pilotDraft, pilotFestival, type PilotLogEntry } from "@/lib/pilot";
import { runUndercardAgent } from "@/server/agent";
import { createAgentModel } from "@/server/ai";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";

const { values } = parseArgs({
  options: {
    city: { type: "string" },
    region: { type: "string" },
    headliner: { type: "string", multiple: true },
    mid: { type: "string", default: "4" },
    opener: { type: "string", default: "6" },
    out: { type: "string", default: ".design/pilots" },
  },
});
const headliners = values.headliner ?? [];
if (!values.city || !values.region || headliners.length !== 2)
  throw new Error(
    'Usage: --city <town> --region <state> --headliner "<name>" --headliner "<name>" [--mid 4] [--opener 6]',
  );
const slots = { mid: Number(values.mid), opener: Number(values.opener) };
if (
  ![slots.mid, slots.opener].every(
    (n) => Number.isInteger(n) && n >= 1 && n <= 10,
  )
)
  throw new Error(
    "--mid and --opener take a whole number of slots from 1 to 10.",
  );

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const apiKey = process.env.QLOO_API_KEY;
if (!apiKey) throw new Error("QLOO_API_KEY is not set (put it in .env.local).");

const festival = pilotFestival({
  city: values.city,
  region: values.region,
  headliners: [headliners[0], headliners[1]],
  slots,
});
// A call Qloo refuses with HTTP 429 (its rate limit) costs the agent a call and a room; such a
// run is redone after a pause, up to three times, so a draft never reflects a rate limit.
const rateLimited = (seen: BuildEvent[]) =>
  seen.some(
    (event) =>
      (event.type === "error" && /HTTP 429/.test(event.message)) ||
      (event.type === "call" && /429/.test(event.call.error ?? "")),
  );
let events: BuildEvent[] = [];
let ranAt = "";
let result!: Awaited<ReturnType<typeof runUndercardAgent>>;
for (let attempt = 1; attempt <= 3; attempt++) {
  if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, 30_000));
  const attemptEvents: BuildEvent[] = [];
  events = attemptEvents;
  ranAt = new Date().toISOString();
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
  if (!rateLimited(events)) break;
  console.error(`  attempt ${attempt} met Qloo's rate limit`);
}

const log: PilotLogEntry[] = events.flatMap((event): PilotLogEntry[] => {
  if (event.type === "call")
    return [
      {
        kind: "call",
        n: event.call.n,
        summary: event.call.summary,
        endpoint: event.call.endpoint,
        resultCount: event.call.resultCount,
      },
    ];
  if (event.type === "status" && event.planner)
    return [{ kind: "note", text: event.text }];
  return [];
});
const acts = result.lineup?.acts ?? [];
const roomsTested = Object.fromEntries(
  festival.feeBands.map((band) => [
    band.id,
    (result.context.anchors[band.id] ?? []).map((venue) => venue.name),
  ]),
);
const page = pilotDraft({ festival, ranAt, acts, roomsTested, log });
mkdirSync(values.out, { recursive: true });
const file = `${values.out}/${festival.id.replace(/^pilot-/, "")}.md`;
writeFileSync(file, page);

// Counts only on the console.
console.log(
  JSON.stringify(
    {
      town: `${festival.city}, ${festival.region}`,
      qlooCalls: log.filter((entry) => entry.kind === "call").length,
      taggedPlaces:
        events.flatMap((event) =>
          event.type === "call" && event.call.tool === "find_venues"
            ? [event.call.resultCount]
            : [],
        )[0] ?? null,
      roomsTestedPerBand: roomsTested,
      rooms: [...new Set(Object.values(roomsTested).flat())].map((room) => ({
        room,
        actsLifted: acts.filter((act) => act.anchorVenue.name === room).length,
      })),
      bands: Object.fromEntries(
        festival.feeBands.map((band) => [
          band.id,
          `${acts.filter((act) => act.band === band.id).length} of ${band.slots}`,
        ]),
      ),
      complete: result.complete,
      errors: events.flatMap((event) =>
        event.type === "error" ? [event.message] : [],
      ),
      draft: file,
    },
    null,
    2,
  ),
);
