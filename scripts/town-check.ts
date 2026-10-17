// Town check (second outreach wave): for each town, the venue lookup a build makes (Qloo's
// live-music-venue tag, then places with the plain city name as the location query), one town
// at a time. It records where each place is (Qloo's geocode and address) and its place
// categories, so a reader can check the places are in that town. Raw answers go to the
// gitignored --out file; the console gets counts only. From the repository root:
//   node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/town-check.ts --out .design/evidence/town-check.json Tallinn "Cluj-Napoca" …
import { existsSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", default: ".design/evidence/town-check.json" },
  },
});
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const apiKey = process.env.QLOO_API_KEY;
if (!apiKey) throw new Error("QLOO_API_KEY is not set (put it in .env.local).");
const BASE = process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(path: string, params: Record<string, string | number>) {
  const url = new URL(path, BASE);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, String(value));
  // One call at a time, spaced, and a 429 waits and tries again: production shares the key.
  for (let attempt = 0; attempt < 5; attempt++) {
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

type Place = {
  name: string;
  properties?: { address?: string; geocode?: Record<string, string> };
  tags?: { name?: string; type?: string; id?: string; tag_id?: string }[];
};

const tags = await get("/v2/tags", {
  "filter.query": "live music venue",
  "filter.parents.types": "urn:entity:place",
});
const tagList =
  (
    tags.body?.results as {
      tags?: { id?: string; tag_id?: string; name?: string }[];
    }
  )?.tags ?? [];
const tag = tagList.find((candidate) =>
  /live music venue/i.test(candidate.name ?? ""),
);
if (!tag) throw new Error("Qloo has no live music venue tag.");
const tagId = tag.id ?? tag.tag_id!;

const fold = (text: string) =>
  text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
const raw: Record<string, unknown> = {};
const counts = [];
for (const city of positionals) {
  const answer = await get("/v2/insights", {
    "filter.type": "urn:entity:place",
    "filter.location.query": city,
    "filter.tags": tagId,
    take: 20,
  });
  const places =
    (answer.body?.results as { entities?: Place[] })?.entities ?? [];
  raw[city] = places.map((place) => ({
    name: place.name,
    address: place.properties?.address ?? null,
    geocode: place.properties?.geocode ?? null,
    categories: (place.tags ?? [])
      .filter((t) => /place/.test(t.type ?? t.id ?? t.tag_id ?? ""))
      .map((t) => t.name),
  }));
  const inTown = places.filter((place) => {
    const where = fold(
      [place.properties?.geocode?.name, place.properties?.address]
        .filter(Boolean)
        .join(" "),
    );
    return where.includes(fold(city.split(/[ ,]/)[0]));
  }).length;
  counts.push({ city, status: answer.status, places: places.length, inTown });
}
console.log(JSON.stringify(counts, null, 2));
writeFileSync(
  values.out!,
  `${JSON.stringify({ ranAt: new Date().toISOString(), tag: tagId, counts, raw }, null, 2)}\n`,
);
