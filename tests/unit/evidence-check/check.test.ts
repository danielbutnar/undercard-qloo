// WS11 (Daniel's brief of 2026-10-22), step 1: each claim is a file, a phrase holding the
// number, and the computation it must equal or "not recomputable". The phrase is found in its
// file (line breaks read as spaces; docs/evidence.md by section), the number it holds is read,
// and one table names the file and the phrase of every claim; a recomputable mismatch fails the
// run, a "not recomputable" row never does. Invented docs and computations.
import { describe, expect, it } from "vitest";
import {
  checkClaims,
  exitCode,
  formatTable,
  type Claim,
  type Derived,
} from "../../../scripts/evidence-check";

const FILES: Record<string, string> = {
  "README.md": [
    "Measured over the 7 checked towns: of the",
    "model's 70 picks, 3 pass all three tests. A refill takes at most three",
    "calls, for 3,000 people, inside 0.55 to 0.92; no call was retried.",
  ].join("\n"),
  "docs/evidence.md": [
    "# Evidence",
    "## 3. Three more towns",
    "The Lantern Room lifted 7 acts.",
    "## 31. With and Without Qloo",
    "| Acts | 70 | 70 |",
    "The Lantern Room lifted 9 acts.",
  ].join("\n"),
};

/** Invented computations: a name and the number it gives, or why it has none. */
type Fake = { name: string; gives: Derived };
const run = (claims: Claim<Fake>[]) =>
  checkClaims(claims, {
    read: (file) => FILES[file] ?? null,
    evaluate: (fake) => fake.gives,
    describe: (fake) => fake.name,
  });
const gives = (n: number): Fake => ({ name: "invented", gives: n });

describe("a claim's phrase and the number it holds", () => {
  it("finds a phrase across a line break and reads the number in braces", () => {
    const [row] = run([
      {
        file: "README.md",
        phrase: "of the model's {70} picks",
        equals: gives(70),
      },
    ]);
    expect(row).toMatchObject({
      status: "match",
      claimed: "70",
      derived: "70",
    });
  });

  it("reads digits with commas or decimals, number words and 'no'", () => {
    const rows = run([
      {
        file: "README.md",
        phrase: "takes at most {three} calls",
        equals: gives(3),
      },
      { file: "README.md", phrase: "for {3,000} people", equals: gives(3000) },
      {
        file: "README.md",
        phrase: "inside {0.55} to 0.92",
        equals: gives(0.55),
      },
      { file: "README.md", phrase: "{no} call was retried", equals: gives(0) },
    ]);
    expect(rows.map((row) => row.status)).toEqual([
      "match",
      "match",
      "match",
      "match",
    ]);
    expect(rows.map((row) => row.claimed)).toEqual(["3", "3000", "0.55", "0"]);
  });

  it("doesn't take a list's comma or a full stop into the number", () => {
    const rows = checkClaims(
      [
        { file: "a.md", phrase: "Austin 3, Denver 4.", equals: "four" },
        { file: "a.md", phrase: "Denver {4}.", equals: "four" },
        { file: "a.md", phrase: "Austin 3,", equals: "three" },
      ],
      {
        read: () => "Lineups sharing acts: Austin 3, Denver 4.",
        evaluate: (word) => (word === "four" ? 4 : 3),
        describe: (word) => word,
      },
    );
    expect(rows.map((row) => [row.status, row.claimed])).toEqual([
      ["bad claim", "3, 4"],
      ["match", "4"],
      ["match", "3"],
    ]);
  });

  it("reads a phrase's only number when nothing is in braces", () => {
    const [row] = run([
      { file: "README.md", phrase: "3 pass all three tests", equals: gives(3) },
    ]);
    // "three" is a number word too, so the phrase holds two numbers and needs braces.
    expect(row.status).toBe("bad claim");
    const [plain] = run([
      {
        file: "README.md",
        phrase: "Measured over the 7 checked",
        equals: gives(7),
      },
    ]);
    expect(plain).toMatchObject({ status: "match", claimed: "7" });
  });

  it("looks for a docs/evidence.md phrase in its own section only", () => {
    const rows = run([
      {
        file: "docs/evidence.md",
        section: 3,
        phrase: "The Lantern Room lifted {7} acts",
        equals: gives(7),
      },
      {
        file: "docs/evidence.md",
        section: 3,
        phrase: "The Lantern Room lifted {9} acts",
        equals: gives(9),
      },
      {
        file: "docs/evidence.md",
        section: 31,
        phrase: "| Acts | {70} | 70 |",
        equals: gives(70),
      },
    ]);
    expect(rows.map((row) => row.status)).toEqual([
      "match",
      "not found",
      "match",
    ]);
  });
});

