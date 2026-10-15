import { describe, expect, it } from "vitest";
import fixture from "../../fixtures/lineup.synthetic.json";
import { lineupCsv } from "@/lib/csv";
import { LineupSchema } from "@/lib/lineup";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

const { acts } = LineupSchema.parse(fixture);

describe("lineupCsv", () => {
  it("has the columns act, band, affinity, popularity, anchor_venue, reason", () => {
    const [header] = lineupCsv(acts, SAGEBRUSH_SOUND.feeBands).split("\r\n");
    expect(header).toBe("act,band,affinity,popularity,anchor_venue,reason");
  });

  const rowsOf = (csv: string) => csv.trimEnd().split("\r\n").slice(1);

  it("writes one row per act in board order, with Qloo's numbers to two decimals", () => {
    const rows = rowsOf(lineupCsv(acts, SAGEBRUSH_SOUND.feeBands));
    expect(rows).toHaveLength(10);
    expect(rows[0]).toBe(
      "Hollow Pines,Mid,0.94,0.91,The Lantern Room,The Lantern Room fans move it up 11 places.",
    );
  });

  it("puts the Mid band first whatever order the board is in", () => {
    const rows = rowsOf(
      lineupCsv([...acts].reverse(), SAGEBRUSH_SOUND.feeBands),
    );
    expect(rows.map((row) => row.split(",")[1])).toEqual([
      ...Array(4).fill("Mid"),
      ...Array(6).fill("Opener"),
    ]);
  });

  it("quotes cells with commas, quotes or line breaks", () => {
    const act = {
      ...acts[0],
      name: 'The "Comma, Band"',
      reason: "Line one\nline two",
    };
    const [, row] = lineupCsv([act], SAGEBRUSH_SOUND.feeBands).split("\r\n");
    expect(row).toBe(
      '"The ""Comma, Band""",Mid,0.94,0.91,The Lantern Room,"Line one\nline two"',
    );
  });

  it("keeps a spreadsheet from reading a cell as a formula", () => {
    const act = { ...acts[0], name: "=HYPERLINK(1)" };
    const [, row] = lineupCsv([act], SAGEBRUSH_SOUND.feeBands).split("\r\n");
    expect(row.startsWith("'=HYPERLINK(1),")).toBe(true);
  });
});
