// One command that re-derives the site's numbers (WS11). Each claim in scripts/evidence-claims.ts
// is a file, a phrase holding the number and the computation it must equal, or "not
// recomputable" for a number from a run that was never saved. The phrase is found in its file,
// the number it holds is read, and one table names the file and the phrase of every claim; any
// recomputable mismatch exits 1.

/** A computation's number, or why there isn't one. */
export type Missing = { missing: string };
export type Derived = number | Missing;

export interface Claim<C> {
  /** The file the number is in, from the repository's root. */
  file: string;
  /** For docs/evidence.md: the section ("## 31.") the phrase must sit in. */
  section?: number;
  /**
   * The words around the number as the file has them; line breaks read as spaces. Braces mark
   * the number the claim checks, as in "of the model's {290} picks"; a phrase holding only one
   * number needs none.
   */
  phrase: string;
  equals: C | "not recomputable";
  /** Why a number can't be re-derived: the run it comes from was never saved. */
  why?: string;
}

export type Status =
  | "match"
  | "differs"
  | "no data"
  | "not found"
  | "bad claim"
  | "not recomputable";

export interface Row {
  file: string;
  section?: number;
  phrase: string;
  status: Status;
  claimed: string;
  derived: string;
  from: string;
}

const WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
};
// Inside braces only: "{no} call was retried".
const ZERO_WORDS = new Set(["no", "none"]);
const DIGITS = /^\d{1,3}(,\d{3})+(\.\d+)?$|^\d+(\.\d+)?$/;
// A thousands comma needs three digits after it, so "Austin 3, Denver 4." reads 3 and 4.
const NUMBER_TOKENS = new RegExp(
  `\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?|\\b(?:${Object.keys(WORDS).join("|")})\\b`,
  "gi",
);

/** A number as a phrase writes it: 290, 3,000, 0.55, "three", or "no" in braces. */
export function parseNumber(token: string): number | null {
  const word = token.trim().toLowerCase();
  if (DIGITS.test(word)) return Number(word.replace(/,/g, ""));
  if (word in WORDS) return WORDS[word];
  if (ZERO_WORDS.has(word)) return 0;
  return null;
}

const spaced = (text: string) => text.replace(/\s+/g, " ").trim();

/** A docs/evidence.md section: from its "## N." heading to the next "## " heading. */
export function sectionText(markdown: string, section: number): string | null {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## ${section}. `));
  if (start < 0) return null;
  const end = lines.findIndex(
    (line, index) => index > start && line.startsWith("## "),
  );
  return lines.slice(start, end < 0 ? undefined : end).join("\n");
}

/** The phrase as the file should have it, and the number it claims (or why it can't say). */
function readPhrase(phrase: string): {
  text: string;
  claimed: number | null;
  numbers: string[];
  problem?: string;
} {
  const marks = [...phrase.matchAll(/\{([^{}]*)\}/g)];
  const text = spaced(phrase.replace(/\{([^{}]*)\}/g, "$1"));
  const numbers = (text.match(NUMBER_TOKENS) ?? []).map((token) =>
    token.trim(),
  );
  if (marks.length > 1)
    return { text, claimed: null, numbers, problem: "more than one {number}" };
  if (marks.length === 1) {
    const claimed = parseNumber(marks[0][1]);
    return claimed === null
      ? { text, claimed, numbers, problem: `{${marks[0][1]}} isn't a number` }
      : { text, claimed, numbers };
  }
  if (numbers.length === 1)
    return { text, claimed: parseNumber(numbers[0]), numbers };
  return {
    text,
    claimed: null,
    numbers,
    problem:
      numbers.length === 0
        ? "the phrase holds no number"
        : "the phrase holds more than one number: mark one {in braces}",
  };
}

/** A number for the table: integers as they are, decimals to three places at most. */
export function shown(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(3)));
}

const same = (a: number, b: number) =>
  Number(a.toFixed(6)) === Number(b.toFixed(6));

/**
 * Checks each claim: its phrase in its file (and section), the number it holds against its
 * computation. `read` gives a file's text or null when there is none.
 */
export function checkClaims<C>(
  claims: readonly Claim<C>[],
  {
    read,
    evaluate,
    describe,
  }: {
    read: (file: string) => string | null;
    evaluate: (computation: C) => Derived;
    describe: (computation: C) => string;
  },
): Row[] {
  return claims.map((claim) => {
    const { text, claimed, numbers, problem } = readPhrase(claim.phrase);
    const whole = read(claim.file);
    const scope =
      whole === null
        ? null
        : claim.section === undefined
          ? whole
          : sectionText(whole, claim.section);
    const found = scope !== null && spaced(scope).includes(text);
    const base = {
      file: claim.file,
      ...(claim.section === undefined ? {} : { section: claim.section }),
      phrase: claim.phrase,
    };
    if (claim.equals === "not recomputable")
      return {
        ...base,
        status: "not recomputable",
        claimed: claimed === null ? numbers.join(", ") : shown(claimed),
        derived: found ? "-" : "phrase not found",
        from: claim.why ?? "",
      };
    const from = describe(claim.equals);
    if (problem || claimed === null)
      return {
        ...base,
        status: "bad claim",
        claimed: numbers.join(", "),
        derived: problem ?? "",
        from,
      };
    if (!found)
      return {
        ...base,
        status: "not found",
        claimed: shown(claimed),
        derived:
          whole === null
            ? "no such file"
            : scope === null
              ? `no section ${claim.section}`
              : "phrase not found",
        from,
      };
    const value = evaluate(claim.equals);
    if (typeof value !== "number")
      return {
        ...base,
        status: "no data",
        claimed: shown(claimed),
        derived: value.missing,
        from,
      };
    return {
      ...base,
      status: same(value, claimed) ? "match" : "differs",
      claimed: shown(claimed),
      derived: shown(value),
      from,
    };
  });
}

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** One table, a row per claim, naming its file (and section) and its phrase. */
export function formatTable(rows: readonly Row[]): string {
  const lines = [
    "| Result | File | Phrase | Claimed | Re-derived | From |",
    "|---|---|---|---|---|---|",
    ...rows.map(
      (row) =>
        `| ${[
          row.status,
          row.section === undefined
            ? row.file
            : `${row.file} section ${row.section}`,
          row.phrase,
          row.claimed,
          row.derived,
          row.from,
        ]
          .map(cell)
          .join(" | ")} |`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

/** 1 when any recomputable claim isn't a match; "not recomputable" rows never fail. */
export function exitCode(rows: readonly Row[]): 0 | 1 {
  return rows.some(
    (row) => row.status !== "match" && row.status !== "not recomputable",
  )
    ? 1
    : 0;
}
