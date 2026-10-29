import { HELD_REFILL_LINE } from "@/lib/agent-words";
import { z } from "zod";
import { assembleLineup, type VenueRef } from "@/lib/assemble-lineup";
import { FEE_BAND_IDS } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import { UNAVAILABLE_REASON_IDS, UNAVAILABLE_REASONS } from "@/lib/unavailable";
import type { BuildStore } from "./build-store";
import { controlRanking, recordedControl, retriedOf } from "./control-reads";
import { QlooError, type QlooClient } from "./qloo";
import { readerFor } from "./saved-reads";
import { assemblyFromSaved } from "./venue-switch";
import type { RateLimiter } from "./rate-limit";
import { limitedResponse, ndjsonResponse } from "./undercard-build";

/**
 * The most Qloo calls one refill of a 2.0 build may make (Daniel, 2026-10-28): two venues, each
 * with its matched control, and one to spare. It reads them only when no act in the rankings the
 * build already holds passes the bar.
 */
export const REFILL_CALL_CAP = 5;

/** A 1.0 build's refill, one call a venue, as M3 set it (SPEC.md). */
export const ONE_POINT_OH_REFILL_CAP = 3;

export const RefillRequestSchema = z.object({
  buildId: z.string().min(1),
  unavailableId: z.string().min(1),
  band: z.enum(FEE_BAND_IDS),
  /** The unavailable act's anchor venue, tried first. */
  anchorVenueId: z.string().nullable(),
  /** Every act on the board and every act marked unavailable, so none comes back. */
  excludeIds: z.array(z.string().min(1)).max(60),
  /** Why the act dropped out, in the buyer's words; the refill's trace line names it. */
  reason: z.enum(UNAVAILABLE_REASON_IDS).optional(),
});

/**
 * POST /api/refill: books a replacement for an unavailable act in the same fee band. It asks
 * Qloo for the band's artists seeded by the headliners and an anchor venue, with every act on
 * the board in filter.exclude.entities, and keeps the first act that venue lifts past the bar.
 * The act's own anchor venue goes first, then the build's other anchors: at most 3 calls on a 1.0
 * build. A 2.0 build first takes an act that passes the bar in the rankings it already holds,
 * with no call; failing that, each venue beside its matched control, at most 5 calls.
 * Refills are rate-limited per IP and per day.
 */
