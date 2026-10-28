// The Qloo client's core (plan.md item 11): the hackathon host, the types, the cached and
// retried GET every endpoint in this folder goes through, and the shapes they share.
import { z } from "zod";
import type { PlaceWhere } from "@/lib/town-resolution";
import { cacheTtlSeconds, type QlooCache } from "@/server/qloo-cache";

/** The hackathon key works only against this host (RULES.md, Dev guide). */
export const QLOO_BASE_URL = "https://hackathon.api.qloo.com";
/**
 * The cache prefix every answer the saved 1.0 builds read sits under (v2: entries cached until
 * at least 2026-11-18; v1 entries kept only 7 days). Their replays and venue switch are rebuilt
 * from these entries, so nothing Agent 2.0 asks is ever written here (Daniel, 2026-10-24).
 */
export const QLOO_CACHE_PREFIX = "qloo:v2:";
/**
 * Agent 2.0's prefix (WS13): its live runs read and write their own entries, so a build compares
 * rankings from the same generation of answers, and a saved build records the prefix it read.
 */
export const AGENT_CACHE_PREFIX = "qloo:a2:";
const REQUEST_TIMEOUT_MS = 20_000;

/** The only Qloo endpoints this app calls, all with GET and parameters in the query string. */
export type QlooPath =
  | "/search"
  | "/v2/tags"
  | "/v2/insights"
  | "/v2/analysis/compare"
  | "/entities";

export interface QlooTag {
  id: string;
  name: string;
  type: string;
}

export interface QlooEntity {
  entityId: string;
  name: string;
  popularity: number;
  /** query.affinity on Insights results; null where Qloo returns none (search, places). */
  affinity: number | null;
  tags: QlooTag[];
  /** Where a place is, from Qloo's geocode; absent on artists and on older cached answers. */
  where?: PlaceWhere;
  /** A place's Qloo keywords, most frequent first (M6o); absent when Qloo gives none. */
  keywords?: string[];
}

export interface QlooCall {
  path: QlooPath;
  params: [key: string, value: string][];
  resultCount: number;
  ms: number;
  cached: boolean;
  /** The busy answers (429, 5xx) this call was retried after; absent when there were none. */
  retried?: number[];
}

export interface QlooResult<T> {
  data: T;
  call: QlooCall;
}

export class QlooError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "QlooError";
  }
}

// Response shapes, loose on purpose: only the fields the app reads are checked. /search and
// /v2/analysis/compare name a tag's id `tag_id`; Insights and /v2/tags may name it `id`.
// Qloo occasionally returns a tag with neither id nor name; such tags are dropped.
export const RawTag = z.object({
  id: z.string().optional(),
  tag_id: z.string().optional(),
  name: z.string().optional(),
  type: z.string().optional(),
  subtype: z.string().optional(),
});
export const RawEntity = z.object({
  entity_id: z.string(),
  name: z.string(),
  popularity: z.number().optional(),
  query: z.object({ affinity: z.number().optional() }).partial().optional(),
  tags: z.array(RawTag).optional(),
  // Places carry Qloo's own geocode: where the place is, checked against a town (M6j).
  properties: z
    .object({
      geocode: z
        .object({
          city: z.string().nullish(),
          name: z.string().nullish(),
          admin2_region: z.string().nullish(),
          admin1_region: z.string().nullish(),
          country: z.string().nullish(),
          country_code: z.string().nullish(),
        })
        .partial()
        .nullish(),
      // Words from a place's reviews, with how often they come up (M6o).
      keywords: z
        .array(z.object({ name: z.string(), count: z.number().optional() }))
        .nullish()
        .catch(null),
    })
    .partial()
    .passthrough()
    .nullish(),
});

export function toTag(raw: z.infer<typeof RawTag>): QlooTag {
  return {
    id: raw.id ?? raw.tag_id ?? "",
    name: raw.name ?? "",
    type: raw.type ?? raw.subtype ?? "",
  };
}