describe("the computation a claim must equal", () => {
  it("marks a different number, a missing phrase and a missing file as failures", () => {
    const rows = run([
      {
        file: "README.md",
        phrase: "of the model's {70} picks",
        equals: gives(69),
      },
      {
        file: "README.md",
        phrase: "of the model's {71} picks",
        equals: gives(71),
      },
      { file: "docs/missing.md", phrase: "{1} thing", equals: gives(1) },
    ]);
    expect(rows.map((row) => row.status)).toEqual([
      "differs",
      "not found",
      "not found",
    ]);
    expect(rows[0]).toMatchObject({ claimed: "70", derived: "69" });
    expect(exitCode(rows)).toBe(1);
  });

  it("marks a computation without data as a failure, saying why", () => {
    const rows = run([
      {
        file: "README.md",
        phrase: "of the model's {70} picks",
        equals: {
          name: "the store",
          gives: { missing: "no saved build for Austin" },
        },
      },
    ]);
    expect(rows[0]).toMatchObject({
      status: "no data",
      derived: "no saved build for Austin",
    });
    expect(exitCode(rows)).toBe(1);
  });

  it("compares decimals to six places", () => {
    const [row] = run([
      {
        file: "README.md",
        phrase: "inside 0.55 to {0.92}",
        equals: gives(0.92000000001),
      },
    ]);
    expect(row.status).toBe("match");
  });
});

describe("rows that aren't recomputable", () => {
  it("print with the reason and never fail, found or not", () => {
    const rows = run([
      {
        file: "docs/evidence.md",
        section: 3,
        phrase: "The Lantern Room lifted 7 acts",
        equals: "not recomputable",
        why: "an offline run, never saved",
      },
      {
        file: "README.md",
        phrase: "a sentence that isn't there 4",
        equals: "not recomputable",
        why: "a run that was never saved",
      },
    ]);
    expect(rows.map((row) => row.status)).toEqual([
      "not recomputable",
      "not recomputable",
    ]);
    expect(rows[0]).toMatchObject({
      claimed: "7",
      from: "an offline run, never saved",
    });
    expect(rows[1].derived).toBe("phrase not found");
    expect(exitCode(rows)).toBe(0);
  });
});

describe("the table", () => {
  it("names every claim's file and phrase in one table, with pipes escaped", () => {
    const rows = run([
      {
        file: "docs/evidence.md",
        section: 31,
        phrase: "| Acts | {70} | 70 |",
        equals: gives(70),
      },
      {
        file: "README.md",
        phrase: "of the model's {70} picks",
        equals: gives(69),
      },
    ]);
    const table = formatTable(rows);
    const lines = table.trim().split("\n");
    expect(lines[0]).toMatch(
      /^\| Result \| File \| Phrase \| Claimed \| Re-derived \| From \|$/,
    );
    expect(lines).toHaveLength(4);
    expect(lines[2]).toContain("docs/evidence.md section 31");
    expect(lines[2]).toContain("\\| Acts \\| {70} \\| 70 \\|");
    expect(lines[3]).toContain("README.md");
    expect(lines[3]).toContain("of the model's {70} picks");
    expect(lines[3]).toMatch(/^\| differs \|/);
  });

  it("exits 0 when every recomputable claim matches", () => {
    const rows = run([
      {
        file: "README.md",
        phrase: "of the model's {70} picks",
        equals: gives(70),
      },
      {
        file: "README.md",
        phrase: "no 4",
        equals: "not recomputable",
        why: "unsaved",
      },
    ]);
    expect(exitCode(rows)).toBe(0);
  });
});
