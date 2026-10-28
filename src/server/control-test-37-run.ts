import { ageBuckets } from "@/lib/ages";
import type { CheckedTown } from "@/lib/checked-towns";
import type { FeeBandId } from "@/lib/fee-bands";
import {
  createRunClient,
  RunStopped,
  SPACING_MS,
  type RunRecord,
} from "./control-test-37-client";
import {
  callKey,
  controlFestivalFor,
  placesParams,
  rankingParams,
  readFestivals,
  runFestival,
  summarise,
  UnreadableAnswer,
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
  return festivals.map((own) => {
    const control = controlFestivalFor(festivals, towns, own);
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
        headlinersOnly,
        venues,
        controlsAtMost: runs.length,
        total: findVenues + headlinersOnly + venues + runs.length,
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
  let stopped: {
    reason: string;
    detail: string;
    festival: string;
    town: string;
  } | null = null;
  for (const own of festivals) {
    const before = client.counts();
    try {
      const result = await runFestival(
        client.ask,
        own,
        controlFestivalFor(festivals, towns, own),
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
        festivals: results.map(omitRankings),
      },
      null,
      1,
    )}\n`,
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
      next: "RESUME=1 with a new MAX_CALLS carries on without repeating a call",
    });
    return { code: 2, summary };
  }
  log({ summary });
  return { code: 0, summary };
}
