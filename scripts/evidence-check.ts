// One command that re-derives the site's numbers (WS11). Each claim in scripts/evidence-claims.ts
// is a file, a phrase holding the number and the computation it must equal, or "not
// recomputable" for a number from a run that was never saved. The phrase is found in its file,
// the number it holds is read, and one table names the file and the phrase of every claim; any
// recomputable mismatch exits 1.
//
// The saved builds come from replay-only requests (POST /api/undercard with replayOnly), which
// make no Qloo or model call and write nothing. It never calls Qloo.
import { MIN_LIFT } from "@/lib/assemble-lineup";
import { BuildEventSchema, type TraceCall } from "@/lib/build-events";
import { CHECKED_TOWNS, type CheckedTown } from "@/lib/checked-towns";
import { feeBandFor, type FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { ClimbEvent } from "@/lib/lift-climb";
import type { Act, Lineup } from "@/lib/lineup";
import { LlmOnlyLineupSchema } from "@/lib/llm-only";
import { liftOf } from "@/lib/marks";
import { foundOnQloo, normalise, pickTests } from "@/lib/pick-tests";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { checkedFestival, TOWNS } from "@/lib/towns";
import { lineupMeasures } from "@/lib/with-without";
import { QLOO_CALL_CAP } from "@/server/agent-tools";
import { createBuildStore } from "@/server/build-store";
import { handleLlmOnly } from "@/server/llm-only";
import { createQlooClient, QlooCacheMiss } from "@/server/qloo";
import type { QlooCache } from "@/server/qloo-cache";
import type { RateLimiter } from "@/server/rate-limit";
import { REFILL_CALL_CAP } from "@/server/refill";
import { assemblyFromSaved } from "@/server/venue-switch";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { createQlooCache, syntheticMode } from "@/server/qloo-cache";
import { CLAIMS } from "./evidence-claims";

/** A computation's number, or why there isn't one. */
export type Missing = { missing: string };
export type Derived = number | Missing;

export interface Claim<C> {
  /** The file the number is in, from the repository's root. */
  file: string;
  /** For docs/evidence.md: the section ("## 31.") the phrase must sit in. */
  section?: number;
  /**
   * The words around the number as the file has them; line breaks read as spaces. Braces mark
   * the number the claim checks, as in "of the model's {290} picks"; a phrase holding only one
   * number needs none.
   */
  phrase: string;
  equals: C | "not recomputable";
  /** Why a number can't be re-derived: the run it comes from was never saved. */
  why?: string;
}

export type Status =
  | "match"
  | "differs"
  | "no data"
  | "not found"
  | "bad claim"
  | "not recomputable";

export interface Row {
  file: string;
  section?: number;
  phrase: string;
  status: Status;
  claimed: string;
  derived: string;
  from: string;
}

const WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
};
// Inside braces only: "{no} call was retried".
const ZERO_WORDS = new Set(["no", "none"]);
const DIGITS = /^\d{1,3}(,\d{3})+(\.\d+)?$|^\d+(\.\d+)?$/;
// A thousands comma needs three digits after it, so "Austin 3, Denver 4." reads 3 and 4.
const NUMBER_TOKENS = new RegExp(
  `\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?|\\b(?:${Object.keys(WORDS).join("|")})\\b`,
  "gi",
);

/** A number as a phrase writes it: 290, 3,000, 0.55, "three", or "no" in braces. */
export function parseNumber(token: string): number | null {
  const word = token.trim().toLowerCase();
  if (DIGITS.test(word)) return Number(word.replace(/,/g, ""));
  if (word in WORDS) return WORDS[word];
  if (ZERO_WORDS.has(word)) return 0;
  return null;
}

const spaced = (text: string) => text.replace(/\s+/g, " ").trim();

/** A docs/evidence.md section: from its "## N." heading to the next "## " heading. */
export function sectionText(markdown: string, section: number): string | null {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## ${section}. `));
  if (start < 0) return null;
  const end = lines.findIndex(
    (line, index) => index > start && line.startsWith("## "),
  );
  return lines.slice(start, end < 0 ? undefined : end).join("\n");
}

/** The phrase as the file should have it, and the number it claims (or why it can't say). */
export function readPhrase(phrase: string): {
  text: string;
  claimed: number | null;
  numbers: string[];
  problem?: string;
} {
  const marks = [...phrase.matchAll(/\{([^{}]*)\}/g)];
  const text = spaced(phrase.replace(/\{([^{}]*)\}/g, "$1"));
  const numbers = (text.match(NUMBER_TOKENS) ?? []).map((token) =>
    token.trim(),
  );
  if (marks.length > 1)
    return { text, claimed: null, numbers, problem: "more than one {number}" };
  if (marks.length === 1) {
    const claimed = parseNumber(marks[0][1]);
    return claimed === null
      ? { text, claimed, numbers, problem: `{${marks[0][1]}} isn't a number` }
      : { text, claimed, numbers };
  }
  if (numbers.length === 1)
    return { text, claimed: parseNumber(numbers[0]), numbers };
  return {
    text,
    claimed: null,
    numbers,
    problem:
      numbers.length === 0
        ? "the phrase holds no number"
        : "the phrase holds more than one number: mark one {in braces}",
  };
}

/** A number for the table: integers as they are, decimals to three places at most. */
export function shown(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(3)));
}

const same = (a: number, b: number) =>
  Number(a.toFixed(6)) === Number(b.toFixed(6));

/**
 * Checks each claim: its phrase in its file (and section), the number it holds against its
 * computation. `read` gives a file's text or null when there is none.
 */
