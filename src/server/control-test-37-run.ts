import { ageBuckets } from "@/lib/ages";
import type { CheckedTown } from "@/lib/checked-towns";
import { sameRanking } from "@/lib/control-venue";
import type { FeeBandId } from "@/lib/fee-bands";
import {
  createRunClient,
  RunStopped,
  SPACING_MS,
  type Attempt,
  type RunRecord,
  type SavedAnswer,
} from "./control-test-37-client";
import {
  callKey,
  controlFestivalFor,
  placesParams,
  popularitiesOf,
  rankingOf,
  rankingParams,
  readFestivals,
  runFestival,
  summarise,
  UnreadableAnswer,
  unscoredInputs,
  venueRunsOf,
  venueTagOf,
  type FestivalInput,
  type FestivalResult,
  type Summary,
} from "./control-test-37";
import type { QlooCache } from "./qloo-cache";

/**
 * scripts/control-test-37.ts's modes, wired here so they can be tested. DRY (the default) reads
 * the saved builds and prints the planned calls per town and in all, calling nothing and writing
 * nothing. LIVE needs MAX_CALLS: it sends at most that many requests, one at a time, stops at the
 * first 429, rate-limit or quota answer (or any answer it can't use), writes what it has and says
 * where it stopped; RESUME=1 carries on from the record without repeating a call. The console
 * gets counts and town names only; names and raw answers stay in .design/evidence-37/.
 */

export interface Settings {
  mode: "dry" | "live";
  /** LIVE only: the most requests the run may send. */
  maxCalls: number | null;
  /** Carry on from the record's answers. */
  resume: boolean;
  spacingMs: number;
}

export function settingsFrom(
  env: Partial<Record<string, string | undefined>>,
): Settings {
  const live = env.LIVE === "1";
  if (live && env.DRY === "1")
    throw new Error("DRY=1 and LIVE=1 are separate runs: set one.");
  const raw = env.MAX_CALLS;
  if (live && raw === undefined)
    throw new Error("LIVE=1 needs MAX_CALLS, the number of calls approved.");
  if (raw !== undefined && !/^[1-9]\d*$/.test(raw))
    throw new Error("MAX_CALLS must be a whole number above 0.");
  const spacing = env.SPACING_MS;
  if (spacing !== undefined && !/^\d+$/.test(spacing))
    throw new Error("SPACING_MS must be a whole number of milliseconds.");
  return {
    mode: live ? "live" : "dry",
    maxCalls: live ? Number(raw) : null,
    resume: env.RESUME === "1",
    spacingMs: spacing === undefined ? SPACING_MS : Number(spacing),
  };
}

export interface PlanRow {
  festivalId: string;
  city: string;
  controlCity: string;
  buildId: string;
  builtAt: string;
  venueRuns: number;
  /** Venue runs that anchor at least one booked act. */
  withActs: number;
  acts: number;
  calls: {
    findVenues: number;
    /** The first festival's /entities check of its venues. */
    entities: number;
    headlinersOnly: number;
    venues: number;
    /** One control per venue run, before any skip; fewer where a control is a call made already. */
    controlsAtMost: number;
    total: number;
  };
}

/** find_venues asked twice in the build (its "town, region" second ask): the run expects two. */
const findVenuesAsks = (build: FestivalInput["build"]) =>
  build.trace.some(
    (call) =>
      call.tool === "find_venues" && call.summary.includes("asked again"),
  )
    ? 2
    : 1;

/**
 * The calls a run would make, town by town in the run's order, from the saved builds alone. A
 * call planned for an earlier town isn't counted again: the run's memory answers it. What can't
 * be known before the answers: the skips for no fan data (one call each), a control that is a
 * call made already, and /entities for a venue missing from its own town's find_venues answer.
 */
