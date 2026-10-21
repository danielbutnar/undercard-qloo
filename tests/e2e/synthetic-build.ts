// A synthetic build for local e2e runs and design shots: invented acts and venues from
// tests/fixtures/lineup.synthetic.json, shaped like a real build. No Qloo data.
// With UNDERCARD_E2E_SYNTHETIC=1 the server seeds its memory cache with syntheticSavedBuild()
// and syntheticLlmOnly() (src/server/synthetic-seed.ts), so the first screen, the replay and
// LLM only run on the server without Qloo, Claude or Upstash. Playwright intercepts the rest.
import lineup from "../fixtures/lineup.synthetic.json";
import type { SavedBuild } from "../../src/server/build-store";
import type { VenueSwitchData } from "../../src/lib/venue-switch";
import {
  UNAVAILABLE_REASONS,
  type UnavailableReason,
} from "../../src/lib/unavailable";

export const SYNTHETIC_BUILD_ID = "synthetic-build";
const CREATED_AT = "2026-10-15T14:02:00.000Z";
const HEADLINERS = "Khruangbin, Japanese Breakfast";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// The rooms the synthetic agent tested: the first two lift every act, the third lifts none.
const LANTERN = { entityId: id(201), name: "The Lantern Room" };
const FORT = { entityId: id(202), name: "Fort Street Ballroom" };
const COTTONWOOD = { entityId: id(203), name: "Cottonwood Social Hall" };

function artistsCall(n: number, band: "Mid" | "Opener", venue?: string) {
  const [min, max] = band === "Mid" ? ["0.8", "0.92"] : ["0.55", "0.8"];
  return {
    n,
    tool: venue ? "venue_artists" : "baseline_artists",
    endpoint: "/v2/insights",
    summary: venue
      ? `${band}-band artists for the headliners and ${venue}`
      : `${band}-band artists for the headliners alone`,
    params: [
      { key: "filter.type", value: "urn:entity:artist" },
      {
        key: "signal.interests.entities",
        value: venue ? `${HEADLINERS}, ${venue}` : HEADLINERS,
      },
      { key: "filter.popularity.min", value: min },
      { key: "filter.popularity.max", value: max },
      { key: "filter.exclude.entities", value: HEADLINERS },
      { key: "take", value: "50" },
    ],
    resultCount: 50,
    ms: 1400,
    cached: false,
  };
}

const calls = [
  {
    n: 1,
    tool: "search_artist",
    endpoint: "/search",
    summary: 'Search for "Khruangbin"',
    params: [
      { key: "query", value: "Khruangbin" },
      { key: "types", value: "urn:entity:artist" },
      { key: "take", value: "5" },
    ],
    resultCount: 3,
    ms: 900,
    cached: false,
  },
  {
    n: 2,
    tool: "search_artist",
    endpoint: "/search",
    summary: 'Search for "Japanese Breakfast"',
    params: [
      { key: "query", value: "Japanese Breakfast" },
      { key: "types", value: "urn:entity:artist" },
      { key: "take", value: "5" },
    ],
    resultCount: 5,
    ms: 950,
    cached: false,
  },
  {
    n: 3,
    tool: "find_tag",
    endpoint: "/v2/tags",
    summary: 'Tags matching "live music venue"',
    params: [
      { key: "filter.query", value: "live music venue" },
      { key: "filter.parents.types", value: "urn:entity:place" },
      { key: "take", value: "10" },
    ],
    resultCount: 10,
    ms: 1000,
    cached: false,
  },
  {
    n: 4,
    tool: "find_venues",
    endpoint: "/v2/insights",
    summary: "Boise places tagged Live music venue",
    params: [
      { key: "filter.type", value: "urn:entity:place" },
      { key: "filter.location.query", value: "Boise" },
      { key: "filter.tags", value: "urn:tag:genre:place:live_music_venue" },
      { key: "take", value: "20" },
    ],
    resultCount: 8,
    ms: 1100,
    cached: false,
  },
  {
    n: 5,
    tool: "compare_headliners",
    endpoint: "/v2/analysis/compare",
    summary: "Taste shared by Khruangbin and Japanese Breakfast",
    params: [
      { key: "a.signal.interests.entities", value: "Khruangbin" },
      { key: "b.signal.interests.entities", value: "Japanese Breakfast" },
      { key: "take", value: "25" },
    ],
    resultCount: 25,
    ms: 700,
    cached: false,
  },
  artistsCall(6, "Mid"),
  artistsCall(7, "Opener"),
  artistsCall(8, "Mid", LANTERN.name),
  artistsCall(9, "Opener", LANTERN.name),
  artistsCall(10, "Mid", FORT.name),
  artistsCall(11, "Opener", FORT.name),
  artistsCall(12, "Mid", COTTONWOOD.name),
];

