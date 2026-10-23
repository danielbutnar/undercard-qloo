// WS4, the buyer's shortlist, step 1: each pasted name resolved with one /search through
// src/lib/qloo (artist type, the top match after section 18's normalising); a name Qloo doesn't
// match is "not found on Qloo", never guessed; repeats are checked once. Invented names and ids.
import { describe, expect, it } from "vitest";
import { pastedNames, SHORTLIST_CALL_CAP } from "@/lib/shortlist";
import { callBudget, resolveNames } from "@/server/shortlist";
import { id, params, qlooWorld, searchOnly } from "./world";

const HEADLINER_IDS = new Set([id(1), id(2)]);

async function resolve(names: string[], world = qlooWorld(searchOnly)) {
  const budget = callBudget({
    live: world.live,
    cached: world.cached,
    cap: SHORTLIST_CALL_CAP,
  });
  const result = await resolveNames({
    names,
    budget,
    headlinerIds: HEADLINER_IDS,
  });
  return { ...result, budget, world };
}

const summary = (acts: Awaited<ReturnType<typeof resolve>>["acts"]) =>
  acts.map((act) =>
    "artist" in act
      ? { name: act.name, status: act.status, entityId: act.artist.entityId }
      : { name: act.name, status: act.status },
  );

describe("a pasted shortlist", () => {
  it("is one name per line, trimmed, with empty lines dropped", () => {
    expect(
      pastedNames("Velvet Coyote\n\n  Dusk Arcade \r\n\t\nSilver Mesa"),
    ).toEqual(["Velvet Coyote", "Dusk Arcade", "Silver Mesa"]);
  });
});

describe("resolving the shortlist's names on Qloo (WS4, step 1)", () => {
  it("searches artists once per name and takes the top match after section 18's normalising", async () => {
    const { acts, world } = await resolve([
      "Velvet Coyote",
      "The Long Drives",
      "Fjarilsdal",
    ]);

    expect(summary(acts)).toEqual([
      { name: "Velvet Coyote", status: "found", entityId: id(301) },
      // Search lists a tribute band first; the act is the second result, "Long Drives".
      { name: "The Long Drives", status: "found", entityId: id(302) },
      // Accents and a bracketed note: "Fjärilsdal (band)".
      { name: "Fjarilsdal", status: "found", entityId: id(309) },
    ]);
    expect(world.requests.map(({ url }) => url.pathname)).toEqual([
      "/search",
      "/search",
      "/search",
    ]);
    expect(world.requests.map(({ url }) => params(url))).toEqual(
      ["Velvet Coyote", "The Long Drives", "Fjarilsdal"].map((query) => ({
        query,
        types: "urn:entity:artist",
        take: "5",
      })),
    );
  });

  it("says a name Qloo doesn't match is not found, never guessed from a near miss", async () => {
    const { acts } = await resolve(["Nobody Knows Us", "Ghost Name"]);

    // Search answers "Nobody Knows" for the first and nothing for the second.
    expect(summary(acts)).toEqual([
      { name: "Nobody Knows Us", status: "not-found" },
      { name: "Ghost Name", status: "not-found" },
    ]);
  });

  // Two names match one act only if they normalise alike, so a repeat is found before searching.
  it("checks a repeat once: a name typed twice, or spelled with a leading The, is searched once", async () => {
    const { acts, repeats, calls, world } = await resolve([
      "Marigold Static",
      "  marigold static ",
      "The Long Drives",
      "Long Drives",
      "Dusk Arcade",
    ]);

    expect(summary(acts)).toEqual([
      { name: "Marigold Static", status: "found", entityId: id(303) },
      { name: "The Long Drives", status: "found", entityId: id(302) },
      { name: "Dusk Arcade", status: "found", entityId: id(305) },
    ]);
    expect(repeats).toEqual([
      { name: "marigold static", sameAs: "Marigold Static" },
      { name: "Long Drives", sameAs: "The Long Drives" },
    ]);
    expect(world.requests.map(({ url }) => params(url).query)).toEqual([
      "Marigold Static",
      "The Long Drives",
      "Dusk Arcade",
    ]);
    expect(calls.map((call) => call.params)).toEqual(
      ["Marigold Static", "The Long Drives", "Dusk Arcade"].map((query) => [
        ["query", query],
        ["types", "urn:entity:artist"],
        ["take", "5"],
      ]),
    );
  });

  it("marks a pasted headliner as one of the headliners, not an act to rank", async () => {
    const { acts } = await resolve(["Khruangbin", "Velvet Coyote"]);

    expect(summary(acts)).toEqual([
      { name: "Khruangbin", status: "headliner", entityId: id(1) },
      { name: "Velvet Coyote", status: "found", entityId: id(301) },
    ]);
  });

  it("lists a search the server's Qloo cache answers as a cached call, and counts only the calls made", async () => {
    const world = qlooWorld(searchOnly);
    const first = await resolve(["Velvet Coyote", "Dusk Arcade"], world);
    const again = await resolve(["Velvet Coyote", "Dusk Arcade"], world);

    expect(first.calls.map((call) => call.cached)).toEqual([false, false]);
    expect(first.budget.made()).toBe(2);
    expect(again.calls.map((call) => call.cached)).toEqual([true, true]);
    expect(again.budget.made()).toBe(0);
    expect(world.requests).toHaveLength(2);
  });
});
