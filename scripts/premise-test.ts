// M8d premise test (docs/evidence.md section 18): do the acts real buyers booked show more lift
// from their own town's venues than band-matched random acts? Reads the lineups and the towns'
// venues from .design/ (gitignored), calls Qloo one request at a time, and writes the per-act
// results back to .design/m8d/. The console gets counts and lifts only. From the root:
//   node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/premise-test.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const apiKey = process.env.QLOO_API_KEY;
if (!apiKey) throw new Error("QLOO_API_KEY is not set (put it in .env.local).");
const BASE = process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";
const MAX_SEARCHES = 40;
const MAX_BOOKED = 12;
/** The Treefort check's normalising: accents, case, a bracketed note and a leading "The" dropped. */
function normalise(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\([^)]*\)/g, "")
    .toLowerCase()
    .replace(/^\s*the\s+/, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let calls = 0;

type Entity = {
  entity_id: string;
  name: string;
  popularity?: number;
  query?: { affinity?: number };
};

async function get(path: string, params: Record<string, string | number>) {
  const url = new URL(path, BASE);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, String(value));
  // One call at a time, spaced; a 429 or 5xx waits and tries again: production shares the key.
  for (let attempt = 0; attempt < 5; attempt++) {
    calls++;
    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey!, Accept: "application/json" },
    });
    if (response.status !== 429 && response.status < 500) {
      await pause(1200);
      return (await response.json().catch(() => null)) as {
        results?: Entity[] | { entities?: Entity[] };
      } | null;
    }
    await pause(2000 * 2 ** attempt);
  }
  throw new Error(`Qloo ${path} stayed busy`);
}

const entities = (body: Awaited<ReturnType<typeof get>>): Entity[] => {
  const results = body?.results;
  return Array.isArray(results) ? results : (results?.entities ?? []);
};

function random(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const bandOf = (popularity: number) =>
  SAGEBRUSH_SOUND.feeBands.find(
    (band) =>
      popularity >= band.minPopularity && popularity <= band.maxPopularity,
  )?.id ?? null;

const lineups = JSON.parse(
  readFileSync(".design/m8d/lineups.json", "utf8"),
) as Record<string, { label: string; town: string; names: string[] }>;

function venuesOf(town: string): string[] {
  const events = readFileSync(`.design/m6m/verify-${town}.ndjson`, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const lineup = events.find((event) => event.type === "lineup").lineup;
  return [
    ...new Set<string>(
      lineup.acts.map(
        (act: { anchorVenue: { entityId: string } }) =>
          act.anchorVenue.entityId,
      ),
    ),
  ];
}

async function affinities(signal: string[], among: string[]) {
  const body = await get("/v2/insights", {
    "filter.type": "urn:entity:artist",
    "signal.interests.entities": signal.join(","),
    "filter.results.entities": among.join(","),
    take: among.length,
  });
  return new Map(
    entities(body)
      .filter((entity) => typeof entity.query?.affinity === "number")
      .map((entity) => [entity.entity_id, entity.query!.affinity!]),
  );
}

const ORDER = [
  "treefort",
  "levitation",
  "liveonthegreen",
  "lollapalooza",
  "rockthegarden",
  "sledisland",
  "popmontreal",
  "leguesswho",
  "pitchforkparis",
  "electriccastle",
];
const report = [];
const raw: Record<string, unknown> = {};
for (const key of ORDER) {
  const festival = lineups[key];
  const before = calls;
  const venues = venuesOf(festival.town);
  const headliners: Entity[] = [];
  const booked: (Entity & { band: string })[] = [];
  let searches = 0;
  for (const name of festival.names) {
    if (searches >= MAX_SEARCHES || booked.length >= MAX_BOOKED) break;
    searches++;
    const found = entities(
      await get("/search", {
        query: name,
        types: "urn:entity:artist",
        take: 5,
      }),
    ).find((entity) => normalise(entity.name) === normalise(name));
    if (!found) continue;
    if (headliners.length < 2) {
      headliners.push(found);
      continue;
    }
    const band = bandOf(found.popularity ?? 0);
    if (band && !booked.some((act) => act.entity_id === found.entity_id))
      booked.push({ ...found, band });
  }
  const lineupNames = new Set(festival.names.map(normalise));
  const pick = random(key);
  const randoms: (Entity & { band: string })[] = [];
  for (const band of SAGEBRUSH_SOUND.feeBands) {
    const need = booked.filter((act) => act.band === band.id).length;
    if (!need || headliners.length < 2) continue;
    const pool = entities(
      await get("/v2/insights", {
        "filter.type": "urn:entity:artist",
        "signal.interests.entities": headliners
          .map((h) => h.entity_id)
          .join(","),
        "filter.popularity.min": band.minPopularity,
        "filter.popularity.max": band.maxPopularity,
        "filter.exclude.entities": headliners.map((h) => h.entity_id).join(","),
        take: 50,
      }),
    ).filter((entity) => !lineupNames.has(normalise(entity.name)));
    for (let i = 0; i < need && pool.length; i++)
      randoms.push({
        ...pool.splice(Math.floor(pick() * pool.length), 1)[0],
        band: band.id,
      });
  }
  const row: Record<string, unknown> = {
    festival: festival.label,
    venues: venues.length,
    searches,
    headliners: headliners.length,
    booked: booked.length,
    bookedMid: booked.filter((act) => act.band === "mid").length,
    bookedOpener: booked.filter((act) => act.band === "opener").length,
    random: randoms.length,
  };
  if (booked.length >= 2 && headliners.length === 2 && randoms.length) {
    const among = [...booked, ...randoms].map((act) => act.entity_id);
    const signal = headliners.map((h) => h.entity_id);
    const base = await affinities(signal, among);
    const withVenue: Map<string, number>[] = [];
    for (const venue of venues)
      withVenue.push(await affinities([...signal, venue], among));
    const lift = (id: string) => {
      const a0 = base.get(id);
      if (a0 === undefined) return null;
      const gains = withVenue
        .map((map) => map.get(id))
        .filter((value): value is number => value !== undefined)
        .map((value) => value - a0);
      return gains.length ? Math.max(...gains) : null;
    };
    const mean = (list: (number | null)[]) => {
      const values = list.filter((value): value is number => value !== null);
      return values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;
    };
    const bookedLift = mean(booked.map((act) => lift(act.entity_id)));
    const randomLift = mean(randoms.map((act) => lift(act.entity_id)));
    Object.assign(row, {
      scored: [...booked, ...randoms].filter(
        (act) => lift(act.entity_id) !== null,
      ).length,
      bookedMeanLift:
        bookedLift === null ? null : Number(bookedLift.toFixed(4)),
      randomMeanLift:
        randomLift === null ? null : Number(randomLift.toFixed(4)),
      supports:
        bookedLift !== null && randomLift !== null && bookedLift > randomLift,
    });
    raw[key] = {
      headliners: headliners.map((h) => h.name),
      booked: booked.map((act) => [act.name, act.band, lift(act.entity_id)]),
      random: randoms.map((act) => [act.name, act.band, lift(act.entity_id)]),
    };
  } else
    Object.assign(row, {
      supports: false,
      note: "fewer than 2 booked acts in the bands",
    });
  row.calls = calls - before;
  report.push(row);
  console.log(JSON.stringify(row));
}
const supporting = report.filter((row) => row.supports).length;
console.log(
  JSON.stringify({
    calls,
    supporting,
    of: report.length,
    supported: supporting >= 8,
  }),
);
writeFileSync(
  ".design/m8d/result.json",
  `${JSON.stringify({ ranAt: new Date().toISOString(), calls, report, raw }, null, 1)}\n`,
);
