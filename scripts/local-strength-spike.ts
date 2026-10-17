// M6c spike: can the hackathon API say how strongly an act's fans concentrate in Boise
// compared with elsewhere? It tries the two routes Qloo's parameter reference documents for
// this: the heatmap output (filter.type=urn:heatmap, seeded by one act) and artist insights
// biased to a place (signal.location.query). A handful of calls; raw answers go to the
// gitignored --out file, and the console gets shapes and counts only. From the root:
//   node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/local-strength-spike.ts --acts .design/evidence/robustness-boise.json
//     --out .design/evidence/m6c-spike.json
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

const { values } = parseArgs({
  options: {
    acts: { type: "string" },
    out: { type: "string", default: ".design/evidence/m6c-spike.json" },
    step: { type: "string", default: "shape" },
  },
});
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const apiKey = process.env.QLOO_API_KEY;
if (!apiKey) throw new Error("QLOO_API_KEY is not set (put it in .env.local).");
const BASE = process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";

type Raw = { request: string; status: number; body: unknown };
const raw: Raw[] = [];
async function get(
  path: string,
  params: Record<string, string | number>,
): Promise<Raw> {
  const url = new URL(path, BASE);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    headers: { "X-Api-Key": apiKey!, Accept: "application/json" },
  });
  const body = await response.json().catch(() => null);
  const entry = {
    request: `${path}?${url.searchParams}`,
    status: response.status,
    body,
  };
  raw.push(entry);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return entry;
}

/** The shape of a JSON value, without its data: keys, types and list lengths. */
function shape(value: unknown, depth = 0): unknown {
  if (Array.isArray(value))
    return value.length
      ? [`${value.length} items`, shape(value[0], depth + 1)]
      : ["0 items"];
  if (value && typeof value === "object" && depth < 5)
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        shape(inner, depth + 1),
      ]),
    );
  return typeof value;
}

// The current bill's acts, by id, from an offline Boise run (gitignored raw file).
const runs = JSON.parse(readFileSync(values.acts!, "utf8")) as {
  raw: { acts: { id: string; band: string }[] }[];
};
const acts = runs.raw[0].acts;

const report: Record<string, unknown> = {};
if (values.step === "shape") {
  // One act, three ways of asking where its fans are.
  const act = acts[0].id;
  const a = await get("/v2/insights", {
    "filter.type": "urn:heatmap",
    "signal.interests.entities": act,
    "filter.location.query": "Boise",
  });
  report.heatmapBoise = { status: a.status, shape: shape(a.body) };
  const b = await get("/v2/insights", {
    "filter.type": "urn:heatmap",
    "signal.interests.entities": act,
    "filter.location.query": "Boise",
    "output.heatmap.boundary": "city",
  });
  report.heatmapBoiseCity = { status: b.status, shape: shape(b.body) };
  const c = await get("/v2/insights", {
    "filter.type": "urn:heatmap",
    "signal.interests.entities": act,
    "filter.geocode.country_code": "US",
    "output.heatmap.boundary": "city",
  });
  report.heatmapUsCity = { status: c.status, shape: shape(c.body) };
  // The Mid band's ranking with and without Boise as a location signal.
  const band = SAGEBRUSH_SOUND.feeBands[0];
  const common = {
    "filter.type": "urn:entity:artist",
    "filter.popularity.min": band.minPopularity,
    "filter.popularity.max": band.maxPopularity,
    take: 50,
  };
  const d = await get("/v2/insights", {
    ...common,
    "signal.location.query": "Boise",
  });
  report.artistsBoiseSignal = { status: d.status, shape: shape(d.body) };
}
if (values.step === "geohash") {
  // The go test, second form: one geohash heatmap call per act, filtered to Boise. Each cell's
  // affinity_rank is how the act does there relative to itself across locations (Qloo's docs),
  // so Boise's cells say how it compares with elsewhere. Usable: at least one Boise cell.
  const rows = [];
  for (const act of acts) {
    const answer = await get("/v2/insights", {
      "filter.type": "urn:heatmap",
      "signal.interests.entities": act.id,
      "filter.location.query": "Boise",
    });
    const cells = ((answer.body as { results?: { heatmap?: { query?: Record<string, number> }[] } })?.results?.heatmap ?? []);
    const ranks = cells.map((cell) => cell.query?.affinity_rank).filter((rank): rank is number => typeof rank === "number").sort((x, y) => x - y);
    const median = ranks.length ? ranks[Math.floor(ranks.length / 2)] : null;
    rows.push({ band: act.band, status: answer.status, cells: cells.length, usable: ranks.length > 0, median, top: ranks.at(-1) ?? null });
  }
  const round = (value: number | null) => (value === null ? null : Math.round(value * 100) / 100);
  report.geohash = {
    calls: rows.length,
    usable: rows.filter((row) => row.usable).length,
    cells: rows.map((row) => row.cells),
    medianRank: rows.map((row) => round(row.median)),
    topRank: rows.map((row) => round(row.top)),
  };
}
if (values.step === "signal") {
  // Popularity filtered by location: each band's artists with and without Boise as a location
  // signal (2 calls per band). Usable per act: the act sits in its band's Boise-signalled list.
  const bands = SAGEBRUSH_SOUND.feeBands;
  const out: Record<string, unknown> = {};
  for (const band of bands) {
    const common = { "filter.type": "urn:entity:artist", "filter.popularity.min": band.minPopularity, "filter.popularity.max": band.maxPopularity, take: 50 };
    const ids = (answer: Raw) => (((answer.body as { results?: { entities?: { entity_id: string }[] } })?.results?.entities) ?? []).map((entity) => entity.entity_id);
    const plain = ids(await get("/v2/insights", common));
    const boise = ids(await get("/v2/insights", { ...common, "signal.location.query": "Boise" }));
    const mine = acts.filter((act) => act.band === band.id).map((act) => act.id);
    out[band.id] = {
      listed: [plain.length, boise.length],
      sameOrder: plain.join() === boise.join(),
      shared: plain.filter((id) => boise.includes(id)).length,
      billActsInBoiseList: mine.filter((id) => boise.includes(id)).length,
      billActs: mine.length,
    };
  }
  report.signal = out;
}
if (values.step === "locality") {
  // The go test: one locality heatmap call per act on the current bill, filtered to Boise.
  // Usable means Qloo returns a Boise row with an affinity_rank for that act.
  const rows = [];
  for (const act of acts) {
    const answer = await get("/v2/insights", {
      "filter.type": "urn:heatmap",
      "signal.interests.entities": act.id,
      "filter.location.query": "Boise",
      "output.heatmap.boundary": "urn:entity:locality",
    });
    const cells =
      (
        answer.body as {
          results?: { heatmap?: { query?: Record<string, number> }[] };
        }
      )?.results?.heatmap ?? [];
    const rank = cells[0]?.query?.affinity_rank;
    rows.push({
      band: act.band,
      status: answer.status,
      cells: cells.length,
      usable: typeof rank === "number",
      affinityRank: rank ?? null,
    });
  }
  report.locality = {
    calls: rows.length,
    usable: rows.filter((row) => row.usable).length,
    // Ranks only, rounded, with no act names: how Boise compares with elsewhere for each act.
    ranks: rows.map((row) =>
      row.affinityRank === null
        ? null
        : Math.round(row.affinityRank * 100) / 100,
    ),
    statuses: rows.map((row) => row.status),
    cells: rows.map((row) => row.cells),
  };
}
console.log(JSON.stringify(report, null, 2));
writeFileSync(values.out!, `${JSON.stringify({ report, raw }, null, 2)}\n`);
