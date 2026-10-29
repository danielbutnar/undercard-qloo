import { z } from "zod";
import { TraceCallSchema } from "./build-events";
import { CHECKED_TOWNS } from "./checked-towns";
import { FEE_BAND_IDS } from "./fee-bands";
import { nameKey } from "./pick-tests";
import { checkedFestival } from "./towns";

/**
 * The buyer's shortlist (WS4): a buyer picks one of the checked towns and pastes the acts
 * they've been pitched; Undercard sorts them by how they climb with that town's venue fans and
 * shows each one's fee range and genre fit. It drafts nothing and books nothing.
 */

/** At most this many act names in one check. */
export const SHORTLIST_MAX_NAMES = 10;

/**
 * The most Qloo calls one check may make: a search per name (10), one ranking for the
 * headliners alone and one per anchor venue (every saved build reads at most 3).
 */
export const SHORTLIST_CALL_CAP = 14;

/** The names a buyer pasted: one per line, trimmed, with empty lines dropped. */
export function pastedNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** The towns a check can be for: the checked towns' festivals, by id. */
const CHECKED_IDS = new Set(
  CHECKED_TOWNS.map((town) => checkedFestival(town).id),
);

/** Whether a festival is one of the checked towns, so the pitch check can be for it. */
export const isCheckedFestival = (festivalId: string) =>
  CHECKED_IDS.has(festivalId);

/**
 * A link that opens the pitch check on a list (WS18 item 4: "Check its picks on Qloo →"): its
 * town and its names fill the form, and nothing runs until the buyer presses the button.
 */
export function shortlistHref({
  festivalId,
  names,
}: {
  festivalId: string;
  names: readonly string[];
}): string {
  const search = new URLSearchParams([
    ["town", festivalId],
    ...names.map((name): [string, string] => ["act", name]),
  ]);
  return `/shortlist?${search}`;
}

/** The town and names a link opens the pitch check on; null unless it names a checked town. */
export function shortlistFromSearch(
  search: string,
): { festivalId: string; names: string[] } | null {
  const params = new URLSearchParams(search);
  const festivalId = params.get("town") ?? "";
  if (!isCheckedFestival(festivalId)) return null;
  const names = params
    .getAll("act")
    .map((name) => name.trim().slice(0, 200))
    .filter((name) => name !== "")
    .slice(0, SHORTLIST_MAX_NAMES);
  return { festivalId, names };
}

/** A name checked once: typed twice, or naming the same act on Qloo as one before it. */
export interface Repeat {
  name: string;
  sameAs: string;
}

/** One pasted name as a check answers it; only a found act has numbers. */
export const ShortlistActSchema = z.discriminatedUnion("status", [
  z.object({ name: z.string(), status: z.literal("not-found") }),
  z.object({ name: z.string(), status: z.literal("not-checked") }),
  z.object({
    name: z.string(),
    status: z.literal("headliner"),
    qlooName: z.string(),
  }),
  z.object({
    /** As the buyer typed it. */
    name: z.string(),
    status: z.literal("found"),
    entityId: z.string(),
    /** As Qloo lists it. */
    qlooName: z.string(),
    popularity: z.number(),
    /** Against the fee ranges, as pickTests reads it. */
    range: z.enum(["in", "above", "below"]),
    /** The fee range it sits inside; null above or below them all. */
    band: z.enum(FEE_BAND_IDS).nullable(),
    /** The genres it shares with the headliners, strongest first; the rule books on two. */
    genres: z.array(z.string()),
    alone: z.number().int().positive().nullable(),
    best: z
      .object({ venueId: z.string(), place: z.number().int().positive() })
      .nullable(),
    climb: z.number().int().nullable(),
  }),
]);

/** A venue the check read: its colour on the town's lineup, null when grey. */
export const ShortlistVenueSchema = z.object({
  entityId: z.string(),
  name: z.string(),
  hue: z.number().int().nonnegative().nullable(),
  read: z.boolean(),
  noFanData: z.boolean(),
  lifts: z.number().int().nonnegative(),
});

/** A check's answer, as POST /api/shortlist sends it and the page prints it. */
export const ShortlistSchema = z.object({
  festivalId: z.string(),
  city: z.string(),
  headliners: z.array(z.string()),
  /** The headliners-alone ranking answered, so the acts have places. */
  ranked: z.boolean(),
  acts: z.array(ShortlistActSchema),
  venues: z.array(ShortlistVenueSchema),
  repeats: z.array(z.object({ name: z.string(), sameAs: z.string() })),
  /** Every Qloo call, in order; a call the cache answered is marked cached. */
  calls: z.array(TraceCallSchema),
  /** The calls that reached Qloo, against the check's cap. */
  made: z.number().int().nonnegative(),
  cap: z.number().int().positive(),
});

