import { z } from "zod";
import type { FeeBandId } from "@/lib/fee-bands";
import { explainCalls, type ExplainCall } from "./attribution";
import type { BuildStore, SavedBuild } from "./build-store";
import {
  createQlooClient,
  QlooBusy,
  QlooCacheMiss,
  QlooError,
  type QlooClientOptions,
} from "./qloo";
import type { QlooCache } from "./qloo-cache";

/**
 * The logic of scripts/attribution-warm.ts (WS7): Qloo's split for every checked town's saved
 * build, made once through the app's cached client so the app reads it from the cache after.
 * The script wires the store, the files and the console; everything that decides is here.
 */

export interface WarmSettings {
  /** Live calls to Qloo; only with LIVE=1. */
  live: boolean;
  /** The calls Daniel approved; LIVE=1 needs it, and no attempt goes past it. */
  maxCalls: number | null;
  /** Write Boise's two entries from section 35's saved answers; no Qloo call. */
  seedBoise: boolean;
}

export function warmSettings(
  env: Partial<Record<string, string | undefined>>,
): WarmSettings {
  const live = env.LIVE === "1";
  const seedBoise = env.SEED_BOISE === "1";
  if (live && seedBoise)
    throw new Error(
      "LIVE=1 and SEED_BOISE=1 are separate runs: seed Boise first, then the live run.",
    );
  const raw = env.MAX_CALLS;
  if (live && raw === undefined)
    throw new Error("LIVE=1 needs MAX_CALLS, the number of calls approved.");
  if (raw !== undefined && !/^[1-9]\d*$/.test(raw))
    throw new Error("MAX_CALLS must be a whole number above 0.");
  return { live, maxCalls: raw === undefined ? null : Number(raw), seedBoise };
}

/** A cache for reading only: a write throws, so a dry run can't change the store or the cache. */
export function readOnlyCache(cache: QlooCache): QlooCache {
  return {
    kind: cache.kind,
    get: (key) => cache.get(key),
    ...(cache.getOrThrow ? { getOrThrow: cache.getOrThrow.bind(cache) } : {}),
    set: async () => {
      throw new Error("This cache is read only.");
    },
  };
}

const PinnedPointers = z.object({
  festivals: z.array(z.object({ festivalId: z.string(), buildId: z.string() })),
});

/** A festival's latest saved build isn't the one pinned on 2026-10-21: the run stops. */
export class PinMismatch extends Error {
  constructor(readonly festivalIds: string[]) {
    super(
      `Latest build isn't the pinned one for ${festivalIds.join(", ")}: stop and check the pointers.`,
    );
    this.name = "PinMismatch";
  }
}

/**
 * Each festival's latest saved build, read one at a time, provided every one is the build
 * pinned in .design/pinned-builds/; otherwise PinMismatch names the festivals that differ.
 */
export async function pinnedBuilds({
  store,
  festivalIds,
  pinned,
}: {
  store: Pick<BuildStore, "latest">;
  festivalIds: readonly string[];
  pinned: unknown;
}): Promise<SavedBuild[]> {
  const pins = new Map(
    PinnedPointers.parse(pinned).festivals.map((entry) => [
      entry.festivalId,
      entry.buildId,
    ]),
  );
  const builds: SavedBuild[] = [];
  const off: string[] = [];
  for (const festivalId of festivalIds) {
    const build = await store.latest(festivalId);
    if (
      build &&
      build.festivalId === festivalId &&
      build.id === pins.get(festivalId)
    )
      builds.push(build);
    else off.push(festivalId);
  }
  if (off.length) throw new PinMismatch(off);
  return builds;
}

export interface WarmRow {
  festivalId: string;
  buildId: string;
  call: ExplainCall;
  /** The cache already holds this call's answer: no call needed. */
  cached: boolean;
}

const cacheOnly = (cache: QlooCache) =>
  createQlooClient({
    apiKey: "",
    cache,
    cacheOnly: true,
    fetch: async () => {
      throw new Error("The plan reads the Qloo cache only.");
    },
  });

/** Every build's calls, in order, each marked cached or not, from the cache only. */
export async function warmPlan(
  builds: readonly SavedBuild[],
  cache: QlooCache,
): Promise<WarmRow[]> {
  const qloo = cacheOnly(cache);
  const rows: WarmRow[] = [];
  for (const build of builds)
    for (const call of explainCalls(build)) {
      let cached = true;
      try {
        await qloo.explain(call);
      } catch (error) {
        if (!(error instanceof QlooCacheMiss)) throw error;
        cached = false;
      }
      rows.push({
        festivalId: build.festivalId,
        buildId: build.id,
        call,
        cached,
      });
    }
  return rows;
}

