import { z } from "zod";
import { RawEntity, toEntity, type QlooGet } from "./core";

const SearchBody = z.object({ results: z.array(RawEntity) });

/** GET /search: entities by name (the headliners, and a town's place in M6j). */
export function searchEndpoint(get: QlooGet) {
  /** GET /search: entities by name. */
  return function search({
    query,
    types = "urn:entity:artist",
    take = 5,
  }: {
    query: string;
    types?: string;
    take?: number;
  }) {
    return get("/search", { query, types, take }, (body) =>
      SearchBody.parse(body).results.map(toEntity),
    );
  };
}
