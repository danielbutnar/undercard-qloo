import { z } from "zod";
import { assembleLineup, type VenueRef } from "@/lib/assemble-lineup";
import { FEE_BAND_IDS } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { BuildStore } from "./build-store";
import { QlooError, type QlooClient } from "./qloo";
import { ndjsonResponse } from "./undercard-build";

/** The most Qloo calls one refill may make (SPEC.md, M3). */
export const REFILL_CALL_CAP = 3;

export const RefillRequestSchema = z.object({
  buildId: z.string().min(1),
  unavailableId: z.string().min(1),
  band: z.enum(FEE_BAND_IDS),
  /** The unavailable act's anchor venue, tried first. */
  anchorVenueId: z.string().nullable(),
  /** Every act on the board and every act marked unavailable, so none comes back. */
  excludeIds: z.array(z.string().min(1)).max(60),
});


/**
 * POST /api/refill: books a replacement for an unavailable act in the same fee band. It asks
 * Qloo for the band's artists seeded by the headliners and an anchor venue, with every act on
 * the board in filter.exclude.entities, and keeps the first act that venue lifts past the bar.
 * The act's own anchor venue goes first, then the build's other anchors, at most 3 calls.
 */
export function handleRefill({
  festival,
  qloo,
  store,
  body,
}: {
  festival: Festival;
  qloo: () => QlooClient | null;
  store: BuildStore;
  body: unknown;
}): Response {
  return ndjsonResponse(async (emit) => {
    const started = Date.now();
    let calls = 0;
    const fail = (message: string) => {
      emit({ type: "error", message });
      emit({ type: "done", calls, ms: Date.now() - started });
    };

    const request = RefillRequestSchema.safeParse(body);
    if (!request.success) return fail("That refill request isn't valid.");
    const {
      buildId,
      unavailableId,
      band: bandId,
      anchorVenueId,
      excludeIds,
    } = request.data;
    const saved = await store.byId(buildId);
    if (!saved || saved.festivalId !== festival.id)
      return fail("This build is no longer saved. Build the undercard again.");
    const client = qloo();
    if (!client) return fail("Qloo isn't configured on this server.");

    const band = festival.feeBands.find((entry) => entry.id === bandId)!;
    const { context } = saved;
    const headlinerIds = context.headliners.map(
      (headliner) => headliner.entityId,
    );
    const excluded = [
      ...new Set([...headlinerIds, ...excludeIds, unavailableId]),
    ];
    const venues = venueOrder(context.anchors, bandId, anchorVenueId).slice(
      0,
      REFILL_CALL_CAP,
    );
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
      const n = ++calls;
      const summary = `Refill: ${band.label}-band artists for the headliners and ${venue.name}, minus the board`;
      names.set(venue.entityId, venue.name);
      let artists;
      try {
        const result = await client.artists({
          signalEntityIds: [...headlinerIds, venue.entityId],
          popularityMin: band.minPopularity,
          popularityMax: band.maxPopularity,
          excludeEntityIds: excluded,
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
            error: message,
          },
        });
        continue;
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
