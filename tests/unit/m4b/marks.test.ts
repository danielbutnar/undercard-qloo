import { describe, expect, it } from "vitest";
import {
  liftOf,
  markKey,
  markLabel,
  markText,
  roomShortName,
} from "@/lib/marks";
import { acts } from "./first-bill-fixture";

const act = (reason: string, room = "The Lantern Room") => ({
  ...acts[0],
  anchorVenue: { ...acts[0].anchorVenue, name: room },
  reason,
});

describe("an act's lift, read from its Why Boise line", () => {
  it("counts the places a room's crowd moved it up", () => {
    expect(liftOf(act("The Lantern Room fans move it up 11 places."))).toEqual({
      kind: "up",
      places: 11,
    });
  });

  it("reads an act from outside the headliners-only ranking as new", () => {
    expect(
      liftOf(act("The Lantern Room fans move it into the top 6.")),
    ).toEqual({ kind: "new", top: 6 });
  });

  it("reads no lift from a line it doesn't recognise", () => {
    expect(liftOf(act("A line from some other build."))).toBeNull();
  });

  it("reads every act in the synthetic build", () => {
    for (const each of acts) expect(liftOf(each)).not.toBeNull();
  });
});

describe("the mark under an act", () => {
  it("shortens a room of three or more words to its initials", () => {
    expect(roomShortName("Fort Street Ballroom")).toBe("FSB");
    expect(roomShortName("Cottonwood Social Hall")).toBe("CSH");
  });

  it("keeps a shorter name whole, not counting a leading The", () => {
    expect(roomShortName("The Lantern Room")).toBe("The Lantern Room");
    expect(roomShortName("Neuromancer")).toBe("Neuromancer");
  });

  it("counts places gained, and says new for an act from outside the top 50", () => {
    expect(
      markText(
        act(
          "Fort Street Ballroom fans move it up 7 places.",
          "Fort Street Ballroom",
        ),
      ),
    ).toBe("FSB +7");
    expect(markText(act("The Lantern Room fans move it into the top 8."))).toBe(
      "The Lantern Room new",
    );
  });

  it("reads out in words, with the room's full name", () => {
    expect(
      markLabel(
        act(
          "Fort Street Ballroom fans move it up 7 places.",
          "Fort Street Ballroom",
        ),
      ),
    ).toBe(
      "With Fort Street Ballroom's fans added: up 7 places in Qloo's ranking",
    );
    expect(
      markLabel(act("The Lantern Room fans move it into the top 8."), 50),
    ).toBe(
      "With The Lantern Room's fans added: new in Qloo's ranking, from outside the headliners-only top 50",
    );
    // A line the lift can't be read from still names the venue whose fans were added.
    expect(markLabel(act("Picked for its sound."))).toBe(
      "With The Lantern Room's fans added",
    );
  });

  // The poster stacks the act's rank over its climb, hidden from screen readers (WS8); its
  // words read the rank out first (Daniel, 2026-10-24).
  it("reads out the act's rank before its climb when the poster shows one", () => {
    expect(
      markLabel(
        act(
          "Fort Street Ballroom fans move it up 7 places.",
          "Fort Street Ballroom",
        ),
        50,
        "5th",
      ),
    ).toBe(
      "With Fort Street Ballroom's fans added: 5th in Qloo's ranking, up 7 places",
    );
    expect(
      markLabel(
        act("The Lantern Room fans move it into the top 8."),
        50,
        "8th",
      ),
    ).toBe(
      "With The Lantern Room's fans added: 8th in Qloo's ranking, new from outside the headliners-only top 50",
    );
  });
});

describe("the key beside the first mark", () => {
  const up = act("The Lantern Room fans move it up 11 places.");
  const fresh = act("The Lantern Room fans move it into the top 8.");

  it("explains the first mark in words, with the room's full name", () => {
    const key = markKey(up, { acts: [up], top: 50, city: "Boise" });
    expect(key.example).toBe("The Lantern Room +11");
    expect(key.lines[0]).toBe(
      "Qloo ranks artists for the headliners' fans; adding the crowd at The Lantern Room, a Boise venue, lifts this act 11 places.",
    );
  });

  it("explains new only when an act on the bill carries it", () => {
    expect(markKey(up, { acts: [up], top: 50 }).lines.join(" ")).not.toMatch(
      /new/,
    );
    expect(markKey(up, { acts: [up, fresh], top: 50 }).lines).toContain(
      "new: not in that top 50 until a venue's fans were added.",
    );
  });

  it("explains a new first mark, and the counts on the others", () => {
    const key = markKey(fresh, { acts: [fresh, up], top: 50 });
    expect(key.example).toBe("The Lantern Room new");
    expect(key.lines[0]).toMatch(
      /^Qloo ranks artists for the headliners' fans; adding the crowd at The Lantern Room, a local venue, brings this act in from outside the top 50\.$/,
    );
    expect(key.lines).toContain(
      "+ and a number: the places a venue's fans lift an act.",
    );
  });

  it("says what Qloo is, and nothing more", () => {
    expect(markKey(up, { acts: [up], top: 50 }).lines.at(-1)).toBe(
      "Qloo: data on what people like, across music, places and more.",
    );
  });

  it("leaves out the ranking's size when the build doesn't record it", () => {
    expect(markKey(up, { acts: [up, fresh] }).lines).toContain(
      "new: not in that ranking until a venue's fans were added.",
    );
  });
});
