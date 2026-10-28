import type { RankedArtist } from "@/lib/assemble-lineup";
import { climbAfter, climbBaseline, type ClimbEvent } from "@/lib/lift-climb";
import type { BuildEvent, TraceCall } from "@/lib/build-events";
import { venueOfCall } from "@/lib/venue-call";
import type { Festival } from "@/lib/festival";
import { diagnoseRun } from "@/lib/your-festival";
import { runUndercardAgent } from "./agent";
import type { AgentModel } from "./ai";
import type { BuildStore, SavedBuild } from "./build-store";
import { QlooCacheMiss, type QlooClient } from "./qloo";
import type { LimitResult, RateLimiter } from "./rate-limit";
import { readerFor, savedRanking } from "./saved-reads";

type Emit = (event: BuildEvent) => void;

/** A streamed response of build events, one JSON object per line, flushed as they happen. */
export function ndjsonResponse(
  run: (emit: Emit) => Promise<void>,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: Emit = (event) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const started = Date.now();
      try {
        await run(emit);
      } catch {
        emit({
          type: "error",
          message: "The build failed unexpectedly. Try again.",
        });
        emit({ type: "done", calls: 0, ms: Date.now() - started });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
      ...init.headers,
    },
  });
}

/** A 429 that still speaks the build stream, so the trace panel shows the friendly message. */
export function limitedResponse(
  result: Extract<LimitResult, { allowed: false }>,
): Response {
  return ndjsonResponse(
    async (emit) => {
      emit({ type: "error", message: result.message, code: "limit" });
      emit({ type: "done", calls: 0, ms: 0 });
    },
    {
      status: 429,
      headers: { "retry-after": String(result.retryAfterSeconds) },
    },
  );
}

const savedAt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The climb behind a saved build (M9a), rebuilt from the Qloo cache only: each band's list for
 * the headliners alone and for each venue, keyed by the trace call it follows. A call the cache
 * can't answer is left out; a replay never calls Qloo.
 */
export async function replayClimbs(
  saved: SavedBuild,
  festival: Festival,
  qloo: QlooClient | null,
): Promise<Map<number, ClimbEvent>> {
  const out = new Map<number, ClimbEvent>();
  if (!qloo) return out;
  const reader = readerFor(saved, qloo);
  const { context } = saved;
  const pair = context.headliners.map((headliner) => headliner.entityId);
  const lists = saved.trace.flatMap((call, index) => {
    if (call.tool !== "baseline_artists" && call.tool !== "venue_artists")
      return [];
    const band = festival.feeBands.find((entry) =>
      call.summary.startsWith(`${entry.label}-band`),
    );
    if (!band) return [];
    const venue =
      call.tool === "venue_artists"
        ? venueOfCall(call.summary, context.anchors[band.id] ?? [])
        : undefined;
    if (call.tool === "venue_artists" && !venue) return [];
    return [{ index, band, venue }];
  });
  // The cache reads run together, so Watch starts sooner; the steps keep the trace's order.
  const answers = await Promise.all(
    lists.map(async ({ band, venue }) => {
      try {
        return await savedRanking(
          saved,
          reader,
          {
            signalEntityIds: venue ? [...pair, venue.entityId] : pair,
            popularityMin: band.minPopularity,
            popularityMax: band.maxPopularity,
            excludeEntityIds: pair,
            ages: context.ages ?? [],
          },
          venue !== undefined,
        );
      } catch (error) {
        if (!(error instanceof QlooCacheMiss)) throw error;
        return null;
      }
    }),
  );
  const baselines = new Map<string, RankedArtist[]>();
  for (const [k, { index, band, venue }] of lists.entries()) {
    const data = answers[k];
    if (!data) continue;
    if (!venue) {
      baselines.set(band.id, data);
      out.set(index, climbBaseline(band.id, data));
    } else {
      const base = baselines.get(band.id);
      if (base) out.set(index, climbAfter(band.id, band, venue, base, data));
    }
  }
  return out;
}

/** Streams a saved build again: same trace and lineup, no Qloo or Claude calls. */
async function replay(
  saved: SavedBuild,
  emit: Emit,
  delayMs: number,
  climbs: Map<number, ClimbEvent> = new Map(),
) {
  const started = Date.now();
  emit({
    type: "build",
    id: saved.id,
    createdAt: saved.createdAt,
    replayed: true,
  });
  emit({
    type: "status",
    text: `Replaying the saved build from ${savedAt.format(new Date(saved.createdAt))} UTC: no new Qloo or Claude calls.`,
  });
  // The planner's lines go out where they were said: before the call that followed them.
  const notes = saved.notes ?? [];
  const sayNotes = (at: (n: number) => boolean) => {
    for (const note of notes)
      if (at(note.at)) emit({ type: "status", text: note.text, planner: true });
  };
  for (const [index, call] of saved.trace.entries()) {
    sayNotes((at) => at === index);
    await sleep(delayMs);
    emit({ type: "call", call: { ...call, cached: true } });
    const climb = climbs.get(index);
    if (climb) emit(climb);
  }
  sayNotes((at) => at >= saved.trace.length);
  if (saved.stopped) emit({ type: "stopped", ...saved.stopped });
  if (saved.short) emit({ type: "short", ...saved.short });
  emit({ type: "lineup", lineup: saved.lineup });
  if (saved.localPicks?.length)
    emit({ type: "local-pick", picks: saved.localPicks });
  emit({ type: "done", calls: saved.trace.length, ms: Date.now() - started });
}

