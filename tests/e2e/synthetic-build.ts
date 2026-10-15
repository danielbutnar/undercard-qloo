// A synthetic POST /api/undercard stream for design shots: invented acts and venues from
// tests/fixtures/lineup.synthetic.json, shaped like a real build. No Qloo data.
import { readFileSync } from "node:fs";

const lineup = JSON.parse(
  readFileSync("tests/fixtures/lineup.synthetic.json", "utf8"),
);

const HEADLINERS = "Khruangbin, Japanese Breakfast";
const VENUES = ["The Lantern Room", "Fort Street Ballroom"];

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
  artistsCall(8, "Mid", VENUES[0]),
  artistsCall(9, "Opener", VENUES[0]),
  artistsCall(10, "Mid", VENUES[1]),
  artistsCall(11, "Opener", VENUES[1]),
];

const ndjson = (events: unknown[]) =>
  events.map((event) => JSON.stringify(event)).join("\n") + "\n";

/** The full NDJSON body of a finished synthetic build. */
export function syntheticBuildStream(): string {
  return ndjson([
    {
      type: "build",
      id: "synthetic-build",
      createdAt: "2026-10-15T14:02:00.000Z",
      replayed: false,
    },
    { type: "status", text: "Planning the Qloo calls" },
    ...calls.map((call) => ({ type: "call", call })),
    { type: "lineup", lineup },
    { type: "done", calls: calls.length, ms: 15600 },
  ]);
}

/** A synthetic refill: one Qloo call, then an invented act takes the slot. */
export function syntheticRefillStream(replaces: string): string {
  const replacement = {
    entityId: "00000000-0000-4000-8000-000000000111",
    name: "Sego Lily",
    band: "mid",
    affinity: 0.86,
    popularity: 0.83,
    anchorVenue: lineup.acts[0].anchorVenue,
    reason: `${lineup.acts[0].anchorVenue.name} fans move it up 13 places.`,
    sharedTags: [
      { id: "urn:tag:genre:music:dream_pop", name: "Dream Pop" },
      { id: "urn:tag:genre:music:indie_rock", name: "Indie Rock" },
    ],
  };
  const call = {
    ...artistsCall(1, "Mid", VENUES[0]),
    tool: "refill",
    summary: `Refill: Mid-band artists for the headliners and ${VENUES[0]}, minus the board`,
  };
  call.params = call.params.map((param) =>
    param.key === "filter.exclude.entities"
      ? {
          ...param,
          value: `${HEADLINERS}, ${lineup.acts.map((act: { name: string }) => act.name).join(", ")}`,
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
  const names = [
    "Velvet Coyote",
    "The Long Drives",
    "Marigold Static",
    "Paper Canyon",
    "Dusk Arcade",
    "Honey Basin",
    "Lowland Choir",
    "Silver Mesa",
    "Fern & Fable",
    "Night Orchard",
  ];
  return {
    cached: true,
    lineup: {
      festivalId: "sagebrush-sound",
      createdAt: "2026-10-15T14:02:00.000Z",
      picks: names.map((name) => ({
        name,
        note: `A popular indie act whose sound suits fans of both headliners.`,
      })),
    },
  };
}