export function planCalls(
  festivals: readonly FestivalInput[],
  towns: readonly CheckedTown[],
): PlanRow[] {
  const planned = new Set<string>();
  const fresh = (key: string) => !planned.has(key) && !!planned.add(key);
  return festivals.map((own, index) => {
    const control = controlFestivalFor(festivals, towns, own);
    const entities = index === 0 ? 1 : 0;
    const { build, festival } = own;
    const headliners = build.context.headliners.map((entry) => entry.entityId);
    const ages = ageBuckets(
      festival.crowdAge.min,
      festival.crowdAge.max,
    ).buckets;
    const findVenues = [control, own]
      .filter((entry) =>
        fresh(
          callKey(
            "/v2/insights",
            placesParams(entry.town.city, venueTagOf(entry.build)),
          ),
        ),
      )
      .reduce((sum, entry) => sum + findVenuesAsks(entry.build), 0);
    const ranking = (band: FeeBandId, input: string | null) =>
      callKey(
        "/v2/insights",
        rankingParams({
          headliners,
          input,
          band: festival.feeBands.find((entry) => entry.id === band)!,
          ages,
        }),
      );
    const headlinersOnly = festival.feeBands.filter((band) =>
      fresh(ranking(band.id, null)),
    ).length;
    const runs = venueRunsOf(build);
    const venues = runs.filter((run) =>
      fresh(ranking(run.band, run.venue.entityId)),
    ).length;
    const anchored = new Set(
      build.lineup.acts.map((act) => `${act.band} ${act.anchorVenue.entityId}`),
    );
    return {
      festivalId: festival.id,
      city: own.town.city,
      controlCity: control.town.city,
      buildId: build.id,
      builtAt: build.createdAt,
      venueRuns: runs.length,
      withActs: runs.filter((run) =>
        anchored.has(`${run.band} ${run.venue.entityId}`),
      ).length,
      acts: build.lineup.acts.length,
      calls: {
        findVenues,
        entities,
        headlinersOnly,
        venues,
        controlsAtMost: runs.length,
        total: findVenues + entities + headlinersOnly + venues + runs.length,
      },
    };
  });
}

/** What the run assumes of the saved builds, checked before any call. */
export function checksOf(festivals: readonly FestivalInput[]) {
  const acts = festivals.flatMap((entry) => entry.build.lineup.acts);
  const runKeys = new Set(
    festivals.flatMap((entry) =>
      venueRunsOf(entry.build).map(
        (run) => `${entry.build.id} ${run.band} ${run.venue.entityId}`,
      ),
    ),
  );
  const ranges = (entry: FestivalInput) =>
    entry.build.trace
      .filter(
        (call) =>
          call.tool === "baseline_artists" || call.tool === "venue_artists",
      )
      .map((call) =>
        ["filter.popularity.min", "filter.popularity.max"]
          .map((key) => call.params.find((param) => param.key === key)?.value)
          .join("-"),
      );
  return {
    builds: festivals.length,
    acts: acts.length,
    actsPerBuild: [
      ...new Set(festivals.map((entry) => entry.build.lineup.acts.length)),
    ],
    actsWithoutVenueRun: festivals.reduce(
      (sum, entry) =>
        sum +
        entry.build.lineup.acts.filter(
          (act) =>
            !runKeys.has(
              `${entry.build.id} ${act.band} ${act.anchorVenue.entityId}`,
            ),
        ).length,
      0,
    ),
    headlinerSets: new Set(
      festivals.map((entry) =>
        entry.build.context.headliners.map((h) => h.entityId).join(","),
      ),
    ).size,
    agesUnlikeBrief: festivals.filter(
      (entry) =>
        (entry.build.context.ages ?? []).join(",") !==
        ageBuckets(
          entry.festival.crowdAge.min,
          entry.festival.crowdAge.max,
        ).buckets.join(","),
    ).length,
    venueTags: new Set(festivals.map((entry) => venueTagOf(entry.build))).size,
    /** Ranking calls in the builds' traces whose popularity range isn't a tier of the brief. */
    rangesUnlikeBrief: festivals.reduce(
      (sum, entry) =>
        sum +
        ranges(entry).filter(
          (range) =>
            !entry.festival.feeBands.some(
              (band) => `${band.minPopularity}-${band.maxPopularity}` === range,
            ),
        ).length,
      0,
    ),
  };
}

const readable = <T>(read: () => T, fallback: T): T => {
  try {
    return read();
  } catch {
    return fallback;
  }
};

/**
 * What the answers so far show about the two things the rules lean on (section 37's addition of
 * 2026-10-28): whether ranking answers carry Qloo's not-scored warning, beside how many rankings
 * with a venue or room added equal the headliners-only one; and whether /entities gives a place's
 * popularity (null before any lookup).
 */
