// WS12 item 6: the printable poster. "Download the poster" sends the poster on screen to
// /api/poster, which draws it with next/og at print size. The server decides all it can: a demo
// festival's own name, facts and headliners, each band's name, and the stamp, "Fictional demo
// festival" on every demo festival. Invented acts and venues, no Qloo data.
import { describe, expect, it } from "vitest";
import { factsLine } from "@/components/chart/words";
import {
  PRINT_SIZE,
  printLayout,
  SHEET_INNER_H,
} from "@/components/share/print-image";
import {
  printPoster,
  type PrintPoster,
  type PrintRequest,
} from "@/components/share/print-words";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

type PrintAct = PrintRequest["bands"][number]["acts"][number];
const act = (
  name: string,
  hue: number | null,
  place: number | null,
  climb: PrintAct["climb"],
): PrintAct => ({ name, hue, place, climb });

const BOISE: PrintRequest = {
  festival: SAGEBRUSH_SOUND.id,
  venues: [
    { name: "Fort Street Ballroom", hue: 1, acts: 1 },
    { name: "The Lantern Room (downtown)", hue: 0, acts: 3 },
  ],
  bands: [
    {
      id: "mid",
      acts: [
        act("Hollow Pines", 0, 5, { kind: "up", places: 14 }),
        act("Ruby Ash", 1, 12, { kind: "new" }),
      ],
      open: 2,
    },
    {
      id: "opener",
      acts: [
        act("Sego Lily", 0, 3, { kind: "up", places: 9 }),
        act("Dry Creek", 0, null, null),
      ],
      open: 4,
    },
  ],
};

const OWN = {
  ...BOISE,
  festival: "yours-draft-3",
  brief: {
    city: "Burlington",
    region: "Vermont",
    headliners: ["Lake Static", "Grace Wire"] as [string, string],
  },
};

const poster = (request: unknown) => {
  const made = printPoster(request);
  expect(made).not.toBeNull();
  return made as PrintPoster;
};

