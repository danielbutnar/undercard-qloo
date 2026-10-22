import { roomShortName } from "./marks";

/**
 * One input of Qloo's split of an act's result (docs/evidence.md section 35), named as the saved
 * build names it: a headliner, or one of the act's fee range's venues. The share is Qloo's, 0 to
 * 1, as it comes; an act's shares add up to about 1.
 */
export interface SplitPart {
  input: "headliner" | "venue";
  entityId: string;
  name: string;
  share: number;
}

/** An act's split: Qloo's parts, and how many venues are in its fee range's split. */
export interface ActSplit {
  /**
   * The fee range's venues Qloo gave a share for any of the range's acts. A venue the call sent
   * that Qloo scored for none (section 35's answer lists one as not found) isn't counted.
   */
  venues: number;
  parts: SplitPart[];
}

const TOGETHER = "With this fee range's venues together, ";

/**
 * Each part to the nearest whole percent, halves up (the 1e-9 keeps a half that floating point
 * stores just under it, such as 0.285, a half); a share too small to reach 1% reads "under 1%".
 * Each part is rounded on its own, so the parts may add up to 99 or 101, not exactly 100.
 */
function percent(share: number): string {
  const whole = Math.round(share * 100 + 1e-9);
  return whole === 0 ? "under 1%" : `${whole}%`;
}

/**
 * The act card's line on Qloo's split (WS7): how much of the act's match Qloo traces to each
 * input when the headliners and the fee range's venues are asked together, largest share first. It reports the split as Qloo gives it and singles out no input: it doesn't know which
 * venue the card credits, so it can't say Qloo leans on that one, or that Qloo confirms it. The
 * headliners read together when both have a share, by name when only one does; a venue reads by
 * its name, or with `short` by its mark (src/lib/marks.ts), as the card's phone line does. An
 * input with no share is left out without comment; with no share at all there is no line. The
 * venues are said to be together only when two or more are in the range's split.
 */
export function attributionLine(
  { venues, parts }: ActSplit,
  { short = false }: { short?: boolean } = {},
): string | null {
  const shared = parts.filter((part) => part.share > 0);
  const headliners = shared.filter((part) => part.input === "headliner");
  const named = [
    ...(headliners.length > 1
      ? [
          {
            label: "the headliners",
            share: headliners.reduce((sum, part) => sum + part.share, 0),
          },
        ]
      : headliners.map((part) => ({ label: part.name, share: part.share }))),
    ...shared
      .filter((part) => part.input === "venue")
      .map((part) => ({
        label: short ? roomShortName(part.name) : part.name,
        share: part.share,
        venue: true,
      })),
  ];
  if (!named.length) return null;
  // Largest share first. Equal shares put the headliners first, then venues by name, so the
  // line doesn't depend on the order the parts come in.
  const [first, ...rest] = [...named].sort(
    (a, b) =>
      b.share - a.share ||
      Number("venue" in a) - Number("venue" in b) ||
      a.label.localeCompare(b.label),
  );
  const phrases = [
    `${percent(first.share)} of this act's match to fans of ${first.label}`,
    ...rest.map((part) => `${percent(part.share)} to fans of ${part.label}`),
  ];
  const list =
    phrases.length === 1
      ? phrases[0]
      : `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
  return `${venues > 1 ? TOGETHER : ""}Qloo traces ${list}.`;
}
