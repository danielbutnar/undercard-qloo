// WS4, the buyer's shortlist, step 4: a hard cap of 14 Qloo calls per check. A call the server's
// Qloo cache answers costs nothing and still lists, marked cached; a call that would reach Qloo
// past the cap is not made, and the venue it was for says it wasn't read. Invented names and ids.
import { describe, expect, it } from "vitest";
import { SHORTLIST_CALL_CAP } from "@/lib/shortlist";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { callBudget, checkShortlist } from "@/server/shortlist";
import { id, qlooWorld, savedBuild, shortlistQloo } from "./world";

const TEN = [
  "Velvet Coyote",
  "The Long Drives",
  "Marigold Static",
  "Paper Canyon",
  "Dusk Arcade",
  "Honey Basin",
  "Lowland Choir",
  "Silver Mesa",
  "Nobody Knows Us",
  "Ghost Name",
];
const EXTRA = [
  { entityId: id(204), name: "Linden Street Annex" },
  { entityId: id(205), name: "Juniper Hall" },
];

/** A saved build whose agent read five venues: more than the cap leaves room for. */
function fiveVenueBuild() {
  const build = savedBuild();
  return {
    ...build,
    context: {
      ...build.context,
      anchors: {
        mid: [...(build.context.anchors.mid ?? []), ...EXTRA],
        opener: build.context.anchors.opener,
      },
    },
  };
}

async function check(world = qlooWorld(shortlistQloo())) {
  const before = world.requests.length;
  const shortlist = await checkShortlist({
    festival: SAGEBRUSH_SOUND,
    build: fiveVenueBuild(),
    names: TEN,
    budget: callBudget({ ...world, cap: SHORTLIST_CALL_CAP }),
  });
  return { shortlist, made: world.requests.length - before, world };
}

describe("the check's 14-call cap (WS4, step 4)", () => {
  it("is 14", () => {
    expect(SHORTLIST_CALL_CAP).toBe(14);
  });

  it("stops at 14 calls that reach Qloo: 10 searches and 4 rankings, the last two venues not read", async () => {
    const { shortlist, made } = await check();

    expect(made).toBe(14);
    expect(shortlist.made).toBe(14);
    expect(shortlist.calls).toHaveLength(14);
    expect(shortlist.calls.filter((call) => call.cached)).toHaveLength(0);
    expect(shortlist.venues.map((venue) => [venue.name, venue.read])).toEqual([
      ["The Lantern Room", true],
      ["Fort Street Ballroom", true],
      ["Cottonwood Social Hall", true],
      ["Linden Street Annex", false],
      ["Juniper Hall", false],
    ]);
  });

  it("counts only the calls made: with the searches cached, every venue is read in 6 calls", async () => {
    const world = qlooWorld(shortlistQloo());
    // The same names searched before, so the cache answers all ten searches.
    await callBudget({ ...world, cap: SHORTLIST_CALL_CAP }).run(
      TEN.map((query) => (qloo) => qloo.search({ query })),
    );

    const { shortlist, made } = await check(world);

    expect(made).toBe(6);
    expect(shortlist.made).toBe(6);
    expect(shortlist.calls).toHaveLength(16);
    expect(shortlist.calls.filter((call) => call.cached)).toHaveLength(10);
    expect(shortlist.venues.every((venue) => venue.read)).toBe(true);
  });

  it("never lets calls running at once pass the cap", async () => {
    const world = qlooWorld(shortlistQloo());
    const budget = callBudget({ ...world, cap: 3 });

    const results = await budget.run(
      TEN.map((query) => (qloo) => qloo.search({ query })),
    );

    expect(world.requests).toHaveLength(3);
    expect(budget.made()).toBe(3);
    expect(results.map((result) => result !== null)).toEqual([
      true,
      true,
      true,
      ...Array(7).fill(false),
    ]);
  });
});
