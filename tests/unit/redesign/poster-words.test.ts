// WS9, step 2: the first screen's derived words, each from the saved build, the venue switch or
// prompt 4's checks. Invented acts, venues and picks (tests/fixtures/lineup.synthetic.json).
import { describe, expect, it } from "vitest";
import {
  bandRange,
  bookedLabel,
  climbMark,
  exampleAct,
  footnote,
  inkLabel,
  leadLine,
  legendLine,
  MISSED_CUT,
  listNames,
  modelPicksTitle,
  oneActLine,
  openBandLine,
  openPosterLine,
  pickTag,
  regionCode,
  rulerTitle,
  signChip,
  stampWords,
  venueLine,
  watchSubLine,
  withoutCounts,
  withoutHeadline,
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
    expect(venueLine("The Lantern Room", 7, true)).toBe(
      "The Lantern Room's fans are off, so its acts left your poster.",
    );
  });

  it("says why a band's slots stay open, and every slot", () => {
    const [mid, opener] = SAGEBRUSH_SOUND.feeBands;
    expect(
      openBandLine({ band: opener, slots: 6, on: ["Cottonwood Social Hall"] }),
    ).toEqual({
      head: "The 6 opening slots stay open.",
      text: "No venue whose fans are on lifts an opening act 5 places.",
    });
    expect(openBandLine({ band: mid, slots: 4, on: [] }).text).toBe(
      "Every venue's fans are off, so no act rises 5 places.",
    );
    expect(
      openPosterLine({ slots: 10, on: ["Cottonwood Social Hall"] }),
    ).toEqual({
      head: "All 10 slots stay open.",
      text: "Only Cottonwood Social Hall's fans are on, and they lift no act 5 places.",
    });
  });

  it("lists names the way a sentence does", () => {
    expect(listNames([])).toBe("");
    expect(listNames(["A"])).toBe("A");
    expect(listNames(["A", "B"])).toBe("A and B");
    expect(listNames(["A", "B", "C"])).toBe("A, B and C");
  });

  it("says over the demo's headliners that they're two bands, and only over the demo's", () => {
    expect(bookedLabel(SAGEBRUSH_SOUND)).toBe("Booked by you: two bands");
    expect(
      bookedLabel({ headliners: ["Mitski", "Khruangbin"] }),
    ).toBe("Booked by you");
  });

  it("stamps the demo's festival as fictional and a judge's own as a draft, shorter on a phone", () => {
    expect(stampWords(false)).toBe("Fictional festival · demo draft");
    expect(stampWords(true)).toBe("Draft, not announced");
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

  it("says what Watch replays, with the build's own call count", () => {
    expect(watchSubLine({ city: "Boise", calls: 12, live: false })).toBe(
      "Replays how the agent drafted Boise, in its 12 Qloo calls",
    );
    expect(watchSubLine({ city: "Boise", calls: null, live: false })).toBe(
      "Replays how the agent drafted Boise",
    );
    expect(watchSubLine({ city: "Boise", calls: null, live: true })).toBe(
      "Runs the AI agent; its Qloo calls list below",
    );
    // Once a live run replaced the saved build on screen, Watch still replays the saved one.
    expect(
      watchSubLine({ city: "Boise", calls: 12, live: false, onScreen: false }),
    ).toBe("Replays the saved build's Qloo calls");
  });
});

describe("the lead and the town", () => {
  it("leads with what Undercard does in the town on screen", () => {
    expect(leadLine({ city: "Austin" }, false)).toEqual({
      mark: "Undercard drafts the rest",
      rest: "from what fans of Austin's music venues like.",
    });
  });

  it("says Without Qloo picks bigger names only when most found picks sit above the ranges", () => {
    const most = { ...counted(), found: 8, above: 6 };
    expect(leadLine({ city: "Boise" }, true, most)).toEqual({
      mark: "Without Qloo, an AI picks bigger names",
      rest: "and it can't see Boise's venues.",
    });
    expect(leadLine({ city: "Boise" }, true, { ...most, above: 4 }).mark).toBe(
      "Without Qloo, an AI picks from what it already knows",
    );
    expect(leadLine({ city: "Boise" }, true, null).mark).toBe(
      "Without Qloo, an AI picks from what it already knows",
    );
  });

  it("explains the coloured and grey venues, with the places Qloo listed", () => {
    expect(
      legendLine({ city: "Boise", placesListed: 8, tested: 3, lifting: 2 }),
    ).toEqual({
      title: "Venues the agent tested",
      text: "Qloo found 8 live-music venues in Boise; the AI agent tested these 3. Coloured: their fans lifted acts onto your poster. Grey: none did.",
    });
    expect(
      legendLine({ city: "Boise", placesListed: null, tested: 2, lifting: 2 })
        .text,
    ).toBe(
      "The AI agent chose these venues to test. Coloured: their fans lifted acts onto your poster.",
    );
    expect(
      legendLine({ city: "Boise", placesListed: 8, tested: 0, lifting: 0 })
        .title,
    ).toBe("No venues read yet");
    expect(
      legendLine({
        city: "Boise",
        placesListed: 8,
        tested: 3,
        lifting: 2,
        without: true,
      }),
    ).toEqual({
      title: "No venues read",
      text: "Without Qloo, the model has no venue's fans to read: its picks come from what it already knows.",
    });
  });

  it("signs each venue with its acts on the poster, or why it has none", () => {
    expect(signChip({ lifted: 7 })).toBe("7 acts");
    expect(signChip({ lifted: 1 })).toBe("1 act");
    expect(signChip({ lifted: 0 })).toBe("none");
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

  it("heads the poster with the picks too big for these slots, and only then", () => {
    expect(withoutHeadline(counted())).toBe(
      "By Qloo popularity, 2 of its 7 picks are too big for these slots",
    );
    expect(withoutHeadline({ ...counted(), above: 1 })).toBe(
      "By Qloo popularity, 1 of its 7 picks is too big for these slots",
    );
    expect(withoutHeadline({ ...counted(), above: 0 })).toBeNull();
  });

  it("says the model can't see the town's venues", () => {
    expect(withoutNote({ city: "Boise" }, counted())).toEqual({
      title: "Without Qloo, the model can't see Boise's venues.",
      text: "Same model as the agent (Claude Sonnet 5.5), same brief, no Qloo: it picks without reading any venue's fans, and by Qloo popularity 2 of its 7 picks are too big for these slots.",
    });
    expect(withoutNote({ city: "Boise" }, null).text).toBe(
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
