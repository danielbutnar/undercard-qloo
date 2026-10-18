import {
  assembleLineup,
  liftsOver,
  type AssemblyInput,
  type VenueRef,
} from "./assemble-lineup";
import type { FeeBandId } from "./fee-bands";
import type { Act } from "./lineup";

/**
 * The venue switch: switch one of the town's venues off and on, and the lineup re-forms from
 * the saved build by the booking rule itself (src/lib/assemble-lineup.ts: a lift of 5 places or
 * more, inside the fee range, two genres shared with the headliners), with only the venues left
 * on. It reads the build's own Qloo results, so it makes no Qloo or model call. A slot nothing
 * qualifies for stays open.
 */

/** An act's place in its venue's ranking, and its place for the headliners' fans alone. */
export interface Placed {
  now: number;
  /** Null for a new entry: the headliners-only ranking didn't list it. */
  was: number | null;
}

export interface SwitchedLineup {
  acts: Act[];
  shortfall: Record<FeeBandId, number>;
  places: Record<string, Placed>;
}

/** Every venue the build ran, in the order it first ran it. */
export function venuesOf(input: AssemblyInput): VenueRef[] {
  const seen = new Map<string, VenueRef>();
  for (const run of input.venueRuns)
    if (!seen.has(run.venue.entityId)) seen.set(run.venue.entityId, run.venue);
  return [...seen.values()];
}

/** The lineup the rule books with only the venues in `on` added to the headliners' fans. */
export function lineupWith(
  input: AssemblyInput,
  on: ReadonlySet<string>,
): SwitchedLineup {
  const runs = input.venueRuns.filter((run) => on.has(run.venue.entityId));
  const { acts, shortfall } = assembleLineup({ ...input, venueRuns: runs });
  const places: Record<string, Placed> = {};
  for (const act of acts) {
    const run = runs.find(
      (candidate) =>
        candidate.band === act.band &&
        candidate.venue.entityId === act.anchorVenue.entityId,
    );
    const lift = run
      ? liftsOver(input.baselines[act.band] ?? [], run.artists).find(
          (entry) => entry.artist.entityId === act.entityId,
        )
      : undefined;
    if (lift)
      places[act.entityId] = {
        now: lift.position + 1,
        was: lift.inBaseline ? lift.position + 1 + lift.lift : null,
      };
  }
  return { acts, shortfall, places };
}

/** "101": the first and third venues on, the second off. */
export function maskFor(
  venues: readonly VenueRef[],
  on: ReadonlySet<string>,
): string {
  return venues.map((venue) => (on.has(venue.entityId) ? "1" : "0")).join("");
}

/**
 * Every combination of venues, worked out once on the server: each act is sent once per venue
 * that can book it, and each combination lists its acts by key.
 */
export interface VenueSwitchData {
  venues: VenueRef[];
  entries: Record<string, { act: Act; place: Placed | null }>;
  lineups: Record<
    string,
    { keys: string[]; shortfall: Record<FeeBandId, number> }
  >;
}

/** Builds with more venues than this aren't offered the switch (2^n combinations). */
export const MAX_SWITCH_VENUES = 8;

const entryKey = (act: Act) => `${act.entityId}@${act.anchorVenue.entityId}`;

export function venueSwitch(input: AssemblyInput): VenueSwitchData {
  const venues = venuesOf(input).slice(0, MAX_SWITCH_VENUES);
  const entries: VenueSwitchData["entries"] = {};
  const lineups: VenueSwitchData["lineups"] = {};
  for (let bits = 0; bits < 2 ** venues.length; bits++) {
    const on = new Set(
      venues
        .filter((_, index) => bits & (1 << index))
        .map((venue) => venue.entityId),
    );
    const lineup = lineupWith(input, on);
    for (const act of lineup.acts)
      entries[entryKey(act)] ??= {
        act,
        place: lineup.places[act.entityId] ?? null,
      };
    lineups[maskFor(venues, on)] = {
      keys: lineup.acts.map(entryKey),
      shortfall: lineup.shortfall,
    };
  }
  return { venues, entries, lineups };
}

/** The lineup for the venues in `on`, from the worked-out combinations. */
export function switchedLineup(
  data: VenueSwitchData,
  on: ReadonlySet<string>,
): SwitchedLineup {
  const lineup = data.lineups[maskFor(data.venues, on)];
  const acts: Act[] = [];
  const places: Record<string, Placed> = {};
  for (const key of lineup?.keys ?? []) {
    const entry = data.entries[key];
    if (!entry) continue;
    acts.push(entry.act);
    if (entry.place) places[entry.act.entityId] = entry.place;
  }
  return {
    acts,
    shortfall: lineup?.shortfall ?? { mid: 0, opener: 0 },
    places,
  };
}
