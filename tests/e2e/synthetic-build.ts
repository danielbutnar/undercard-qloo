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

// The rooms the synthetic agent tested: the first two lift every act, the third lifts none, and
// its cached runs are the headliners-only ranking itself, so Qloo had no fan data for it (WS2).
const LANTERN = { entityId: id(201), name: "The Lantern Room" };
const FORT = { entityId: id(202), name: "Fort Street Ballroom" };
const COTTONWOOD = { entityId: id(203), name: "Cottonwood Social Hall" };
// Nashville's switch build reads this room instead of Cottonwood Social Hall: Qloo's ranking
// changes with its fans, but no act climbs 5 places, so it moves nothing for real.
const LINDEN = { entityId: id(204), name: "Linden Street Annex" };

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

export const SYNTHETIC_SWITCH_BUILD_ID = "synthetic-switch-build";

/**
 * A synthetic build whose planner switches venue (WS2): the first plan anchors on The Lantern
 * Room and Linden Street Annex, with Fort Street Ballroom as a backup; Linden Street Annex lifts
 * no act (its fans were read: the ranking moves, but no act 5 places), so after its result the
 * planner names Fort Street Ballroom, read next. Same lineup as syntheticSavedBuild() (Fort
 * Street Ballroom's fans put 3 acts on it), invented names.
 */
export function syntheticSwitchBuild(): SavedBuild {
  const base = syntheticSavedBuild();
  return {
    ...base,
    id: SYNTHETIC_SWITCH_BUILD_ID,
    trace: [
      ...calls.slice(0, 7),
      artistsCall(8, "Mid", LANTERN.name),
      artistsCall(9, "Opener", LANTERN.name),
      artistsCall(10, "Mid", LINDEN.name),
      artistsCall(11, "Mid", FORT.name),
      artistsCall(12, "Opener", FORT.name),
    ],
    context: {
      ...base.context,
      anchors: { mid: [LANTERN, LINDEN, FORT], opener: [LANTERN, FORT] },
    },
    notes: [
      {
        at: 0,
        text: "Search both headliners and find the tag Qloo puts on live music venues.",
      },
      {
        at: 3,
        text: "List the town's places with that tag, and compare what the two headliners' fans share.",
      },
      {
        at: 5,
        text: "Anchors: The Lantern Room for both bands and Linden Street Annex for Mid, with Fort Street Ballroom as a backup.",
      },
      {
        at: 10,
        text: "Linden Street Annex lifted no act; try Fort Street Ballroom for both bands.",
      },
    ],
  };
}

// Denver's rooms (WS8): The Room's fans lift three mid-size acts and all six openers, The Room
// East's the fourth mid-size act, and Cottonwood Social Hall is read for mid-size acts
// and lifts none. The Room alone fills the opening slots, so with it switched off the opening
// tier empties while the mid-size tier keeps one act and three open slots.
const LARIMER = { entityId: id(205), name: "The Room" };
const IRONWORKS = { entityId: id(206), name: "The Room East" };

/** Boise's bill re-credited to Denver's rooms: Fort Street Ballroom's mid-size act to The Room East. */
function denverActs(): SavedBuild["lineup"]["acts"] {
  return (lineup.acts as SavedBuild["lineup"]["acts"]).map((act) => {
    const room =
      act.band === "mid" && act.anchorVenue.entityId === FORT.entityId
        ? IRONWORKS
        : LARIMER;
    return {
      ...act,
      anchorVenue: room,
      reason: act.reason.replace(/^.+? fans /, `${room.name} fans `),
    };
  });
}

/**
 * Denver's synthetic saved build (WS8): Boise's acts, each credited to one of Denver's rooms, so
 * a room switched off can empty a whole tier (as Venue 418 does Boise's openers).
 */
export function syntheticDenverBuild(): SavedBuild {
  const base = syntheticSavedBuild();
  return {
    ...base,
    id: "synthetic-tier-build",
    trace: [
      ...calls.slice(0, 7),
      artistsCall(8, "Mid", IRONWORKS.name),
      artistsCall(9, "Mid", LARIMER.name),
      artistsCall(10, "Opener", LARIMER.name),
      artistsCall(11, "Mid", COTTONWOOD.name),
    ],
    lineup: { ...base.lineup, acts: denverActs() },
    context: {
      ...base.context,
      anchors: { mid: [LARIMER, IRONWORKS, COTTONWOOD], opener: [LARIMER] },
    },
    notes: [
      {
        at: 0,
        text: "Search both headliners and find the tag Qloo puts on live music venues.",
      },
      {
        at: 3,
        text: "List the town's places with that tag, and compare what the two headliners' fans share.",
      },
      {
        at: 5,
        text: "Rank each band for the headliners alone, then add The Room East and The Room for Mid and The Room for openers.",
      },
      { at: 10, text: "Try Cottonwood Social Hall for Mid as a third room." },
    ],
  };
}

