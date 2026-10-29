// WS4, the buyer's shortlist, step 3: what each row says. The fee range in the Without Qloo
// cards' words (pickTag: inside the mid-size range, inside the opening range, above or below
// both), the genres shared with the headliners against the rule's two, and the venue whose fans
// lift the act most, by how many places. Invented names and numbers.
import { describe, expect, it } from "vitest";
import {
  climbWords,
  feeWords,
  genreWords,
  missingWords,
  SHORTLIST_LEAD,
  venueWords,
} from "@/components/shortlist/words";
import type { ShortlistAct, ShortlistVenue } from "@/lib/shortlist";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

type Found = Extract<ShortlistAct, { status: "found" }>;
const act = (over: Partial<Found>): Found => ({
  name: "Marigold Static",
  status: "found",
  entityId: "00000000-0000-4000-8000-000000000303",
  qlooName: "Marigold Static",
  popularity: 0.862,
  range: "in",
  band: "mid",
  genres: ["Dream Pop", "Indie Pop"],
  alone: 6,
  best: { venueId: "lantern", place: 1 },
  climb: 5,
  ...over,
});
const VENUES: ShortlistVenue[] = [
  {
    entityId: "lantern",
    name: "The Lantern Room",
    hue: 0,
    read: true,
    noFanData: false,
    lifts: 2,
  },
  {
    entityId: "fort",
    name: "Fort Street Ballroom",
    hue: 1,
    read: true,
    noFanData: false,
    lifts: 0,
  },
  {
    entityId: "cottonwood",
    name: "Cottonwood Social Hall",
    hue: null,
    read: true,
    noFanData: true,
    lifts: 0,
  },
  {
    entityId: "linden",
    name: "Linden Street Annex",
    hue: 2,
    read: false,
    noFanData: false,
    lifts: 0,
  },
];

describe("what a shortlist row says (WS4, step 3)", () => {
  it("opens on Daniel's sentence", () => {
    expect(SHORTLIST_LEAD).toBe(
      "Paste the acts you've been pitched; Undercard sorts them by how Qloo ranks them with this town's venue fans added to the headliners'. You make every call.",
    );
  });

  it("places its popularity against the two fee ranges", () => {
    const fee = (over: Partial<Found>) => feeWords(act(over), SAGEBRUSH_SOUND);
    expect(fee({})).toBe("Qloo popularity 86/100 · in the mid-size range");
    expect(fee({ popularity: 0.64, band: "opener" })).toBe(
      "Qloo popularity 64/100 · in the opening range",
    );
    expect(fee({ popularity: 0.963, range: "above", band: null })).toBe(
      "Qloo popularity 96/100 · above both ranges",
    );
    // Just over the top edge reads one past it, never as the edge itself.
    expect(fee({ popularity: 0.9204, range: "above", band: null })).toBe(
      "Qloo popularity 93/100 · above both ranges",
    );
    expect(fee({ popularity: 0.47, range: "below", band: null })).toBe(
      "Qloo popularity 47/100 · below both ranges",
    );
  });

  it("says whether it shares two genres with the headliners", () => {
    expect(genreWords(act({}))).toBe(
      "2 genres shared with the headliners: Dream Pop, Indie Pop",
    );
    expect(genreWords(act({ genres: ["Indie Pop"] }))).toBe(
      "Only 1 genre shared with the headliners: Indie Pop",
    );
    expect(genreWords(act({ genres: [] }))).toBe(
      "No genre shared with the headliners",
    );
  });

  it("names the venue whose fans lift it most, by how many places, or says none does", () => {
    expect(climbWords(act({}), VENUES)).toBe(
      "The Lantern Room's fans lift it 5 places, 6th to 1st",
    );
    expect(
      climbWords(
        act({ alone: 2, best: { venueId: "fort", place: 1 }, climb: 1 }),
        VENUES,
      ),
    ).toBe("Fort Street Ballroom's fans lift it 1 place, 2nd to 1st");
    expect(
      climbWords(
        act({ alone: 1, best: { venueId: "lantern", place: 2 }, climb: -1 }),
        VENUES,
      ),
    ).toBe("No venue's fans lift it: 1st for the headliners' fans alone");
    expect(
      climbWords(act({ alone: null, best: null, climb: null }), VENUES),
    ).toBe("Qloo gave it no place for the headliners' fans");
  });

  it("says why a name has no row of numbers", () => {
    expect(missingWords({ name: "Ghost Name", status: "not-found" })).toBe(
      "Not found on Qloo",
    );
    expect(missingWords({ name: "Night Orchard", status: "not-checked" })).toBe(
      "Not checked on Qloo",
    );
    expect(
      missingWords({
        name: "Khruangbin",
        status: "headliner",
        qlooName: "Khruangbin",
      }),
    ).toBe("One of your headliners, so not ranked");
  });

  it("says what each venue's fans did, and which venue Qloo had no fan data for", () => {
    // 14 calls: one ranking for the headliners alone, one per venue, one search per act.
    const check = { cap: 14, pasted: 10, venues: VENUES.length };
    expect(VENUES.map((venue) => venueWords(venue, check))).toEqual([
      "The Lantern Room's fans lift 2 of your acts",
      "Fort Street Ballroom's fans lift none of your acts",
      "Qloo had no fan data for Cottonwood Social Hall",
      "Linden Street Annex: not read. Undercard checks 9 acts per paste; paste the other one to check it.",
    ]);
  });

  // Daniel, 2026-10-24: a venue left unread says what the visitor can do next, never that calls
  // ran out.
  it("tells a visitor how many acts a paste checks, and to paste the rest", () => {
    const unread = VENUES[3];
    expect(venueWords(unread, { cap: 14, pasted: 10, venues: 6 })).toBe(
      "Linden Street Annex: not read. Undercard checks 7 acts per paste; paste the other 3 to check them.",
    );
    expect(venueWords(unread, { cap: 14, pasted: 10, venues: 6 })).not.toMatch(
      /ran out|call budget/,
    );
  });
});