export type ShortlistAct = z.infer<typeof ShortlistActSchema>;
export type ShortlistVenue = z.infer<typeof ShortlistVenueSchema>;
export type Shortlist = z.infer<typeof ShortlistSchema>;

/** Boise's example (step 5): the model's own picks, and their check read from the cache. */
export interface ShortlistExample {
  festivalId: string;
  /** The model's picks in its order, from its saved Without Qloo answer. */
  names: string[];
  /** Their check, from the Qloo cache only; null while the cache doesn't hold it. */
  shortlist: Shortlist | null;
}

const GROUP: Record<ShortlistAct["status"], number> = {
  found: 0,
  headliner: 2,
  "not-checked": 3,
  "not-found": 4,
};
const groupOf = (act: ShortlistAct) =>
  act.status === "found" && act.climb === null ? 1 : GROUP[act.status];

/**
 * The rows, by climb (step 3): the biggest climb first, then the better place with the venue's
 * fans and alone; then acts Qloo couldn't place, a headliner, and names not checked or not found,
 * each group in the buyer's order.
 */
export function sortShortlist(acts: readonly ShortlistAct[]): ShortlistAct[] {
  return acts
    .map((act, order) => ({ act, order }))
    .sort((a, b) => {
      const group = groupOf(a.act) - groupOf(b.act);
      if (group !== 0) return group;
      if (
        a.act.status === "found" &&
        b.act.status === "found" &&
        a.act.climb !== null &&
        b.act.climb !== null
      )
        return (
          b.act.climb - a.act.climb ||
          (a.act.best?.place ?? 0) - (b.act.best?.place ?? 0) ||
          (a.act.alone ?? 0) - (b.act.alone ?? 0) ||
          a.order - b.order
        );
      return a.order - b.order;
    })
    .map(({ act }) => act);
}

/** An act in one Qloo answer: its id and Qloo's score (query.affinity) in that answer. */
export interface Scored {
  entityId: string;
  affinity: number | null;
}

/**
 * Places within one Qloo answer, 1 for the highest score. Qloo normalises scores per query,
 * so a place compares only with places in the same answer. An act without a score has none;
 * equal scores keep Qloo's order.
 */
export function placesIn(answer: readonly Scored[]): Map<string, number> {
  const scored = answer.filter(
    (act): act is Scored & { affinity: number } => act.affinity !== null,
  );
  const ranked = scored
    .map((act, order) => ({ act, order }))
    .sort((a, b) => b.act.affinity - a.act.affinity || a.order - b.order);
  return new Map(ranked.map(({ act }, index) => [act.entityId, index + 1]));
}

/**
 * The same answer: the same acts in the same order with the same scores. A venue Qloo has no
 * fan data for leaves the headliners' answer exactly as it was (docs/evidence.md section 35;
 * in the 29 saved builds, every venue run with the headliners' ranking also had their scores).
 */
export function sameAnswer(
  a: readonly Scored[],
  b: readonly Scored[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (act, index) =>
        act.entityId === b[index].entityId &&
        act.affinity === b[index].affinity,
    )
  );
}

/** One venue's answer, as places. */
export interface VenuePlaces {
  venueId: string;
  places: ReadonlyMap<string, number>;
}

/** An act's places and climb: null where Qloo gave it no place to compare. */
export interface Climb {
  /** Its place for the headliners' fans alone. */
  alone: number | null;
  /** Its best place with one venue's fans added, and that venue (the first read, on a tie). */
  best: { venueId: string; place: number } | null;
  /** Places alone minus the best place: above 0, a venue's fans lift it. */
  climb: number | null;
}

/**
 * Step 2's arithmetic (WS4): an act's climb is its place with the headliners alone minus its
 * best place with one venue's fans added, every place read within its own call.
 */
export function climbOf(
  entityId: string,
  alone: ReadonlyMap<string, number>,
  venues: readonly VenuePlaces[],
): Climb {
  let best: Climb["best"] = null;
  for (const { venueId, places } of venues) {
    const place = places.get(entityId);
    if (place !== undefined && (best === null || place < best.place))
      best = { venueId, place };
  }
  const place = alone.get(entityId) ?? null;
  return {
    alone: place,
    best,
    climb: place !== null && best !== null ? place - best.place : null,
  };
}

/**
 * The names to search, each once: a repeat after the app's full fold (nameKey: accents and the
 * letters they leave folded, case, a bracketed note, a leading "The") keeps the first spelling
 * (Daniel, 2026-10-29, 20:00: the pitch check folds too).
 */
export function distinctNames(names: readonly string[]): {
  names: string[];
  repeats: Repeat[];
} {
  const first = new Map<string, string>();
  const repeats: Repeat[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (name === "") continue;
    const key = nameKey(name);
    const seen = first.get(key);
    if (seen !== undefined) repeats.push({ name, sameAs: seen });
    else first.set(key, name);
  }
  return { names: [...first.values()], repeats };
}