export const usable = (tag: QlooTag) => tag.id !== "" && tag.name !== "";

export function toEntity(raw: z.infer<typeof RawEntity>): QlooEntity {
  return {
    entityId: raw.entity_id,
    name: raw.name,
    popularity: raw.popularity ?? 0,
    affinity: raw.query?.affinity ?? null,
    tags: (raw.tags ?? []).map(toTag).filter(usable),
    ...placeWhere(raw.properties?.geocode),
    ...keywordsOf(raw.properties?.keywords),
  };
}

function keywordsOf(
  keywords: { name: string; count?: number }[] | null | undefined,
): { keywords?: string[] } {
  if (!keywords?.length) return {};
  return {
    keywords: [...keywords]
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .map((keyword) => keyword.name),
  };
}

function placeWhere(
  geocode: NonNullable<z.infer<typeof RawEntity>["properties"]>["geocode"],
): { where?: PlaceWhere } {
  if (!geocode) return {};
  const where: PlaceWhere = {
    city: geocode.city ?? undefined,
    name: geocode.name ?? undefined,
    admin2: geocode.admin2_region ?? undefined,
    admin1: geocode.admin1_region ?? undefined,
    country: geocode.country ?? undefined,
    countryCode: geocode.country_code ?? undefined,
  };
  return Object.values(where).some(Boolean) ? { where } : {};
}

/**
 * How the client rides out Qloo's rate limit (M6g; docs/evidence.md section 8). The hackathon
 * key is shared by every visitor and every build, and Qloo answers HTTP 429 when calls come
 * too fast, so the client keeps few calls in flight and retries busy answers with backoff.
 */
export interface QlooRetryPolicy {
  /** Calls one client (one build or refill) keeps in flight at once. */
  maxInFlight: number;
  /** Retries of one call after a 429 or 5xx, before the client gives up. */
  maxRetries: number;
  /** The first backoff ceiling; it doubles each retry up to maxDelayMs (full jitter). */
  baseDelayMs: number;
  maxDelayMs: number;
  /**
   * The time from the client's creation that retries may run into. A build's function may run
   * 120 s (src/app/api/undercard/route.ts); 45 s of waiting leaves room for the planner's turns
   * and Qloo's own answers.
   */
  budgetMs: number;
}

export const QLOO_RETRY: QlooRetryPolicy = {
  maxInFlight: 2,
  maxRetries: 5,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
  budgetMs: 45_000,
};

/** Answers worth retrying: the rate limit and Qloo's own transient errors. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/** Qloo stayed busy past the client's time budget: the build ends in its own designed state. */
/** A cache-only client found no cached answer (M9a): it never calls Qloo. */
export class QlooCacheMiss extends Error {
  constructor() {
    super("No cached Qloo answer.");
    this.name = "QlooCacheMiss";
  }
}

export class QlooBusy extends QlooError {
  /**
   * The busy answers the client retried before it gave up: every retry is counted on the call's
   * line, a failed call's too (Daniel, 2026-10-28).
   */
  readonly retried: number[];
  /** A re-run's own stop (its first 429, its window spent): the run ends at once (WS13). */
  stopsRun = false;
  constructor(retried: readonly number[] = []) {
    super(429, "Qloo is busy right now. Try again in a minute.");
    this.name = "QlooBusy";
    this.retried = [...retried];
  }
}

/** Retry-After in milliseconds: seconds, or an HTTP date; 0 when absent or unreadable. */
function retryAfterMs(header: string | null, now: number): number {
  if (!header) return 0;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(header);
  return Number.isFinite(at) ? Math.max(0, at - now) : 0;
}

export interface QlooClientOptions {
  apiKey: string;
  cache: QlooCache;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  retry?: QlooRetryPolicy;
  /** Injected in tests, so backoff runs instantly; clock and sleep advance together there. */
  sleep?: (ms: number) => Promise<void>;
  clock?: () => number;
  random?: () => number;
  /** Answer only from the cache (M9a's replays): a miss throws QlooCacheMiss, never fetches. */
  cacheOnly?: boolean;
  /** The cache prefix answers are read and written under; the 1.0 builds' by default (WS13). */
  prefix?: string;
}

