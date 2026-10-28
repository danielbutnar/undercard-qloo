import type { SavedBuild } from "./build-store";
import type { ArtistsQuery, QlooClient, QlooEntity } from "./qloo";

/**
 * The client a saved build's answers are read back with (WS13): over the cache prefix the build
 * records, or the 1.0 builds' when it records none. Nothing is read across prefixes.
 */
export function readerFor(
  saved: Pick<SavedBuild, "cachePrefix">,
  qloo: QlooClient,
): QlooClient {
  return saved.cachePrefix && saved.cachePrefix !== qloo.cachePrefix
    ? qloo.withPrefix(saved.cachePrefix)
    : qloo;
}

/**
 * One of a saved build's rankings, as its build asked it: a 2.0 build's venue reads are scored
 * reads (Qloo's warnings kept), cached under their own key; every other ranking is a plain read.
 * A miss throws as the client does (QlooCacheMiss on a cache-only client).
 */
export async function savedRanking(
  saved: Pick<SavedBuild, "engine">,
  reader: QlooClient,
  query: ArtistsQuery,
  venueRead: boolean,
): Promise<QlooEntity[]> {
  if (venueRead && saved.engine === 2)
    return (await reader.scoredArtists(query)).data.entities;
  return (await reader.artists(query)).data;
}
