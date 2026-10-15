import type { BuildEvent } from "@/lib/build-events";
import type { Festival } from "@/lib/festival";
import { runUndercardAgent } from "./agent";
import type { AgentModel } from "./ai";
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

/**
 * POST /api/undercard: runs one agent build and streams its trace. The factories return null
 * when a server key is missing, which the stream reports as a friendly error.
 */
export function handleUndercardBuild({
  festival,
  qloo,
  model,
}: {
  festival: Festival;
  qloo: () => QlooClient | null;
  model: () => AgentModel | null;
}): Response {
  return ndjsonResponse(async (emit) => {
    const started = Date.now();
    const qlooClient = qloo();
    const agentModel = qlooClient ? model() : null;
    if (!qlooClient || !agentModel) {
      const missing = !qlooClient ? "Qloo isn't" : "The planning model isn't";
      emit({ type: "error", message: `${missing} configured on this server.` });
      emit({ type: "done", calls: 0, ms: Date.now() - started });
      return;
    }
    await runUndercardAgent({
      festival,
      qloo: qlooClient,
      model: agentModel,
      emit,
    });
  });
}
