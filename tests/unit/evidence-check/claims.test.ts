// WS11 (Daniel's brief of 2026-10-22), step 4: the claims in scripts/evidence-claims.ts, from
// README.md, docs/devpost-story.md, docs/evidence.md and the copy constants. Each names one
// number and how to re-derive it, or why it can't be; none needs the docs to pass here, so a
// changed doc fails `pnpm evidence:check`, not `pnpm gate`. Claims carry phrases from the docs
// and computations only: a venue they name is in their own phrase, and no act is named.
import { describe, expect, it } from "vitest";
import { readPhrase, type Computation } from "../../../scripts/evidence-check";
import { CLAIMS } from "../../../scripts/evidence-claims";
import { CHECKED_TOWNS } from "@/lib/checked-towns";

const FILES = new Set([
  "README.md",
  "docs/devpost-story.md",
  "docs/evidence.md",
  "src/data/with-without-qloo.json",
  "src/data/without-qloo-checks.json",
  "src/components/method-evidence.tsx",
  "src/lib/compare.ts",
]);
const CITIES = new Set(CHECKED_TOWNS.map((town) => town.city));

const recomputable = CLAIMS.flatMap((claim) =>
  claim.equals === "not recomputable"
    ? []
    : [{ ...claim, equals: claim.equals }],
);

/** Every town a computation names. */
function townsOf(computation: Computation): string[] {
  const named: string[] = [];
  if ("town" in computation) named.push(computation.town);
  if ("towns" in computation && Array.isArray(computation.towns))
    named.push(...computation.towns);
  return named;
}

describe("the claims", () => {
  it("come from the brief's files, docs/evidence.md ones with their section", () => {
    for (const claim of CLAIMS) {
      expect(FILES, claim.phrase).toContain(claim.file);
      expect(claim.section !== undefined, claim.phrase).toBe(
        claim.file === "docs/evidence.md",
      );
    }
    const sections = new Set(
      CLAIMS.filter((claim) => claim.section).map((claim) => claim.section),
    );
    for (const section of [3, 31, 33]) expect(sections).toContain(section);
  });

  it("each name one number, in braces where the phrase holds more than one", () => {
    for (const claim of recomputable) {
      const read = readPhrase(claim.phrase);
      expect(read.problem, claim.phrase).toBeUndefined();
      expect(read.claimed, claim.phrase).not.toBeNull();
    }
  });

  it("say why a number can't be re-derived", () => {
    for (const claim of CLAIMS.filter(
      (entry) => entry.equals === "not recomputable",
    )) {
      expect(claim.why, claim.phrase).toMatch(/\w{4}/);
      expect(
        readPhrase(claim.phrase).numbers.length,
        claim.phrase,
      ).toBeGreaterThan(0);
    }
    // Daniel's brief: section 3's offline table and section 33 come from runs never saved.
    for (const claim of CLAIMS.filter((entry) => entry.section === 33))
      expect(claim.equals, claim.phrase).toBe("not recomputable");
    for (const claim of CLAIMS.filter((entry) => entry.section === 31))
      expect(claim.equals, claim.phrase).not.toBe("not recomputable");
  });

  it("name only checked towns, and a venue only where their phrase does", () => {
    for (const claim of recomputable) {
      for (const city of townsOf(claim.equals))
        expect(CITIES, claim.phrase).toContain(city);
      if (claim.equals.kind === "venue-acts")
        expect(claim.phrase, claim.equals.venue).toContain(claim.equals.venue);
    }
  });

  it("check the story without naming a venue, and its stamps from their sections (WS17)", () => {
    const story = CLAIMS.filter(
      (claim) => claim.file === "docs/devpost-story.md",
    );
    // Daniel, 29 October: the story names no act and no venue, so no claim reads a venue's acts.
    expect(
      story.filter(
        (claim) =>
          claim.equals !== "not recomputable" &&
          claim.equals.kind === "venue-acts",
      ),
    ).toEqual([]);
    // How it works' three stamps: each number names its section of docs/evidence.md.
    const whys = story.flatMap((claim) =>
      claim.equals === "not recomputable" ? [claim.why ?? ""] : [],
    );
    for (const section of [26, 34, 37, 38])
      expect(
        whys.some((why) => why.includes(`section ${section},`)),
        `section ${section}`,
      ).toBe(true);
  });
});

// Daniel, 29 October 13:30: claims about the builds saved before 29 October read those builds by
// id (the 21 October record), as section 31's do; claims about the builds on show read the latest.
describe("claims about earlier builds", () => {
  const pinnedOf = (claim: (typeof CLAIMS)[number]) =>
    claim.equals !== "not recomputable" &&
    "builds" in claim.equals &&
    claim.equals.builds === "pinned-1.0";

  it("are pinned in docs/evidence.md's sections 3, 13, 19 and 20 and src/lib/compare.ts", () => {
    const earlier = CLAIMS.filter(
      (claim) =>
        claim.equals !== "not recomputable" &&
        ((claim.file === "docs/evidence.md" &&
          [3, 13, 19, 20].includes(claim.section ?? 0)) ||
          claim.file === "src/lib/compare.ts"),
    );
    expect(earlier.length).toBeGreaterThanOrEqual(54);
    for (const claim of earlier)
      expect(pinnedOf(claim), claim.phrase).toBe(true);
    // The evidence page's row for M6m, measured on the 1.0 builds.
    expect(
      CLAIMS.filter(
        (claim) =>
          claim.file === "src/components/method-evidence.tsx" &&
          claim.phrase === 'result: "{29} of 29"',
      ).every(pinnedOf),
    ).toBe(true);
  });

  it("aren't the README's or the story's, which describe the builds on show", () => {
    for (const claim of CLAIMS.filter(
      (entry) =>
        entry.file === "README.md" || entry.file === "docs/devpost-story.md",
    ))
      expect(pinnedOf(claim), claim.phrase).toBe(false);
  });
});
