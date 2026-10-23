// WS8: a Qloo call's line names its venue exactly, so a venue whose name starts another's ("The
// Room", "The Room East") is never matched to the other's call. Invented names.
import { describe, expect, it } from "vitest";
import { festivalById } from "@/lib/towns";
import { namesVenue, venueOfCall } from "@/lib/venue-call";
import type { QlooClient } from "@/server/qloo";
import { replayClimbs } from "@/server/undercard-build";
import { assemblyFromSaved } from "@/server/venue-switch";
import { syntheticTownBuild } from "../../e2e/synthetic-build";

const ROOM = { entityId: "room", name: "The Room" };
const EAST = { entityId: "room-east", name: "The Room East" };
const line = (venue: string, after = "") =>
  `Mid-band artists for the headliners and ${venue}${after}`;

describe("which venue a call's line names (WS8)", () => {
  it("never matches a venue to a longer name that starts the same way", () => {
    expect(namesVenue(line("The Room East"), "The Room")).toBe(false);
    expect(namesVenue(line("The Room East"), "The Room East")).toBe(true);
    expect(namesVenue(line("The Room"), "The Room")).toBe(true);
    expect(namesVenue(line("The Room"), "The Room East")).toBe(false);
  });

  it("reads past a note in brackets or a refill's tail", () => {
    expect(namesVenue(line("The Room", " (an arena)"), "The Room")).toBe(true);
    expect(
      namesVenue(
        line("The Room", " (the crowd's ages as Qloo's nearest buckets)"),
        "The Room",
      ),
    ).toBe(true);
    expect(
      namesVenue(
        `Refill (fee): ${line("The Room")}, minus the board`,
        "The Room",
      ),
    ).toBe(true);
  });

  it("picks the venue the line names, in either order", () => {
    expect(venueOfCall(line("The Room East"), [ROOM, EAST])).toBe(EAST);
    expect(venueOfCall(line("The Room East"), [EAST, ROOM])).toBe(EAST);
    expect(venueOfCall(line("The Room"), [EAST, ROOM])).toBe(ROOM);
    expect(venueOfCall(line("Elsewhere"), [EAST, ROOM])).toBeUndefined();
    // A name with its own brackets beats the shorter name it starts with.
    const vac = { entityId: "vac", name: "Venue 418 (V418)" };
    const plain = { entityId: "plain", name: "Venue 418" };
    expect(
      venueOfCall(line(vac.name, " (an arena)"), [plain, vac])?.entityId,
    ).toBe("vac");
  });
});

// Denver's synthetic build lists The Room before The Room East among its mid-size anchors, and
// reads The Room East first: the server's rebuilds credit each call to its own venue.
describe("the server's rebuilds of a saved build (WS8)", () => {
  const build = syntheticTownBuild("denver", "sagebrush-sound-denver");
  const festival = festivalById("sagebrush-sound-denver")!;
  const qloo = { artists: async () => ({ data: [] }) } as unknown as QlooClient;

  it("the venue switch reads each venue's own run", async () => {
    const input = await assemblyFromSaved(build, festival, qloo);
    expect(
      input!.venueRuns.map((run) => `${run.band} ${run.venue.name}`),
    ).toEqual([
      "mid The Room East",
      "mid The Room",
      "opener The Room",
      "mid Cottonwood Social Hall",
    ]);
  });

  it("the replay's climbs name each call's own venue", async () => {
    const climbs = await replayClimbs(build, festival, qloo);
    const venueAt = (n: number) =>
      climbs.get(build.trace.findIndex((call) => call.n === n))?.venue?.name;
    expect([venueAt(8), venueAt(9), venueAt(10)]).toEqual([
      "The Room East",
      "The Room",
      "The Room",
    ]);
  });
});
