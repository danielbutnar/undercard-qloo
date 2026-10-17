// A synthetic build for local e2e runs and design shots: invented acts and venues from
// tests/fixtures/lineup.synthetic.json, shaped like a real build. No Qloo data.
// With UNDERCARD_E2E_SYNTHETIC=1 the server seeds its memory cache with syntheticSavedBuild()
// and syntheticLlmOnly() (src/server/synthetic-seed.ts), so the first screen, the replay and
// LLM only run on the server without Qloo, Claude or Upstash. Playwright intercepts the rest.
import lineup from "../fixtures/lineup.synthetic.json";
import type { SavedBuild } from "../../src/server/build-store";

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

// The headliners-only ranking per band: the band's acts that it already listed, padded to 50
// with invented ids. An act whose Why Boise line says "into the top" isn't in it.
function baseline(band: "mid" | "opener"): string[] {
  const listed = lineup.acts
    .filter((act) => act.band === band && !/into the top/.test(act.reason))
    .map((act) => act.entityId);
  const padding = Array.from({ length: 50 - listed.length }, (_, i) =>
    id((band === "mid" ? 400 : 500) + i),
  );
  return [...padding.slice(0, 20), ...listed, ...padding.slice(20)];
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
export function syntheticRefillStream(replaces: string): string {
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
    summary: `Refill: Mid-band artists for the headliners and ${LANTERN.name}, minus the board`,
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