describe("the printable poster's words (WS12 item 6)", () => {
  it("stamps the demo festival and takes its name, facts and headliners from the server", () => {
    const made = poster({
      ...BOISE,
      // Whatever else a request says, the demo festival's own words win.
      name: "Not Sagebrush",
      headliners: ["Someone Else"],
    });
    expect(made.stamp).toBe("Fictional demo festival");
    expect(made.festival).toBe(SAGEBRUSH_SOUND.name);
    expect(made.facts).toBe(factsLine(SAGEBRUSH_SOUND));
    expect(made.headliners).toEqual(SAGEBRUSH_SOUND.headliners);
    expect(made.from).toBe("from what fans of Boise's music venues like");
    expect(made.bands.map((band) => band.name)).toEqual([
      "Mid-size acts",
      "Opening acts",
    ]);
  });

  it("stamps the same brief in another town as a demo festival too", () => {
    const made = poster({ ...BOISE, festival: "sagebrush-sound-austin" });
    expect(made.stamp).toBe("Fictional demo festival");
    expect(made.from).toBe("from what fans of Austin's music venues like");
    expect(made.note).toContain(
      "the same headliners and slot sizes in every town",
    );
  });

  it("prints a judge's own festival as their draft, never as the demo", () => {
    const made = poster(OWN);
    expect(made.stamp).toBe("Draft");
    expect(made.festival).toBe("Your festival");
    expect(made.headliners).toEqual(["Lake Static", "Grace Wire"]);
    expect(made.facts).toMatch(/^Burlington, Vermont · 3,000 capacity/);
    expect(JSON.stringify(made)).not.toMatch(/fictional/i);
  });

  it("refuses a poster it can't vouch for", () => {
    const refused: unknown[] = [
      { ...BOISE, festival: "somewhere-else" },
      // A judge's own festival needs its brief, and the brief its own festival's id.
      { ...BOISE, festival: "yours-draft-3" },
      { ...OWN, festival: "yours-3" },
      // The festival's own bands, in its order.
      { ...BOISE, bands: [...BOISE.bands].reverse() },
      { ...BOISE, bands: BOISE.bands.slice(0, 1) },
      // No more acts and open slots than the band has slots.
      {
        ...BOISE,
        bands: [{ ...BOISE.bands[0], open: 3 }, BOISE.bands[1]],
      },
      // Colours are the six venue colours; names are names.
      {
        ...BOISE,
        venues: [{ name: "Fort Street Ballroom", hue: 6, acts: 1 }],
      },
      {
        ...BOISE,
        bands: [
          {
            ...BOISE.bands[0],
            acts: [act("x".repeat(201), 0, 5, null)],
          },
          BOISE.bands[1],
        ],
      },
      "not a poster",
      null,
    ];
    for (const request of refused) expect(printPoster(request)).toBeNull();
  });

  it("marks each act as the poster does: its place over its climb", () => {
    const [mid, opener] = poster(BOISE).bands;
    expect(mid.acts.map((a) => a.climb)).toEqual(["5th ↑14", "12th NEW"]);
    expect(opener.acts.map((a) => a.climb)).toEqual(["3rd ↑9", null]);
    expect(mid.acts.map((a) => a.hue)).toEqual([0, 1]);
    expect([mid.open, opener.open]).toEqual([2, 4]);
  });

  it("draws only what next/og's own font has, so it never fetches a font", () => {
    const made = poster({
      ...BOISE,
      bands: [
        {
          ...BOISE.bands[0],
          acts: [act("Ŏzz \u{1F3B8} Band", 0, 5, null), BOISE.bands[0].acts[1]],
        },
        BOISE.bands[1],
      ],
    });
    expect(made.bands[0].acts[0].name).toBe("Ozz Band");
  });

  it("clips a name too long for a poster line", () => {
    const name = `${"Long Name ".repeat(7)}`.trim();
    const made = poster({
      ...BOISE,
      bands: [
        { ...BOISE.bands[0], acts: [act(name, 0, 5, null)], open: 3 },
        BOISE.bands[1],
      ],
    });
    expect(made.bands[0].acts[0].name).toBe(`${name.slice(0, 59).trim()}…`);
  });

  it("keys the venues whose fans lifted a printed act, strongest first, as the town's signs say it", () => {
    expect(poster(BOISE).venues).toEqual([
      { name: "The Lantern Room", hue: 0, acts: "3 acts" },
      { name: "Fort Street Ballroom", hue: 1, acts: "1 act" },
    ]);
  });

  it("keys NEW when an act is new to the top 50", () => {
    expect(poster(BOISE).note).toContain("NEW = rose into Qloo's top 50");
  });

  it("names the file for what it is", () => {
    expect(poster(BOISE).file).toBe(
      "sagebrush-sound-fictional-demo-festival-poster.png",
    );
    expect(poster(OWN).file).toBe("yours-draft-3-poster.png");
  });
});

describe("the printable poster's layout", () => {
  it("is print-sized: portrait, 3 by 4, 1800 px wide", () => {
    expect(PRINT_SIZE).toEqual({ width: 1800, height: 2400 });
  });

  it("fits the demo's poster on its sheet", () => {
    const layout = printLayout(poster(BOISE));
    expect(layout.height).toBeLessThanOrEqual(SHEET_INNER_H);
  });

  it("fits the longest names a request can hold, every slot filled", () => {
    // Names at the longest a poster line prints them (60 letters; a headliner of a judge's own
    // festival, 80), in words of wide capitals.
    const long = (n: number, length = 60) =>
      `${n} ${"Wxyz ".repeat(20)}`.slice(0, length).trim();
    const full = poster({
      ...OWN,
      brief: { ...OWN.brief, headliners: [long(1, 80), long(2, 80)] },
      venues: Array.from({ length: 12 }, (_, n) => ({
        name: long(n),
        hue: n % 6,
        acts: 1,
      })),
      bands: SAGEBRUSH_SOUND.feeBands.map((band) => ({
        id: band.id,
        acts: Array.from({ length: band.slots }, (_, n) =>
          act(long(n), n % 6, 50, { kind: "up", places: 49 }),
        ),
        open: 0,
      })),
    });
    const layout = printLayout(full);
    expect(layout.height).toBeLessThanOrEqual(SHEET_INNER_H);
    // Nothing shrinks out of reading distance on a print.
    expect(Math.min(...layout.bands)).toBeGreaterThanOrEqual(24);
  });
});
