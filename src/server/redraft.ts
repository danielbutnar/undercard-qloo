import { z } from "zod";
import {
  assembleLineup,
  type RankedArtist,
  type VenueRef,
} from "@/lib/assemble-lineup";
import { FEE_BAND_IDS, type FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { BuildStore } from "./build-store";
import { QlooError, type QlooClient } from "./qloo";
import type { RateLimiter } from "./rate-limit";
import { limitedResponse, ndjsonResponse } from "./undercard-build";

/** The most Qloo calls one redraft may make (M8c). */
export const REDRAFT_CALL_CAP = 3;

export const RedraftRequestSchema = z.object({
  buildId: z.string().min(1),
  /** The slots not kept: each act to replace, with its band. */
  replace: z
    .array(
      z.object({ entityId: z.string().min(1), band: z.enum(FEE_BAND_IDS) }),
    )
    .min(1)
    .max(20),
  /** Every act on the board and every act marked unavailable, so none comes back. */
  excludeIds: z.array(z.string().min(1)).max(60),
});

/**
 * POST /api/redraft (M8c): the buyer kept some acts; every other slot is refilled with the
 * same bar, leaving out every act on the board and every unavailable act. At most 3 Qloo
 * calls, shared across the bands with open slots, each band's anchor rooms in the build's
 * order. A slot nothing qualifies for keeps its act. Limited like a refill.
 */
export async function handleRedraft({
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

  const request = RedraftRequestSchema.safeParse(body);
  if (!request.success)
    return refused("Keep at least one act and leave at least one to redraft.");
  const { buildId, replace, excludeIds } = request.data;
  const saved = await store.byId(buildId);
  if (!saved || saved.festivalId !== festival.id)
    return refused("This build is no longer saved. Build the undercard again.");
  const client = qloo();
  if (!client) return refused("Qloo isn't configured on this server.");
  const verdict = await limiter.check("refill", ip);
  if (!verdict.allowed) return limitedResponse(verdict);

  return ndjsonResponse(async (emit) => {
    const started = Date.now();
    const { context } = saved;
    const headlinerIds = context.headliners.map(
      (headliner) => headliner.entityId,
    );
    const excluded = [
      ...new Set([
        ...headlinerIds,
        ...excludeIds,
        ...replace.map((slot) => slot.entityId),
      ]),
    ];
    const open = (band: FeeBandId) =>
      replace.filter((slot) => slot.band === band).length;
    const bands = FEE_BAND_IDS.filter((band) => open(band) > 0).sort(
      (a, b) => open(b) - open(a),
    );
    // The calls go round the bands with open slots, each band's rooms in the build's order.
    const plan: { band: FeeBandId; venue: VenueRef }[] = [];
    for (let round = 0; plan.length < REDRAFT_CALL_CAP; round++) {
      const before = plan.length;
      for (const band of bands) {
        const venue = context.anchors[band]?.[round];
        if (venue && plan.length < REDRAFT_CALL_CAP) plan.push({ band, venue });
      }
      if (plan.length === before) break;
    }

    const names = new Map<string, string>([
      ...context.headliners.map((headliner): [string, string] => [
        headliner.entityId,
        headliner.name,
      ]),
      ...saved.lineup.acts.map((act): [string, string] => [
        act.entityId,
        act.name,
      ]),
    ]);
    const readable = (value: string) =>
      value
        .split(",")
        .map((part) => names.get(part) ?? part)
        .join(", ");
    const runs: {
      venue: VenueRef;
      band: FeeBandId;
      artists: RankedArtist[];
    }[] = [];
    let calls = 0;
    for (const { band: bandId, venue } of plan) {
      const n = ++calls;
      const band = festival.feeBands.find((entry) => entry.id === bandId)!;
      const summary = `Redraft: ${band.label}-band artists for the headliners and ${venue.name}, minus the board`;
      names.set(venue.entityId, venue.name);
      try {
        const result = await client.artists({
          signalEntityIds: [...headlinerIds, venue.entityId],
          popularityMin: band.minPopularity,
          popularityMax: band.maxPopularity,
          excludeEntityIds: excluded,
          ages: context.ages,
        });
        runs.push({
          venue,
          band: bandId,
          artists: result.data.filter(
            (artist) => !excluded.includes(artist.entityId),
          ),
        });
        emit({
          type: "call",
          call: {
            n,
            tool: "redraft",
            endpoint: result.call.path,
            summary,
            params: result.call.params.map(([key, value]) => ({
              key,
              value: readable(value),
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
            tool: "redraft",
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

    const { acts } = assembleLineup({
      bands: festival.feeBands
        .filter((band) => open(band.id) > 0)
        .map((band) => ({ ...band, slots: open(band.id) })),
      headliners: context.headliners,
      comparedTags: context.comparedTags,
      baselines: Object.fromEntries(
        FEE_BAND_IDS.map((band) => [
          band,
          (context.baselines[band] ?? [])
            .filter((entityId) => !excluded.includes(entityId))
            .map((entityId) => ({ entityId })),
        ]),
      ),
      venueRuns: runs,
    });
    const pairs = FEE_BAND_IDS.flatMap((band) => {
      const fresh = acts.filter((act) => act.band === band);
      return replace
        .filter((slot) => slot.band === band)
        .slice(0, fresh.length)
        .map((slot, index) => ({ replaces: slot.entityId, act: fresh[index] }));
    });
    if (pairs.length > 0) emit({ type: "redraft", pairs });
    const left = replace.length - pairs.length;
    if (left > 0)
      emit({
        type: "error",
        message:
          pairs.length === 0
            ? `No other act that a ${festival.city} room lifts is left for these slots; they keep their acts.`
            : `${left} ${left === 1 ? "slot keeps its act" : "slots keep their acts"}: no other act that a ${festival.city} room lifts was left for ${left === 1 ? "it" : "them"}.`,
      });
    emit({ type: "done", calls, ms: Date.now() - started });
  });
}