export function checkClaims<C>(
  claims: readonly Claim<C>[],
  {
    read,
    evaluate,
    describe,
  }: {
    read: (file: string) => string | null;
    evaluate: (computation: C) => Derived;
    describe: (computation: C) => string;
  },
): Row[] {
  return claims.map((claim) => {
    const { text, claimed, numbers, problem } = readPhrase(claim.phrase);
    const whole = read(claim.file);
    const scope =
      whole === null
        ? null
        : claim.section === undefined
          ? whole
          : sectionText(whole, claim.section);
    const found = scope !== null && spaced(scope).includes(text);
    const base = {
      file: claim.file,
      ...(claim.section === undefined ? {} : { section: claim.section }),
      phrase: claim.phrase,
    };
    if (claim.equals === "not recomputable")
      return {
        ...base,
        status: "not recomputable",
        claimed: claimed === null ? numbers.join(", ") : shown(claimed),
        derived: found ? "-" : "phrase not found",
        from: claim.why ?? "",
      };
    const from = describe(claim.equals);
    if (problem || claimed === null)
      return {
        ...base,
        status: "bad claim",
        claimed: numbers.join(", "),
        derived: problem ?? "",
        from,
      };
    if (!found)
      return {
        ...base,
        status: "not found",
        claimed: shown(claimed),
        derived:
          whole === null
            ? "no such file"
            : scope === null
              ? `no section ${claim.section}`
              : "phrase not found",
        from,
      };
    const value = evaluate(claim.equals);
    if (typeof value !== "number")
      return {
        ...base,
        status: "no data",
        claimed: shown(claimed),
        derived: value.missing,
        from,
      };
    return {
      ...base,
      status: same(value, claimed) ? "match" : "differs",
      claimed: shown(claimed),
      derived: shown(value),
      from,
    };
  });
}

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** One table, a row per claim, naming its file (and section) and its phrase. */
export function formatTable(rows: readonly Row[]): string {
  const lines = [
    "| Result | File | Phrase | Claimed | Re-derived | From |",
    "|---|---|---|---|---|---|",
    ...rows.map(
      (row) =>
        `| ${[
          row.status,
          row.section === undefined
            ? row.file
            : `${row.file} section ${row.section}`,
          row.phrase,
          row.claimed,
          row.derived,
          row.from,
        ]
          .map(cell)
          .join(" | ")} |`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

/** 1 when any recomputable claim isn't a match; "not recomputable" rows never fail. */
export function exitCode(rows: readonly Row[]): 0 | 1 {
  return rows.some(
    (row) => row.status !== "match" && row.status !== "not recomputable",
  )
    ? 1
    : 0;
}

// ---------------------------------------------------------------------------------------------
// The saved builds, through replay-only requests.

/** What one replay-only request streamed: the saved build's trace, climb and lineup. */
export interface Replay {
  festivalId: string;
  build: { id: string; createdAt: string } | null;
  trace: TraceCall[];
  /** The climb's lists, rebuilt from the Qloo cache by the server (M9a). */
  climbs: ClimbEvent[];
  lineup: Lineup | null;
  /** The stream's error code, such as "no-saved-build". */
  code: string | null;
  error: string | null;
}

export interface TownBuild {
  town: CheckedTown;
  festival: Festival;
  replay: Replay;
}

/**
 * One town's saved build, as a judge's replay streams it: POST /api/undercard with only the
 * festival and replayOnly, never fresh, so the server replays or says there's no saved build.
 * If the first event isn't a replay, the request is dropped unread. A request the network drops
 * is tried once more; an answer from the server, whatever its status, is taken as it is.
 */
export async function replayOnly(
  base: string,
  festivalId: string,
  fetchImpl: typeof fetch = fetch,
  { retryDelayMs = 2000 }: { retryDelayMs?: number } = {},
): Promise<Replay> {
  const replay: Replay = {
    festivalId,
    build: null,
    trace: [],
    climbs: [],
    lineup: null,
    code: null,
    error: null,
  };
  const request = () =>
    fetchImpl(new URL("/api/undercard", base), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ festival: festivalId, replayOnly: true }),
      signal: AbortSignal.timeout(60_000),
    });
  let response: Response;
  try {
    response = await request().catch(async () => {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      return request();
    });
  } catch (error) {
    return { ...replay, error: `the request failed: ${String(error)}` };
  }
  if (!response.ok || !response.body)
    return { ...replay, error: `HTTP ${response.status}` };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let first = true;
  // Reads one line; false stops the stream.
  const take = (line: string): boolean => {
    if (!line.trim()) return true;
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      replay.error = "an unreadable line in the stream";
      return false;
    }
    const parsed = BuildEventSchema.safeParse(json);
    if (!parsed.success) return true;
    const event = parsed.data;
    const opening = first;
    first = false;
    if (event.type === "build") {
      if (!opening || !event.replayed) {
        replay.error =
          "not a replay: the server started a build, so the stream was dropped";
        return false;
      }
      replay.build = { id: event.id, createdAt: event.createdAt };
    } else if (event.type === "call") replay.trace.push(event.call);
    else if (event.type === "climb") replay.climbs.push(event);
    else if (event.type === "lineup") replay.lineup = event.lineup;
    else if (event.type === "error") {
      replay.code = event.code ?? null;
      replay.error = event.message;
    }
    return true;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = done ? "" : (lines.pop() ?? "");
      if (!lines.every(take)) {
        await reader.cancel();
        return { ...replay, lineup: null };
      }
      if (done) break;
    }
  } catch (error) {
    return {
      ...replay,
      lineup: null,
      error: `the stream broke: ${String(error)}`,
    };
  }
  if (!replay.build && !replay.error) replay.error = "no build in the stream";
  return replay;
}

