import { z } from "zod";
import { RawTag, toTag, usable, type QlooGet } from "./core";

const TagsBody = z.object({ results: z.object({ tags: z.array(RawTag) }) });

/** GET /v2/tags: the tag Qloo puts on live music venues. */
export function tagsEndpoint(get: QlooGet) {
  /** GET /v2/tags: tag ids by keyword. */
  return function tags({
    query,
    parentType,
    take = 10,
  }: {
    query: string;
    parentType?: string;
    take?: number;
  }) {
    const params: Record<string, string | number> = { "filter.query": query };
    if (parentType) params["filter.parents.types"] = parentType;
    params.take = take;
    return get("/v2/tags", params, (body) =>
      TagsBody.parse(body).results.tags.map(toTag).filter(usable),
    );
  };
}
