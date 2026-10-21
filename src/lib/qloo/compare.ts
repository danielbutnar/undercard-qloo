import { z } from "zod";
import { RawTag, toTag, usable, type QlooGet } from "./core";

const CompareBody = z.object({
  results: z.object({
    tags: z.array(
      RawTag.extend({
        query: z.object({ score: z.number().optional() }).partial().optional(),
      }),
    ),
  }),
});

/** GET /v2/analysis/compare: the taste tags the two headliners share. */
export function compareEndpoint(get: QlooGet) {
  /** GET /v2/analysis/compare: the tags two groups of entities have in common, with scores. */
  return function compare({
    a,
    b,
    take = 25,
  }: {
    a: string[];
    b: string[];
    take?: number;
  }) {
    return get(
      "/v2/analysis/compare",
      {
        "a.signal.interests.entities": a.join(","),
        "b.signal.interests.entities": b.join(","),
        take,
      },
      (body) =>
        CompareBody.parse(body)
          .results.tags.map((raw) => ({
            tag: toTag(raw),
            score: raw.query?.score ?? 0,
          }))
          .filter(({ tag }) => usable(tag)),
    );
  };
}
