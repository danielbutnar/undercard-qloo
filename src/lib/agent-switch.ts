import type { TraceCall } from "./build-events";
import type { Act, Venue } from "./lineup";

/**
 * A venue switch the saved trace shows (WS2): after venue A's result, a line of the planner's
 * names venue B, and B is the next venue read. A's fans moved no act onto the lineup; `acts`
 * counts the lineup acts B's fans put there. Only what the trace and the lineup hold.
 */
export interface AgentSwitch {
  from: Pick<Venue, "entityId" | "name">;
  to: Pick<Venue, "entityId" | "name">;
  acts: number;
  /** The planner's line, by its place in the build's notes. */
  note: number;
}

export interface SwitchTrace {
  trace: readonly Pick<TraceCall, "tool" | "summary">[];
  /** The planner's lines, each with how many calls had come back when it was said. */
  notes: readonly { at: number; text: string }[];
  acts: readonly Pick<Act, "anchorVenue">[];
  /** Every venue the build read (its context's anchors, any band). */
  venues: readonly Pick<Venue, "entityId" | "name">[];
}

type Room = Pick<Venue, "entityId" | "name">;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** How a line can name a venue: its full name, the name without a bracketed note, or the note. */
function forms(name: string): string[] {
  const plain = name.replace(/\s*\([^)]*\)/g, "").trim();
  const given = /\(([A-Z0-9&]{2,6})\)\s*$/.exec(name)?.[1];
  return [...new Set([name, plain, given ?? ""])].filter(
    (form) => form.length >= 3,
  );
}

/**
 * The switches in a saved build's trace, in the order the planner said them. Each venue call is
 * read as the build venue whose name it holds, the longest where one name holds another; a call
 * that holds none, or two of the same length, leaves the trace ambiguous, and then there is none.
 * A venue read in the first round, with no line of the planner's between it and the venue before
 * it, was planned from the start and is never a switch.
 */
export function agentSwitches({
  trace,
  notes,
  acts,
  venues,
}: SwitchTrace): AgentSwitch[] {
  const rooms = [
    ...new Map(venues.map((venue) => [venue.entityId, venue])).values(),
  ];
  const reads: { index: number; room: Room }[] = [];
  for (const [index, call] of trace.entries()) {
    if (call.tool !== "venue_artists") continue;
    const held = rooms.filter((room) =>
      call.summary.includes(`headliners and ${room.name}`),
    );
    const longest = Math.max(0, ...held.map((room) => room.name.length));
    const best = held.filter((room) => room.name.length === longest);
    if (best.length !== 1) return [];
    reads.push({ index, room: best[0] });
  }

  // A form two venues share names neither.
  const formsOf = new Map(
    rooms.map((room) => [room.entityId, forms(room.name)]),
  );
  const shared = (form: string) =>
    rooms.filter((room) => formsOf.get(room.entityId)!.includes(form)).length >
    1;
  const names = (text: string, room: Room) =>
    formsOf
      .get(room.entityId)!
      .some(
        (form) =>
          !shared(form) &&
          new RegExp(
            `(^|[^\\p{L}\\p{N}])${escape(form)}($|[^\\p{L}\\p{N}])`,
            "u",
          ).test(text),
      );
  const lifted = (room: Room) =>
    acts.filter((act) => act.anchorVenue.entityId === room.entityId).length;

  const found: AgentSwitch[] = [];
  for (const [index, note] of notes.entries()) {
    const before = reads.filter((entry) => entry.index < note.at);
    const next = reads.find((entry) => entry.index >= note.at);
    if (before.length === 0 || !next) continue;
    const to = next.room;
    if (
      before.some((entry) => entry.room.entityId === to.entityId) ||
      found.some((entry) => entry.to.entityId === to.entityId) ||
      !names(note.text, to)
    )
      continue;
    // Venue A: read before the line, its fans moved no act onto the lineup; where two did, the
    // one the line names, else none.
    const idle = [
      ...new Map(
        before.map((entry) => [entry.room.entityId, entry.room]),
      ).values(),
    ].filter((room) => lifted(room) === 0);
    const named = idle.filter((room) => names(note.text, room));
    const from =
      named.length === 1 ? named[0] : idle.length === 1 ? idle[0] : null;
    if (!from) continue;
    found.push({
      from: { entityId: from.entityId, name: from.name },
      to: { entityId: to.entityId, name: to.name },
      acts: lifted(to),
      note: index,
    });
  }
  return found;
}
