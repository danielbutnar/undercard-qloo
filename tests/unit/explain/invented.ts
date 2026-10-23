// An invented saved build and an invented Qloo that answers section 35's call for it: made-up
// names, the reserved all-zero ids of tests/unit/m2 and made-up shares. No Qloo response data.
import type { Act } from "@/lib/lineup";
import type { SavedBuild } from "@/server/build-store";
import { params, syntheticId } from "../m2/fake-qloo";

export const HOLLOW_PINES = syntheticId(1);
export const QUIET_ONES = syntheticId(2);
export const LANTERN = syntheticId(201);
export const FORT = syntheticId(202);
/** A venue the build ran that the invented Qloo scores for no act, as section 35 found one. */
export const DINER = syntheticId(203);

const VENUE_NAMES: Record<string, string> = {
  [LANTERN]: "The Lantern Room",
  [FORT]: "Fort Street Ballroom",
  [DINER]: "Sagebrush Diner",
};

const venue = (entityId: string) => ({ entityId, name: VENUE_NAMES[entityId] });

function act(n: number, band: Act["band"], anchor: string): Act {
  return {
    entityId: syntheticId(n),
    name: `Invented Act ${n}`,
    band,
    affinity: 0.9,
    popularity: band === "mid" ? 0.85 : 0.6,
    anchorVenue: venue(anchor),
    reason: `Fans of ${VENUE_NAMES[anchor]} move it up 4 places.`,
    sharedTags: [
      { id: "urn:tag:genre:music:dream_pop", name: "Dream Pop" },
      { id: "urn:tag:genre:music:indie_rock", name: "Indie Rock" },
    ],
  };
}

export const MID_ACTS = [1001, 1002, 1003, 1004].map(syntheticId);
export const OPENER_ACTS = [2001, 2002, 2003, 2004, 2005, 2006].map(
  syntheticId,
);

/** A saved build: two headliners, three venues for the mid-size range and two for openers. */
export function inventedBuild(overrides: Partial<SavedBuild> = {}): SavedBuild {
  const festivalId = overrides.festivalId ?? "invented-festival";
  return {
    id: "invented-build",
    festivalId,
    createdAt: "2026-10-17T12:13:00.000Z",
    trace: [],
    lineup: {
      festivalId,
      acts: [
        act(1001, "mid", LANTERN),
        act(1002, "mid", FORT),
        act(1003, "mid", LANTERN),
        act(1004, "mid", FORT),
        ...[2001, 2002, 2003, 2004, 2005, 2006].map((n, index) =>
          act(n, "opener", index % 2 ? FORT : LANTERN),
        ),
      ],
    },
    context: {
      headliners: [
        { entityId: HOLLOW_PINES, name: "Hollow Pines", tags: [] },
        { entityId: QUIET_ONES, name: "The Quiet Ones", tags: [] },
      ],
      comparedTags: [],
      baselines: { mid: [], opener: [] },
      anchors: {
        mid: [venue(LANTERN), venue(FORT), venue(DINER)],
        opener: [venue(LANTERN), venue(FORT)],
      },
      ages: ["25_to_29", "30_to_34"],
    },
    ...overrides,
  };
}

/**
 * Invented shares for an act: the headliners first, then the venues, the Diner never scored.
 * Act n's shares add up to 1: Hollow Pines 0.30, The Quiet Ones 0.20, then the rest split
 * between the two venues by n.
 */
export function inventedShares(actId: string): Record<string, number> {
  const n = Number(actId.slice(-4));
  const lantern = Number((0.1 + (n % 4) * 0.1).toFixed(2));
  return {
    [HOLLOW_PINES]: 0.3,
    [QUIET_ONES]: 0.2,
    [LANTERN]: lantern,
    [FORT]: Number((0.5 - lantern).toFixed(2)),
  };
}

/** An invented Qloo for section 35's call: every requested act, scored on the inputs sent. */
export function inventedExplainQloo(url: URL): unknown {
  const p = params(url);
  const inputs = new Set((p["signal.interests.entities"] ?? "").split(","));
  const acts = (p["filter.results.entities"] ?? "").split(",").filter(Boolean);
  return {
    success: true,
    results: {
      entities: acts.map((entityId) => ({
        name: `Invented Act ${entityId.slice(-4)}`,
        entity_id: entityId,
        type: "urn:entity:artist",
        query: {
          affinity: 0.9,
          explainability: {
            "signal.interests.entities": Object.entries(
              inventedShares(entityId),
            )
              .filter(([input]) => inputs.has(input))
              .map(([input, score]) => ({ entity_id: input, score }))
              .sort((a, b) => b.score - a.score),
          },
        },
      })),
    },
    warnings: [],
  };
}