export function firstChecks(answers: readonly SavedAnswer[]) {
  const rankings = answers.filter(
    (answer) =>
      answer.path === "/v2/insights" &&
      answer.params["filter.type"] === "urn:entity:artist",
  );
  const alone = rankings.filter(
    (answer) =>
      answer.params["signal.interests.entities"] ===
      answer.params["filter.exclude.entities"],
  );
  const sameCall = (a: SavedAnswer, b: SavedAnswer) =>
    [
      "filter.popularity.min",
      "filter.popularity.max",
      "filter.exclude.entities",
      "signal.demographics.age",
    ].every((key) => a.params[key] === b.params[key]);
  const ids = (answer: SavedAnswer) =>
    readable(() => rankingOf(answer.body), []);
  const equal = rankings.filter((answer) => {
    if (alone.includes(answer)) return false;
    const base = alone.find((entry) => sameCall(entry, answer));
    return base !== undefined && sameRanking(ids(answer), ids(base));
  });
  const lookups = answers.filter((answer) => answer.path === "/entities");
  const withPopularity = lookups.reduce(
    (sum, answer) => sum + readable(() => popularitiesOf(answer.body).size, 0),
    0,
  );
  return {
    rankingCalls: rankings.length,
    rankingWarnings: rankings.filter(
      (answer) => unscoredInputs(answer.body).length > 0,
    ).length,
    rankingsEqualToHeadlinersOnly: equal.length,
    entitiesLookups: lookups.length,
    entitiesAsked: lookups.reduce(
      (sum, answer) =>
        sum +
        (answer.params.entity_ids ?? "").split(",").filter(Boolean).length,
      0,
    ),
    entitiesWithPopularity: withPopularity,
    entitiesReturnPopularity: lookups.length ? withPopularity > 0 : null,
  };
}

/** Fills each {{name}} in the page; a name with no value is an error, not a gap. */
export function fillResult(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    if (!(name in values))
      throw new Error(`The result page has no value for {{${name}}}.`);
    return String(values[name]);
  });
}

const TIER_LABELS: Record<FeeBandId, string> = {
  mid: "Mid-size range",
  opener: "Opening range",
};

const clock = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));

export interface StopInfo {
  reason: string;
  detail: string;
  festival: string;
  town: string;
}

/**
 * The result page's values (scripts/control-test-37-result.md): counts and town names only.
 * The outcome follows section 37's "What each outcome means for the site", written before
 * the run; an incomplete run sets no bar.
 */
