import type { TraceCall } from "./build-events";
import type { Act, Venue } from "./lineup";
import { namesVenue } from "./venue-call";

/**
 * A venue switch the saved trace shows (WS2): after venue A's result, a line of the planner's
 * names venue B, and B is the next venue read. A's fans moved no act onto the lineup; `acts`
 * counts the lineup acts B's fans put there. Only what the trace and the lineup hold.
 */
export interface AgentSwitch {
  from: Pick<Venue, "entityId" | "name">;
  to: Pick<Venue, "entityId" | "name">;
  acts: number;
  /** The planner's line, by its place in the build's notes; absent on a switch the data shows. */
  note?: number;
  /**
   * Why the agent read `to` (WS13.1): Qloo had no fan data for `from`, and the agent was told so.
   * Only a 2.0 build's calls carry it; a 1.0 switch states the order, never a reason.
   */
  because?: "no-fan-data";
}

export interface SwitchTrace {
  trace: readonly Pick<TraceCall, "tool" | "summary" | "noFanData">[];
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
  const reads: { index: number; room: Room; noFanData: boolean }[] = [];
  for (const [index, call] of trace.entries()) {
    if (call.tool !== "venue_artists") continue;
    const held = rooms.filter((room) => namesVenue(call.summary, room.name));
    const longest = Math.max(0, ...held.map((room) => room.name.length));
    const best = held.filter((room) => room.name.length === longest);
    if (best.length !== 1) return [];
    reads.push({
      index,
      room: best[0],
      noFanData: call.noFanData !== undefined,
    });
  }
  const lifted = (room: Room) =>
    acts.filter((act) => act.anchorVenue.entityId === room.entityId).length;

  // A 2.0 build (WS13.1): the calls say where Qloo had no fan data, which the agent was told, so
  // each such venue's switch is the next venue it went on to read, with the reason.
  if (reads.some((entry) => entry.noFanData)) {
    const found: AgentSwitch[] = [];
    const seen = new Set<string>();
    for (const [k, entry] of reads.entries()) {
      seen.add(entry.room.entityId);
      if (!entry.noFanData) continue;
      if (found.some((done) => done.from.entityId === entry.room.entityId))
        continue;
      const next = reads
        .slice(k + 1)
        .find(
          (later) =>
            !seen.has(later.room.entityId) &&
            !found.some((done) => done.to.entityId === later.room.entityId),
        );
      if (!next) continue;
      found.push({
        from: { entityId: entry.room.entityId, name: entry.room.name },
        to: { entityId: next.room.entityId, name: next.room.name },
        acts: lifted(next.room),
        because: "no-fan-data",
      });
    }
    return found;
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
