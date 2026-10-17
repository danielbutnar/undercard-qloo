// The Treefort check (M4e): does adding a Boise room's crowd to the headliners' signal pull
// Qloo's ranking toward acts Boise's own festival booked? For each fee band it asks Qloo for
// the top 50 artists for the headliners alone, and for the headliners plus each room, with
// the same parameters a build sends (the band's popularity range and the crowd's age), then
// counts how many names in each list are on Treefort Music Fest 2026's bill. It prints counts
// only; the matched names go to .design/evidence/ (gitignored), never to the repository. It
// never saves a build and never touches Upstash. From the repository root, after the lineup
// is in .design/evidence/treefort-2026-lineup.json:
//   node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/treefort-check.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ageBuckets } from "@/lib/ages";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";

// The rooms the Oct 17 production build tested, by the name Qloo lists them under.
const ROOMS = [
  "Venue 418 (V418)",
  "Venue 227",
  "Venue 166 Boise",
];
const LINEUP = ".design/evidence/treefort-2026-lineup.json";
const OUT = ".design/evidence/treefort-check.json";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const apiKey = process.env.QLOO_API_KEY;
if (!apiKey) throw new Error("QLOO_API_KEY is not set (put it in .env.local).");
const qloo = createQlooClient({
  apiKey,
  cache: createMemoryCache(),
  baseUrl: process.env.QLOO_BASE_URL || undefined,
});

/**
 * Names compared after normalising: accents and case dropped, a bracketed note such as
 * "(Acoustic)" dropped, a leading "The" dropped, and only letters and digits kept.
 */
export function normalise(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\([^)]*\)/g, "")
    .toLowerCase()
    .replace(/^\s*the\s+/, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

const lineup = JSON.parse(readFileSync(LINEUP, "utf8")) as {
  source: string;
  count: number;
  names: string[];
};
const onBill = new Set(lineup.names.map(normalise));

const headliners = await Promise.all(
  SAGEBRUSH_SOUND.headliners.map(async (name) => {
    const { data } = await qloo.search({ query: name });
    const match =
      data.find((entity) => normalise(entity.name) === normalise(name)) ??
      data[0];
    if (!match) throw new Error(`Qloo found no artist for ${name}.`);
    return match;
  }),
);
const headlinerIds = headliners.map((artist) => artist.entityId);

const tag = (
  await qloo.tags({ query: "live music venue", parentType: "urn:entity:place" })
).data.find((candidate) => /live music venue/i.test(candidate.name));
if (!tag) throw new Error("Qloo has no live music venue tag.");
const places = (
  await qloo.places({ locationQuery: SAGEBRUSH_SOUND.city, tagId: tag.id })
).data;
const rooms = ROOMS.map((name) => {
  const place = places.find((candidate) => candidate.name === name);
  if (!place) throw new Error(`${name} isn't among Qloo's Boise places.`);
  return place;
});

const ages = ageBuckets(
  SAGEBRUSH_SOUND.crowdAge.min,
  SAGEBRUSH_SOUND.crowdAge.max,
).buckets;
const results: {
  band: string;
  list: string;
  ranked: number;
  onTreefortBill: number;
}[] = [];
const matched: Record<string, string[]> = {};
for (const band of SAGEBRUSH_SOUND.feeBands) {
  const lists = [
    { seed: "headliners alone", extra: [] as string[] },
    ...rooms.map((room) => ({
      seed: `headliners + ${room.name}`,
      extra: [room.entityId],
    })),
  ];
  for (const list of lists) {
    const { data } = await qloo.artists({
      signalEntityIds: [...headlinerIds, ...list.extra],
      popularityMin: band.minPopularity,
      popularityMax: band.maxPopularity,
      excludeEntityIds: headlinerIds,
      ages,
      take: 50,
    });
    const hits = data.filter((artist) => onBill.has(normalise(artist.name)));
    matched[`${band.label}: ${list.seed}`] = hits.map((artist) => artist.name);
    results.push({
      band: band.label,
      list: list.seed,
      ranked: data.length,
      onTreefortBill: hits.length,
    });
  }
}

const verdictPerBand = SAGEBRUSH_SOUND.feeBands.map((band) => {
  const rows = results.filter((row) => row.band === band.label);
  const baseline = rows[0].onTreefortBill;
  const best = Math.max(...rows.slice(1).map((row) => row.onTreefortBill));
  return {
    band: band.label,
    baseline,
    bestRoom: best,
    roomBeatsBaseline: best > baseline,
  };
});
const summary = {
  ranAt: new Date().toISOString(),
  lineup: { source: lineup.source, names: lineup.count },
  taggedPlaces: places.length,
  ages,
  results,
  verdictPerBand,
  go: verdictPerBand.every((band) => band.roomBeatsBaseline),
};
console.log(JSON.stringify(summary, null, 2));
writeFileSync(OUT, `${JSON.stringify({ ...summary, matched }, null, 2)}\n`);