export function resultValues({
  summary,
  attempts,
  answers,
  planned,
  stopped,
  totalTowns = summary.towns,
}: {
  summary: Summary;
  attempts: readonly Attempt[];
  answers: number;
  planned: number;
  stopped: StopInfo | null;
  totalTowns?: number;
}): Record<string, string | number> {
  const times = attempts.map((attempt) => attempt.at).sort();
  const first = times[0];
  const last = times.at(-1);
  const day = (iso: string | undefined) => iso?.slice(0, 10) ?? "n/a";
  const share = (count: number) =>
    `${count} of ${summary.acts}, ${summary.acts ? ((100 * count) / summary.acts).toFixed(1) : "0.0"}%`;
  const met = summary.barMet === true;
  const unanswered = attempts.filter((attempt) => attempt.stop);
  const reasons = [...new Set(unanswered.map((attempt) => attempt.stop))];
  return {
    date:
      day(first) === day(last) ? day(first) : `${day(first)} to ${day(last)}`,
    startUtc: first?.slice(11, 16) ?? "n/a",
    endUtc: last?.slice(11, 16) ?? "n/a",
    startBucharest: first ? clock(first, "Europe/Bucharest") : "n/a",
    endBucharest: last ? clock(last, "Europe/Bucharest") : "n/a",
    verdict: summary.complete
      ? met
        ? "bar met"
        : "bar not met"
      : `incomplete: ${summary.towns} of ${totalTowns} towns measured`,
    productBar:
      summary.productBar === null ? "not set" : String(summary.productBar),
    productBarSentence: summary.complete
      ? ` So, by section 37's rule, Undercard 2.0's bar is ${summary.productBar} places.`
      : "",
    requests: attempts.length,
    requestsNote: unanswered.length
      ? `${answers} of them answered; ${unanswered.length} stopped the run (${reasons.join(", ")})${stopped ? "" : " and RESUME=1 carried on without repeating a call"}`
      : "every one answered, none retried",
    planned,
    towns: summary.towns,
    acts: summary.acts,
    atBar: summary.atBar,
    atFallback: summary.atFallback,
    stillClimb: summary.stillClimb,
    noScoredControl: summary.noScoredControl,
    controlsSkipped: summary.controlsSkipped,
    controlsSkippedByWarning: summary.controlsSkippedByWarning,
    controlsSkippedByEqualRanking: summary.controlsSkippedByEqualRanking,
    controlTownsWithoutFanData: summary.controlTownsWithoutFanData,
    venueRunsWithoutControl: summary.venueRunsWithoutControl,
    roomsSkipped: summary.roomsSkipped,
    venueRuns: summary.venueRuns,
    popularityFromFindVenues: summary.popularitySources.find_venues,
    popularityFromEntities: summary.popularitySources.entities,
    popularityFromNeither: summary.popularitySources.none,
    townVenuesWithoutFanDataByWarning: summary.townVenuesWithoutFanData.warning,
    townVenuesWithoutFanDataByEqualRanking:
      summary.townVenuesWithoutFanData.equalRanking,
    actsWithTownVenueWithoutFanData: summary.actsWithTownVenueWithoutFanData,
    actsWithTownVenueWithoutFanDataAtLift5:
      summary.actsWithTownVenueWithoutFanDataAtLift5,
    townRows: summary.byTown
      .map(
        (town) =>
          `| ${town.city} | ${town.controlCity} | ${town.acts} | ${town.atBar} | ${town.atFallback} | ${town.stillClimb} | ${town.noScoredControl} |`,
      )
      .join("\n"),
    tierRows: (Object.keys(TIER_LABELS) as FeeBandId[])
      .map((band) => {
        const tier = summary.byTier[band];
        return `| ${TIER_LABELS[band]} | ${tier.acts} | ${tier.atBar} | ${tier.atFallback} |`;
      })
      .join("\n"),
    barSentence: !summary.complete
      ? `Not set: ${summary.towns} of ${totalTowns} towns measured.`
      : met
        ? `At least half of the ${summary.acts} acts reach a local lift of 5 places: ${share(summary.atBar)}.`
        : `Fewer than half of the ${summary.acts} acts reach a local lift of 5 places: ${share(summary.atBar)}; at 3 places, ${share(summary.atFallback)}.`,
    outcome: !summary.complete
      ? `not set: the run stopped (${stopped?.reason ?? "before every town"}) at ${stopped?.town ?? "a town"}, after ${summary.towns} of ${totalTowns} towns; RESUME=1 carries on from .design/evidence-37/ without repeating a call.`
      : met
        ? `the bar is met, so the evidence page's SHOWN stamp gives the share at 5 places (${share(summary.atBar)}), and Undercard 2.0 books an act only if its local lift is at least 5 places and it still climbs at least 5 places with the town's venue (WS13.3's constant: 5).`
        : `the bar is not met, so PARTLY SHOWN gives both shares (${share(summary.atBar)}, at 5 places; ${share(summary.atFallback)}, at 3), "What these numbers don't establish" says that for most 1.0 acts the town's own part of the climb was under 5 places, and Undercard 2.0 books an act only if its local lift is at least 3 places and it still climbs at least 5 places with the town's venue (WS13.3's constant: 3).`,
  };
}

/** A festival's result without the rankings themselves: those stay in answers.ndjson. */
const omitRankings = (result: FestivalResult) => ({
  ...result,
  venueRuns: result.venueRuns.map((run) => {
    const copy: Partial<typeof run> = { ...run };
    delete copy.withVenue;
    delete copy.withControl;
    return copy;
  }),
});

