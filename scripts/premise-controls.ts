// Evidence section 34 (docs/evidence.md): the premise test's two controls, on section 26's 22
// scored festivals. normalise, the client, entities, venuesOf and affinities are
// scripts/premise-test.ts's (section 26), with the call cap and the answer's status added. Reads
// .design/m8f/ (lineups.json, and result.json's names, fee ranges and lifts) and the towns'
// saved builds in .design/m6m/; finds the same acts again, since section 26 saved no entity ids
// (the headliners and booked acts by its search, the random acts from its pool calls, matched by
// name); then per festival one call with the headliners alone, Control A's venue calls and
// Control B's location call. One call at a time, every attempt counted. Names go to
// .design/m8f/controls/ (gitignored) only; the console gets counts and lifts. Without LIVE=1 it
// calls nothing and prints the plan. LIVE=1 needs MAX_CALLS, the count Daniel approved, and
// stops before an attempt past it; a rerun skips the festivals already done. From the root:
//   LIVE=1 MAX_CALLS=<n> node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/premise-controls.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CHECKED_TOWNS, type CheckedTown } from "@/lib/checked-towns";
import { controlTownFor, meanOf, tallyBars } from "@/lib/premise-controls";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { checkedFestival } from "@/lib/towns";

const LIVE = process.env.LIVE === "1";
const MAX_CALLS = Number(process.env.MAX_CALLS ?? 0);
if (LIVE && !(MAX_CALLS > 0))
  throw new Error("LIVE=1 needs MAX_CALLS, the approved number of calls.");
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const apiKey = process.env.QLOO_API_KEY;
if (LIVE && !apiKey)
  throw new Error("QLOO_API_KEY is not set (put it in .env.local).");
const BASE = process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";
const DIR = ".design/m8f";
// CONTROLS_OUT moves the output, for a run against a fake Qloo that must not touch the record.
const OUT = process.env.CONTROLS_OUT ?? `${DIR}/controls`;
const PROGRESS = `${OUT}/progress.json`;
const BAR = 16;

/** As section 26: accents, case, a bracketed note and a leading "The" dropped. */
function normalise(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\([^)]*\)/g, "")
    .toLowerCase()
    .replace(/^\s*the\s+/, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

type Entity = {
  entity_id: string;
  name: string;
  popularity?: number;
  query?: { affinity?: number };
};
type Answer = { results?: Entity[] | { entities?: Entity[] } } | null;

const progress: {
  calls: number;
  done: Record<string, Record<string, unknown>>;
} = existsSync(PROGRESS)
  ? JSON.parse(readFileSync(PROGRESS, "utf8"))
  : { calls: 0, done: {} };
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Section 26 spaced its calls 1.2 s apart; only a rehearsal against a fake Qloo shortens it.
const SPACING_MS = Number(process.env.SPACING_MS ?? 1200);
let calls = 0;

// As section 26's client: one call at a time, spaced; a 429 or 5xx waits and tries again.
async function get(path: string, params: Record<string, string | number>) {
  const url = new URL(path, BASE);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, String(value));
  for (let attempt = 0; attempt < 5; attempt++) {
    if (progress.calls + calls >= MAX_CALLS)
      throw new Error(`Stopping at the approved ${MAX_CALLS} calls.`);
    calls++;
    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey!, Accept: "application/json" },
    });
    if (response.status !== 429 && response.status < 500) {
      await pause(SPACING_MS);
      return {
        status: response.status,
        body: (await response.json().catch(() => null)) as Answer,
      };
    }
    await pause(2000 * 2 ** attempt);
  }
  throw new Error(`Qloo ${path} stayed busy`);
}

const entities = (body: Answer): Entity[] => {
  const results = body?.results;
  return Array.isArray(results) ? results : (results?.entities ?? []);
};

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

async function affinities(
  signal: string[],
  among: string[],
  extra: Record<string, string> = {},
) {
  const { status, body } = await get("/v2/insights", {
    "filter.type": "urn:entity:artist",
    "signal.interests.entities": signal.join(","),
    ...extra,
    "filter.results.entities": among.join(","),
    take: among.length,
  });
  return {
    status,
    map: new Map(
      entities(body)
        .filter((entity) => typeof entity.query?.affinity === "number")
        .map((entity) => [entity.entity_id, entity.query!.affinity!]),
    ),
  };
}

async function searchId(name: string): Promise<string | null> {
  const { body } = await get("/search", {
    query: name,
    types: "urn:entity:artist",
    take: 5,
  });
  return (
    entities(body).find((entity) => normalise(entity.name) === normalise(name))
      ?.entity_id ?? null
  );
}

