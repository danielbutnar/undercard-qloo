import { z } from "zod";
import { FEE_BAND_IDS } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import { planRunningOrder } from "@/lib/running-order";
import type { BuildStore } from "./build-store";
import { QlooError, type QlooClient } from "./qloo";
import type { RateLimiter } from "./rate-limit";
import { limitedResponse, ndjsonResponse } from "./undercard-build";

/** The most Qloo calls one running order may make (M8a; docs/evidence.md section 15). */
export const ORDER_CALL_CAP = 10;

export const RunningOrderRequestSchema = z.object({
  buildId: z.string().min(1),
  /** The acts on the board now, refills included. */
  acts: z
    .array(
      z.object({
        entityId: z.string().min(1),
        name: z.string().min(1).max(200),
        band: z.enum(FEE_BAND_IDS),
        popularity: z.number().min(0).max(1),
      }),
    )
    .min(2)
    .max(ORDER_CALL_CAP + 1),
});

/**
 * POST /api/running-order (M8a): scores how much each pair of acts in a band shares an
 * audience, then plans two stages so the acts on at the same time share the least. Within a
 * band, each act but the last seeds one Qloo call limited to the acts after it, so every pair
 * is scored once: 5 calls for 6 Openers, 3 for 4 Mid acts. Limited per IP and per day.
 */
export async function handleRunningOrder({
  festival,
  qloo,
  store,
  body,
  limiter,
  ip,
}: {
  festival: Festival;
  qloo: () => QlooClient | null;
  store: BuildStore;
  body: unknown;
  limiter: RateLimiter;
  ip: string;
}): Promise<Response> {
  const refused = (message: string) =>
    ndjsonResponse(async (emit) => {
      emit({ type: "error", message });
      emit({ type: "done", calls: 0, ms: 0 });
    });

  const request = RunningOrderRequestSchema.safeParse(body);
  if (!request.success)
    return refused("That running-order request isn't valid.");
  const { buildId, acts } = request.data;
  const saved = await store.byId(buildId);
  if (!saved || saved.festivalId !== festival.id)
    return refused("This build is no longer saved. Build the undercard again.");
  const client = qloo();
  if (!client) return refused("Qloo isn't configured on this server.");
  const verdict = await limiter.check("order", ip);
  if (!verdict.allowed) return limitedResponse(verdict);

  return ndjsonResponse(async (emit) => {
    const started = Date.now();
    const scores = new Map<string, number>();
    const key = (a: string, b: string) => [a, b].sort().join("|");
    const names = new Map(acts.map((act) => [act.entityId, act.name]));
    let calls = 0;
    for (const band of FEE_BAND_IDS) {
      const inBand = acts.filter((act) => act.band === band);
      const label = festival.feeBands.find((entry) => entry.id === band)?.label;
      for (let i = 0; i < inBand.length - 1 && calls < ORDER_CALL_CAP; i++) {
        const seed = inBand[i];
        const among = inBand.slice(i + 1);
        const n = ++calls;
        const summary = `Running order: how much ${seed.name}'s fans like the other ${label} acts`;
        try {
          const result = await client.audience({
            seedId: seed.entityId,
            amongIds: among.map((act) => act.entityId),
          });
          const raw: string[] = [];
          for (const entity of result.data)
            if (entity.affinity !== null && names.has(entity.entityId)) {
              scores.set(key(seed.entityId, entity.entityId), entity.affinity);
              raw.push(
                `${names.get(entity.entityId)} ${entity.affinity.toFixed(3)}`,
              );
            }
          emit({
            type: "call",
            call: {
              n,
              tool: "running_order",
              endpoint: result.call.path,
              // The raw Qloo affinities stay in the trace; the panel shows ranks (M6r).
              summary: raw.length ? `${summary} · ${raw.join(", ")}` : summary,
              params: result.call.params.map(([param, value]) => ({
                key: param,
                value: value
                  .split(",")
                  .map((part) => names.get(part) ?? part)
                  .join(", "),
              })),
              resultCount: result.call.resultCount,
              ms: result.call.ms,
              cached: result.call.cached,
            },
          });
        } catch (error) {
          emit({
            type: "call",
            call: {
              n,
              tool: "running_order",
              endpoint: "/v2/insights",
              summary,
              params: [],
              resultCount: null,
              ms: 0,
              cached: false,
              error:
                error instanceof QlooError
                  ? error.message
                  : "The Qloo request failed.",
            },
          });
        }
      }
    }
    const slots = planRunningOrder(
      acts,
      (a, b) => scores.get(key(a, b)) ?? null,
      festival.feeBands,
    );
    emit({ type: "running-order", slots });
    emit({ type: "done", calls, ms: Date.now() - started });
  });
}
