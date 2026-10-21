import type { AssemblyInput, VenueRef, VenueRun } from "@/lib/assemble-lineup";
import type { FeeBand } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import {
  lineupWith,
  venueSwitch,
  venuesOf,
  type VenueSwitchData,
} from "@/lib/venue-switch";
import type { BuildStore, SavedBuild } from "./build-store";
import { QlooCacheMiss, type QlooClient } from "./qloo";

// The labels a venue's trace line can carry after its name (M6l, M6o; src/lib/place-kinds.ts).
const KINDS = [
  "a festival",
  "a stadium",
  "an arena",
  "an outdoor festival site",
  "a sports ground",
];

/** "Mid-band artists for the headliners and Expo Park (an outdoor festival site) …" */
function kindIn(summary: string, venue: string): string | undefined {
  const after = summary.split(`headliners and ${venue}`)[1] ?? "";
  return KINDS.find((kind) => after.startsWith(` (${kind})`));
}

/**
 * The booking rule's input for a saved build, rebuilt from the build's context and the Qloo
 * cache only (as the replay's climb is, src/server/undercard-build.ts): the headliners, the
 * compared tags, each band's headliners-only ranking, and each venue run in the order the
 * trace lists it. A run the cache can't answer makes it null: the switch is then left out
 * rather than guessed.
 */
export async function assemblyFromSaved(
  saved: SavedBuild,
  festival: Festival,
  qloo: QlooClient,
): Promise<AssemblyInput | null> {
  const { context } = saved;
  const pair = context.headliners.map((headliner) => headliner.entityId);
  const runs: { band: FeeBand; venue: VenueRef }[] = [];
  for (const call of saved.trace) {
    if (call.tool !== "venue_artists") continue;
    const band = festival.feeBands.find((entry) =>
      call.summary.startsWith(`${entry.label}-band`),
    );
    const anchor = band
      ? (context.anchors[band.id] ?? []).find((venue) =>
          call.summary.includes(`headliners and ${venue.name}`),
        )
      : undefined;
    if (!band || !anchor) return null;
    const kind = kindIn(call.summary, anchor.name);
    runs.push({
      band,
      venue: {
        entityId: anchor.entityId,
        name: anchor.name,
        ...(kind ? { kind } : {}),
      },
    });
  }
  // The cache reads run together; the runs keep the trace's order, which breaks the rule's ties.
  let venueRuns: VenueRun[];
  try {
    venueRuns = await Promise.all(
      runs.map(async ({ band, venue }) => ({
        venue,
        band: band.id,
        artists: (
          await qloo.artists({
            signalEntityIds: [...pair, venue.entityId],
            popularityMin: band.minPopularity,
            popularityMax: band.maxPopularity,
            excludeEntityIds: pair,
            ages: context.ages ?? [],
          })
        ).data,
      })),
    );
  } catch (error) {
    if (error instanceof QlooCacheMiss) return null;
    throw error;
  }
  return {
    bands: festival.feeBands,
    headliners: context.headliners,
    comparedTags: context.comparedTags,
    baselines: Object.fromEntries(
      Object.entries(context.baselines).map(([band, ids]) => [
        band,
        (ids ?? []).map((entityId) => ({ entityId })),
      ]),
    ),
    venueRuns,
  };
}

const sameLineup = (
  a: readonly { entityId: string; band: string }[],
  b: readonly { entityId: string; band: string }[],
) =>
  a.length === b.length &&
  a.every(
    (act, index) =>
      act.entityId === b[index].entityId && act.band === b[index].band,
  );

/**
 * The venue switch for a festival's latest saved build, or null when there is none, the cache
 * can't rebuild it, or the rule with every venue on doesn't give back the saved lineup.
 */
export async function readVenueSwitch({
  store,
  festival,
  qloo,
  buildId,
}: {
  store: Pick<BuildStore, "latest" | "byId">;
  festival: Festival;
  qloo: QlooClient | null;
  /** The build on the buyer's screen; the festival's latest saved build when unset. */
  buildId?: string;
}): Promise<VenueSwitchData | null> {
  if (!qloo) return null;
  const saved = buildId
    ? await store.byId(buildId)
    : await store.latest(festival.id);
  if (!saved || saved.festivalId !== festival.id) return null;
  const input = await assemblyFromSaved(saved, festival, qloo);
  if (!input) return null;
  const every = new Set(venuesOf(input).map((venue) => venue.entityId));
  if (!sameLineup(lineupWith(input, every).acts, saved.lineup.acts))
    return null;
  return { buildId: saved.id, ...venueSwitch(input) };
}
