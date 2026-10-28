// WS12 step 0: the Design 2.0 prototype's words and picks (/lab/design-2), on the synthetic build
// (invented acts and venues, no Qloo data): the agent's setlist, the call it circles, the door
// check's three stamps and the act the landing follows.
import { describe, expect, it } from "vitest";
import {
  firstAct,
  liftingCall,
  setlistLines,
  ticketStamps,
} from "@/app/lab/design-2/_kit/words";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { syntheticSavedBuild } from "../../e2e/synthetic-build";

const build = syntheticSavedBuild();
const bands = SAGEBRUSH_SOUND.feeBands;
const venues = [
  ...new Map(
    Object.values(build.context.anchors)
      .flatMap((list) => list ?? [])
      .map((venue) => [venue.entityId, venue]),
  ).values(),
];
const venue = (name: string) => venues.find((entry) => entry.name === name)!;
const act = (name: string) =>
  build.lineup.acts.find((entry) => entry.name === name)!;
const COTTONWOOD = venue("Cottonwood Social Hall");

describe("the agent's setlist", () => {
  const { lines, closing } = setlistLines(build.trace, {
    venues,
    bands,
    noFanData: [COTTONWOOD.entityId],
    notes: build.notes ?? [],
  });

  it("prints every call of the build as a numbered line, in order", () => {
    expect(lines.map((line) => line.n)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("words each kind of call as a short line", () => {
    expect(lines.slice(0, 7).map((line) => line.text)).toEqual([
      "Look up Khruangbin",
      "Look up Japanese Breakfast",
      'Qloo\'s "live music venue" tag',
      "Live-music places in Boise",
      "What both headliners' fans like",
      "Mid-size: the headliners' fans alone",
      "Opening: the headliners' fans alone",
    ]);
  });

  it("names each venue call's venue and tier, so the line takes the venue's colour", () => {
    expect(lines[7]).toMatchObject({
      text: "Mid-size +",
      band: "mid",
      venue: { name: "The Lantern Room" },
      noFanData: false,
    });
    expect(lines[10]).toMatchObject({
      text: "Opening +",
      band: "opener",
      venue: { name: "Fort Street Ballroom" },
    });
    expect(lines[5].venue).toBeNull();
  });

  it("marks the venue Qloo had no fan data for", () => {
    expect(lines[11]).toMatchObject({
      venue: { name: "Cottonwood Social Hall" },
      noFanData: true,
    });
  });

  it("counts each call's results in words", () => {
    expect(lines.slice(0, 7).map((line) => line.count)).toEqual([
      "3 matches",
      "5 matches",
      "10 tags",
      "8 places",
      "25 tags",
      "50 acts",
      "50 acts",
    ]);
  });

  it("puts each of the agent's lines before the call it was said before, and the last after the list", () => {
    const notes = build.notes ?? [];
    expect(lines[0].before).toEqual([notes[0].text]);
    expect(lines[3].before).toEqual([notes[1].text]);
    expect(lines[5].before).toEqual([notes[2].text]);
    expect(lines[11].before).toEqual([notes[3].text]);
    expect(lines[1].before).toEqual([]);
    expect(closing).toEqual([notes[4].text]);
  });
});

describe("the call the setlist circles", () => {
  it("is the venue call for the act's tier and venue", () => {
    expect(liftingCall(build.trace, act("Hollow Pines"), venues, bands)).toBe(
      8,
    );
    expect(liftingCall(build.trace, act("Marisol Vey"), venues, bands)).toBe(
      10,
    );
    expect(liftingCall(build.trace, act("Owyhee Drift"), venues, bands)).toBe(
      11,
    );
  });

  it("is none when no call of the build names the act's venue", () => {
    const elsewhere = {
      ...act("Hollow Pines"),
      anchorVenue: { entityId: "not-read", name: "A Room Never Read" },
    };
    expect(liftingCall(build.trace, elsewhere, venues, bands)).toBeNull();
  });
});

describe("the door check's three stamps", () => {
  it("carry the climb against the bar, the popularity on the tier's scale and the two genres", () => {
    expect(ticketStamps(act("Hollow Pines"), bands[0])).toEqual({
      climb: { kind: "up", places: 11 },
      bar: 5,
      popularity: { value: 91, min: 80, max: 92 },
      genres: ["Dream Pop", "Psychedelic Rock"],
    });
  });

  it("mark an act new to Qloo's top 50", () => {
    expect(ticketStamps(act("Low Bench Choir"), bands[1]).climb).toEqual({
      kind: "new",
      top: 8,
    });
  });
});

describe("the act the landing follows", () => {
  it("is the poster's first act whose climb the build can tell", () => {
    const places = {
      [act("Hollow Pines").entityId]: { now: 3, was: 14 },
    };
    expect(firstAct(build.lineup.acts, places, bands)?.name).toBe(
      "Hollow Pines",
    );
  });

  it("skips an act whose places the build doesn't hold", () => {
    const places = {
      [act("Marisol Vey").entityId]: { now: 6, was: 13 },
    };
    expect(firstAct(build.lineup.acts, places, bands)?.name).toBe(
      "Marisol Vey",
    );
  });
});