/** The fetch would go past MAX_CALLS: nothing is sent. */
class CallCap extends Error {
  constructor() {
    super("MAX_CALLS reached");
    this.name = "CallCap";
  }
}

export interface WarmCallReport {
  festivalId: string;
  band: FeeBandId;
  acts: number;
  /** Acts Qloo answered for, and those with a split. */
  returned: number;
  withSplit: number;
  /** Inputs sent, and those Qloo gave a share for any act. */
  inputs: number;
  inputsScored: number;
  /** HTTP attempts this call took, retries included. */
  attempts: number;
  /** The answer reads back from the cache, as the app will read it. */
  stored: boolean;
}

export interface WarmReport {
  /** Every HTTP attempt to Qloo, retries included; never past MAX_CALLS. */
  attempts: number;
  /** Calls Qloo answered, and those whose answer reads back from the cache. */
  fetched: number;
  stored: number;
  alreadyCached: number;
  /** Why the run stopped early, or null when it finished. */
  stopped: null | string;
  rows: WarmCallReport[];
}

/**
 * The live run: each call the cache doesn't hold, one at a time, through the app's cached client
 * (createQlooClient with the server's cache, a fresh client per call so each has the app's own
 * retry budget), with a pause between calls. Every HTTP attempt counts against maxCalls, and the
 * run stops before one would pass it; it refuses to start when the plan alone needs more. A
 * malformed answer, an error answer or a spent retry budget stops the run; nothing is cached for
 * that call. So does an answer that doesn't read back from the cache.
 */
export async function warmLive({
  rows,
  cache,
  apiKey,
  baseUrl,
  fetch,
  maxCalls,
  pauseMs = 1200,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  client = {},
}: {
  rows: readonly WarmRow[];
  cache: QlooCache;
  apiKey: string;
  baseUrl?: string;
  fetch: typeof globalThis.fetch;
  maxCalls: number;
  /** Between two calls that went to Qloo, as section 35's script paused. */
  pauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Tests only: the client's backoff clock and jitter. */
  client?: Pick<QlooClientOptions, "sleep" | "random" | "clock">;
}): Promise<WarmReport> {
  const needed = rows.filter((row) => !row.cached).length;
  if (needed > maxCalls)
    throw new Error(
      `The plan needs ${needed} calls and MAX_CALLS is ${maxCalls}: nothing was called.`,
    );
  let attempts = 0;
  const capped = (async (...args: Parameters<typeof globalThis.fetch>) => {
    if (attempts >= maxCalls) throw new CallCap();
    attempts++;
    return fetch(...args);
  }) as typeof globalThis.fetch;

  const report: WarmReport = {
    attempts: 0,
    fetched: 0,
    stored: 0,
    alreadyCached: 0,
    stopped: null,
    rows: [],
  };
  for (const row of rows) {
    if (row.cached) {
      report.alreadyCached++;
      continue;
    }
    if (attempts > 0) await sleep(pauseMs);
    const before = attempts;
    const qloo = createQlooClient({
      apiKey,
      cache,
      baseUrl,
      fetch: capped,
      ...client,
    });
    try {
      const { data, call } = await qloo.explain(row.call);
      if (call.cached) {
        report.alreadyCached++;
        continue;
      }
      const scored = new Set(
        data.flatMap((act) => act.shares.map((share) => share.entityId)),
      );
      // The Upstash cache skips a write it can't make, so the answer is read back as the app
      // will read it; one that isn't there stops the run before another call is spent.
      let stored = true;
      try {
        await cacheOnly(cache).explain(row.call);
      } catch (error) {
        if (!(error instanceof QlooCacheMiss)) throw error;
        stored = false;
      }
      report.fetched++;
      if (stored) report.stored++;
      report.rows.push({
        festivalId: row.festivalId,
        band: row.call.band,
        acts: row.call.actIds.length,
        returned: data.length,
        withSplit: data.filter((act) => act.shares.length > 0).length,
        inputs: row.call.signalEntityIds.length,
        inputsScored: row.call.signalEntityIds.filter((id) => scored.has(id))
          .length,
        attempts: attempts - before,
        stored,
      });
      if (!stored) {
        report.stopped = `answer not stored for ${row.festivalId} ${row.call.band}`;
        break;
      }
    } catch (error) {
      report.stopped =
        error instanceof CallCap
          ? "cap"
          : error instanceof z.ZodError
            ? `malformed answer for ${row.festivalId} ${row.call.band}`
            : error instanceof QlooBusy
              ? `Qloo stayed busy for ${row.festivalId} ${row.call.band}`
              : error instanceof QlooError
                ? `HTTP ${error.status} for ${row.festivalId} ${row.call.band}`
                : `${error instanceof Error ? error.name : "error"} for ${row.festivalId} ${row.call.band}`;
      break;
    }
  }
  report.attempts = attempts;
  return report;
}

