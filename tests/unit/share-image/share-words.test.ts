// WS10, step 1: the text the link preview draws, worked out from the saved build the page reads,
// in the page's own words. Invented acts and venues (tests/e2e/synthetic-build.ts); no Qloo data.
import { isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { billRows } from "@/components/chart/chart-rows";
import { signName } from "@/components/chart/town-scene";
import { shareImage } from "@/components/share/share-image";
import { drawable, shareCard } from "@/components/share/share-words";
import type { FirstBill } from "@/lib/first-bill";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { townBySlug } from "@/lib/towns";
import { venueHues } from "@/lib/venue-colours";
import { readFirstBill } from "@/server/first-bill";
import { syntheticSavedBuild } from "../../e2e/synthetic-build";

const NBSP = String.fromCharCode(0xa0);

const firstBill = async () =>
  (await readFirstBill(
    { latest: async () => syntheticSavedBuild() },
    SAGEBRUSH_SOUND.id,
  ))!;

/** Every text node of the element passed to ImageResponse, in drawing order. */
function drawnText(node: ReactNode): string[] {
  if (node === null || node === undefined || typeof node === "boolean")
    return [];
  if (typeof node === "string" || typeof node === "number")
    return [String(node)];
  if (Array.isArray(node)) return node.flatMap(drawnText);
  if (isValidElement<{ children?: ReactNode }>(node)) {
    if (typeof node.type === "function")
      return drawnText(
        (node.type as (props: unknown) => ReactNode)(node.props),
      );
    return drawnText(node.props.children);
  }
  return [];
}

describe("the link preview's text on a saved build", () => {
  it("is the poster's: the festival, its headliners, then the drafted acts in their venues' colours", async () => {
    expect(shareCard(SAGEBRUSH_SOUND, await firstBill())).toEqual({
      kind: "poster",
      wordmark: "Undercard",
      tagline: "An AI agent for festival bookers, built on Qloo",
      stamp: "Fictional festival · demo draft",
      festival: "Sagebrush Sound",
      facts: "Boise, Idaho · 3,000 capacity · crowd aged 25–34",
      booked: "Booked by you: two bands",
      headliners: ["Khruangbin", "Japanese Breakfast"],
      drafted: "Drafted by Undercard",
      from: "from what fans of Boise's music venues love",
      // Only the venues whose fans lifted an act, most acts first, each in its poster colour.
      venues: [
        { name: "The Lantern Room", hue: 0, acts: "7 acts" },
        { name: "Fort Street Ballroom", hue: 1, acts: "3 acts" },
      ],
      bands: [
        {
          id: "mid",
          name: "Mid-size acts",
          open: 0,
          acts: [
            { name: "The Ditch Riders", hue: 0, climb: "↑26" },
            { name: "Hollow Pines", hue: 0, climb: "↑11" },
            { name: "Kestrel & Bloom", hue: 0, climb: "↑9" },
            { name: "Marisol Vey", hue: 1, climb: "↑7" },
          ],
        },
        {
          id: "opener",
          name: "Opening acts",
          open: 0,
          acts: [
            { name: "Low Bench Choir", hue: 0, climb: "NEW" },
            { name: "Juniper Static", hue: 0, climb: "↑30" },
            { name: "Saltgrass", hue: 0, climb: "↑23" },
            { name: "Owyhee Drift", hue: 1, climb: "↑15" },
            { name: "Teddy Arcana", hue: 0, climb: "↑14" },
            { name: "Cass Wren", hue: 1, climb: "↑12" },
          ],
        },
      ],
    });
  });

  it("draws exactly those words, the names in capitals as the poster sets them", async () => {
    const card = shareCard(SAGEBRUSH_SOUND, await firstBill());
    expect(drawnText(shareImage(card))).toEqual([
      "UNDERCARD",
      "An AI agent for festival bookers, built on Qloo",
      "Fictional festival · demo draft",
      "SAGEBRUSH SOUND",
      // The facts wrap only after a "·": no-break spaces inside each part.
      `Boise,${NBSP}Idaho${NBSP}· 3,000${NBSP}capacity${NBSP}· crowd${NBSP}aged${NBSP}25–34`,
      "Booked by you: two bands",
      "KHRUANGBIN",
      "JAPANESE BREAKFAST",
      "Drafted by Undercard",
      "from what fans of Boise's music venues love",
      "THE LANTERN ROOM",
      "7 acts",
      "FORT STREET BALLROOM",
      "3 acts",
      "Mid-size acts",
      "THE DITCH RIDERS",
      "↑26",
      "HOLLOW PINES",
      "↑11",
      "KESTREL & BLOOM",
      "↑9",
      "MARISOL VEY",
      "↑7",
      "Opening acts",
      "LOW BENCH CHOIR",
      "NEW",
      "JUNIPER STATIC",
      "↑30",
      "SALTGRASS",
      "↑23",
      "OWYHEE DRIFT",
      "↑15",
      "TEDDY ARCANA",
      "↑14",
      "CASS WREN",
      "↑12",
    ]);
  });

  it("orders each band and colours each act as the poster does (chart-rows.ts, venue-colours.ts)", async () => {
    const bill = await firstBill();
    const card = shareCard(SAGEBRUSH_SOUND, bill);
    if (card.kind !== "poster") throw new Error("expected the poster");
    // The page's first paint: the venues the build read, band by band, then any act's own.
    const read = [
      ...new Map(
        [
          ...SAGEBRUSH_SOUND.feeBands.flatMap((band) => bill.anchors[band.id]!),
          ...bill.acts.map((act) => act.anchorVenue),
        ].map((venue) => [venue.entityId, venue]),
      ).values(),
    ];
    const hues = venueHues(read, bill.acts);
    for (const [index, band] of SAGEBRUSH_SOUND.feeBands.entries()) {
      const rows = billRows(
        band,
        bill.acts,
        bill.places!,
        hues,
        0,
        undefined,
        "climb",
      );
      expect(card.bands[index].acts).toEqual(
        rows.map((row) => ({
          name: row.name,
          hue: row.hue,
          climb: expect.any(String),
        })),
      );
    }
    for (const venue of card.venues)
      expect(read.map((entry) => signName(entry.name))).toContain(venue.name);
  });

  it("names the town's own venues in another town", async () => {
    const austin = townBySlug("austin")!.festival;
    const bill = await readFirstBill(
      { latest: async () => syntheticSavedBuild() },
      austin.id,
    );
    const card = shareCard(austin, bill);
    if (card.kind !== "poster") throw new Error("expected the poster");
    expect(card.festival).toBe("Sagebrush Sound");
    expect(card.facts).toBe(
      "Austin, Texas · 3,000 capacity · crowd aged 25–34",
    );
    expect(card.from).toBe("from what fans of Austin's music venues love");
  });

  it("draws an open slot where a band is short", async () => {
    const bill = await firstBill();
    const short: FirstBill = {
      ...bill,
      acts: bill.acts.filter((act) => act.name !== "Marisol Vey"),
    };
    const card = shareCard(SAGEBRUSH_SOUND, short);
    if (card.kind !== "poster") throw new Error("expected the poster");
    expect(card.bands[0].open).toBe(1);
    const text = drawnText(shareImage(card));
    expect(
      text.slice(text.indexOf("Mid-size acts"), text.indexOf("Opening acts")),
    ).toEqual([
      "Mid-size acts",
      "THE DITCH RIDERS",
      "↑26",
      "HOLLOW PINES",
      "↑11",
      "KESTREL & BLOOM",
      "↑9",
      "Open slot",
    ]);
    // Fort Street Ballroom's fans now lift two acts.
    expect(card.venues[1]).toEqual({
      name: "Fort Street Ballroom",
      hue: 1,
      acts: "2 acts",
    });
  });
});

describe("the link preview with no saved build", () => {
  it("is a plain card: the wordmark and what Undercard is", () => {
    const card = shareCard(SAGEBRUSH_SOUND, null);
    expect(card).toEqual({
      kind: "plain",
      wordmark: "Undercard",
      tagline:
        "An AI agent for festival bookers, built on Qloo, a taste-data service that maps what fans of one artist, venue or film also like.",
    });
    expect(drawnText(shareImage(card))).toEqual([
      "UNDERCARD",
      "An AI agent for festival bookers, built on Qloo, a taste-data service that maps what fans of one artist, venue or film also like.",
    ]);
  });
});

describe("what the image's font can draw", () => {
  it("keeps the Latin letters the font has and folds the accents it lacks", () => {
    expect(drawable("Björk & Sigur Rós")).toBe("Björk & Sigur Rós");
    expect(drawable("Łódź Øresund")).toBe("Łódź Øresund");
    expect(drawable("Ŏmar Ĭvo")).toBe("Omar Ivo");
  });

  it("leaves out what it can't draw, so no font is fetched for it", () => {
    expect(drawable("宇多田ヒカル Utada")).toBe("Utada");
    expect(drawable("Sun Ra 🎷 Arkestra")).toBe("Sun Ra Arkestra");
    const hyphen = String.fromCharCode(0x2010);
    expect(drawable(`Twenty${hyphen}One Pilots`)).toBe("Twenty-One Pilots");
    expect(drawable("ﬁne  print")).toBe("fine print");
  });
});
