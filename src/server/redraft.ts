import { z } from "zod";
import {
  assembleLineup,
  type RankedArtist,
  type VenueRef,
} from "@/lib/assemble-lineup";
import type { Act } from "@/lib/lineup";
import { FEE_BAND_IDS, type FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { BuildStore } from "./build-store";
import { controlRanking, recordedControl, retriedOf } from "./control-reads";
import { QlooError, type QlooClient } from "./qloo";
import { readerFor } from "./saved-reads";
import { assemblyFromSaved } from "./venue-switch";
import type { RateLimiter } from "./rate-limit";
import { limitedResponse, ndjsonResponse } from "./undercard-build";

/**
 * The most Qloo calls one redraft of a 2.0 build may make (Daniel, 2026-10-28): two venues, each
 * with its matched control, and one to spare, read only for the slots the rankings the build
 * already holds can't fill.
 */
export const REDRAFT_CALL_CAP = 5;

/** A 1.0 build's redraft, one call a venue, as M8c set it. */
export const ONE_POINT_OH_REDRAFT_CAP = 3;

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
  cachedQloo = () => null,
}: {
  festival: Festival;
  qloo: () => QlooClient | null;
  store: BuildStore;
  body: unknown;
  limiter: RateLimiter;
  ip: string;
  /** Reads the Qloo cache only: the rankings a 2.0 build holds, for slots with no call. */
  cachedQloo?: () => QlooClient | null;
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
    const twoPointOh = context.controls !== undefined;
    const reader = readerFor(saved, client);
    const cap = twoPointOh ? REDRAFT_CALL_CAP : ONE_POINT_OH_REDRAFT_CAP;

    // Daniel, 2026-10-28: a 2.0 build first fills what it can from the rankings it already holds
    // (its venue runs and their controls, from the cache only), in the rule's order, at no call.
    const held: Record<FeeBandId, Act[]> = { mid: [], opener: [] };
    const cached = twoPointOh ? cachedQloo() : null;
    const input = cached
      ? await assemblyFromSaved(saved, festival, cached).catch(() => null)
      : null;
    if (input)
      for (const bandId of FEE_BAND_IDS) {
        const need = replace.filter((slot) => slot.band === bandId).length;
        const band = festival.feeBands.find((entry) => entry.id === bandId);
        if (!need || !band) continue;
        held[bandId] = assembleLineup({
          ...input,
          bands: [{ ...band, slots: 50 }],
        })
          .acts.filter((act) => !excluded.includes(act.entityId))
          .slice(0, need);
      }
    const heldCount = held.mid.length + held.opener.length;
    if (heldCount > 0) {
      excluded.push(
        ...[...held.mid, ...held.opener].map((act) => act.entityId),
      );
      emit({
        type: "status",
        text: `Redrafted ${heldCount} ${heldCount === 1 ? "slot" : "slots"} from the rankings this build already holds: no new Qloo call.`,
      });
    }
    // The slots left open after that.
    const open = (band: FeeBandId) =>
      replace.filter((slot) => slot.band === band).length - held[band].length;
    const bands = FEE_BAND_IDS.filter((band) => open(band) > 0).sort(
      (a, b) => open(b) - open(a),
    );
    // The calls go round the bands with open slots, each band's rooms in the build's order. On a
    // 2.0 build (WS13.3) each venue read comes with its matched control, both counted, and a
    // venue with no matched control is passed over: nothing can be booked from it.
    const plan: {
      band: FeeBandId;
      venue: VenueRef;
      control?: NonNullable<ReturnType<typeof recordedControl>>;
    }[] = [];
    let planned = 0;
    for (let round = 0; planned < cap; round++) {
      let listed = false;
      for (const band of bands) {
        const venue = context.anchors[band]?.[round];
        if (!venue) continue;
        listed = true;
        const control = recordedControl(context, band, venue.entityId);
        if (twoPointOh && !control) continue;
        const cost = control ? 2 : 1;
        if (planned + cost > cap) continue;
        plan.push({ band, venue, ...(control ? { control } : {}) });
        planned += cost;
      }
      if (!listed) break;
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
      control?: Awaited<ReturnType<typeof controlRanking>>["run"];
    }[] = [];
    let calls = 0;
    for (const { band: bandId, venue, control } of plan) {
      const n = ++calls;
      const band = festival.feeBands.find((entry) => entry.id === bandId)!;
      const summary = `Redraft: ${band.label}-band artists for the headliners and ${venue.name}, minus the board`;
      names.set(venue.entityId, venue.name);
      try {
        const query = {
          signalEntityIds: [...headlinerIds, venue.entityId],
          popularityMin: band.minPopularity,
          popularityMax: band.maxPopularity,
          excludeEntityIds: excluded,
          ages: context.ages,
        };
        const result = await reader.artists(query);
        let controlRun: Awaited<ReturnType<typeof controlRanking>>["run"] =
          null;
        if (control) {
          const m = ++calls;
          names.set(control.entityId, control.name);
          const read = await controlRanking(
            reader,
            query,
            venue.entityId,
            control,
            excluded,
          );
          controlRun = read.run;
          emit({
            type: "call",
            call: {
              n: m,
              tool: "redraft",
              endpoint: read.call?.path ?? "/v2/insights",
              summary: `Redraft: ${band.label}-band artists for the headliners and ${control.name}, a venue in ${control.town} with similar Qloo popularity, the control for ${venue.name}, minus the board`,
              params: (read.call?.params ?? []).map(([key, value]) => ({
                key,
                value: readable(value),
              })),
              resultCount: read.call?.resultCount ?? null,
              ms: read.call?.ms ?? 0,
              cached: read.call?.cached ?? false,
              ...retriedOf(read.call, read.error),
              controlFor: venue.name,
              ...(read.call ? {} : { error: "The Qloo request failed." }),
            },
          });
        }
        runs.push({
          venue,
          band: bandId,
          artists: result.data.filter(
            (artist) => !excluded.includes(artist.entityId),
          ),
          ...(control ? { control: controlRun } : {}),
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
            ...retriedOf(result.call),
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
            ...retriedOf(null, error),
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
      const fresh = [...held[band], ...acts.filter((act) => act.band === band)];
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
            ? `No other act that a ${festival.city} venue lifts is left for these slots; they keep their acts.`
            : `${left} ${left === 1 ? "slot keeps its act" : "slots keep their acts"}: no other act that a ${festival.city} venue lifts was left for ${left === 1 ? "it" : "them"}.`,
      });
    emit({ type: "done", calls, ms: Date.now() - started });
  });
}
