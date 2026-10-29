// WS9, step 2: the first screen's derived words, each from the saved build, the venue switch or
// prompt 4's checks. Invented acts, venues and picks (tests/fixtures/lineup.synthetic.json).
import { describe, expect, it } from "vitest";
import {
  bandRange,
  cardBand,
  CARD_CHECKS,
  cardClimbRule,
  cardGenresLine,
  cardPopularityLine,
  CARD_STRONGEST,
  climbMark,
  exampleAct,
  footnote,
  inkLabel,
  leadLine,
  legendLine,
  MISSED_CUT,
  listNames,
  modelPicksTitle,
  NOTE_WORDS,
  oneActLine,
  openBandLine,
  venueReadLine,
  openPosterLine,
  pickTag,
  regionCode,
  rulerTitle,
  signChip,
  stampWords,
  venueLine,
  watchSubLine,
  withoutCounts,
  withoutNote,
  withoutSummary,
} from "@/components/chart/poster-words";
import type { PickCheck } from "@/lib/llm-only";
import { billPlaces } from "@/lib/places";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { TOWNS } from "@/lib/towns";
import { syntheticSavedBuild } from "../../e2e/synthetic-build";
import { acts } from "../m4b/first-bill-fixture";

const saved = syntheticSavedBuild();
const places = billPlaces(acts, saved.context.baselines);
const byName = (name: string) => acts.find((act) => act.name === name)!;

describe("the one-act sentence", () => {
  it("says where an act climbed from and to, once its venue's fans joined", () => {
    const act = byName("Hollow Pines");
    const place = places[act.entityId];
    expect(place.was! - place.now).toBe(11);
    expect(oneActLine(act, place)).toBe(
      `Hollow Pines climbed from ${ordinalOf(place.was!)} to ${ordinalOf(place.now)} in Qloo's ranking once The Lantern Room's fans joined the headliners' fans.`,
    );
  });

  it("says where an act from outside the top 50 entered it", () => {
    const act = byName("Low Bench Choir");
    expect(oneActLine(act, places[act.entityId])).toBe(
      "Low Bench Choir entered Qloo's top 50 at 8th once The Lantern Room's fans joined the headliners' fans.",
    );
    // Without its places the build's reason still gives where it entered.
    expect(oneActLine(act, undefined)).toBe(
      "Low Bench Choir entered Qloo's top 50 at 8th once The Lantern Room's fans joined the headliners' fans.",
    );
  });

  it("says nothing where the build can't tell the places", () => {
    expect(oneActLine(byName("Hollow Pines"), undefined)).toBeNull();
    expect(
      oneActLine({ ...byName("Hollow Pines"), reason: "Picked." }, undefined),
    ).toBeNull();
  });

  it("follows the first act on the poster whose places the build can tell", () => {
    const printed = [byName("The Ditch Riders"), byName("Hollow Pines")];
    expect(exampleAct(printed, places)?.name).toBe("The Ditch Riders");
    expect(exampleAct(printed, {})).toBeNull();
    expect(
      exampleAct([byName("Hollow Pines"), byName("Low Bench Choir")], {}),
    )?.toMatchObject({ name: "Low Bench Choir" });
  });
});