/** One cached, retried GET against Qloo; every endpoint file calls through it. */
export type QlooGet = <T>(
  path: QlooPath,
  params: Record<string, string | number>,
  parse: (body: unknown) => T,
  /** Bumped when the parsed shape gains a field, so older cached answers aren't reused. */
  keyVersion?: string,
  /** The answer's result count for the trace: a list's length unless the endpoint says. */
  count?: (data: T) => number,
) => Promise<QlooResult<T>>;

/** A client's GET: its own calls in flight, its own retry budget from now. */
export function createGet({
  apiKey,
  cache,
  baseUrl = QLOO_BASE_URL,
  fetch = globalThis.fetch,
  now = Date.now,
  retry = QLOO_RETRY,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  clock = Date.now,
  random = Math.random,
  cacheOnly = false,
  prefix = QLOO_CACHE_PREFIX,
}: QlooClientOptions): QlooGet {
  const deadline = clock() + retry.budgetMs;
  let inFlight = 0;
  const waiting: (() => void)[] = [];
  async function slot() {
    if (inFlight >= retry.maxInFlight)
      await new Promise<void>((resolve) => waiting.push(resolve));
    inFlight++;
  }
  function release() {
    inFlight--;
    waiting.shift()?.();
  }

  // A list's length is the result count the trace shows, unless the endpoint counts its own.
  async function get<T>(
    path: QlooPath,
    params: Record<string, string | number>,
    parse: (body: unknown) => T,
    /** Bumped when the parsed shape gains a field, so older cached answers aren't reused. */
    keyVersion = "",
    count: (data: T) => number = (data) =>
      Array.isArray(data) ? data.length : 0,
  ): Promise<QlooResult<T>> {
    const entries = Object.entries(params).map(
      ([key, value]): [string, string] => [key, String(value)],
    );
    const cacheKey = `${prefix}${keyVersion}${path}?${new URLSearchParams([...entries].sort()).toString()}`;
    const started = Date.now();
    // A retry isn't a new call: it rides on this call's line in the trace.
    const retried: number[] = [];
    const call = (data: T, cached: boolean): QlooCall => ({
      path,
      params: entries,
      resultCount: count(data),
      ms: Date.now() - started,
      cached,
      ...(retried.length ? { retried: [...retried] } : {}),
    });

    const hit = await cache.get<T>(cacheKey);
    if (hit !== null) return { data: hit, call: call(hit, true) };
    if (cacheOnly) throw new QlooCacheMiss();

    const url = new URL(path, baseUrl);
    for (const [key, value] of entries) url.searchParams.set(key, value);
    for (let attempt = 0; ; attempt++) {
      await slot();
      let response: Response;
      try {
        response = await fetch(url, {
          method: "GET",
          headers: { "X-Api-Key": apiKey, Accept: "application/json" },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } finally {
        release();
      }
      if (response.ok) {
        const data = parse(await response.json());
        await cache.set(cacheKey, data, cacheTtlSeconds(now()));
        return { data, call: call(data, false) };
      }
      if (!RETRYABLE.has(response.status))
        throw new QlooError(
          response.status,
          `Qloo ${path} answered HTTP ${response.status}`,
        );
      if (attempt >= retry.maxRetries) throw new QlooBusy(retried);
      // Full jitter on an exponential ceiling, and never sooner than Qloo asked.
      const backoff =
        random() * Math.min(retry.maxDelayMs, retry.baseDelayMs * 2 ** attempt);
      const delay = Math.max(
        retryAfterMs(response.headers.get("retry-after"), clock()),
        backoff,
      );
      if (clock() + delay > deadline) throw new QlooBusy(retried);
      retried.push(response.status);
      await sleep(delay);
    }
  }

  return get;
}