export async function handleRefill({
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
  /** Reads the Qloo cache only: the rankings a 2.0 build holds, for a refill with no call. */
  cachedQloo?: () => QlooClient | null;
}): Promise<Response> {
  const refused = (message: string) =>
    ndjsonResponse(async (emit) => {
      emit({ type: "error", message });
      emit({ type: "done", calls: 0, ms: 0 });
    });

  const request = RefillRequestSchema.safeParse(body);
  if (!request.success) return refused("That refill request isn't valid.");
  const {
    buildId,
    unavailableId,
    band: bandId,
    anchorVenueId,
    excludeIds,
    reason,
  } = request.data;
  const saved = await store.byId(buildId);
  if (!saved || saved.festivalId !== festival.id) {
    return refused("This build is no longer saved. Build the undercard again.");
  }
  const client = qloo();
  if (!client) return refused("Qloo isn't configured on this server.");
  const verdict = await limiter.check("refill", ip);
  if (!verdict.allowed) return limitedResponse(verdict);

  return ndjsonResponse(async (emit) => {
    const started = Date.now();
    let calls = 0;
    const fail = (message: string) => {
      emit({ type: "error", message });
      emit({ type: "done", calls, ms: Date.now() - started });
    };

    const band = festival.feeBands.find((entry) => entry.id === bandId)!;
    const { context } = saved;
    const headlinerIds = context.headliners.map(
      (headliner) => headliner.entityId,
    );
    const excluded = [
      ...new Set([...headlinerIds, ...excludeIds, unavailableId]),
    ];
    // WS13.3: a 2.0 build refills by the 2.0 rule, each venue read beside its matched control,
    // both with the board left out, in the build's own prefix.
    const twoPointOh = context.controls !== undefined;
    const reader = readerFor(saved, client);
    const venues = venueOrder(context.anchors, bandId, anchorVenueId);
    const cap = twoPointOh ? REFILL_CALL_CAP : ONE_POINT_OH_REFILL_CAP;

    // Daniel, 2026-10-28: before any call, an act that already passes the bar in the rankings the
    // build holds (the venue runs and their controls, from the cache only) takes the slot.
    const cached = twoPointOh ? cachedQloo() : null;
    if (cached) {
      const held = await assemblyFromSaved(saved, festival, cached).catch(
        () => null,
      );
      const next = held
        ? assembleLineup({
            ...held,
            bands: [{ ...band, slots: 50 }],
          }).acts.find((act) => !excluded.includes(act.entityId))
        : undefined;
      if (next) {
        emit({
          type: "status",
          text: HELD_REFILL_LINE,
        });
        emit({ type: "refill", replaces: unavailableId, act: next });
        emit({ type: "done", calls: 0, ms: Date.now() - started });
        return;
      }
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
    // Both lists leave out the same acts, so a lift compares like with like.
    const baseline = (context.baselines[bandId] ?? [])
      .filter((entityId) => !excluded.includes(entityId))
      .map((entityId) => ({ entityId }));

    for (const venue of venues) {
      const control = recordedControl(context, bandId, venue.entityId);
      // No matched control on a 2.0 build: nothing can be booked from this venue.
      if (twoPointOh && !control) continue;
      if (calls + (control ? 2 : 1) > cap) break;
      const n = ++calls;
      const why = reason ? ` (${UNAVAILABLE_REASONS[reason]})` : "";
      const summary = `Refill${why}: ${band.label}-band artists for the headliners and ${venue.name}, minus the board`;
      names.set(venue.entityId, venue.name);
      let artists;
      try {
        const result = await reader.artists({
          signalEntityIds: [...headlinerIds, venue.entityId],
          popularityMin: band.minPopularity,
          popularityMax: band.maxPopularity,
          excludeEntityIds: excluded,
          // The crowd the build asked for, so the lift compares like with like.
          ages: context.ages,
        });
        artists = result.data;
        emit({
          type: "call",
          call: {
            n,
            tool: "refill",
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
        const message =
          error instanceof QlooError
            ? error.message
            : "The Qloo request failed.";
        emit({
          type: "call",
          call: {
            n,
            tool: "refill",
            endpoint: "/v2/insights",
            summary,
            params: [],
            resultCount: null,
            ms: 0,
            cached: false,
            ...retriedOf(null, error),
            error: message,
          },
        });
        continue;
      }

      let controlRun:
        Awaited<ReturnType<typeof controlRanking>>["run"] | undefined;
      if (control) {
        const m = ++calls;
        const controlSummary = `Refill${why}: ${band.label}-band artists for the headliners and ${control.name}, a venue in ${control.town} with similar Qloo popularity, the control for ${venue.name}, minus the board`;
        names.set(control.entityId, control.name);
        const read = await controlRanking(
          reader,
          {
            signalEntityIds: [...headlinerIds, venue.entityId],
            popularityMin: band.minPopularity,
            popularityMax: band.maxPopularity,
            excludeEntityIds: excluded,
            ages: context.ages,
          },
          venue.entityId,
          control,
          excluded,
        );
        controlRun = read.run;
        emit({
          type: "call",
          call: read.call
            ? {
                n: m,
                tool: "refill",
                endpoint: read.call.path,
                summary: controlSummary,
                params: read.call.params.map(([key, value]) => ({
                  key,
                  value: readable(value),
                })),
                resultCount: read.call.resultCount,
                ms: read.call.ms,
                cached: read.call.cached,
                ...retriedOf(read.call),
                controlFor: venue.name,
              }
            : {
                n: m,
                tool: "refill",
                endpoint: "/v2/insights",
                summary: controlSummary,
                params: [],
                resultCount: null,
                ms: 0,
                cached: false,
                ...retriedOf(null, read.error),
                error:
                  read.error instanceof QlooError
                    ? read.error.message
                    : "The Qloo request failed.",
              },
        });
      }

      const [act] = assembleLineup({
        bands: [{ ...band, slots: 1 }],
        headliners: context.headliners,
        comparedTags: context.comparedTags,
        baselines: { [bandId]: baseline },
        venueRuns: [
          {
            venue,
            band: bandId,
            artists: artists.filter(
              (artist) => !excluded.includes(artist.entityId),
            ),
            ...(control ? { control: controlRun ?? null } : {}),
          },
        ],
      }).acts;
      if (act) {
        emit({ type: "refill", replaces: unavailableId, act });
        emit({ type: "done", calls, ms: Date.now() - started });
        return;
      }
    }
    fail(
      `No other ${band.label} act that a ${festival.city} venue lifts is left for this slot.`,
    );
  });
}

/** The act's anchor venue first, then the band's other anchors, then the build's others. */
function venueOrder(
  anchors: Partial<Record<string, VenueRef[]>>,
  band: string,
  first: string | null,
): VenueRef[] {
  const all = [
    ...(anchors[band] ?? []),
    ...Object.values(anchors).flatMap((list) => list ?? []),
  ];
  const ordered = [...all.filter((venue) => venue.entityId === first), ...all];
  return ordered.filter(
    (venue, index) =>
      ordered.findIndex((other) => other.entityId === venue.entityId) === index,
  );
}
