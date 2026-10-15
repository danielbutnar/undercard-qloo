#!/usr/bin/env node
// The M2 spike: three live Qloo calls, reported as result counts only. It never prints or
// writes response bodies (RULES.md: Qloo response data stays out of the repository).
// Run from the repository root with QLOO_API_KEY in .env.local:
//   node scripts/qloo-spike.mjs
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const BASE = process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";
const KEY = process.env.QLOO_API_KEY;
if (!KEY) {
  console.error("QLOO_API_KEY is not set (put it in .env.local).");
  process.exit(1);
}

const HEADLINERS = ["Khruangbin", "Japanese Breakfast"];
const CITY = "Boise";
const VENUE_TAG = "urn:tag:genre:place:live_music_venue";
const SEED_VENUE = "Venue 227";
const BANDS = [
  { label: "Mid", min: 0.8, max: 0.92 },
  { label: "Opener", min: 0.55, max: 0.8 },
];

async function qloo(path, params) {
  const url = new URL(path, BASE);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, String(value));
  const started = Date.now();
  const response = await fetch(url, { headers: { "X-Api-Key": KEY } });
  const body = response.ok ? await response.json() : null;
  const query = [...url.searchParams].map(([k, v]) => `${k}=${v}`).join("&");
  return {
    status: response.status,
    body,
    ms: Date.now() - started,
    request: `${path}?${query}`,
  };
}

function report(label, call, count, extra = "") {
  console.log(
    `${label}\n  GET ${call.request}\n  HTTP ${call.status}, ${call.ms} ms, ${count} results${extra}`,
  );
}

for (const name of HEADLINERS) {
  const call = await qloo("/search", {
    query: name,
    types: "urn:entity:artist",
    take: 10,
  });
  const results = call.body?.results ?? [];
  const exact = results[0]?.name?.toLowerCase() === name.toLowerCase();
  report(
    `/search for ${name}`,
    call,
    results.length,
    `; top result is the headliner: ${exact}`,
  );
}

const venuesCall = await qloo("/v2/insights", {
  "filter.type": "urn:entity:place",
  "filter.location.query": CITY,
  "filter.tags": VENUE_TAG,
  take: 50,
});
const venues = venuesCall.body?.results?.entities ?? [];
report(`Music venues in ${CITY}`, venuesCall, venues.length);

const seed = venues.find((venue) => venue.name === SEED_VENUE);
if (!seed) {
  console.log(`${SEED_VENUE} is not among the venues; stopping.`);
  process.exit(1);
}
const artistsCall = await qloo("/v2/insights", {
  "filter.type": "urn:entity:artist",
  "signal.interests.entities": seed.entity_id,
  take: 50,
});
const artists = artistsCall.body?.results?.entities ?? [];
const perBand = BANDS.map(
  (band) =>
    `${band.label} ${artists.filter((a) => a.popularity >= band.min && a.popularity <= band.max).length}`,
).join(", ");
report(
  `Artist insights seeded by ${SEED_VENUE}`,
  artistsCall,
  artists.length,
  `; by fee band: ${perBand}`,
);
