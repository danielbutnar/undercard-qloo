// Evidence section 35 (docs/evidence.md): Qloo's own attribution. Two /v2/insights calls for
// Boise's saved build, one per fee range: the headliners and the range's anchor venues as the
// signal, the range's lineup acts as filter.results.entities, the build's crowd ages and
// feature.explainability=true. Every id comes from the saved build, read from the store with no
// write; the build must be the one pinned in .design/pinned-builds/. Raw answers go to
// .design/explainability/ (gitignored); the console gets counts and the answer's shape only.
// Without LIVE=1 it calls nothing and prints the two calls' shape. From the repository root:
//   LIVE=1 node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/explainability-35.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { perInputContributions } from "@/lib/attribution";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createBuildStore } from "@/server/build-store";
import { createQlooCache } from "@/server/qloo-cache";

const LIVE = process.env.LIVE === "1";
const envFile = process.env.ENV_FILE ?? ".env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);
const apiKey = process.env.QLOO_API_KEY;
if (LIVE && !apiKey)
  throw new Error("QLOO_API_KEY is not set (put it in .env.local).");
const BASE = process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";
const DIR = ".design/explainability";
const BAR = 8;

const cache = createQlooCache();
if (cache.kind !== "upstash") throw new Error("no Upstash settings found");
const pinned = (
  JSON.parse(
    readFileSync(
      ".design/pinned-builds/latest-pointers-2026-10-21.json",
      "utf8",
    ),
  ) as { festivals: { festivalId: string; buildId: string }[] }
).festivals.find((entry) => entry.festivalId === SAGEBRUSH_SOUND.id)?.buildId;
const build = await createBuildStore(cache).latest(SAGEBRUSH_SOUND.id);
if (!build || build.id !== pinned)
  throw new Error(
    "Boise's latest build isn't the pinned one: stop and check the pointers.",
  );

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let calls = 0;
// As the premise tests' client: one call at a time, every attempt counted, a 429 or 5xx retried.
async function get(params: Record<string, string | number>) {
  const url = new URL("/v2/insights", BASE);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, String(value));
  for (let attempt = 0; attempt < 5; attempt++) {
    calls++;
    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey!, Accept: "application/json" },
    });
    if (response.status !== 429 && response.status < 500) {
      await pause(1200);
      return {
        status: response.status,
        body: (await response.json().catch(() => null)) as unknown,
      };
    }
    await pause(2000 * 2 ** attempt);
  }
  throw new Error("Qloo /v2/insights stayed busy");
}

const headliners = build.context.headliners.map((h) => h.entityId);
let withContribution = 0;
let acts = 0;
if (LIVE) mkdirSync(DIR, { recursive: true });
for (const band of SAGEBRUSH_SOUND.feeBands) {
  const anchors = (build.context.anchors[band.id] ?? []).map((v) => v.entityId);
  const lineup = build.lineup.acts.filter((act) => act.band === band.id);
  const inputs = [...headliners, ...anchors];
  const params: Record<string, string | number> = {
    "filter.type": "urn:entity:artist",
    "signal.interests.entities": inputs.join(","),
    "filter.results.entities": lineup.map((act) => act.entityId).join(","),
    ...(build.context.ages?.length
      ? { "signal.demographics.age": build.context.ages.join(",") }
      : {}),
    "feature.explainability": "true",
    take: lineup.length,
  };
  acts += lineup.length;
  if (!LIVE) {
    console.log(
      JSON.stringify({
        band: band.id,
        headliners: headliners.length,
        anchors: anchors.length,
        acts: lineup.length,
        params: Object.keys(params),
      }),
    );
    continue;
  }
  const { status, body } = await get(params);
  writeFileSync(
    `${DIR}/${band.id}.json`,
    `${JSON.stringify({ status, params, body }, null, 1)}\n`,
  );
  const results = (body as { results?: { entities?: unknown[] } } | null)
    ?.results;
  const entities = (
    Array.isArray(results) ? results : (results?.entities ?? [])
  ) as {
    entity_id?: string;
  }[];
  const rows = lineup.map((act, index) => {
    const entity = entities.find((e) => e.entity_id === act.entityId);
    const found = entity
      ? perInputContributions(entity, inputs, act.anchorVenue.entityId)
      : null;
    if (found?.perInput) withContribution++;
    return {
      act: index + 1,
      returned: Boolean(entity),
      inputsWithNumber: found?.inputs.length ?? 0,
      ownVenue: found?.ownVenue ?? false,
      perInput: found?.perInput ?? false,
      paths: found?.paths ?? [],
    };
  });
  console.log(
    JSON.stringify({
      band: band.id,
      status,
      returned: entities.length,
      inputs: inputs.length,
      rows,
    }),
  );
}
if (LIVE)
  console.log(
    JSON.stringify({
      calls,
      acts,
      withContribution,
      bar: BAR,
      go: withContribution >= BAR,
    }),
  );
else console.log(JSON.stringify({ dry: true, calls: 0, acts }));