// The headliners-only ranking per band, padded to 50 with invented ids. Each act it lists sits
// where its climb comes from: the band's acts take places 1, 4, 7 and on with their venue's fans
// (8, the new entry's, stays free), so each listed act's rank is that place plus its climb, and
// the chart's ladders read real places. An act whose Why Boise line says "into the top" isn't in it.
function baseline(band: "mid" | "opener"): string[] {
  const ranking: (string | null)[] = Array.from({ length: 50 }, () => null);
  lineup.acts
    .filter((act) => act.band === band && !/into the top/.test(act.reason))
    .forEach((act, index) => {
      const climb = Number(/move it up (\d+) places/.exec(act.reason)![1]);
      const rank = 3 * index + 1 + climb;
      if (rank > 50 || ranking[rank - 1] !== null)
        throw new Error(`synthetic baseline: rank ${rank} for ${act.name}`);
      ranking[rank - 1] = act.entityId;
    });
  let pad = band === "mid" ? 400 : 500;
  return ranking.map((entry) => entry ?? id(pad++));
}

/** The saved build the synthetic server replays: the fixture's lineup and the calls above. */
export function syntheticSavedBuild(): SavedBuild {
  return {
    id: SYNTHETIC_BUILD_ID,
    festivalId: "sagebrush-sound",
    createdAt: CREATED_AT,
    trace: calls,
    lineup: lineup as SavedBuild["lineup"],
    context: {
      headliners: [
        {
          entityId: id(1),
          name: "Khruangbin",
          tags: [
            {
              id: "urn:tag:genre:music:psychedelic_rock",
              name: "Psychedelic Rock",
              type: "urn:tag:genre:music",
            },
          ],
        },
        {
          entityId: id(2),
          name: "Japanese Breakfast",
          tags: [
            {
              id: "urn:tag:genre:music:dream_pop",
              name: "Dream Pop",
              type: "urn:tag:genre:music",
            },
          ],
        },
      ],
      comparedTags: [{ name: "Indie Pop", score: 0.8 }],
      baselines: { mid: baseline("mid"), opener: baseline("opener") },
      anchors: { mid: [LANTERN, FORT, COTTONWOOD], opener: [LANTERN, FORT] },
    },
    // Invented planner lines, placed by how many calls had come back when each was said.
    notes: [
      {
        at: 0,
        text: "Search both headliners and find the tag Qloo puts on live music venues.",
      },
      {
        at: 3,
        text: "List Boise's places with that tag, and compare what the two headliners' fans share.",
      },
      {
        at: 5,
        text: "Rank each band for the headliners alone, then add The Lantern Room and Fort Street Ballroom.",
      },
      {
        at: 11,
        text: "Try Cottonwood Social Hall for Mid as a third room.",
      },
      {
        at: 12,
        text: "Cottonwood Social Hall lifted no act; finish with the two rooms that did.",
      },
    ],
  };
}

const ndjson = (events: unknown[]) =>
  events.map((event) => JSON.stringify(event)).join("\n") + "\n";

/** The full NDJSON body of a finished synthetic build, run fresh or replayed from the saved one. */
export function syntheticBuildStream({
  replayed = false,
}: { replayed?: boolean } = {}): string {
  return ndjson([
    { type: "build", id: SYNTHETIC_BUILD_ID, createdAt: CREATED_AT, replayed },
    { type: "status", text: "Planning the Qloo calls" },
    ...calls.map((call) => ({
      type: "call",
      call: replayed ? { ...call, cached: true } : call,
    })),
    { type: "lineup", lineup },
    { type: "done", calls: calls.length, ms: replayed ? 1400 : 15600 },
  ]);
}

/** The 429 body the build route sends when a fresh build is over the per-IP limit. */
export const LIMIT_MESSAGE =
  "You've used today's 5 fresh builds from this network. The saved build still replays instantly. Try again tomorrow (UTC).";
export function syntheticLimitStream(): string {
  return ndjson([
    { type: "error", message: LIMIT_MESSAGE },
    { type: "done", calls: 0, ms: 0 },
  ]);
}

/** A synthetic refill: one Qloo call, then an invented act takes the slot. */
export function syntheticRefillStream(
  replaces: string,
  reason?: UnavailableReason,
): string {
  const replacement = {
    entityId: id(111),
    name: "Sego Lily",
    band: "mid",
    affinity: 0.86,
    popularity: 0.83,
    anchorVenue: LANTERN,
    reason: `${LANTERN.name} fans move it up 13 places.`,
    sharedTags: [
      { id: "urn:tag:genre:music:dream_pop", name: "Dream Pop" },
      { id: "urn:tag:genre:music:indie_rock", name: "Indie Rock" },
    ],
  };
  const call = {
    ...artistsCall(1, "Mid", LANTERN.name),
    tool: "refill",
    summary: `Refill${reason ? ` (${UNAVAILABLE_REASONS[reason]})` : ""}: Mid-band artists for the headliners and ${LANTERN.name}, minus the board`,
  };
  call.params = call.params.map((param) =>
    param.key === "filter.exclude.entities"
      ? {
          ...param,
          value: `${HEADLINERS}, ${lineup.acts.map((act) => act.name).join(", ")}`,
        }
      : param,
  );
  return ndjson([
    { type: "call", call },
    { type: "refill", replaces, act: replacement },
    { type: "done", calls: 1, ms: 1500 },
  ]);
}

