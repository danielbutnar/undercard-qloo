import { foundOnQloo } from "@/lib/pick-tests";
import { distinctNames, type Repeat } from "@/lib/shortlist";
import {
  QlooCacheMiss,
  type QlooCall,
  type QlooClient,
  type QlooEntity,
  type QlooResult,
} from "./qloo";

/** One Qloo call a check may make, run against the client the budget gives it. */
export type ShortlistTask<T extends unknown[]> = (
  qloo: QlooClient,
) => Promise<QlooResult<T>>;

/**
 * A check's Qloo calls (WS4): each runs through the live client, and a call the server's Qloo
 * cache answers still lists, marked cached. A cache-only client's miss is a call not made: its
 * result is null. `made` counts the calls that reached Qloo.
 */
export function callBudget({
  live,
}: {
  /** Calls that may reach Qloo go here (cache first, as every client reads). */
  live: QlooClient;
  /** Reads the cache only, never Qloo. */
  cached: QlooClient;
  /** The most calls one check may make. */
  cap: number;
}) {
  let made = 0;
  return {
    async run<T extends unknown[]>(
      tasks: readonly ShortlistTask<T>[],
    ): Promise<(QlooResult<T> | null)[]> {
      const results = await Promise.all(
        tasks.map(async (task) => {
          try {
            return await task(live);
          } catch (error) {
            if (error instanceof QlooCacheMiss) return null;
            throw error;
          }
        }),
      );
      made += results.filter((result) => result && !result.call.cached).length;
      return results;
    },
    made: () => made,
  };
}

export type CallBudget = ReturnType<typeof callBudget>;

/** A pasted name on Qloo: the act it found, or why there's none. */
export type ResolvedName =
  | { name: string; status: "found" | "headliner"; artist: QlooEntity }
  | { name: string; status: "not-found" | "not-checked" };

/**
 * Step 1: each name once, searched on Qloo as an artist; its act is the first of search's top
 * five that matches it after section 18's normalising (foundOnQloo), so a near miss is not found,
 * never guessed. A match needs the same normalised name, so two names for one act are a repeat
 * before any search. A headliner is marked, not ranked; a search not made is not checked.
 */
export async function resolveNames({
  names,
  budget,
  headlinerIds,
}: {
  names: readonly string[];
  budget: CallBudget;
  headlinerIds: ReadonlySet<string>;
}): Promise<{
  acts: ResolvedName[];
  repeats: Repeat[];
  calls: QlooCall[];
}> {
  const typed = distinctNames(names);
  const results = await budget.run(
    typed.names.map((query) => (qloo: QlooClient) => qloo.search({ query })),
  );
  const acts = typed.names.map((name, index): ResolvedName => {
    const result = results[index];
    if (!result) return { name, status: "not-checked" };
    const artist = foundOnQloo(name, result.data);
    if (!artist) return { name, status: "not-found" };
    return {
      name,
      status: headlinerIds.has(artist.entityId) ? "headliner" : "found",
      artist,
    };
  });
  return {
    acts,
    repeats: typed.repeats,
    calls: results.flatMap((result) => (result ? [result.call] : [])),
  };
}