/** Every checked town's replay, a few at a time, in the checked list's order. */
export async function loadReplays(
  base: string,
  {
    fetch: fetchImpl = fetch,
    towns = CHECKED_TOWNS,
    concurrency = 4,
  }: {
    fetch?: typeof fetch;
    towns?: readonly CheckedTown[];
    concurrency?: number;
  } = {},
): Promise<TownBuild[]> {
  const out: TownBuild[] = new Array(towns.length);
  let next = 0;
  const worker = async () => {
    while (next < towns.length) {
      const index = next++;
      const town = towns[index];
      const festival = checkedFestival(town);
      out[index] = {
        town,
        festival,
        replay: await replayOnly(base, festival.id, fetchImpl),
      };
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, towns.length) }, worker),
  );
  return out;
}

// ---------------------------------------------------------------------------------------------
// What a claim can be checked against.

type TownSet = "all" | "later" | readonly string[];
export type WithQlooCount =
  "acts" | "found" | "inRange" | "twoGenres" | "climbs" | "allThree";

/** A number re-derived from the replays, the store or the code; describe() says which. */
export type Computation =
  | { kind: "venue-acts"; town: string; venue: string }
  | { kind: "venues-tested"; town: string }
  | { kind: "calls"; town: string }
  | { kind: "calls-across"; towns: TownSet; end: "fewest" | "most" }
  | { kind: "refused-calls"; towns: TownSet }
  | { kind: "filled"; town: string; band: FeeBandId }
  | { kind: "slots"; town: string; band: FeeBandId }
  | { kind: "full-lineups"; towns: TownSet }
  | { kind: "built-on"; date: string; towns: TownSet }
  | { kind: "shared-with-boise"; town: string }
  | { kind: "own-vs-boise"; town: string }
  | { kind: "climb"; town: string; band: FeeBandId; rank: number }
  | { kind: "new-acts"; town: string }
  | { kind: "baseline-top"; town: string }
  | { kind: "climb-rebuilt"; of: "towns" | "fewest-lists" | "most-lists" }
  | { kind: "with-qloo"; count: WithQlooCount }
  | { kind: "rule"; of: "min-lift" | "call-cap" | "refill-cap" }
  | { kind: "fee-range"; end: "bottom" | "top" }
  | { kind: "checked-towns" }
  | { kind: "without"; count: WithoutCount | "towns" | "rebuilt" }
  | { kind: "without-towns"; count: WithoutCount; equal: number }
  | { kind: "without-most"; count: WithoutCount }
  | {
      kind: "measure";
      of:
        | "towns-sharing-no-act"
        | "towns-changed-seven"
        | "distinct-with"
        | "distinct-without"
        | "named-in-half"
        | "average-changed";
    }
  | {
      kind: "run";
      of:
        | "model-calls"
        | "searches"
        | "search-retries"
        | "answers-saved"
        | "answers-asked";
    };

export interface EvidenceData {
  towns: TownBuild[];
  /**
   * The Without Qloo counts as they stand: from the store, else from the raw files; why there
   * are none when the store didn't answer.
   */
  without: WithoutData | Missing | null;
  /** Section 31's run as its raw files recorded it. */
  run: RunRecord | null;
}

const BOISE = CHECKED_TOWNS[0].city;
const DEMO = new Set(TOWNS.map((town) => town.festival.id));

const missing = (why: string): Missing => ({ missing: why });
const isMissing = (value: unknown): value is Missing =>
  typeof value === "object" && value !== null && "missing" in value;

function townNamed(data: EvidenceData, city: string): TownBuild | Missing {
  return (
    data.towns.find((entry) => entry.town.city === city) ??
    missing(`${city} isn't a checked town`)
  );
}

type Built = TownBuild & { lineup: Lineup };

/** A town's replayed lineup, or why there's none. */
function built(data: EvidenceData, city: string): Built | Missing {
  const town = townNamed(data, city);
  if (isMissing(town)) return town;
  const { lineup, code, error } = town.replay;
  if (lineup) return { ...town, lineup };
  if (code === "no-saved-build") return missing(`${city} has no saved build`);
  return missing(`${city}'s replay failed: ${error ?? "no lineup"}`);
}

function townsIn(data: EvidenceData, set: TownSet): TownBuild[] {
  if (set === "all") return data.towns;
  if (set === "later")
    return data.towns.filter((town) => !DEMO.has(town.festival.id));
  return set.flatMap((city) => {
    const town = townNamed(data, city);
    return isMissing(town) ? [] : [town];
  });
}

const builtOnly = (data: EvidenceData, towns: readonly TownBuild[]) =>
  towns.flatMap((town) => {
    const one = built(data, town.town.city);
    return isMissing(one) ? [] : [one];
  });

/** Every town of a set with its lineup, or which ones have none. */
function builtAll(data: EvidenceData, set: TownSet): Built[] | Missing {
  const towns = townsIn(data, set);
  const lineups = builtOnly(data, towns);
  if (lineups.length === towns.length) return lineups;
  if (lineups.length === 0) return missing("no saved build for any of them");
  const none = towns
    .filter((town) => !town.replay.lineup)
    .map((town) => town.town.city);
  return missing(
    `no saved build for ${none.slice(0, 3).join(", ")}${none.length > 3 ? ` and ${none.length - 3} more` : ""}`,
  );
}

const AGE_NOTE = " (the crowd's ages as Qloo's nearest buckets)";