const SavedAnswer = z.object({
  status: z.number(),
  params: z.record(z.string(), z.union([z.string(), z.number()])),
  body: z.unknown(),
});

export interface SeedReport {
  band: FeeBandId;
  /** The saved call's parameters are the ones the client sends for this build's range. */
  matched: boolean;
  /** The cache already holds this key: left as it is. */
  alreadyCached: boolean;
  /** Acts in the entry, and its time to live. */
  acts: number;
  ttlSeconds: number | null;
  /** The key, its entity id lists shown as counts. */
  key: string | null;
  written: boolean;
  /** Why nothing was written, when nothing was. */
  reason?: string;
}

/** A cache key with its entity id lists shown as counts, for the console. */
function redactedKey(key: string): string {
  const [path, query = ""] = key.split("?");
  const ids = new Set(["signal.interests.entities", "filter.results.entities"]);
  return `${path}?${[...new URLSearchParams(query)]
    .map(
      ([name, value]) =>
        `${name}=${ids.has(name) ? `<${value.split(",").length} ids>` : value}`,
    )
    .join("&")}`;
}

/**
 * Boise's two cache entries from section 35's saved answers (.design/explainability/*.json, each
 * { status, params, body }), with no Qloo call: the app's own client makes each call with a
 * fetch that answers from the saved file only if the request it builds carries exactly the saved
 * parameters, so the client itself computes the key, parses the answer and sets its time to
 * live, as a live call made now would. Dry unless `write`: then each would-be entry is reported,
 * not written. A key the cache already holds is left as it is.
 */
export async function seedFromSaved({
  build,
  answers,
  cache,
  write,
}: {
  build: SavedBuild;
  answers: Partial<Record<FeeBandId, unknown>>;
  cache: QlooCache;
  write: boolean;
}): Promise<SeedReport[]> {
  const report: SeedReport[] = [];
  for (const call of explainCalls(build)) {
    const row: SeedReport = {
      band: call.band,
      matched: false,
      alreadyCached: false,
      acts: 0,
      ttlSeconds: null,
      key: null,
      written: false,
    };
    report.push(row);
    const saved = SavedAnswer.safeParse(answers[call.band]);
    if (!saved.success) {
      row.reason = "no saved answer for this range";
      continue;
    }
    if (saved.data.status !== 200) {
      row.reason = `the saved answer is HTTP ${saved.data.status}`;
      continue;
    }
    const want = Object.entries(saved.data.params).map(
      ([name, value]): [string, string] => [name, String(value)],
    );
    const entry: { key?: string; ttlSeconds?: number } = {};
    const seeding: QlooCache = {
      kind: cache.kind,
      get: (key) => cache.get(key),
      set: async (key, value, ttlSeconds) => {
        entry.key = key;
        entry.ttlSeconds = ttlSeconds;
        if (write) await cache.set(key, value, ttlSeconds);
      },
    };
    const qloo = createQlooClient({
      apiKey: "seed",
      cache: seeding,
      fetch: async (input) => {
        const sent = [...new URL(String(input)).searchParams];
        const same =
          sent.length === want.length &&
          want.every(([name, value]) =>
            sent.some(([n, v]) => n === name && v === value),
          );
        if (!same) throw new Error("params differ");
        row.matched = true;
        return Response.json(saved.data.body);
      },
    });
    try {
      const { data, call: made } = await qloo.explain(call);
      row.acts = data.length;
      if (made.cached) {
        row.alreadyCached = true;
        row.reason = "already cached";
        continue;
      }
    } catch (error) {
      row.reason =
        error instanceof z.ZodError
          ? "the saved answer is malformed"
          : error instanceof Error && error.message === "params differ"
            ? "the saved call's parameters differ from this build's"
            : "the seed failed";
      continue;
    }
    if (entry.key !== undefined) {
      row.key = redactedKey(entry.key);
      row.ttlSeconds = entry.ttlSeconds ?? null;
      row.written = write;
    }
  }
  return report;
}