/**
 * Each other town's synthetic saved build (src/server/synthetic-seed.ts): Boise's bill under the
 * town's own id, for Nashville the build whose planner switches venue, and for Denver Boise's acts
 * from Denver's rooms.
 */
export function syntheticTownBuild(
  slug: string,
  festivalId: string,
): SavedBuild {
  const build =
    slug === "nashville"
      ? syntheticSwitchBuild()
      : slug === "denver"
        ? syntheticDenverBuild()
        : syntheticSavedBuild();
  return {
    ...build,
    id: `${build.id}-${slug}`,
    festivalId,
    lineup: { ...build.lineup, festivalId },
  };
}

const ndjson = (events: unknown[]) =>
  events.map((event) => JSON.stringify(event)).join("\n") + "\n";

const climbPlace = (reason: string) =>
  Number(/move it up (\d+) places/.exec(reason)?.[1] ?? 0);

/**
 * Watch's editions for a synthetic build, invented from its lineup (the synthetic server has no
 * Qloo lists to rebuild them from): each band's acts for the headliners alone, then, for each
 * venue's call, the acts its fans put on the lineup with their climb, above the band's others.
 */
function syntheticClimbs(build: SavedBuild) {
  const acts = build.lineup.acts;
  return build.trace.map((call) => {
    const band = call.summary.startsWith("Mid-band")
      ? "mid"
      : call.summary.startsWith("Opener-band")
        ? "opener"
        : null;
    if (!band || !/^(baseline|venue)_artists$/.test(call.tool)) return null;
    const inBand = acts.filter((act) => act.band === band);
    const venue =
      call.tool === "venue_artists"
        ? ([LANTERN, FORT, COTTONWOOD, LINDEN, LARIMER, IRONWORKS].find(
            (room) => call.summary.endsWith(`headliners and ${room.name}`),
          ) ?? null)
        : null;
    const lifted = venue
      ? inBand.filter((act) => act.anchorVenue.entityId === venue.entityId)
      : [];
    const rest = inBand.filter((act) => !lifted.includes(act));
    return {
      type: "climb",
      band,
      venue,
      acts: [...lifted, ...rest].slice(0, 8).map((act) => {
        const fresh = lifted.includes(act) && /into the top/.test(act.reason);
        return {
          entityId: act.entityId,
          name: act.name,
          move: lifted.includes(act) && !fresh ? climbPlace(act.reason) : null,
          ...(fresh ? { fresh: true } : {}),
        };
      }),
    };
  });
}

/**
 * A saved build's replay as the server streams it (src/server/undercard-build.ts), with the
 * planner's lines before the calls they came before and an edition after each artist call, so
 * Watch steps through every venue at its own pace.
 */
export function syntheticReplayStream(build: SavedBuild): string {
  const climbs = syntheticClimbs(build);
  const notes = build.notes ?? [];
  const said = (at: (n: number) => boolean) =>
    notes
      .filter((note) => at(note.at))
      .map((note) => ({ type: "status", text: note.text, planner: true }));
  return ndjson([
    { type: "build", id: build.id, createdAt: build.createdAt, replayed: true },
    {
      type: "status",
      text: "Replaying the saved build: no new Qloo or Claude calls.",
    },
    ...build.trace.flatMap((call, index) => [
      ...said((at) => at === index),
      { type: "call", call: { ...call, cached: true } },
      ...(climbs[index] ? [climbs[index]] : []),
    ]),
    ...said((at) => at >= build.trace.length),
    { type: "lineup", lineup: build.lineup },
    { type: "done", calls: build.trace.length, ms: 1400 },
  ]);
}

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
    // Its place in its venue's ranking, for the receipt (WS18 item 3): up 13, 25th to 12th.
    { type: "refill", replaces, act: replacement, place: { now: 12, was: 25 } },
    { type: "done", calls: 1, ms: 1500 },
  ]);
}

/** The one model pick whose search the synthetic Qloo cache doesn't hold: "not checked". */
export const SYNTHETIC_UNCHECKED_PICK = "Night Orchard";

// What Qloo's search answers for the model's picks (prompt-4): invented entities with genre tags
// the synthetic headliners and their compared tag carry, or don't. "The Long Drives" is found as
// "Long Drives"; nothing of "Fern & Fable" matches.
const PICK_RESULTS: Record<
  string,
  { n: number; name: string; popularity: number; genres: string[] }[]