/** The venue a venue_artists line names, without the notes after it (M6l's kind, the ages). */
export function venueOf(summary: string): string | null {
  const at = summary.indexOf("headliners and ");
  if (at < 0) return null;
  let name = summary.slice(at + "headliners and ".length);
  if (name.endsWith(AGE_NOTE)) name = name.slice(0, -AGE_NOTE.length);
  return name.replace(/ \(an? [^()]*\)$/, "");
}

const testedVenues = (trace: readonly TraceCall[]) => [
  ...new Set(
    trace
      .filter((call) => call.tool === "venue_artists")
      .map((call) => venueOf(call.summary))
      .filter((name): name is string => name !== null),
  ),
];

/**
 * A venue as Qloo names it against a name in the docs, which drop a bracketed note the way the
 * marks do (src/lib/marks.ts): "Venue 418 (V418)" is "Venue 418".
 */
const sameVenue = (qloo: string, named: string) =>
  qloo === named || qloo.replace(/\s*\([^)]*\)/g, "").trim() === named;

const bandOf = (festival: Festival, band: FeeBandId) =>
  festival.feeBands.find((entry) => entry.id === band);

const isFull = (town: Built) =>
  town.festival.feeBands.every(
    (band) =>
      town.lineup.acts.filter((act) => act.band === band.id).length ===
      band.slots,
  );

/** The climbs a band's rows show on the first screen, biggest first (M10a); NEW acts apart. */
function climbsOf(acts: readonly Act[], band?: FeeBandId) {
  const lifts = acts
    .filter((act) => band === undefined || act.band === band)
    .map(liftOf);
  return {
    up: lifts
      .flatMap((lift) => (lift?.kind === "up" ? [lift.places] : []))
      .sort((a, b) => b - a),
    fresh: lifts.filter((lift) => lift?.kind === "new").length,
  };
}

const ARTIST_LISTS = new Set(["baseline_artists", "venue_artists"]);

/** An act on a Qloo lineup against section 31's three tests, from what the lineup says. */
function withQloo(
  act: Act,
  festival: Festival,
): Record<WithQlooCount, boolean> {
  const inRange = feeBandFor(act.popularity, festival.feeBands) !== null;
  const twoGenres = act.sharedTags.length >= 2;
  const lift = liftOf(act);
  const climbs = lift !== null && (lift.kind === "new" || lift.places > 0);
  return {
    acts: true,
    found: true,
    inRange,
    twoGenres,
    climbs,
    allThree: inRange && twoGenres && climbs,
  };
}

const ordinal = (n: number) => {
  const teen = Math.floor((n % 100) / 10) === 1;
  return `${n}${teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
};
const setName = (set: TownSet) =>
  set === "all"
    ? "the 29 towns"
    : set === "later"
      ? "the 25 towns built after M6d"
      : set.join(", ");
const bandName = (band: FeeBandId) =>
  bandOf(SAGEBRUSH_SOUND, band)?.label ?? band;

/** Where a computation's number comes from, in words, for the table. */
export function describe(computation: Computation): string {
  const c = computation;
  switch (c.kind) {
    case "venue-acts":
      return `${c.town}'s saved build: acts ${c.venue} lifted`;
    case "venues-tested":
      return `${c.town}'s saved build: venues tested`;
    case "calls":
      return `${c.town}'s saved build: Qloo calls`;
    case "calls-across":
      return `${setName(c.towns)}' saved builds: the ${c.end} Qloo calls`;
    case "refused-calls":
      return `${setName(c.towns)}' saved builds: calls refused or retried`;
    case "filled":
      return `${c.town}'s saved build: ${bandName(c.band)} acts`;
    case "slots":
      return `${c.town}'s brief: ${bandName(c.band)} slots`;
    case "full-lineups":
      return `${setName(c.towns)}' saved builds: every slot filled`;
    case "built-on":
      return `${setName(c.towns)}' saved builds: made on ${c.date}`;
    case "shared-with-boise":
      return `${c.town}'s saved lineup: acts also on Boise's`;
    case "own-vs-boise":
      return `${c.town}'s saved lineup: acts not on Boise's`;
    case "climb":
      return `${c.town}'s first screen: the ${ordinal(c.rank)} biggest ${bandName(c.band)} climb`;
    case "new-acts":
      return `${c.town}'s first screen: NEW acts`;
    case "baseline-top":
      return `${c.town}'s saved build: the headliners-only list's length`;
    case "climb-rebuilt":
      return c.of === "towns"
        ? "the replays: towns whose climb rebuilt in full"
        : `the replays: the ${c.of === "fewest-lists" ? "fewest" : "most"} lists in one climb`;
    case "with-qloo":
      return `With Qloo, the saved lineups: ${c.count === "acts" ? "acts" : `acts passing ${c.count}`}`;
    case "rule":
      return c.of === "min-lift"
        ? "src/lib/assemble-lineup.ts: MIN_LIFT"
        : c.of === "call-cap"
          ? "src/server/agent-tools.ts: QLOO_CALL_CAP"
          : "src/server/refill.ts: REFILL_CALL_CAP";
    case "fee-range":
      return `the brief's fee ranges: the ${c.end} percentile`;
    case "checked-towns":
      return "src/lib/checked-towns.ts: checked towns";
    case "without":
      return `Without Qloo, the measured towns: ${WITHOUT_WORDS[c.count]}`;
    case "without-towns":
      return `Without Qloo: towns with ${c.equal} ${WITHOUT_WORDS[c.count]}`;
    case "without-most":
      return `Without Qloo: the most ${WITHOUT_WORDS[c.count]} in one town`;
    case "measure":
      return `the review's measures: ${MEASURE_WORDS[c.of]}`;
    case "run":
      return `section 31's run record (.design): ${RUN_WORDS[c.of]}`;
  }
}

