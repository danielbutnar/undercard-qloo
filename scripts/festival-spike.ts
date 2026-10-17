// M6o spike: does Qloo mark a festival brand among the places the agent already fetches? For
// each town ("City|Region"), the agent's venue lookup (Qloo's live-music-venue tag, then places
// with the plain name and, on a region miss, "City, Region"), one call at a time. The whole
// place entities go to the gitignored --out file, so a rule can be tried on every field Qloo
// returns; the console gets counts only. From the repository root:
//   node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/festival-spike.ts --out .design/evidence/m6o-places.json "Cluj-Napoca|Romania" …
import { existsSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  needsFullName,
  placesInRegion,
  type PlaceWhere,
} from "../src/lib/town-resolution.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", default: ".design/evidence/m6o-places.json" },
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
  // One call at a time, spaced, and a 429 waits and tries again: production shares the key.
  for (let attempt = 0; attempt < 5; attempt++) {
    calls++;
    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey!, Accept: "application/json" },
    });
    if (response.status !== 429 && response.status < 500) {
      await pause(1500);
      return (await response.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
    }
    await pause(2000 * 2 ** attempt);
  }
  throw new Error(`Qloo ${path} stayed busy`);
}

type Place = {
  entity_id?: string;
  name?: string;
  properties?: { geocode?: Record<string, string | null> } & Record<
    string,
    unknown
  >;
  tags?: unknown[];
} & Record<string, unknown>;

const whereOf = (place: Place): { where?: PlaceWhere } => {
  const g = place.properties?.geocode;
  if (!g) return {};
  return {
    where: {
      city: g.city ?? undefined,
      name: g.name ?? undefined,
      admin2: g.admin2_region ?? undefined,
      admin1: g.admin1_region ?? undefined,
      country: g.country ?? undefined,
      countryCode: g.country_code ?? undefined,
    },
  };
};

const tags = await get("/v2/tags", {
  "filter.query": "live music venue",
  "filter.parents.types": "urn:entity:place",
});
const tagList =
  (
    tags?.results as {
      tags?: { id?: string; tag_id?: string; name?: string }[];
    }
  )?.tags ?? [];
const tag = tagList.find((candidate) =>
  /live music venue/i.test(candidate.name ?? ""),
);
if (!tag) throw new Error("Qloo has no live music venue tag.");
const tagId = tag.id ?? tag.tag_id!;

const places = async (locationQuery: string) =>
  (
    (
      (
        await get("/v2/insights", {
          "filter.type": "urn:entity:place",
          "filter.location.query": locationQuery,
          "filter.tags": tagId,
          take: 20,
        })
      )?.results as { entities?: Place[] }
    )?.entities ?? []
  ).map((place) => ({
    ...place,
    ...whereOf(place),
  }));

const raw: Record<string, Place[]> = {};
const counts = [];
for (const town of positionals) {
  const [city, region = ""] = town.split("|");
  const plain = await places(city);
  const answers = [plain];
  if (needsFullName(plain, region))
    answers.push(await places(`${city}, ${region}`));
  const kept =
    answers.length > 1 || region.trim()
      ? placesInRegion(answers, region).places
      : plain;
  const venues = answers.length > 1 ? kept : plain;
  raw[town] = venues;
  counts.push({ town, asks: answers.length, places: venues.length });
}
console.log(JSON.stringify({ calls, counts }, null, 2));
writeFileSync(
  values.out!,
  `${JSON.stringify({ ranAt: new Date().toISOString(), tag: tagId, calls, raw }, null, 2)}\n`,
);
