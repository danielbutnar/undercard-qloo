// M6j spike: can a town be resolved to the intended place with the Qloo API alone? Three routes,
// one call at a time: (A) a fuller name in filter.location.query, at no extra call; (B) Qloo's
// own /search for a locality, the candidate in the intended state or country, then places by
// that locality's id (one extra call); (C) that locality's point with filter.location.radius.
// Raw answers go to the gitignored --out file; the console gets counts only. From the root:
//   node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/resolve-spike.ts --out .design/evidence/m6j-spike.json
import { existsSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    out: { type: "string", default: ".design/evidence/m6j-spike.json" },
  },
});
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const apiKey = process.env.QLOO_API_KEY;
if (!apiKey) throw new Error("QLOO_API_KEY is not set (put it in .env.local).");
const BASE = process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let calls = 0;

async function get(path: string, params: Record<string, string | number>) {
  const url = new URL(path, BASE);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, String(value));
  for (let attempt = 0; attempt < 5; attempt++) {
    calls++;
    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey!, Accept: "application/json" },
    });
    if (response.status !== 429 && response.status < 500) {
      await pause(1500);
      return {
        status: response.status,
        body: (await response.json().catch(() => null)) as Record<
          string,
          unknown
        > | null,
      };
    }
    await pause(2000 * 2 ** attempt);
  }
  throw new Error(`Qloo ${path} stayed busy`);
}

type Entity = {
  entity_id: string;
  name: string;
  disambiguation?: string;
  properties?: {
    address?: string;
    geocode?: Record<string, string>;
    location?: Record<string, number>;
  };
  location?: Record<string, number>;
  tags?: { id?: string; tag_id?: string }[];
};
const entities = (body: Record<string, unknown> | null): Entity[] =>
  ((body?.results as { entities?: Entity[] })?.entities ??
    (body?.results as Entity[]) ??
    []) as Entity[];
const where = (place: Entity) => {
  const g = place.properties?.geocode ?? {};
  return [g.name, g.admin2_region, g.admin1_region, g.country_code]
    .filter(Boolean)
    .join(" / ");
};

const tags = await get("/v2/tags", {
  "filter.query": "live music venue",
  "filter.parents.types": "urn:entity:place",
});
const tag = (
  (
    tags.body?.results as {
      tags?: { id?: string; tag_id?: string; name?: string }[];
    }
  )?.tags ?? []
).find((t) => /live music venue/i.test(t.name ?? ""));
const tagId = tag?.id ?? tag?.tag_id;
if (!tagId) throw new Error("No live music venue tag.");
const places = (location: Record<string, string | number>) =>
  get("/v2/insights", {
    "filter.type": "urn:entity:place",
    "filter.tags": tagId,
    take: 20,
    ...location,
  });

const TOWNS = [
  { city: "Burlington", region: "Vermont", country: "US" },
  { city: "Richmond", region: "Virginia", country: "US" },
  { city: "Brighton", region: "England", country: "GB" },
  { city: "Boise", region: "Idaho", country: "US" },
  { city: "Austin", region: "Texas", country: "US" },
  { city: "Denver", region: "Colorado", country: "US" },
  { city: "Nashville", region: "Tennessee", country: "US" },
];
const raw: Record<string, unknown> = {};
const report: Record<string, unknown>[] = [];
const fold = (text: string) =>
  text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

for (const town of TOWNS) {
  const row: Record<string, unknown> = { town: `${town.city}, ${town.region}` };
  const before = calls;
  // A: fuller names, only for the three that a plain name gets wrong.
  if (["Burlington", "Richmond", "Brighton"].includes(town.city)) {
    for (const name of [
      `${town.city}, ${town.region}`,
      `${town.city}, ${town.country}`,
    ]) {
      const answer = await places({ "filter.location.query": name });
      const found = entities(answer.body);
      raw[`A ${name}`] = found.map((p) => ({ name: p.name, where: where(p) }));
      row[`A "${name}"`] = `${answer.status} ${found.length} places`;
    }
  }
  // B: Qloo's own search for the locality.
  const search = await get("/search", {
    query: town.city,
    types: "urn:entity:locality",
    take: 10,
  });
  const candidates = entities(search.body);
  raw[`B search ${town.city}`] = candidates.map((c) => ({
    id: c.entity_id,
    name: c.name,
    disambiguation: c.disambiguation ?? null,
    geocode: c.properties?.geocode ?? null,
    location: c.properties?.location ?? c.location ?? null,
  }));
  const match = candidates.find((c) => {
    const text = fold(
      [c.disambiguation, ...Object.values(c.properties?.geocode ?? {})]
        .filter(Boolean)
        .join(" "),
    );
    return (
      text.includes(fold(town.region)) ||
      (town.country === "GB" && /england|united kingdom|\bgb\b/.test(text))
    );
  });
  row["B candidates"] = candidates.length;
  row["B matched"] = match
    ? `${match.name} (${match.disambiguation ?? where(match)})`
    : null;
  if (match) {
    const answer = await places({ "filter.location": match.entity_id });
    const found = entities(answer.body);
    raw[`B places ${town.city}`] = found.map((p) => ({
      name: p.name,
      where: where(p),
    }));
    row["B places"] = `${answer.status} ${found.length}`;
    row["B in region"] = found.filter(
      (p) =>
        fold(where(p)).includes(fold(town.region)) ||
        (town.country === "GB" && /\bgb\b/i.test(where(p))),
    ).length;
    const point = match.properties?.location ?? match.location;
    if (point && (row["B in region"] as number) < found.length) {
      const lon = point.lon ?? point.longitude;
      const lat = point.lat ?? point.latitude;
      const answerC = await places({
        "filter.location": `POINT(${lon} ${lat})`,
        "filter.location.radius": 15000,
      });
      const foundC = entities(answerC.body);
      raw[`C places ${town.city}`] = foundC.map((p) => ({
        name: p.name,
        where: where(p),
      }));
      row["C places"] = `${answerC.status} ${foundC.length}`;
    }
  }
  row.calls = calls - before;
  report.push(row);
}
console.log(JSON.stringify(report, null, 2));
writeFileSync(
  values.out!,
  `${JSON.stringify({ ranAt: new Date().toISOString(), report, raw }, null, 2)}\n`,
);