/** A synthetic LLM-only answer: invented acts, as the model alone might list them. */
export function syntheticLlmOnly() {
  const picks: [string, string][] = [
    [
      "Velvet Coyote",
      "Warm, groove-led desert rock that sits well beside both headliners.",
    ],
    [
      "The Long Drives",
      "Hazy road-trip indie with a strong following among listeners in their late twenties.",
    ],
    [
      "Marigold Static",
      "Dreamy synth pop that bridges Japanese Breakfast's melodies and Khruangbin's mood.",
    ],
    [
      "Paper Canyon",
      "A tight live band with funk-leaning rhythms that suit an early-evening slot.",
    ],
    ["Dusk Arcade", "Shimmering guitar pop with a growing festival profile."],
    [
      "Honey Basin",
      "Soulful psych with the laid-back feel Khruangbin fans tend to like.",
    ],
    ["Lowland Choir", "Lush harmonies and a gentle set that opens a day well."],
    ["Silver Mesa", "Instrumental grooves that echo the headliners' textures."],
    [
      "Fern & Fable",
      "Bright folk pop that draws the same crowd as indie headliners.",
    ],
    ["Night Orchard", "Moody bedroom pop that suits a 25 to 34 audience."],
  ];
  return {
    cached: true,
    lineup: {
      festivalId: "sagebrush-sound",
      createdAt: CREATED_AT,
      picks: picks.map(([name, note]) => ({ name, note })),
    },
  };
}

/** A synthetic redraft (M8c): each slot not kept gets an invented act from the same band. */
export function syntheticRedraftStream(
  replace: { entityId: string; band: "mid" | "opener" }[],
): string {
  const names = [
    "Juniper Static",
    "Owyhee Lights",
    "Table Rock Choir",
    "Basque Block",
    "Foothill Radio",
    "Payette Bloom",
    "Snake River Sun",
  ];
  const pairs = replace.map((slot, index) => ({
    replaces: slot.entityId,
    act: {
      entityId: id(600 + index),
      name: names[index % names.length],
      band: slot.band,
      affinity: 0.8 - index * 0.01,
      popularity: slot.band === "mid" ? 0.84 : 0.7,
      anchorVenue: LANTERN,
      reason: `${LANTERN.name} fans move it up 9 places.`,
      sharedTags: [
        { id: "urn:tag:genre:music:dream_pop", name: "Dream Pop" },
        { id: "urn:tag:genre:music:indie_rock", name: "Indie Rock" },
      ],
    },
  }));
  const call = {
    ...artistsCall(1, "Mid", LANTERN.name),
    tool: "redraft",
    summary: `Redraft: Mid-band artists for the headliners and ${LANTERN.name}, minus the board`,
  };
  return ndjson([
    { type: "call", call },
    { type: "redraft", pairs },
    { type: "done", calls: 1, ms: 1200 },
  ]);
}

/**
 * The venue switch for the synthetic build (local e2e and design shots): every combination of
 * its three rooms, where a room switched off takes its acts with it and their slots stay open.
 * A real build's switch reruns the booking rule on its Qloo results (src/server/venue-switch.ts).
 */
export function syntheticVenueSwitch(): VenueSwitchData {
  const venues = [LANTERN, FORT, COTTONWOOD];
  const acts = lineup.acts as SavedBuild["lineup"]["acts"];
  const ranking = { mid: baseline("mid"), opener: baseline("opener") };
  const entries: VenueSwitchData["entries"] = {};
  for (const act of acts) {
    const up = /move it up (\d+) places/.exec(act.reason);
    const into = /into the top (\d+)/.exec(act.reason);
    const was = ranking[act.band].indexOf(act.entityId) + 1;
    entries[`${act.entityId}@${act.anchorVenue.entityId}`] = {
      act,
      place: up
        ? { now: was - Number(up[1]), was }
        : into
          ? { now: Number(into[1]), was: null }
          : null,
    };
  }
  const lineups: VenueSwitchData["lineups"] = {};
  for (let bits = 0; bits < 2 ** venues.length; bits++) {
    const mask = venues.map((_, i) => (bits & (1 << i) ? "1" : "0")).join("");
    const on = new Set(
      venues.filter((_, i) => mask[i] === "1").map((v) => v.entityId),
    );
    const kept = acts.filter((act) => on.has(act.anchorVenue.entityId));
    lineups[mask] = {
      keys: kept.map((act) => `${act.entityId}@${act.anchorVenue.entityId}`),
      shortfall: {
        mid: 4 - kept.filter((act) => act.band === "mid").length,
        opener: 6 - kept.filter((act) => act.band === "opener").length,
      },
    };
  }
  return { venues, entries, lineups };
}