const lineups = JSON.parse(
  readFileSync(`${DIR}/lineups.json`, "utf8"),
) as Record<string, { label: string; town: string; names: string[] }>;
type Act = [name: string, band: string, lift: number | null];
const section26 = JSON.parse(readFileSync(`${DIR}/result.json`, "utf8")) as {
  raw: Record<string, { headliners: string[]; booked: Act[]; random: Act[] }>;
};
const townOf = (festivalId: string): CheckedTown => {
  const town = CHECKED_TOWNS.find((t) => checkedFestival(t).id === festivalId);
  if (!town) throw new Error(`no checked town for ${festivalId}`);
  return town;
};
const anchorCount = (city: string) => {
  const town = CHECKED_TOWNS.find((t) => t.city === city);
  return town ? venuesOf(checkedFestival(town).id).length : 0;
};

const plan = {
  searches: 0,
  pools: 0,
  base: 0,
  venues: 0,
  location: 0,
  randomActs: 0,
};
for (const [key, raw] of Object.entries(section26.raw)) {
  const festival = lineups[key];
  const town = townOf(festival.town);
  const needed = venuesOf(festival.town).length;
  const other = controlTownFor(CHECKED_TOWNS, anchorCount, town.city, needed);
  if (!other) throw new Error(`no control town for ${festival.label}`);
  const otherVenues = venuesOf(checkedFestival(other).id).slice(0, needed);
  const bands = SAGEBRUSH_SOUND.feeBands.filter((band) =>
    raw.booked.some(([, id]) => id === band.id),
  );
  const location = `${town.city}, ${town.region}`;
  const row: Record<string, unknown> = {
    festival: festival.label,
    town: town.city,
    venues: needed,
    control: other.city,
    location,
  };
  if (!LIVE) {
    plan.searches += raw.headliners.length + raw.booked.length;
    plan.pools += bands.length;
    plan.base += 1;
    plan.venues += otherVenues.length;
    plan.location += 1;
    plan.randomActs += raw.random.length;
    console.log(
      JSON.stringify({
        ...row,
        searches: raw.headliners.length + raw.booked.length,
        pools: bands.length,
        calls:
          raw.headliners.length +
          raw.booked.length +
          bands.length +
          2 +
          otherVenues.length,
      }),
    );
    continue;
  }
  if (progress.done[key]) continue;
  const before = calls;
  const headliners: string[] = [];
  for (const name of raw.headliners) {
    const id = await searchId(name);
    if (id) headliners.push(id);
  }
  if (headliners.length < 2) {
    progress.done[key] = {
      ...row,
      unscored: "the headliners didn't resolve again",
    };
  } else {
    const booked = [];
    for (const [name, band, ownLift] of raw.booked)
      booked.push({ name, band, ownLift, id: await searchId(name) });
    const pools = new Map<string, Map<string, string>>();
    for (const band of bands) {
      const { body } = await get("/v2/insights", {
        "filter.type": "urn:entity:artist",
        "signal.interests.entities": headliners.join(","),
        "filter.popularity.min": band.minPopularity,
        "filter.popularity.max": band.maxPopularity,
        "filter.exclude.entities": headliners.join(","),
        take: 50,
      });
      const pool = new Map<string, string>();
      for (const entity of entities(body))
        if (!pool.has(normalise(entity.name)))
          pool.set(normalise(entity.name), entity.entity_id);
      pools.set(band.id, pool);
    }
    const random = [];
    for (const [name, band, ownLift] of raw.random) {
      const inPool = pools.get(band)?.get(normalise(name)) ?? null;
      random.push({
        name,
        band,
        ownLift,
        inPool: inPool !== null,
        id: inPool ?? (await searchId(name)),
      });
    }
    const among = [...booked, ...random]
      .map((act) => act.id)
      .filter((id): id is string => id !== null);
    const base = await affinities(headliners, among);
    const withOther: Awaited<ReturnType<typeof affinities>>[] = [];
    for (const venue of otherVenues)
      withOther.push(await affinities([...headliners, venue], among));
    const withLocation = await affinities(headliners, among, {
      "signal.location.query": location,
    });
    const gain = (map: Map<string, number>, id: string | null) => {
      const a0 = id === null ? undefined : base.map.get(id);
      const a1 = id === null ? undefined : map.get(id);
      return a0 === undefined || a1 === undefined ? null : a1 - a0;
    };
    const liftA = (id: string | null) => {
      const gains = withOther
        .map(({ map }) => gain(map, id))
        .filter((value): value is number => value !== null);
      return gains.length ? Math.max(...gains) : null;
    };
    const scored = <T extends { id: string | null; ownLift: number | null }>(
      acts: T[],
    ) =>
      acts.map((act) => ({
        ...act,
        base: act.id === null ? null : (base.map.get(act.id) ?? null),
        liftA: liftA(act.id),
        liftB: gain(withLocation.map, act.id),
      }));
    const b = scored(booked);
    const r = scored(random);
    const advantage = (key: "ownLift" | "liftA" | "liftB") => {
      const bm = meanOf(b.map((act) => act[key]));
      const rm = meanOf(r.map((act) => act[key]));
      return {
        booked: bm,
        random: rm,
        advantage: bm === null || rm === null ? null : bm - rm,
      };
    };
    const baseBooked = meanOf(b.map((act) => act.base));
    const baseRandom = meanOf(r.map((act) => act.base));
    progress.done[key] = {
      ...row,
      headliners: raw.headliners,
      booked: b,
      random: r,
      own: advantage("ownLift"),
      a: advantage("liftA"),
      b: advantage("liftB"),
      baseBooked,
      baseRandom,
      locationStatus: withLocation.status,
      locationAnswered: withLocation.map.size,
    };
  }
  progress.done[key].calls = calls - before;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    PROGRESS,
    `${JSON.stringify({ calls: progress.calls + calls, done: progress.done }, null, 1)}\n`,
  );
  const done = progress.done[key] as {
    own?: { advantage: number | null };
    a?: { advantage: number | null };
    b?: { advantage: number | null };
    baseBooked?: number | null;
    baseRandom?: number | null;
    booked?: { id: string | null }[];
    random?: { id: string | null; inPool: boolean }[];
  };
  const round = (value: number | null | undefined) =>
    value === null || value === undefined ? null : Number(value.toFixed(4));
  console.log(
    JSON.stringify({
      ...row,
      bookedFound: done.booked?.filter((act) => act.id).length,
      randomFound: done.random?.filter((act) => act.id).length,
      randomInPool: done.random?.filter((act) => act.inPool).length,
      own: round(done.own?.advantage),
      a: round(done.a?.advantage),
      b: round(done.b?.advantage),
      startsLower:
        done.baseBooked == null || done.baseRandom == null
          ? null
          : done.baseBooked < done.baseRandom,
      calls: progress.done[key].calls,
    }),
  );
}