/**
 * POST /api/undercard: replays the festival's saved build when there is one, so the board
 * fills in seconds; otherwise (or with fresh) runs the agent and saves a complete build. A
 * replay is never rate-limited; an agent run is, per IP and per day. The factories return
 * null when a server key is missing, which the stream reports as an error.
 */
export async function handleUndercardBuild({
  festival,
  qloo,
  model,
  store,
  fresh,
  replayDelayMs = 120,
  limiter,
  ip,
  save = true,
  replayOnly = false,
  cachedQloo = () => null,
}: {
  festival: Festival;
  qloo: () => QlooClient | null;
  model: () => AgentModel | null;
  store: BuildStore;
  fresh: boolean;
  replayDelayMs?: number;
  limiter: RateLimiter;
  ip: string;
  /**
   * False for a judge's own brief (M6f): the run is never saved, and if it can't fill both
   * bands the stream ends with an error naming why.
   */
  save?: boolean;
  /**
   * A checked town's button (M6m): replay the saved build or say there isn't one; never run
   * the agent, so a click costs no Qloo or Claude call.
   */
  replayOnly?: boolean;
  /** A cache-only Qloo client, so a replay can show the climb without a Qloo call (M9a). */
  cachedQloo?: () => QlooClient | null;
}): Promise<Response> {
  const saved = fresh || !save ? null : await store.latest(festival.id);
  if (saved)
    return ndjsonResponse(async (emit) =>
      replay(
        saved,
        emit,
        replayDelayMs,
        await replayClimbs(saved, festival, cachedQloo()),
      ),
    );
  if (replayOnly && !fresh)
    return ndjsonResponse(async (emit) => {
      emit({
        type: "error",
        message: `There's no saved build for ${festival.city} yet. Run the agent live to make one.`,
        code: "no-saved-build",
      });
      emit({ type: "done", calls: 0, ms: 0 });
    });

  const qlooClient = qloo();
  const agentModel = qlooClient ? model() : null;
  if (!qlooClient || !agentModel) {
    const missing = !qlooClient ? "Qloo isn't" : "The planning model isn't";
    return ndjsonResponse(async (emit) => {
      emit({ type: "error", message: `${missing} configured on this server.` });
      emit({ type: "done", calls: 0, ms: 0 });
    });
  }

  const verdict = await limiter.check("build", ip);
  if (!verdict.allowed) return limitedResponse(verdict);

  return ndjsonResponse(async (emit) => {
    const { result, build, seen } = await recordRun({
      festival,
      qloo: qlooClient,
      model: agentModel,
      emit,
    });
    if (!save) {
      // A busy Qloo or a failed planner call already said why; a second diagnosis would only
      // blur it, and would blame the town.
      const stopped = seen.some(
        (event) =>
          event.type === "error" &&
          (event.code === "qloo-busy" || event.code === "planner-failed"),
      );
      const problem = stopped
        ? null
        : diagnoseRun(
            seen,
            result.complete,
            festival.city,
            result.places?.length,
          );
      if (problem) emit({ type: "error", ...problem });
      return;
    }
    if (result.complete && build) await store.save(build);
  });
}

/**
 * One live run of the agent, recorded as a saved build would be (WS13.11): its trace in call
 * order, the planner's lines where it said them, and Agent 2.0's fields, its prefix among them.
 * The build is null when the run booked no act. Shared by POST /api/undercard, which saves only
 * a complete build, and scripts/rerun-towns.ts, which keeps every build by id only.
 */
export async function recordRun({
  festival,
  qloo,
  model,
  emit = () => {},
}: {
  festival: Festival;
  qloo: QlooClient;
  model: AgentModel;
  emit?: Emit;
}) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const trace: TraceCall[] = [];
  const notes: { at: number; text: string }[] = [];
  const seen: BuildEvent[] = [];
  emit({ type: "build", id, createdAt, replayed: false });
  const result = await runUndercardAgent({
    festival,
    qloo,
    model,
    emit: (event) => {
      if (event.type === "call") trace.push(event.call);
      if (event.type === "status" && event.planner)
        notes.push({ at: trace.length, text: event.text });
      seen.push(event);
      emit(event);
    },
  });
  trace.sort((a, b) => a.n - b.n);
  const build: SavedBuild | null = result.lineup
    ? {
        id,
        festivalId: festival.id,
        createdAt,
        trace,
        lineup: result.lineup,
        context: result.context,
        notes,
        // Agent 2.0 (WS13): its venue reads are scored reads, under the prefix its client used.
        engine: 2,
        cachePrefix: qloo.cachePrefix,
        ...(result.stopped ? { stopped: result.stopped } : {}),
        ...(result.localPicks ? { localPicks: result.localPicks } : {}),
        ...(result.plan ? { plan: result.plan } : {}),
        ...(result.short ? { short: result.short } : {}),
      }
    : null;
  return { result, build, seen };
}
