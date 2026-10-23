// WS8 (item 15): a pick with letters beyond ASCII ("Ałtın Gün", invented) that Qloo's search
// didn't match is searched again with its accents folded; a saved check reads the folded
// search's cache entry when there is one, and says "not found" only when that one fails too.
import { describe, expect, it } from "vitest";
import type { LlmOnlyLineup } from "@/lib/llm-only";
import { foldAccents, hasNonAscii } from "@/lib/pick-tests";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { pickChecks } from "@/server/pick-checks";
import { createQlooClient } from "@/server/qloo";
import {
  fakeFetch,
  HEADLINER_TAGS,
  params,
  searchEntity,
  syntheticQloo,
} from "../m2/fake-qloo";
import { readEvents, syntheticServer } from "../m3/scripted";

const SEARCHES: Record<string, unknown[]> = {
  // The accented search finds nothing; the folded one finds the act.
  "Ałtın Gün": [],
  "Altin Gun": [
    searchEntity(905, "Altin Gun", 0.7, HEADLINER_TAGS.slice(1, 3)),
  ],
  // Accented, unmatched, and no folded search saved yet.
  "Søren Lake": [],
};
const answer = (names: string[]): LlmOnlyLineup => ({
  festivalId: SAGEBRUSH_SOUND.id,
  createdAt: "2026-10-15T14:02:00.000Z",
  picks: names.map((name) => ({ name, note: "An invented reason." })),
});

describe("the folded search retry (WS8)", () => {
  it("folds accents and the letters NFKD leaves, and spots non-ASCII names", () => {
    expect(foldAccents("Ałtın Gün")).toBe("Altin Gun");
    expect(foldAccents("Søren Lake")).toBe("Soren Lake");
    expect(foldAccents("Beyoncé")).toBe("Beyonce");
    expect(hasNonAscii("Altın Gün")).toBe(true);
    expect(hasNonAscii("Khruangbin")).toBe(false);
  });

  it("reads the folded search's cache entry before saying not found", async () => {
    const server = syntheticServer();
    await readEvents(server.build({ fresh: true }));
    const build = await server.store.latest(SAGEBRUSH_SOUND.id);
    const seeding = createQlooClient({
      apiKey: "synthetic",
      cache: server.cache,
      fetch: fakeFetch((url) =>
        url.pathname === "/search"
          ? { results: SEARCHES[params(url).query] ?? [] }
          : syntheticQloo(url),
      ).fetch,
    });
    for (const name of Object.keys(SEARCHES))
      await seeding.search({ query: name });

    const checks = await pickChecks({
      answer: answer(["Ałtın Gün", "Søren Lake"]),
      build,
      festival: SAGEBRUSH_SOUND,
      cache: server.cache,
    });
    expect(checks[0]).toMatchObject({ name: "Ałtın Gün", status: "found" });
    expect(checks[1]).toEqual({ name: "Søren Lake", status: "not-found" });
  });
});
