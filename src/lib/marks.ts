import type { Act } from "./lineup";

/**
 * How far a Boise room's crowd moved an act in Qloo's ranking: the places it gained over the
 * headliners-only ranking, or "new" when that ranking didn't list it.
 */
export type Lift =
  { kind: "up"; places: number } | { kind: "new"; top: number };

// The Why Boise line the lineup assembler writes (src/lib/assemble-lineup.ts, whyBoise). The
// lift is read from it, so builds saved before the marks existed need no new field.
const UP = /fans move it up (\d+) places?\.?$/;
const INTO = /fans move it into the top (\d+)\.?$/;

export function liftOf(act: Pick<Act, "reason">): Lift | null {
  const up = UP.exec(act.reason);
  if (up) return { kind: "up", places: Number(up[1]) };
  const into = INTO.exec(act.reason);
  if (into) return { kind: "new", top: Number(into[1]) };
  return null;
}

const ARTICLES = new Set(["the", "a", "an"]);

/** A room's name for its mark: its initials when it has three or more words, else the name. */
export function roomShortName(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((word) => word && !ARTICLES.has(word.toLowerCase()));
  return words.length >= 3
    ? words.map((word) => word[0].toUpperCase()).join("")
    : name;
}

/** The mark under an act on the bill, such as "FSB ▲7" or "The Lantern Room new". */
export function markText(act: Act): string {
  const room = roomShortName(act.anchorVenue.name);
  const lift = liftOf(act);
  if (!lift) return room;
  return lift.kind === "up" ? `${room} ▲${lift.places}` : `${room} new`;
}

const outsideTop = (top?: number) =>
  top ? `the headliners-only top ${top}` : "the headliners-only ranking";

/** The mark in words, for screen readers. */
export function markLabel(act: Act, top?: number): string {
  const crowd = `${act.anchorVenue.name}'s crowd`;
  const lift = liftOf(act);
  if (!lift) return crowd;
  return lift.kind === "up"
    ? `${crowd}: up ${lift.places} places`
    : `${crowd}: new, from outside ${outsideTop(top)}`;
}

const RANKING =
  "Qloo ranks artists by how much the headliners' fans like them.";
const QLOO = "Qloo: data on what people like, across music, places and more.";

/**
 * The key set beside the first mark on the bill: the first mark as its example, what it means,
 * what "new" means when an act on the bill carries it, and what Qloo is.
 */
export function markKey(
  first: Act,
  { acts, top }: { acts: readonly Act[]; top?: number },
): { example: string; lines: string[] } {
  const room = first.anchorVenue.name;
  const lift = liftOf(first);
  const lines: string[] = [];
  if (lift?.kind === "up") {
    lines.push(
      `${RANKING} Adding ${room}'s crowd moves this act up ${lift.places} places.`,
    );
  } else if (lift?.kind === "new") {
    lines.push(
      `${RANKING} This act was outside ${outsideTop(top)}; adding ${room}'s crowd moves it into the top ${lift.top}.`,
    );
  }
  const otherNew = acts.some(
    (act) => act !== first && liftOf(act)?.kind === "new",
  );
  if (lift?.kind === "up" && otherNew) {
    lines.push(
      `new: outside ${outsideTop(top)} until a room's crowd was added.`,
    );
  }
  const otherUp = acts.some(
    (act) => act !== first && liftOf(act)?.kind === "up",
  );
  if (lift?.kind === "new" && otherUp) {
    lines.push("▲ and a number: the places a room's crowd moves an act up.");
  }
  lines.push(QLOO);
  return { example: markText(first), lines };
}
