/**
 * An act's sleeve: square cover art drawn from its two genre words, so a glance says what kind of
 * music each act is without a photo. The first genre draws the top-left half and the second the
 * bottom-right half, in the colour of the venue whose fans lifted it. A fixed grammar: the same
 * genre word always draws the same form, and the act's own id only turns and mirrors it.
 */
export type SleeveForm =
  | "rings"
  | "fade"
  | "spiral"
  | "stipple"
  | "waves"
  | "arcs"
  | "staff"
  | "shards"
  | "blocks"
  | "bars"
  | "stripes"
  | "dots"
  | "crosses"
  | "chevrons"
  | "bricks"
  | "grid";

/** What each form looks like, in words for the key and for screen readers. */
export const FORM_WORDS: Record<SleeveForm, string> = {
  rings: "soft rings",
  fade: "fading bands",
  spiral: "a spiral",
  stipple: "grain",
  waves: "waves",
  arcs: "warm arcs",
  staff: "staff lines",
  shards: "shards",
  blocks: "offset blocks",
  bars: "thin bars",
  stripes: "hard stripes",
  dots: "round forms",
  crosses: "crosses",
  chevrons: "chevrons",
  bricks: "bricks",
  grid: "a grid",
};

// Most specific first: "Dream Pop" is rings before "pop" is round forms, "Indie Rock" is bars
// before "rock" is stripes and "indie" is crosses.
const RULES: [RegExp, SleeveForm][] = [
  [/dream/, "rings"],
  [/shoegaze/, "fade"],
  [/psych/, "spiral"],
  [/lo-?fi/, "stipple"],
  [/funk|disco|groove/, "waves"],
  [/soul|r&b|rnb|gospel/, "arcs"],
  [/instrumental|jazz|classical/, "staff"],
  [/experimental|noise|art/, "shards"],
  [/alternative/, "blocks"],
  [/indie rock/, "bars"],
  [/rock|punk|metal|grunge/, "stripes"],
  [/pop/, "dots"],
  [/indie/, "crosses"],
  [/folk|country|americana|bluegrass/, "chevrons"],
  [/hip ?hop|rap|grime/, "bricks"],
  [/electronic|house|techno|dance|synth/, "grid"],
];

const ALL_FORMS = Object.keys(FORM_WORDS) as SleeveForm[];

/** A small stable hash, so the same words and ids always draw the same sleeve. */
export function hashOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** The form a genre word draws; a word the grammar doesn't know still always draws the same one. */
export function formFor(genre: string): SleeveForm {
  const words = genre.toLowerCase();
  for (const [pattern, form] of RULES) if (pattern.test(words)) return form;
  return ALL_FORMS[hashOf(words) % ALL_FORMS.length];
}

export interface SleeveSpec {
  first: SleeveForm;
  second: SleeveForm;
  /** Quarter turns for the first half's form, 0 to 3. */
  turn: number;
  /** Mirror the second half's form. */
  mirror: boolean;
}

export function sleeveFor(
  genres: readonly [string, string] | readonly string[],
  id: string,
): SleeveSpec {
  const seed = hashOf(id);
  return {
    first: formFor(genres[0] ?? ""),
    second: formFor(genres[1] ?? genres[0] ?? ""),
    turn: seed % 4,
    mirror: (seed >> 2) % 2 === 1,
  };
}

/** "A sleeve drawn from Indie Pop (round forms) and Soul (warm arcs)." */
export function sleeveWords(genres: readonly string[]): string {
  const [a, b] = genres;
  const part = (genre: string | undefined) =>
    genre ? `${genre} (${FORM_WORDS[formFor(genre)]})` : null;
  return `A sleeve drawn from ${[part(a), part(b)].filter(Boolean).join(" and ")}.`;
}
