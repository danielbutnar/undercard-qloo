import type { FeeBand } from "@/lib/fee-bands";
import type { ClimbEvent } from "@/lib/lift-climb";
import type { Act } from "@/lib/lineup";
import { liftOf } from "@/lib/marks";
import type { Placed } from "@/lib/venue-switch";
import type { ChartRowData } from "./band-chart";
import { ordinal, venueShort } from "./words";

/**
 * A band's rows as a chart prints them: lowest place first, an act whose place the build can't
 * tell (a refill from a deeper call) after them, then any open slots.
 */
export function billRows(
  band: FeeBand,
  acts: readonly Act[],
  places: Readonly<Record<string, Placed>>,
  hues: ReadonlyMap<string, number>,
  openSlots = 0,
  /** Why a slot is open, said in the slot. */
  openWords = "No act the venues lifted clears the bar.",
): ChartRowData[] {
  const rows: ChartRowData[] = acts
    .filter((act) => act.band === band.id)
    .map((act) => {
      const lift = liftOf(act);
      const place = places[act.entityId];
      return {
        key: act.entityId,
        kind: "act",
        name: act.name,
        place: place?.now ?? (lift?.kind === "new" ? lift.top : null),
        was: place?.was ?? null,
        move: lift?.kind === "up" ? lift.places : null,
        fresh: lift?.kind === "new",
        genres: act.sharedTags.map((tag) => tag.name),
        hue: hues.get(act.anchorVenue.entityId) ?? null,
        venueShort: venueShort(act.anchorVenue.name),
        act,
      };
    });
  rows.sort((a, b) => (a.place ?? 999) - (b.place ?? 999));
  for (let i = 0; i < openSlots; i++)
    rows.push({
      key: `open-${band.id}-${i}`,
      kind: "open",
      name: "Open slot",
      place: null,
      was: null,
      move: null,
      fresh: false,
      genres: null,
      hue: null,
      venueShort: null,
      act: null,
      words: openWords,
    });
  return rows;
}

/**
 * One edition of a band's chart during Watch: the eight acts the Qloo result lists (src/lib/
 * lift-climb.ts), then any act on the lineup this venue's fans lifted from further down, at the
 * place the build gives it. Every number is the build's; nothing is invented for the motion.
 */
export function editionRows(
  step: ClimbEvent,
  bill: readonly Act[],
  places: Readonly<Record<string, Placed>>,
  hues: ReadonlyMap<string, number>,
): ChartRowData[] {
  const byId = new Map(bill.map((act) => [act.entityId, act]));
  const venueId = step.venue?.entityId ?? null;
  const hue = venueId !== null ? (hues.get(venueId) ?? null) : null;
  const fromHere = bill.filter(
    (act) =>
      venueId !== null &&
      act.band === step.band &&
      act.anchorVenue.entityId === venueId,
  );
  const booked = new Set(fromHere.map((act) => act.entityId));
  const words = (row: ChartRowData) =>
    `${row.name}: ${row.place ? ordinal(row.place) : ""}${
      row.fresh
        ? ", new to the top 50"
        : row.move !== null && row.was !== null
          ? `, up ${row.move} from ${ordinal(row.was)}`
          : ""
    }${row.booked ? ", on the lineup" : ""}`;

  const top: ChartRowData[] = step.acts.map((listed, index) => {
    const act = byId.get(listed.entityId);
    const climbed = venueId !== null && listed.move !== null;
    const row: ChartRowData = {
      key: listed.entityId,
      kind: "listed",
      name: listed.name,
      place: index + 1,
      was: climbed ? index + 1 + listed.move! : null,
      move: climbed ? listed.move : null,
      fresh: false,
      genres: act ? act.sharedTags.map((tag) => tag.name) : null,
      hue: climbed || booked.has(listed.entityId) ? hue : null,
      venueShort: climbed && step.venue ? venueShort(step.venue.name) : null,
      act: null,
      booked: booked.has(listed.entityId),
    };
    return { ...row, words: words(row) };
  });
  const listed = new Set(top.map((row) => row.key));
  const deep: ChartRowData[] = fromHere
    .filter((act) => !listed.has(act.entityId))
    .map((act) => {
      const lift = liftOf(act);
      const place = places[act.entityId];
      const row: ChartRowData = {
        key: act.entityId,
        kind: "listed",
        name: act.name,
        place: place?.now ?? (lift?.kind === "new" ? lift.top : null),
        was: place?.was ?? null,
        move: lift?.kind === "up" ? lift.places : null,
        fresh: lift?.kind === "new",
        genres: act.sharedTags.map((tag) => tag.name),
        hue,
        venueShort: step.venue ? venueShort(step.venue.name) : null,
        act: null,
        booked: true,
      };
      return { ...row, words: words(row) };
    })
    .sort((a, b) => (a.place ?? 999) - (b.place ?? 999));
  return [...top, ...deep];
}