const WITHOUT_WORDS: Record<WithoutCount | "towns" | "rebuilt", string> = {
  towns: "towns with a saved build and a saved model answer",
  rebuilt: "towns whose build's lists the cache holds",
  picks: "the model's picks",
  found: "picks found on Qloo",
  inRange: "picks in the fee range",
  above: "picks above the fee range",
  below: "picks below the fee range",
  twoGenres: "picks sharing two genres with the headliners",
  climbs: "picks that climb with a venue's fans",
  allThree: "picks passing all three tests",
};
const MEASURE_WORDS: Record<
  Extract<Computation, { kind: "measure" }>["of"],
  string
> = {
  "towns-sharing-no-act": "towns whose two lineups share no act",
  "towns-changed-seven": "towns where Qloo changes at least 7 of the 10",
  "distinct-with": "distinct acts on the With Qloo lineups",
  "distinct-without": "distinct acts on the Without Qloo lineups",
  "named-in-half": "acts on half the Without Qloo lineups or more",
  "average-changed": "acts Qloo changes per town, on average (one decimal)",
};
const RUN_WORDS: Record<Extract<Computation, { kind: "run" }>["of"], string> = {
  "model-calls": "model calls",
  searches: "distinct Qloo searches",
  "search-retries": "search attempts beyond one per search",
  "answers-saved": "towns whose model answer was already saved",
  "answers-asked": "towns whose model answer the run asked for",
};

/** The Without Qloo data, or why there is none. */
const withoutOf = (data: EvidenceData): WithoutData | Missing =>
  data.without ?? NO_WITHOUT;

/** The rebuilt towns' counts of one kind, or why the source can't give them. */
function withoutCounts(
  data: EvidenceData,
  count: WithoutCount,
): number[] | Missing {
  const without = withoutOf(data);
  if (isMissing(without)) return without;
  const towns = without.towns.filter((town) => town.rebuilt);
  const counts = towns.map((town) => town.counts[count]);
  if (counts.some((value) => value === undefined))
    return missing(`the raw files don't hold ${count}; read the store`);
  return counts as number[];
}

const NO_WITHOUT = missing(
  "no Without Qloo data: no store and no .design/with-without-qloo/",
);

