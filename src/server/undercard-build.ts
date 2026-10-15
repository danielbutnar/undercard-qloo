import type { BuildEvent, TraceCall } from "@/lib/build-events";
import type { Festival } from "@/lib/festival";
import { runUndercardAgent } from "./agent";
import type { AgentModel } from "./ai";
import type { BuildStore, SavedBuild } from "./build-store";
import type { QlooClient } from "./qloo";

type Emit = (event: BuildEvent) => void;

/** A streamed response of build events, one JSON object per line, flushed as they happen. */
export function ndjsonResponse(run: (emit: Emit) => Promise<void>): Response {
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
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
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

/** Streams a saved build again: same trace and lineup, no Qloo or model calls. */
async function replay(saved: SavedBuild, emit: Emit, delayMs: number) {
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
  for (const call of saved.trace) {
    await sleep(delayMs);
    emit({ type: "call", call: { ...call, cached: true } });
  }
  emit({ type: "lineup", lineup: saved.lineup });
  emit({ type: "done", calls: saved.trace.length, ms: Date.now() - started });
}

/**
 * POST /api/undercard: replays the festival's saved build when there is one, so the board
 * fills in seconds; otherwise (or with fresh) runs the agent and saves a complete build. The
 * factories return null when a server key is missing, which the stream reports as an error.
 */
export function handleUndercardBuild({
  festival,
  qloo,
  model,
  store,
  fresh,
  replayDelayMs = 120,
}: {
  festival: Festival;
  qloo: () => QlooClient | null;
  model: () => AgentModel | null;
  store: BuildStore;
  fresh: boolean;
  replayDelayMs?: number;
}): Response {
  return ndjsonResponse(async (emit) => {
    const started = Date.now();
    const saved = fresh ? null : await store.latest(festival.id);
    if (saved) return replay(saved, emit, replayDelayMs);

    const qlooClient = qloo();
    const agentModel = qlooClient ? model() : null;
    if (!qlooClient || !agentModel) {
      const missing = !qlooClient ? "Qloo isn't" : "The planning model isn't";
      emit({ type: "error", message: `${missing} configured on this server.` });
      emit({ type: "done", calls: 0, ms: Date.now() - started });
      return;
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const trace: TraceCall[] = [];
    emit({ type: "build", id, createdAt, replayed: false });
    const result = await runUndercardAgent({
      festival,
      qloo: qlooClient,
      model: agentModel,
      emit: (event) => {
        if (event.type === "call") trace.push(event.call);
        emit(event);
      },
    });
    if (result.complete && result.lineup) {
      trace.sort((a, b) => a.n - b.n);
      await store.save({
        id,
        festivalId: festival.id,
        createdAt,
        trace,
        lineup: result.lineup,
        context: result.context,
      });
    }
  });
}
