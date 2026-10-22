// WS7 part (a), step 3: the act card's line on Qloo's split, in words. Invented names and shares.
// The line reports the split as Qloo gives it and never says Qloo confirms the credited venue.
import { describe, expect, it } from "vitest";
import { attributionLine, type SplitPart } from "@/lib/attribution-line";

const headliner = (name: string, share: number): SplitPart => ({
  input: "headliner",
  entityId: `h-${name}`,
  name,
  share,
});
const venue = (name: string, share: number): SplitPart => ({
  input: "venue",
  entityId: `v-${name}`,
  name,
  share,
});

const LEAD = "With all of this fee range's venues together, Qloo traces";

describe("the line on Qloo's split (WS7 step 3)", () => {
  it("puts the headliners together and lists the split in descending order, in whole percents", () => {
    expect(
      attributionLine([
        venue("The Lantern Room", 0.21),
        headliner("Hollow Pines", 0.27),
        venue("Fort Street Ballroom", 0.31),
        headliner("The Quiet Ones", 0.21),
      ]),
    ).toBe(
      `${LEAD} 48% of this act's match to fans of the headliners, 31% to fans of Fort Street Ballroom and 21% to fans of The Lantern Room.`,
    );
  });

  it("names a headliner when it's the only one with a share, and lets a venue lead", () => {
    expect(
      attributionLine([
        headliner("Hollow Pines", 0.353),
        venue("Fort Street Ballroom", 0.404),
        venue("The Lantern Room", 0.243),
      ]),
    ).toBe(
      `${LEAD} 40% of this act's match to fans of Fort Street Ballroom, 35% to fans of Hollow Pines and 24% to fans of The Lantern Room.`,
    );
  });

  it("rounds each part to the nearest whole percent, halves up, and doesn't force the parts to 100", () => {
    // 0.285 × 100 is 28.4999… in floating point; it still reads 29%. 57 + 29 + 13 = 99.
    expect(
      attributionLine([
        headliner("Hollow Pines", 0.285),
        venue("Fort Street Ballroom", 0.574),
        venue("The Lantern Room", 0.131),
      ]),
    ).toBe(
      `${LEAD} 57% of this act's match to fans of Fort Street Ballroom, 29% to fans of Hollow Pines and 13% to fans of The Lantern Room.`,
    );
  });

  it("says under 1% for a share too small to round to a whole percent", () => {
    expect(
      attributionLine([
        headliner("Hollow Pines", 0.6),
        headliner("The Quiet Ones", 0.396),
        venue("The Lantern Room", 0.004),
      ]),
    ).toBe(
      `${LEAD} 100% of this act's match to fans of the headliners and under 1% to fans of The Lantern Room.`,
    );
  });

  it("leaves out an input with no share, with no comment, and has no line when nothing has one", () => {
    const line = attributionLine([
      headliner("Hollow Pines", 0.7),
      venue("Sagebrush Diner", 0),
      venue("Fort Street Ballroom", 0.3),
    ]);
    expect(line).toBe(
      `${LEAD} 70% of this act's match to fans of Hollow Pines and 30% to fans of Fort Street Ballroom.`,
    );
    expect(line).not.toContain("Sagebrush Diner");
    expect(attributionLine([])).toBeNull();
    expect(attributionLine([venue("Sagebrush Diner", 0)])).toBeNull();
  });

  it("reads one part as a whole", () => {
    expect(attributionLine([venue("Fort Street Ballroom", 1)])).toBe(
      `${LEAD} 100% of this act's match to fans of Fort Street Ballroom.`,
    );
  });

  it("uses each venue's short label, as the card's phone line does, when asked", () => {
    expect(
      attributionLine(
        [
          headliner("Hollow Pines", 0.5),
          venue("Fort Street Ballroom", 0.3),
          venue("The Lantern Room", 0.2),
        ],
        { short: true },
      ),
    ).toBe(
      `${LEAD} 50% of this act's match to fans of Hollow Pines, 30% to fans of FSB and 20% to fans of The Lantern Room.`,
    );
  });

  it("is one line that never says Qloo confirms, agrees, proves, backs or verifies anything", () => {
    const names = ["Hollow Pines", "The Quiet Ones"];
    const venues = [
      "The Lantern Room",
      "Fort Street Ballroom",
      "Sagebrush Diner",
    ];
    const lines: string[] = [];
    for (const shares of [
      [0.5, 0.2, 0.2, 0.1, 0],
      [0.1, 0, 0.6, 0.3, 0],
      [0, 0.25, 0.25, 0.25, 0.25],
      [0.2, 0.2, 0, 0, 0.6],
      [0.004, 0.996, 0, 0, 0],
    ])
      for (const short of [false, true]) {
        const parts = [
          ...names.map((name, index) => headliner(name, shares[index])),
          ...venues.map((name, index) => venue(name, shares[index + 2])),
        ];
        const line = attributionLine(parts, { short });
        if (line)
          lines.push(line, attributionLine([...parts].reverse(), { short })!);
      }
    expect(lines.length).toBeGreaterThan(10);
    for (const line of lines) {
      expect(line).not.toMatch(/\n/);
      expect(line).not.toMatch(/confirm|agree|prove|backs?\b|verif/i);
      // Nothing that reads as Qloo siding with the card: no "also", "too", "as well" or "credit".
      expect(line).not.toMatch(/\balso\b|\btoo\b|as well|credit/i);
    }
  });

  it("gives the same line whatever order the parts come in", () => {
    const parts = [
      headliner("Hollow Pines", 0.3),
      headliner("The Quiet Ones", 0.2),
      venue("The Lantern Room", 0.4),
      venue("Fort Street Ballroom", 0.1),
    ];
    expect(attributionLine([...parts].reverse())).toBe(attributionLine(parts));

    // Equal shares: the headliners first, then the venues by name.
    const tied = [
      venue("The Lantern Room", 0.25),
      venue("Fort Street Ballroom", 0.25),
      headliner("Hollow Pines", 0.25),
    ];
    const line = `${LEAD} 25% of this act's match to fans of Hollow Pines, 25% to fans of Fort Street Ballroom and 25% to fans of The Lantern Room.`;
    expect(attributionLine(tied)).toBe(line);
    expect(attributionLine([...tied].reverse())).toBe(line);
  });
});