/** A computation's number from the replays and the code. */
export function evaluate(
  computation: Computation,
  data: EvidenceData,
): Derived {
  const c = computation;
  switch (c.kind) {
    case "venue-acts": {
      const town = built(data, c.town);
      if (isMissing(town)) return town;
      const lifted = town.lineup.acts.filter((act) =>
        sameVenue(act.anchorVenue.name, c.venue),
      ).length;
      if (
        lifted === 0 &&
        !testedVenues(town.replay.trace).some((name) =>
          sameVenue(name, c.venue),
        )
      )
        return missing(`${c.town}'s saved build didn't test ${c.venue}`);
      return lifted;
    }
    case "venues-tested": {
      const town = built(data, c.town);
      return isMissing(town) ? town : testedVenues(town.replay.trace).length;
    }
    case "calls": {
      const town = built(data, c.town);
      return isMissing(town) ? town : town.replay.trace.length;
    }
    case "calls-across": {
      const towns = builtAll(data, c.towns);
      if (isMissing(towns)) return towns;
      const calls = towns.map((town) => town.replay.trace.length);
      return c.end === "fewest" ? Math.min(...calls) : Math.max(...calls);
    }
    case "refused-calls": {
      const towns = builtAll(data, c.towns);
      if (isMissing(towns)) return towns;
      return towns
        .flatMap((town) => town.replay.trace)
        .filter((call) => (call.retried?.length ?? 0) > 0 || call.error).length;
    }
    case "filled": {
      const town = built(data, c.town);
      if (isMissing(town)) return town;
      return town.lineup.acts.filter((act) => act.band === c.band).length;
    }
    case "slots": {
      const town = townNamed(data, c.town);
      if (isMissing(town)) return town;
      return (
        bandOf(town.festival, c.band)?.slots ?? missing(`no ${c.band} band`)
      );
    }
    case "full-lineups": {
      const towns = townsIn(data, c.towns);
      const failed = towns.filter(
        (town) => !town.replay.lineup && town.replay.code !== "no-saved-build",
      );
      if (failed.length)
        return missing(
          `${failed.length} replays failed, ${failed[0].town.city}'s first`,
        );
      return builtOnly(data, towns).filter(isFull).length;
    }
    case "built-on": {
      const towns = builtOnly(data, townsIn(data, c.towns));
      if (towns.length === 0) return missing("no saved build for any of them");
      return towns.filter((town) =>
        town.replay.build?.createdAt.startsWith(c.date),
      ).length;
    }
    case "shared-with-boise":
    case "own-vs-boise": {
      const boise = built(data, BOISE);
      if (isMissing(boise)) return boise;
      const town = built(data, c.town);
      if (isMissing(town)) return town;
      const ids = new Set(boise.lineup.acts.map((act) => act.entityId));
      const shared = town.lineup.acts.filter((act) =>
        ids.has(act.entityId),
      ).length;
      return c.kind === "shared-with-boise"
        ? shared
        : town.lineup.acts.length - shared;
    }
    case "climb": {
      const town = built(data, c.town);
      if (isMissing(town)) return town;
      const { up } = climbsOf(town.lineup.acts, c.band);
      return (
        up[c.rank - 1] ??
        missing(
          `${c.town}'s first screen shows ${up.length} ${bandName(c.band)} climbs; the rest are NEW`,
        )
      );
    }
    case "new-acts": {
      const town = built(data, c.town);
      return isMissing(town) ? town : climbsOf(town.lineup.acts).fresh;
    }
    case "baseline-top": {
      const town = built(data, c.town);
      if (isMissing(town)) return town;
      const counts = new Set(
        town.replay.trace
          .filter((call) => call.tool === "baseline_artists")
          .map((call) => call.resultCount),
      );
      const [only] = [...counts];
      return counts.size === 1 && typeof only === "number"
        ? only
        : missing(`${c.town}'s headliners-only lists differ in length`);
    }
    case "climb-rebuilt": {
      const towns = builtOnly(data, data.towns);
      if (towns.length === 0) return missing("no replay has a lineup");
      const lists = towns.map((town) => ({
        wanted: town.replay.trace.filter((call) => ARTIST_LISTS.has(call.tool))
          .length,
        rebuilt: town.replay.climbs.length,
      }));
      if (c.of === "towns")
        return lists.filter(
          ({ wanted, rebuilt }) => wanted > 0 && rebuilt === wanted,
        ).length;
      const rebuilt = lists.map((entry) => entry.rebuilt);
      return c.of === "fewest-lists"
        ? Math.min(...rebuilt)
        : Math.max(...rebuilt);
    }
    case "with-qloo": {
      const towns = builtOnly(data, data.towns);
      if (towns.length === 0) return missing("no replay has a lineup");
      return towns
        .flatMap((town) =>
          town.lineup.acts.map((act) => withQloo(act, town.festival)),
        )
        .filter((tests) => tests[c.count]).length;
    }
    case "rule":
      return c.of === "min-lift"
        ? MIN_LIFT
        : c.of === "call-cap"
          ? QLOO_CALL_CAP
          : REFILL_CALL_CAP;
    case "fee-range": {
      const bands = SAGEBRUSH_SOUND.feeBands;
      return c.end === "bottom"
        ? Math.min(...bands.map((band) => band.minPopularity)) * 100
        : Math.max(...bands.map((band) => band.maxPopularity)) * 100;
    }
    case "checked-towns":
      return CHECKED_TOWNS.length;
    case "without": {
      const without = withoutOf(data);
      if (isMissing(without)) return without;
      if (c.count === "towns") return without.towns.length;
      if (c.count === "rebuilt")
        return without.towns.filter((town) => town.rebuilt).length;
      const counts = withoutCounts(data, c.count);
      return isMissing(counts)
        ? counts
        : counts.reduce((sum, value) => sum + value, 0);
    }
    case "without-towns": {
      const counts = withoutCounts(data, c.count);
      return isMissing(counts)
        ? counts
        : counts.filter((value) => value === c.equal).length;
    }
    case "without-most": {
      const counts = withoutCounts(data, c.count);
      if (isMissing(counts)) return counts;
      return counts.length ? Math.max(...counts) : missing("no town measured");
    }
    case "measure": {
      const without = withoutOf(data);
      if (isMissing(without)) return without;
      const towns = without.towns.flatMap((town) =>
        town.keys ? [town.keys] : [],
      );
      if (towns.length === 0) return missing("no town's two lineups were read");
      const m = lineupMeasures(towns);
      switch (c.of) {
        case "towns-sharing-no-act":
          return m.changed.filter(
            (changed, index) => changed === towns[index].with.length,
          ).length;
        case "towns-changed-seven":
          return m.townsChangedSeven;
        case "distinct-with":
          return m.distinctWith;
        case "distinct-without":
          return m.distinctWithout;
        case "named-in-half":
          return m.inHalfOrMoreWithout;
        case "average-changed":
          // As scripts/with-without-measures.ts writes it, to one decimal.
          return Number(m.averageChanged.toFixed(1));
      }
    }
    case "run": {
      const run = data.run;
      if (!run)
        return missing(
          "no run record: .design/with-without-qloo/result.json wasn't read",
        );
      switch (c.of) {
        case "model-calls":
          return run.modelCalls;
        case "searches":
          return run.searches;
        case "search-retries":
          return run.searchAttempts - run.searches;
        case "answers-saved":
          return run.answersSaved;
        case "answers-asked":
          return run.answersAsked;
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The Without Qloo counts: from the store, read-only, or from section 31's raw files.

export type WithoutCount =
  | "picks"
  | "found"
  | "inRange"
  | "above"
  | "below"
  | "twoGenres"
  | "climbs"
  | "allThree";

/** One town's model picks against the three tests, and its two lineups for the measures. */
export interface WithoutTown {
  festivalId: string;
  /** The build's venue lists came from the cache; without them no pick is tested. */
  rebuilt: boolean;
  /** A count the source doesn't hold is absent (the raw files predate above and below). */
  counts: Partial<Record<WithoutCount, number>>;
  /** Each lineup's acts as keys: Qloo's entity id, or "name:" and a pick's normalised name. */
  keys: { with: string[]; without: string[] } | null;
}

export interface WithoutData {
  source: string;
  /** The towns with a saved build and a saved model answer. */
  towns: WithoutTown[];
}

export interface RunRecord {
  source: string;
  ranAt: string;
  modelCalls: number;
  searches: number;
  searchAttempts: number;
  answersSaved: number;
  answersAsked: number;
}

/**
 * Reads pass through and a write throws, so nothing here can change the store. A read that
 * fails throws too (getOrThrow, where the cache has it) rather than reading as a miss, so an
 * outage can't pass for a town with no saved build: it fails closed.
 */
export function readOnlyCache(cache: QlooCache): QlooCache {
  return {
    kind: cache.kind,
    get: <T>(key: string) =>
      cache.getOrThrow ? cache.getOrThrow<T>(key) : cache.get<T>(key),
    ...(cache.getOrThrow
      ? { getOrThrow: <T>(key: string) => cache.getOrThrow!<T>(key) }
      : {}),
    set: async () => {
      throw new Error("evidence:check reads the store and never writes to it");
    },
  };
}

const noQloo: typeof fetch = async () => {
  throw new Error("evidence:check never calls Qloo");
};
// Asked only when a festival has no saved answer, and the model is never there to ask.
const noLimit: RateLimiter = {
  kind: "memory",
  check: async () => {
    throw new Error("evidence:check never asks the model");
  },
};

/**
 * Section 31's counts as they stand, read the way its dry run reads them
 * (scripts/with-without-qloo.ts with DRY=1, and the measures of scripts/with-without-measures.ts):
 * each town's latest saved build, the app's saved model answer through its own route handler with
 * no model to ask, each pick's cached search and the build's cached lists through a Qloo client
 * whose fetch throws. Nothing is written.
 */
export async function withoutFromStore(
  store: QlooCache,
  towns: readonly CheckedTown[] = CHECKED_TOWNS,
): Promise<WithoutData> {
  const cache = readOnlyCache(store);
  const builds = createBuildStore(cache);
  const qloo = createQlooClient({
    apiKey: "",
    cache,
    cacheOnly: true,
    fetch: noQloo,
  });
  const out: WithoutTown[] = [];
  for (const town of towns) {
    const festival = checkedFestival(town);
    const build = await builds.latest(festival.id);
    const answered = await handleLlmOnly({
      festival,
      model: () => null,
      cache,
      limiter: noLimit,
      ip: "evidence-check",
    });
    const answer = LlmOnlyLineupSchema.safeParse(
      ((await answered.json()) as { lineup?: unknown }).lineup,
    );
    if (!build || !answer.success) continue;
    const input = await assemblyFromSaved(build, festival, qloo);
    const counts: Record<WithoutCount, number> = {
      picks: 0,
      found: 0,
      inRange: 0,
      above: 0,
      below: 0,
      twoGenres: 0,
      climbs: 0,
      allThree: 0,
    };
    const without: string[] = [];
    for (const pick of answer.data.picks) {
      let found = null;
      try {
        found = foundOnQloo(
          pick.name,
          (await qloo.search({ query: pick.name })).data,
        );
      } catch (error) {
        if (!(error instanceof QlooCacheMiss)) throw error;
      }
      without.push(
        found ? found.entityId.toUpperCase() : `name:${normalise(pick.name)}`,
      );
      if (!input) continue;
      counts.picks++;
      if (!found) continue;
      counts.found++;
      const tests = pickTests(input, found);
      if (tests.inFeeRange) counts.inRange++;
      if (tests.range === "above") counts.above++;
      if (tests.range === "below") counts.below++;
      if (tests.genres >= 2) counts.twoGenres++;
      if (tests.climb !== null && tests.climb > 0) counts.climbs++;
      if (tests.passes) counts.allThree++;
    }
    out.push({
      festivalId: festival.id,
      rebuilt: input !== null,
      counts: input ? counts : {},
      keys: {
        with: build.lineup.acts.map((act) => act.entityId.toUpperCase()),
        without,
      },
    });
  }
  return { source: "the store, read-only", towns: out };
}

const RawRow = z
  .object({
    festival: z.string(),
    rebuilt: z.boolean(),
    answerSaved: z.boolean().optional(),
    picks: z.number().optional(),
    found: z.number().optional(),
    inFeeRange: z.number().optional(),
    above: z.number().optional(),
    below: z.number().optional(),
    twoGenres: z.number().optional(),
    climbs: z.number().optional(),
    allThree: z.number().optional(),
  })
  .passthrough();
const RawResult = z
  .object({
    ranAt: z.string(),
    modelCalls: z.number(),
    searches: z.number(),
    searchAttempts: z.number(),
    rows: z.array(RawRow),
  })
  .passthrough();
const RawMeasures = z
  .object({
    towns: z.array(
      z.object({
        festival: z.string(),
        with: z.array(z.string()),
        without: z.array(z.string()),
      }),
    ),
  })
  .passthrough();

function readJson<T extends z.ZodType>(path: string, schema: T) {
  if (!existsSync(path)) return null;
  const parsed = schema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  return parsed.success ? (parsed.data as z.infer<T>) : null;
}

/**
 * Section 31's run as it left its files under <design>/with-without-qloo/ (git-ignored): each
 * town's counts (result.json), each town's two lineups as keys (measures.json), and the run's
 * own record. Either is null when its file isn't there or doesn't read.
 */
export function withoutFromRaw(design: string): {
  without: WithoutData | null;
  run: RunRecord | null;
} {
  const dir = join(design, "with-without-qloo");
  const result = readJson(join(dir, "result.json"), RawResult);
  const measures = readJson(join(dir, "measures.json"), RawMeasures);
  if (!result) return { without: null, run: null };
  const keys = new Map(
    (measures?.towns ?? []).map((town) => [
      town.festival,
      { with: town.with, without: town.without },
    ]),
  );
  const source = `section 31's raw files, ${dir}, of ${result.ranAt}`;
  return {
    without: {
      source,
      towns: result.rows.map((row) => {
        const counts: Partial<Record<WithoutCount, number>> = {};
        const read: [WithoutCount, number | undefined][] = [
          ["picks", row.picks],
          ["found", row.found],
          ["inRange", row.inFeeRange],
          ["above", row.above],
          ["below", row.below],
          ["twoGenres", row.twoGenres],
          ["climbs", row.climbs],
          ["allThree", row.allThree],
        ];
        if (row.rebuilt)
          for (const [count, value] of read)
            if (value !== undefined) counts[count] = value;
        return {
          festivalId: row.festival,
          rebuilt: row.rebuilt,
          counts,
          keys: keys.get(row.festival) ?? null,
        };
      }),
    },
    run: {
      source,
      ranAt: result.ranAt,
      modelCalls: result.modelCalls,
      searches: result.searches,
      searchAttempts: result.searchAttempts,
      answersSaved: result.rows.filter((row) => row.answerSaved === true)
        .length,
      answersAsked: result.rows.filter((row) => row.answerSaved === false)
        .length,
    },
  };
}

/**
 * Everything the claims are checked against: the replays from `base`; the Without Qloo counts
 * from the store when there is one, else from the raw files under `design`; and section 31's run
 * record from those files. A store that doesn't answer leaves the counts without data, not
 * filled from the raw files, so a failed read never passes for the store's numbers.
 */
export async function loadEvidence({
  base,
  fetch: fetchImpl = fetch,
  store,
  design,
}: {
  base: string;
  fetch?: typeof fetch;
  store: QlooCache | null;
  design: string | null;
}): Promise<EvidenceData> {
  const raw = design ? withoutFromRaw(design) : { without: null, run: null };
  const fromStore = async (
    cache: QlooCache,
  ): Promise<WithoutData | Missing> => {
    try {
      return await withoutFromStore(cache);
    } catch (error) {
      return missing(
        `the store didn't answer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  const [towns, without] = await Promise.all([
    loadReplays(base, { fetch: fetchImpl }),
    store ? fromStore(store) : Promise.resolve(raw.without),
  ]);
  return { towns, without, run: raw.run };
}

// ---------------------------------------------------------------------------------------------
// The command: pnpm evidence:check [--base <url>] [--design <dir>] [--no-store] [--no-raw]

/** The judge URL: production's domain, which serves the latest production deploy. */
export const PRODUCTION = "https://undercard-daniel-51ed.vercel.app";

export function parseArgs(argv: readonly string[]) {
  const options = {
    base: PRODUCTION,
    design: ".design",
    store: true,
    raw: true,
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--base" || arg === "--design") {
      const value = argv[++index];
      if (!value || value.startsWith("--"))
        throw new Error(`${arg} needs a value`);
      if (arg === "--base")
        options.base = new URL(value).href.replace(/\/$/, "");
      else options.design = value;
    } else if (arg === "--no-store") options.store = false;
    else if (arg === "--no-raw") options.raw = false;
    else
      throw new Error(
        `unknown option ${arg}: use --base <url>, --design <dir>, --no-store or --no-raw`,
      );
  }
  return options;
}

/** The store, read-only, when the environment names one (Upstash, or the synthetic seed). */
function storeFromEnv(): QlooCache | null {
  const cache = createQlooCache();
  return cache.kind === "upstash" || syntheticMode() ? cache : null;
}

const ROOT = new URL("../", import.meta.url);

function readRepoFile(file: string): string | null {
  const path = fileURLToPath(new URL(file, ROOT));
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** The count under the table. */
export function summary(rows: readonly Row[]): string {
  const count = (status: Status) =>
    rows.filter((row) => row.status === status).length;
  return [
    `${plural(rows.length, "claim", "claims")}: ${count("match")} match`,
    plural(count("differs"), "differs", "differ"),
    plural(count("no data"), "has no data", "have no data"),
    `${count("not found")} not found`,
    `${count("bad claim")} bad`,
    `${count("not recomputable")} not recomputable.`,
  ].join(", ");
}

/**
 * Re-derives every claim's number and prints one table. Replays come from --base (production by
 * default); the Without Qloo counts from the store when the environment has one, else from the
 * raw files under --design. Returns the exit code: 1 on any recomputable mismatch.
 */
export async function main(
  argv: readonly string[],
  {
    claims = CLAIMS,
    fetch: fetchImpl = fetch,
    store,
    read = readRepoFile,
    print = (line: string) => console.log(line),
  }: {
    claims?: readonly Claim<Computation>[];
    fetch?: typeof fetch;
    /** The store to read; from the environment when undefined. */
    store?: QlooCache | null;
    read?: (file: string) => string | null;
    print?: (line: string) => void;
  } = {},
): Promise<0 | 1> {
  const options = parseArgs(argv);
  const data = await loadEvidence({
    base: options.base,
    fetch: fetchImpl,
    store: options.store
      ? store === undefined
        ? storeFromEnv()
        : store
      : null,
    design: options.raw ? options.design : null,
  });
  const rows = checkClaims(claims, {
    read,
    evaluate: (computation) => evaluate(computation, data),
    describe,
  });
  const replayed = data.towns.filter((town) => town.replay.lineup).length;
  const failed = data.towns.filter(
    (town) => !town.replay.lineup && town.replay.code !== "no-saved-build",
  );
  print(
    `evidence:check: ${plural(claims.length, "claim", "claims")}, re-derived from ${options.base}`,
  );
  print(
    `Replays: ${data.towns.length} replay-only requests (the server makes no Qloo or model call for them), ${plural(replayed, "saved build", "saved builds")} read${failed.length ? `; ${failed.length} failed, ${failed[0].town.city}'s: ${failed[0].replay.error}` : ""}.`,
  );
  const without = withoutOf(data);
  print(
    `Without Qloo: ${isMissing(without) ? without.missing : `${without.source}, ${plural(without.towns.length, "town", "towns")}`}. Section 31's run: ${data.run ? data.run.source : "no run record (.design/with-without-qloo/result.json)"}.`,
  );
  print("");
  print(formatTable(rows).trimEnd());
  print("");
  print(summary(rows));
  return exitCode(rows);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