if (!LIVE) {
  const total =
    plan.searches + plan.pools + plan.base + plan.venues + plan.location;
  console.log(
    JSON.stringify({
      dry: true,
      ...plan,
      total,
      plusUpTo: plan.randomActs,
      calls: 0,
    }),
  );
} else {
  type Done = {
    own?: {
      advantage: number | null;
      booked: number | null;
      random: number | null;
    };
    a?: {
      advantage: number | null;
      booked: number | null;
      random: number | null;
    };
    b?: {
      advantage: number | null;
      booked: number | null;
      random: number | null;
    };
    baseBooked?: number | null;
    baseRandom?: number | null;
  };
  const rows = Object.values(progress.done) as Done[];
  const tally = tallyBars(
    rows.map((row) => ({
      own: row.own?.advantage ?? null,
      other: row.a?.advantage ?? null,
      signal: row.b?.advantage ?? null,
    })),
  );
  const supports = (side?: { booked: number | null; random: number | null }) =>
    side?.booked != null && side.random != null && side.booked > side.random;
  const summary = {
    festivals: rows.length,
    calls: progress.calls + calls,
    ...tally,
    barA: tally.ownBeatsOther >= BAR ? "the town matters" : "not met",
    barB:
      tally.venuesBeatSignal >= BAR
        ? "venues beat the signal"
        : tally.signalBeatsVenues >= BAR
          ? "the signal beats the venues"
          : "neither",
    supportOf30: {
      section26: rows.filter((row) => supports(row.own)).length,
      controlA: rows.filter((row) => supports(row.a)).length,
      controlB: rows.filter((row) => supports(row.b)).length,
    },
    step0BookedStartLower: rows.filter(
      (row) =>
        row.baseBooked != null &&
        row.baseRandom != null &&
        row.baseBooked < row.baseRandom,
    ).length,
  };
  console.log(JSON.stringify(summary));
  writeFileSync(
    `${OUT}/result.json`,
    `${JSON.stringify({ ranAt: new Date().toISOString(), summary, festivals: progress.done }, null, 1)}\n`,
  );
}
