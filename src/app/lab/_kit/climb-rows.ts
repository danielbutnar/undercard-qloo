import type { TraceCall } from "@/lib/build-events";
import type { FeeBand } from "@/lib/fee-bands";
import type { LabPlace } from "@/lib/lab";
import type { ClimbEvent } from "@/lib/lift-climb";
import type { Act } from "@/lib/lineup";
import { liftOf } from "@/lib/marks";

/**
 * The Qloo call a climb step came from, matched as the replay matches it (src/server/
 * undercard-build.ts replayClimbs): the band's label and the venue named in the call's summary.
 * The replay streams every call in a second or two while the climb plays at reading pace, so
 * a direction shows this call beside its step rather than the newest call.
 */
export function stepCall(
  step: ClimbEvent,
  calls: readonly TraceCall[],
  bands: readonly FeeBand[],
): TraceCall | null {
  const band = bands.find((entry) => entry.id === step.band);
  if (!band) return null;
  return (
    calls.find(
      (call) =>
        call.summary.startsWith(`${band.label}-band`) &&
        (step.venue
          ? call.tool === "venue_artists" &&
            call.summary.includes(`headliners and ${step.venue.name}`)
          : call.tool === "baseline_artists"),
    ) ?? null
  );
}

/** The planner's latest line said before call n, as the replay emits it. */
export function noteBefore(
  n: number,
  notes: readonly { at: number; text: string }[],
) {
  return [...notes].reverse().find((note) => note.at < n)?.text ?? null;
}

export interface ClimbRow {
  entityId: string;
  name: string;
  /** Its place in this step's ranking. */
  place: number;
  /** Places it gained with this venue's fans, past the bar; null when it didn't climb that far. */
  move: number | null;
  /** Where it stood for the headliners' fans alone, when it climbed; null for a new entry. */
  was: number | null;
  /** New to Qloo's top 50 with this venue's fans. */
  fresh: boolean;
  /** This venue's fans put it on the bill. */
  onBill: boolean;
  /** Below the eight the climb lists: an act on the bill, at its own place. */
  deep: boolean;
}

/**
 * One climb step as rows: the eight the step lists (src/lib/lift-climb.ts), then any act this
 * venue's fans put on the bill from further down, at the place the saved build gives it. Every
 * number is from the build; nothing is invented for the motion.
 */
export function climbRows(
  step: ClimbEvent,
  bill: readonly Act[],
  places: Record<string, LabPlace>,
): ClimbRow[] {
  const fromHere = bill.filter(
    (act) =>
      step.venue !== null &&
      act.band === step.band &&
      act.anchorVenue.entityId === step.venue.entityId,
  );
  const booked = new Set(fromHere.map((act) => act.entityId));
  const top: ClimbRow[] = step.acts.map((act, index) => ({
    entityId: act.entityId,
    name: act.name,
    place: index + 1,
    move: step.venue ? act.move : null,
    was: step.venue && act.move !== null ? index + 1 + act.move : null,
    fresh: false,
    onBill: booked.has(act.entityId),
    deep: false,
  }));
  const listed = new Set(top.map((row) => row.entityId));
  const deep: ClimbRow[] = fromHere
    .filter((act) => !listed.has(act.entityId) && places[act.entityId]?.now)
    .map((act) => {
      const lift = liftOf(act);
      const place = places[act.entityId];
      return {
        entityId: act.entityId,
        name: act.name,
        place: place.now!,
        move: lift?.kind === "up" ? lift.places : null,
        was: place.was,
        fresh: lift?.kind === "new",
        onBill: true,
        deep: true,
      };
    })
    .sort((a, b) => a.place - b.place);
  return [...top, ...deep];
}