export async function runControlTest37({
  settings,
  serverCache,
  pinned,
  towns,
  record,
  fetch,
  apiKey,
  log,
  write,
  template,
  now = Date.now,
  sleep,
}: {
  settings: Settings;
  /** The server's cache: only the build store reads it, read-only. */
  serverCache: QlooCache;
  pinned: unknown;
  towns: readonly CheckedTown[];
  record: RunRecord;
  fetch: typeof globalThis.fetch;
  apiKey: string | undefined;
  /** A console line: counts and town names only. */
  log: (line: unknown) => void;
  /** A result file in the run's folder (git-ignored). */
  write: (name: string, text: string) => void;
  /** The result page to fill (scripts/control-test-37-result.md); without it, none is written. */
  template?: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ code: 0 | 2; summary?: Summary }> {
  const festivals = await readFestivals({ serverCache, towns, pinned });
  const plan = planCalls(festivals, towns);
  log({ checks: checksOf(festivals) });
  for (const row of plan)
    log({
      town: row.city,
      festival: row.festivalId,
      control: row.controlCity,
      build: row.buildId,
      builtAt: row.builtAt,
      venueRuns: row.venueRuns,
      withActs: row.withActs,
      acts: row.acts,
      plan: row.calls,
    });
  const sum = (key: keyof PlanRow["calls"]) =>
    plan.reduce((total, row) => total + row.calls[key], 0);
  const totals = {
    towns: plan.length,
    findVenues: sum("findVenues"),
    entities: sum("entities"),
    headlinersOnly: sum("headlinersOnly"),
    venues: sum("venues"),
    controlsAtMost: sum("controlsAtMost"),
    total: sum("total"),
    plus: "one call per control skipped for no fan data, and one /entities call for a town whose own find_venues answer lacks a venue it read; fewer where a control is a call already made",
  };
  const saved = record.answers().length;

  if (settings.mode === "dry") {
    log({ dry: true, ...totals, savedAnswers: saved, calls: 0 });
    return { code: 0 };
  }

  if (saved > 0 && !settings.resume)
    throw new Error(
      `The record holds ${saved} answers from an earlier run: RESUME=1 carries on from them; move them aside to start afresh.`,
    );
  if (!apiKey) throw new Error("QLOO_API_KEY is not set.");
  log({ live: true, maxCalls: settings.maxCalls, ...totals });

  const client = createRunClient({
    apiKey,
    fetch,
    record,
    maxCalls: settings.maxCalls!,
    spacingMs: settings.spacingMs,
    resume: settings.resume,
    now,
    ...(sleep ? { sleep } : {}),
  });
  const results: FestivalResult[] = [];
  let stopped: StopInfo | null = null;
  for (const [index, own] of festivals.entries()) {
    const before = client.counts();
    try {
      const result = await runFestival(
        client.ask,
        own,
        controlFestivalFor(festivals, towns, own),
        { probeEntities: index === 0 },
      );
      results.push(result);
      const after = client.counts();
      const [one] = summarise([result], { towns: 1 }).byTown;
      log({
        town: own.town.city,
        control: result.controlCity,
        requests: after.attempts - before.attempts,
        fromMemory: after.fromMemory - before.fromMemory,
        venueRuns: result.venueRuns.length,
        controlsSkipped: result.venueRuns.reduce(
          (total, run) => total + run.skipped.length,
          0,
        ),
        townVenuesWithoutFanData: result.venueRuns.filter(
          (run) => run.venueNoFanData,
        ).length,
        ...one,
      });
    } catch (error) {
      if (!(error instanceof RunStopped || error instanceof UnreadableAnswer))
        throw error;
      stopped = {
        reason: error instanceof RunStopped ? error.reason : "unreadable",
        detail: error instanceof RunStopped ? error.detail : error.message,
        festival: own.festival.id,
        town: own.town.city,
      };
      break;
    }
  }

  const summary = summarise(results, { towns: festivals.length });
  const attempts = record.attempts();
  const times = attempts.map((attempt) => attempt.at).sort();
  write(
    "result.json",
    `${JSON.stringify(
      {
        ranAt: new Date(now()).toISOString(),
        complete: summary.complete,
        stopped,
        requests: {
          thisRun: client.counts().attempts,
          all: attempts.length,
        },
        window: { first: times[0] ?? null, last: times.at(-1) ?? null },
        summary,
        checks: firstChecks(record.answers()),
        festivals: results.map(omitRankings),
      },
      null,
      1,
    )}\n`,
  );
  if (template)
    write(
      "result.md",
      fillResult(
        template,
        resultValues({
          summary,
          attempts,
          answers: record.answers().length,
          planned: totals.total,
          stopped,
          totalTowns: festivals.length,
        }),
      ),
    );
  if (stopped) {
    log({
      stopped: stopped.reason,
      detail: stopped.detail,
      festival: stopped.festival,
      town: stopped.town,
      townsDone: results.length,
      requestsThisRun: client.counts().attempts,
      answersSaved: record.answers().length,
      ...firstChecks(record.answers()),
      next: "RESUME=1 with a new MAX_CALLS carries on without repeating a call",
    });
    return { code: 2, summary };
  }
  log({ summary, checks: firstChecks(record.answers()) });
  return { code: 0, summary };
}