> = {
  "Velvet Coyote": [
    {
      n: 301,
      name: "Velvet Coyote",
      popularity: 0.963,
      genres: ["Psychedelic Rock", "Indie Pop"],
    },
  ],
  "The Long Drives": [
    { n: 302, name: "Long Drives", popularity: 0.941, genres: ["Dream Pop"] },
  ],
  "Marigold Static": [
    {
      n: 303,
      name: "Marigold Static",
      popularity: 0.862,
      genres: ["Dream Pop", "Indie Pop"],
    },
  ],
  "Paper Canyon": [
    { n: 304, name: "Paper Canyon", popularity: 0.975, genres: ["Funk"] },
  ],
  "Dusk Arcade": [
    {
      n: 305,
      name: "Dusk Arcade",
      popularity: 0.912,
      genres: ["Indie Pop", "Dream Pop"],
    },
  ],
  "Honey Basin": [
    {
      n: 306,
      name: "Honey Basin",
      popularity: 0.958,
      genres: ["Psychedelic Rock", "Dream Pop"],
    },
  ],
  "Lowland Choir": [
    { n: 307, name: "Lowland Choir", popularity: 0.64, genres: ["Indie Pop"] },
  ],
  "Silver Mesa": [
    {
      n: 308,
      name: "Silver Mesa",
      popularity: 0.47,
      genres: ["Psychedelic Rock"],
    },
  ],
  "Fern & Fable": [
    { n: 309, name: "Fern and Fable Choir", popularity: 0.7, genres: [] },
    { n: 310, name: "Fable Fern", popularity: 0.6, genres: [] },
  ],
};

const rawArtist = ({
  n,
  name,
  popularity,
  genres,
}: (typeof PICK_RESULTS)[string][number]) => ({
  entity_id: id(n),
  name,
  popularity,
  tags: genres.map((genre) => ({
    tag_id: `urn:tag:genre:music:${genre.toLowerCase().replace(/ /g, "_")}`,
    name: genre,
    type: "urn:tag:genre:music",
  })),
});

/** An act of a band's headliners-only ranking as Qloo lists it: the fixture's, or a padded one. */
function rankedRaw(entityId: string, index: number, band: "mid" | "opener") {
  const act = lineup.acts.find((entry) => entry.entityId === entityId);
  return {
    entity_id: entityId,
    name: act?.name ?? `Synthetic ${band} act ${index + 1}`,
    popularity: act?.popularity ?? (band === "mid" ? 0.86 : 0.66),
    query: { affinity: Math.round((0.9 - index * 0.005) * 1000) / 1000 },
  };
}

/**
 * Qloo's answers for the Without Qloo checks (prompt-4), which the synthetic server seeds into
 * its cache (src/server/synthetic-seed.ts): each searched pick's results, and the builds' venue
 * lists, where only The Lantern Room's fans bring a pick (Marigold Static) into Mid's top 50.
 * The checks read these lists, and so does WS2's no-fan-data check (src/lib/fan-data.ts):
 * Cottonwood Social Hall's list is the band's headliners-only ranking itself, and Linden Street
 * Annex's swaps each pair of neighbours in it, so its ranking changes but no act climbs 5 places.
 */
export function syntheticPickQloo(url: URL): unknown {
  if (url.pathname === "/search")
    return {
      results: (PICK_RESULTS[url.searchParams.get("query") ?? ""] ?? []).map(
        rawArtist,
      ),
    };
  const signal = (
    url.searchParams.get("signal.interests.entities") ?? ""
  ).split(",");
  const band =
    url.searchParams.get("filter.popularity.min") === "0.8" ? "mid" : "opener";
  if (
    signal.includes(COTTONWOOD.entityId) ||
    signal.includes(LINDEN.entityId)
  ) {
    const ranking = baseline(band);
    const listed = signal.includes(LINDEN.entityId)
      ? ranking.map((_, index) => ranking[index ^ 1] ?? ranking[index])
      : ranking;
    return {
      results: {
        entities: listed.map((entityId, index) =>
          rankedRaw(entityId, index, band),
        ),
      },
    };
  }
  const lifts = signal.includes(LANTERN.entityId) && band === "mid";
  return {
    results: {
      entities: lifts
        ? [
            {
              ...rawArtist(PICK_RESULTS["Marigold Static"][0]),
              query: { affinity: 0.7 },
            },
          ]
        : [],
    },
  };
}

/**
 * Invented Qloo scores for the shortlist (WS4), per searched pick: for the headliners alone and
 * with each venue's fans added. Qloo normalises each answer, so The Lantern Room's scores sit
 * lower across the board, yet Marigold Static rises from 6th to 1st in it; Cottonwood Social
 * Hall's answer is the headliners' own (Qloo had no fan data for it).
 */
const SHORTLIST_SCORES: Record<
  number,
  { alone: number; lantern: number; fort: number }