const ordinalOf = (n: number) =>
  `${n}${[11, 12, 13].includes(n % 100) ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;

// The act card's words (the layout brief's card): its slot, then the three checks it passed.
describe("the act card", () => {
  const [mid, opener] = SAGEBRUSH_SOUND.feeBands;

  it("names the act's slot, and heads the three checks it passed", () => {
    expect(cardBand(mid)).toBe("Mid-size act");
    expect(cardBand(opener)).toBe("Opening act");
    expect(CARD_CHECKS).toBe("Why it's on your poster");
  });

  it("says the rule each check holds the act to, from the rule's own numbers", () => {
    expect(cardClimbRule()).toBe(
      "Undercard only books a climb of 5 places or more.",
    );
    expect(cardPopularityLine(mid)).toBe(
      "Its Qloo popularity is inside the mid-size range, 80–92 out of 100, our stand-in for fee.",
    );
    expect(cardPopularityLine(opener)).toBe(
      "Its Qloo popularity is inside the opening range, 55–80 out of 100, our stand-in for fee.",
    );
    expect(cardPopularityLine(undefined)).toBe(
      "Its Qloo popularity stands in for its fee.",
    );
    expect(cardGenresLine(2)).toBe("It shares two genres with the headliners:");
    expect(CARD_STRONGEST).toBe(
      "Of the acts that pass all three, the strongest Qloo match fills each slot first.",
    );
  });
});

describe("the poster's marks and lines", () => {
  it("marks a climb with its places, and a new entry as NEW", () => {
    expect(climbMark(byName("Hollow Pines"))).toBe("↑11");
    expect(climbMark(byName("Low Bench Choir"))).toBe("NEW");
    expect(climbMark({ reason: "Picked." })).toBeNull();
  });

  it("gives each band its Qloo popularity range, the first saying it stands in for fee", () => {
    const [mid, opener] = SAGEBRUSH_SOUND.feeBands;
    expect(bandRange(mid, true)).toBe(
      "Qloo popularity 80–92, our stand-in for fee",
    );
    expect(bandRange(opener, false)).toBe("Qloo popularity 55–80");
  });

  it("reads each venue's switch out with what pressing it does", () => {
    expect(inkLabel("The Lantern Room", true, 7)).toBe(
      "The Lantern Room's fans: on, 7 acts. Switch them off",
    );
    expect(inkLabel("Fort Street Ballroom", true, 1)).toBe(
      "Fort Street Ballroom's fans: on, 1 act. Switch them off",
    );
    expect(inkLabel("Fort Street Ballroom", false, 0)).toBe(
      "Fort Street Ballroom's fans: off. Switch them on",
    );
  });

  it("says what a selected venue's fans did", () => {
    expect(venueLine("The Lantern Room", 7, false)).toBe(
      "The Lantern Room's fans lifted 7 acts onto your poster. Pick one for why.",
    );
    expect(venueLine("Cottonwood Social Hall", 0, false)).toBe(
      "Cottonwood Social Hall's fans lifted no act onto your poster.",
    );
    // WS8: a venue Qloo had no fan data for.
    expect(venueLine("Cottonwood Social Hall", 0, false, true)).toBe(
      "Qloo had no fan data for Cottonwood Social Hall, so it lifted no act onto your poster.",
    );
    // WS8: what the agent read each venue for, never the count it chose from.
    expect(venueReadLine(["mid-size acts"], false)).toBe(
      "The AI agent read its fans for mid-size acts.",
    );
    expect(venueReadLine(["mid-size acts", "opening acts"], false)).toBe(
      "The AI agent read its fans for both slot sizes.",
    );
    expect(venueReadLine(["mid-size acts"], true)).toBe(
      "The AI agent tried it for mid-size acts.",
    );
    expect(venueLine("The Lantern Room", 7, true)).toBe(
      "The Lantern Room's fans are off, so its acts left your poster.",
    );
  });

  // WS8 (the brief's item 12): what the draft read for those slots, which of those venues Qloo
  // had no fan data for, and which venues are off; never a climb the screen can't show.
  it("says why a band's slots stay open: the venues read, the ones without fan data, the ones off", () => {
    const [mid, opener] = SAGEBRUSH_SOUND.feeBands;
    // One venue off.
    expect(
      openBandLine({
        band: opener,
        slots: 6,
        read: ["Venue 418", "Venue 166"],
        noFanData: ["Venue 166"],
        off: ["V418"],
      }),
    ).toEqual({
      head: "The 6 opening slots stay open.",
      text: "For opening acts this draft read Venue 418's and Venue 166's fans, and Qloo had no fan data for Venue 166. With V418 off, no act passes the rule for these slots.",
      fix: "Switch V418 back on",
    });
    // Two off.
    expect(
      openBandLine({
        band: opener,
        slots: 6,
        read: ["Venue 418", "Venue 166"],
        noFanData: ["Venue 166"],
        off: ["V418", "Venue 227"],
      }),
    ).toEqual({
      head: "The 6 opening slots stay open.",
      text: "For opening acts this draft read Venue 418's and Venue 166's fans, and Qloo had no fan data for Venue 166. With V418 and Venue 227 off, no act passes the rule for these slots.",
      fix: "Switch the venues back on",
    });
    // A band read by one venue, which had fan data: the clause drops.
    expect(
      openBandLine({
        band: mid,
        slots: 4,
        read: ["The Lantern Room"],
        noFanData: [],
        off: ["The Lantern Room"],
      }),
    ).toEqual({
      head: "The 4 mid-size slots stay open.",
      text: "For mid-size acts this draft read The Lantern Room's fans. With The Lantern Room off, no act passes the rule for these slots.",
      fix: "Switch The Lantern Room back on",
    });
    // Three read, none without fan data.
    expect(
      openBandLine({
        band: mid,
        slots: 4,
        read: ["A Hall", "B Room", "C Club"],
        noFanData: [],
        off: ["A Hall", "B Room", "C Club"],
      }).text,
    ).toBe(
      "For mid-size acts this draft read A Hall's, B Room's and C Club's fans. With A Hall, B Room and C Club off, no act passes the rule for these slots.",
    );
  });

  it("says why every slot stays open", () => {
    expect(
      openPosterLine({ slots: 10, on: ["Cottonwood Social Hall"] }),
    ).toEqual({
      head: "All 10 slots stay open.",
      text: "Only Cottonwood Social Hall's fans are on, and no act passes the rule.",
    });
  });

  it("lists names the way a sentence does", () => {
    expect(listNames([])).toBe("");
    expect(listNames(["A"])).toBe("A");
    expect(listNames(["A", "B"])).toBe("A and B");
    expect(listNames(["A", "B", "C"])).toBe("A, B and C");
  });

  it("stamps the demo's festival as fictional and a judge's own as a draft, shorter on a phone", () => {
    expect(stampWords(false)).toBe("Fictional festival · demo draft");
    // A judge's own festival: "Draft" (Daniel's WS9 brief, item 6; confirmed 2026-10-24).
    expect(stampWords(true)).toBe("Draft");
    expect(stampWords(false, true)).toBe("Fictional demo");
    expect(stampWords(true, true)).toBe("Draft");
  });

  it("says why an act the re-formed poster books missed the cut with every venue on", () => {
    expect(MISSED_CUT).toBe(
      "With every venue on, it missed the cut: the strongest Qloo match fills each slot first.",
    );
  });

  it("ends the poster with what the festival is and what NEW means, where an act is new", () => {
    expect(footnote(SAGEBRUSH_SOUND, true)).toBe(
      "Fictional demo festival · NEW = rose into Qloo's top 50",
    );
    // A town's page names its own town only (M6d).
    expect(footnote(TOWNS[1].festival, false)).toBe(
      "Fictional demo festival: the same headliners and slot sizes in every town",
    );
    expect(footnote({ id: "yours-draft-1" }, true)).toBe(
      "NEW = rose into Qloo's top 50",
    );
  });

  // One line on a phone too, as the layout brief has it; the calls are counted on the poster.
  it("says what Watch replays", () => {
    expect(watchSubLine({ city: "Boise", live: false })).toBe(
      "Replays how the agent drafted Boise",
    );
    expect(watchSubLine({ city: "Boise", live: true })).toBe(
      "Runs the AI agent; its Qloo calls list below",
    );
    // Once a live run replaced the saved build on screen, Watch still replays the saved one.
    expect(watchSubLine({ city: "Boise", live: false, onScreen: false })).toBe(
      "Replays the saved build's Qloo calls",
    );
  });
});

describe("the lead and the town", () => {
  it("leads with what Undercard does in the town on screen", () => {
    expect(leadLine({ city: "Austin" }, false)).toEqual({
      mark: "Undercard drafts the rest",
      rest: "from what fans of Austin's music venues like.",
    });
  });

  // WS8: the headline never grades the model on a number it never saw.
  it("says Without Qloo the AI picks without seeing the town's venues", () => {
    expect(leadLine({ city: "Boise" }, true)).toEqual({
      mark: "Without Qloo, an AI picks",
      rest: "without seeing Boise's venues.",
    });
  });

  // WS18 item 2 (Daniel, 29 Oct): the lines from "Qloo listed 8 live-music places" to "Grey: none
  // of their acts are on your poster" became one sentence of at most 25 words, built from the
  // build on screen. The colour key stays on the poster.
  it("says in one sentence what each venue's fans put on the bill", () => {
    expect(
      legendLine({
        city: "Boise",
        venues: [
          { name: "Venue 227", lifted: 8 },
          { name: "Venue 418 (V418)", lifted: 2 },
          { name: "Venue 166 Boise", lifted: 0, noFanData: true },
        ],
      }),
    ).toEqual({
      title: "Venues the agent tested",
      text: "Venue 227's fans lifted 8 acts onto this bill and Venue 418's 2; Qloo had no fan data for Venue 166 Boise.",
    });
    // The strongest venue first, whatever the order given; a venue whose fans lifted no act on
    // the bill says none.
    expect(
      legendLine({
        city: "Larkspur",
        venues: [
          { name: "Fort Street Ballroom (FSB)", lifted: 1 },
          { name: "The Lantern Room", lifted: 9 },
          { name: "Cottonwood Social Hall", lifted: 0 },
        ],
      }).text,
    ).toBe(
      "The Lantern Room's fans lifted 9 acts onto this bill, Fort Street Ballroom's 1 and Cottonwood Social Hall's none.",
    );
    // One act; a name that already ends in 's keeps it.
    expect(
      legendLine({
        city: "Larkspur",
        venues: [{ name: "Juniper's", lifted: 1 }],
      }).text,
    ).toBe("Juniper's fans lifted 1 act onto this bill.");
    // A venue switched off on the poster's key says so.
    expect(
      legendLine({
        city: "Larkspur",
        venues: [
          { name: "The Lantern Room", lifted: 0, off: true },
          { name: "Fort Street Ballroom", lifted: 6 },
        ],
      }).text,
    ).toBe(
      "Fort Street Ballroom's fans lifted 6 acts onto this bill; The Lantern Room's fans are switched off.",
    );
    expect(legendLine({ city: "Boise", venues: [] }).title).toBe(
      "No venues read yet",
    );
    expect(
      legendLine({
        city: "Boise",
        venues: [{ name: "Venue 227", lifted: 8 }],
        without: true,
      }),
    ).toEqual({
      title: "No venues read",
      text: "Without Qloo, the model has no venue's fans to read: its picks come from what it already knows.",
    });
  });

  it("keeps the sentence to 25 words however long the town's names run", () => {
    const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
    // Long names drop "onto this bill" first, and keep every name and number.
    const long = legendLine({
      city: "Larkspur",
      venues: [
        { name: "The Old Juniper Mill Music Hall", lifted: 7 },
        { name: "Larkspur Community Arts Hall", lifted: 3 },
        { name: "The Copper Kettle", lifted: 0, noFanData: true },
      ],
    }).text;
    expect(long).toBe(
      "The Old Juniper Mill Music Hall's fans lifted 7 acts and Larkspur Community Arts Hall's 3; Qloo had no fan data for The Copper Kettle.",
    );
    expect(words(long)).toBe(NOTE_WORDS);
    // Longer still, the venues Qloo had no fan data for are counted, not named.
    expect(
      legendLine({
        city: "Larkspur",
        venues: [
          { name: "The Old Juniper Mill Music Hall", lifted: 8 },
          { name: "Larkspur Community Arts Hall", lifted: 2 },
          { name: "The Copper Kettle Social Club", lifted: 0, noFanData: true },
          { name: "Larkspur Legion Hall", lifted: 0, noFanData: true },
        ],
      }).text,
    ).toBe(
      "The Old Juniper Mill Music Hall's fans lifted 8 acts and Larkspur Community Arts Hall's 2; Qloo had no fan data for 2 more.",
    );
    // However many venues and however long their names, never more than 25 words.
    for (const count of [1, 2, 3, 5, 8])
      expect(
        words(
          legendLine({
            city: "Larkspur",
            venues: Array.from({ length: count }, (_, index) => ({
              name: `The Very Long Named Music Hall and Social Club Number ${index + 1}`,
              lifted: index < 3 ? 4 - index : 0,
              noFanData: index >= 3 && index % 2 === 1,
              off: index === 4,
            })),
          }).text,
        ),
      ).toBeLessThanOrEqual(NOTE_WORDS);
  });

  it("signs each venue with its acts on the poster, or why it has none", () => {
    expect(signChip({ lifted: 7 })).toBe("7 acts");
    expect(signChip({ lifted: 1 })).toBe("1 act");
    expect(signChip({ lifted: 0 })).toBe("none");
    // WS8: a venue Qloo had no fan data for says so.
    expect(signChip({ lifted: 0, noFanData: true })).toBe("no fan data");
    expect(signChip({ lifted: 3, off: true })).toBe("Fans off");
    expect(signChip({ lifted: 3, unread: true })).toBe("not read yet");
  });

  it("gives a US town's chip its state's postal code, and none elsewhere", () => {
    expect(TOWNS.map((town) => regionCode(town.festival.region))).toEqual([
      "ID",
      "TX",
      "CO",
      "TN",
    ]);
    expect(regionCode("Iceland")).toBeNull();
  });
});

// Invented picks and checks, in prompt 4's shape (src/lib/llm-only.ts).
const PICKS = [
  "Velvet Coyote",
  "The Long Drives",
  "Marigold Static",
  "Paper Canyon",
  "Silver Mesa",
  "Fern & Fable",
  "Night Orchard",
].map((name) => ({ name }));
const CHECKS: PickCheck[] = [
  {
    name: "Velvet Coyote",
    status: "found",
    popularity: 0.963,
    range: "above",
    genres: 2,
    climb: null,
  },
  {
    name: "The Long Drives",
    status: "found",
    popularity: 0.921,
    range: "above",
    genres: 1,
    climb: null,
  },
  {
    name: "Marigold Static",
    status: "found",
    popularity: 0.862,
    range: "in",
    genres: 2,
    climb: 12,
  },
  {
    name: "Paper Canyon",
    status: "found",
    popularity: 0.64,
    range: "in",
    genres: 0,
    climb: null,
  },
  {
    name: "Silver Mesa",
    status: "found",
    popularity: 0.47,
    range: "below",
    genres: 1,
    climb: null,
  },
  { name: "Fern & Fable", status: "not-found" },
  { name: "Night Orchard", status: "not-checked" },
];
const counted = () => withoutCounts(PICKS, CHECKS, SAGEBRUSH_SOUND);

describe("Without Qloo: the model's picks, checked on Qloo afterwards", () => {
  it("tags each pick with where Qloo's popularity puts it, or why it can't", () => {
    expect(CHECKS.map((check) => pickTag(check, SAGEBRUSH_SOUND))).toEqual([
      "96th · above both ranges",
      // Just over the top edge reads one past it, never as the edge itself.
      "93rd · above both ranges",
      "86th · in the mid-size range",
      "64th · in the opening range",
      "47th · below both ranges",
      "not on Qloo",
      "not checked on Qloo",
    ]);
    expect(pickTag(undefined, SAGEBRUSH_SOUND)).toBe("not checked on Qloo");
  });

  it("counts the checks, with the picks that climb by name", () => {
    expect(counted()).toEqual({
      picks: 7,
      found: 5,
      above: 2,
      below: 1,
      inRange: { mid: 1, opener: 1 },
      notFound: 1,
      notChecked: 1,
      climbers: ["Marigold Static"],
    });
  });

  // Daniel, 2026-10-24: like the headline (item 10), the note never grades the model on Qloo's
  // popularity, a number it never saw.
  it("says the model can't see the town's venues, and grades none of its picks", () => {
    expect(withoutNote({ city: "Boise" })).toEqual({
      title: "Without Qloo, the model can't see Boise's venues.",
      text: "Same model as the agent (Claude Sonnet 5.5), same brief, no Qloo: it picks without reading any venue's fans.",
    });
    expect(withoutNote({ city: "Boise" }).text).toBe(
      "Same model as the agent (Claude Sonnet 5.5), same brief, no Qloo: it picks without reading any venue's fans.",
    );
  });

  it("sums the checks up, naming any pick that climbs and never saying none does", () => {
    expect(withoutSummary(SAGEBRUSH_SOUND, counted())).toBe(
      "Checked on Qloo afterwards: 1 fits the mid-size range, 1 fits the opening range, 1 sits below both ranges and 1 name had no Qloo match; 1 of the 7 climbs with a Boise venue's fans: Marigold Static.",
    );
    const none = { ...counted(), climbers: [] };
    expect(withoutSummary(SAGEBRUSH_SOUND, none)).not.toMatch(/climb/);
    expect(
      withoutSummary(
        SAGEBRUSH_SOUND,
        withoutCounts(PICKS, [], SAGEBRUSH_SOUND),
      ),
    ).toBeNull();
  });

  it("titles the list with the model's own count, in one list with no slots", () => {
    expect(modelPicksTitle(10)).toBe("The model's 10 picks");
    expect(modelPicksTitle(1)).toBe("The model's 1 pick");
  });

  it("says over the ruler how many names it can't place", () => {
    expect(rulerTitle(counted())).toBe(
      "Qloo popularity, our stand-in for fee: where the model's picks sit (2 names not placed on Qloo)",
    );
    expect(rulerTitle({ ...counted(), notFound: 0, notChecked: 0 })).toBe(
      "Qloo popularity, our stand-in for fee: where the model's picks sit",
    );
  });
});
