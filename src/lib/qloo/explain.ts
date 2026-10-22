import { z } from "zod";
import type { QlooGet } from "./core";

/** One input's part of an act's result, as Qloo's explainability gives it. */
export interface InputShare {
  /** An input of the call's signal: a headliner or one of the fee range's venues. */
  entityId: string;
  /** Its part of the act's result, 0 to 1. An act's parts add up to about 1 (section 35). */
  share: number;
}

export interface ActShares {
  /** The act, one of filter.results.entities. */
  entityId: string;
  /** Qloo's list in Qloo's order; empty when Qloo gave the act none. */
  shares: InputShare[];
}

// Section 35's answer (docs/evidence.md): each act's query.explainability holds, under
// "signal.interests.entities", one { entity_id, score } per input Qloo scored. An act without
// that list is valid and has no split; a list that isn't one, or a score that isn't a number
// from 0 up, makes the whole answer malformed, so nothing is cached.
const ExplainBody = z.object({
  results: z.object({
    entities: z.array(
      z.object({
        entity_id: z.string().min(1),
        query: z
          .object({
            explainability: z
              .object({
                "signal.interests.entities": z
                  .array(
                    z.object({
                      entity_id: z.string().min(1),
                      score: z.number().nonnegative(),
                    }),
                  )
                  .nullish(),
              })
              .nullish(),
          })
          .nullish(),
      }),
    ),
  }),
});

/** GET /v2/insights with feature.explainability: how Qloo splits each act's result by input. */
export function explainEndpoint(get: QlooGet) {
  /**
   * GET /v2/insights for the given acts only, with feature.explainability=true (docs/evidence.md
   * section 35): the headliners and a fee range's venues as the signal, that range's lineup acts
   * as filter.results.entities, the build's crowd ages. Each act comes back with the part of its
   * result Qloo puts on each input. The parameters keep section 35's order.
   */
  return function explain({
    signalEntityIds,
    actIds,
    ages = [],
  }: {
    /** The headliners, then the fee range's venues in the order the build ran them. */
    signalEntityIds: readonly string[];
    actIds: readonly string[];
    /** Qloo age buckets for signal.demographics.age, as the build sent them. */
    ages?: readonly string[];
  }) {
    const params: Record<string, string | number> = {
      "filter.type": "urn:entity:artist",
      "signal.interests.entities": signalEntityIds.join(","),
      "filter.results.entities": actIds.join(","),
    };
    if (ages.length) params["signal.demographics.age"] = ages.join(",");
    params["feature.explainability"] = "true";
    params.take = actIds.length;
    return get("/v2/insights", params, (body): ActShares[] =>
      ExplainBody.parse(body).results.entities.map((act) => ({
        entityId: act.entity_id,
        shares: (
          act.query?.explainability?.["signal.interests.entities"] ?? []
        ).map((input) => ({ entityId: input.entity_id, share: input.score })),
      })),
    );
  };
}