> = {
  301: { alone: 0.95, lantern: 0.74, fort: 0.93 },
  302: { alone: 0.91, lantern: 0.68, fort: 0.89 },
  303: { alone: 0.85, lantern: 0.8, fort: 0.84 },
  304: { alone: 0.87, lantern: 0.62, fort: 0.91 },
  305: { alone: 0.89, lantern: 0.66, fort: 0.96 },
  306: { alone: 0.93, lantern: 0.7, fort: 0.92 },
  307: { alone: 0.81, lantern: 0.72, fort: 0.82 },
  308: { alone: 0.83, lantern: 0.6, fort: 0.86 },
};

/**
 * Qloo's answers for a shortlist check on the synthetic server (WS4), never the network: the
 * picks' searches (any other name finds nothing, so it reads "not found on Qloo"), and Insights
 * limited to the listed acts, scored from SHORTLIST_SCORES by the venue in the signal.
 */
export function syntheticShortlistQloo(url: URL): unknown {
  if (url.pathname === "/search")
    return {
      results: (PICK_RESULTS[url.searchParams.get("query") ?? ""] ?? []).map(
        rawArtist,
      ),
    };
  const venue = (url.searchParams.get("signal.interests.entities") ?? "").split(
    ",",
  )[2];
  const column =
    venue === LANTERN.entityId
      ? "lantern"
      : venue === FORT.entityId
        ? "fort"
        : "alone";
  const known = new Map(
    Object.values(PICK_RESULTS)
      .flat()
      .map((pick) => [id(pick.n), pick]),
  );
  return {
    results: {
      entities: (url.searchParams.get("filter.results.entities") ?? "")
        .split(",")
        .flatMap((entityId) => {
          const pick = known.get(entityId);
          const scores = pick && SHORTLIST_SCORES[pick.n];
          return pick && scores
            ? [{ ...rawArtist(pick), query: { affinity: scores[column] } }]
            : [];
        })
        .sort((a, b) => b.query.affinity - a.query.affinity),
    },
  };
}

/**
 * Qloo's split of each act's result (WS7, docs/evidence.md section 35), invented for the
 * synthetic builds, which the synthetic server seeds into its cache: every input of the call
 * is scored but Cottonwood Social Hall, which Qloo has no fan data for (the answer lists it as
 * not found, as the real answers list such a venue). The headliners take about half; the venues
 * split the rest by weights from the act's number, so for some acts the venue its card credits
 * isn't the larger share. Each act's shares add up to 1, to four places.
 */
export function syntheticExplainQloo(url: URL): unknown {
  const listed = (name: string) =>
    (url.searchParams.get(name) ?? "").split(",").filter(Boolean);
  const inputs = listed("signal.interests.entities");
  return {
    success: true,
    results: {
      entities: listed("filter.results.entities").map((entityId) => {
        const k = Number(entityId.slice(-3));
        const headliners: [string, number][] = [
          [id(1), 0.24 + (k % 3) * 0.02],
          [id(2), 0.2 + (k % 2) * 0.03],
        ];
        const weights: Record<string, number> = {
          [LANTERN.entityId]: 1 + (k % 3),
          [FORT.entityId]: 1 + ((k + 1) % 3),
          [LINDEN.entityId]: 1,
        };
        const venues = inputs.filter((input) => input in weights);
        const rest = 1 - headliners.reduce((sum, [, share]) => sum + share, 0);
        const total = venues.reduce((sum, venue) => sum + weights[venue], 0);
        const shares = [
          ...headliners.filter(([headliner]) => inputs.includes(headliner)),
          ...venues.map((venue): [string, number] => [
            venue,
            (rest * weights[venue]) / total,
          ]),
        ]
          .map(([input, score]) => ({
            entity_id: input,
            score: Number(score.toFixed(4)),
          }))
          .sort((a, b) => b.score - a.score);
        return {
          name:
            lineup.acts.find((act) => act.entityId === entityId)?.name ??
            "Invented act",
          entity_id: entityId,
          type: "urn:entity:artist",
          query: {
            affinity: 0.9,
            explainability: { "signal.interests.entities": shares },
          },
        };
      }),
    },
    warnings: inputs.includes(COTTONWOOD.entityId)
      ? [
          {
            type: "not_found",
            "signal.interests.entities": [COTTONWOOD.entityId],
          },
        ]
      : [],
  };
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
export function syntheticVenueSwitch(festivalId?: string): VenueSwitchData {
  // Denver's build credits Boise's acts to its own rooms (WS8); every other town's is Boise's.
  const denver = festivalId === "sagebrush-sound-denver";
  const venues = denver
    ? [IRONWORKS, LARIMER, COTTONWOOD]
    : [LANTERN, FORT, COTTONWOOD];
  const acts = denver
    ? denverActs()
    : (lineup.acts as SavedBuild["lineup"]["acts"]);
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
