// WS2 (b): the agent's switch, from the saved trace only. A planner line said after venue A's
// result that names venue B, the next venue read, where A's fans moved no act onto the lineup:
// one sentence, with how many acts come from B. A venue planned from the start, read in the
// first round of venue calls, is no switch; anything the trace leaves open adds nothing.
// Invented venues and acts only.
import { describe, expect, it } from "vitest";
import { switchLine } from "@/components/chart/words";
import { agentSwitches, type SwitchTrace } from "@/lib/agent-switch";
import {
  syntheticSavedBuild,
  syntheticSwitchBuild,
} from "../../e2e/synthetic-build";

const venue = (n: number, name: string) => ({ entityId: `v-${n}`, name });
// Shaped like a real first plan: two anchors read in one round, a backup named for later.
const HALL = venue(1, "Lamplight Hall Boise");
const ARTS = venue(2, "Juniper Arts Collective (JAC)");
const ROOM = venue(3, "Owyhee Room");
const OTHER = venue(4, "Basque Block Social");

const read = (band: "Mid" | "Opener", room: { name: string }) => ({
  tool: "venue_artists",
  summary: `${band}-band artists for the headliners and ${room.name}`,
});
const plain = (tool: string) => ({ tool, summary: `${tool} call` });
const SETUP = [
  plain("search_artist"),
  plain("search_artist"),
  plain("find_tag"),
  plain("find_venues"),
  plain("compare_headliners"),
  {
    tool: "baseline_artists",
    summary: "Mid-band artists for the headliners alone",
  },
  {
    tool: "baseline_artists",
    summary: "Opener-band artists for the headliners alone",
  },
];
const on = (room: { entityId: string; name: string }, n: number) =>
  Array.from({ length: n }, () => ({ anchorVenue: room }));

function boiseShaped(overrides: Partial<SwitchTrace> = {}): SwitchTrace {
  return {
    trace: [
      ...SETUP,
      read("Mid", HALL),
      read("Opener", HALL),
      read("Mid", ARTS),
      read("Opener", ARTS),
      read("Mid", ROOM),
    ],
    notes: [
      {
        at: 4,
        text: "Anchors: Lamplight Hall, JAC (Owyhee Room is a backup).",
      },
      {
        at: 11,
        text: "Lamplight Hall lifted nothing; try Owyhee Room for both bands (1 call left).",
      },
    ],
    acts: [...on(ARTS, 8), ...on(ROOM, 2)],
    venues: [HALL, ARTS, ROOM],
    ...overrides,
  };
}

describe("the agent's switch in a saved trace", () => {
  it("finds the switch to the backup named after the first round's result", () => {
    expect(agentSwitches(boiseShaped())).toEqual([
      { from: HALL, to: ROOM, acts: 2, note: 1 },
    ]);
  });

  it("says it in one sentence, with the acts that read put on the lineup", () => {
    const [found] = agentSwitches(boiseShaped());
    expect(switchLine(found)).toBe(
      "Lamplight Hall Boise's fans moved no act onto the lineup, so the agent read Owyhee Room; 2 acts come from that read.",
    );
    expect(switchLine({ ...found, acts: 1 })).toBe(
      "Lamplight Hall Boise's fans moved no act onto the lineup, so the agent read Owyhee Room; 1 act comes from that read.",
    );
    expect(switchLine({ ...found, acts: 0 })).toBe(
      "Lamplight Hall Boise's fans moved no act onto the lineup, so the agent read Owyhee Room; no act comes from that read.",
    );
  });

  it("doesn't count a venue planned from the start, read in the first round after one that lifted nothing", () => {
    // JAC follows Lamplight Hall in call order and Lamplight Hall lifted nothing, but no line of
    // the planner's came between them: both were anchors from the first plan. Without the later
    // line, the backup's read isn't explained either.
    expect(
      agentSwitches(boiseShaped({ notes: [boiseShaped().notes[0]] })),
    ).toEqual([]);
    expect(agentSwitches(boiseShaped()).map((found) => found.to)).toEqual([
      ROOM,
    ]);
  });

  it("adds nothing when the venue read before the line moved acts onto the lineup", () => {
    expect(
      agentSwitches(
        boiseShaped({ acts: [...on(HALL, 1), ...on(ARTS, 7), ...on(ROOM, 2)] }),
      ),
    ).toEqual([]);
  });

  it("adds nothing when the line doesn't name the next venue read", () => {
    const { notes } = boiseShaped();
    expect(
      agentSwitches(
        boiseShaped({
          notes: [
            notes[0],
            {
              at: 11,
              text: "Lamplight Hall lifted nothing; use the last call.",
            },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("adds nothing when the venue the line names isn't the next one read", () => {
    const trace = [
      ...boiseShaped().trace.slice(0, 11),
      read("Mid", OTHER),
      read("Opener", ROOM),
    ];
    expect(
      agentSwitches(boiseShaped({ trace, venues: [HALL, ARTS, ROOM, OTHER] })),
    ).toEqual([]);
  });

  it("adds nothing when the venue the line names was read already", () => {
    const { notes } = boiseShaped();
    expect(
      agentSwitches(
        boiseShaped({
          trace: [...boiseShaped().trace.slice(0, 11), read("Mid", ARTS)],
          notes: [
            notes[0],
            { at: 11, text: "Lamplight Hall lifted nothing; read JAC again." },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("takes the venue the line names when two read before it moved nothing, and adds nothing when it names neither", () => {
    const trace = [
      ...SETUP,
      read("Mid", HALL),
      read("Mid", OTHER),
      read("Mid", ARTS),
      read("Mid", ROOM),
    ];
    const acts = [...on(ARTS, 8), ...on(ROOM, 2)];
    const venues = [HALL, ARTS, ROOM, OTHER];
    const named = {
      at: 10,
      text: "Basque Block Social lifted nothing; try Owyhee Room.",
    };
    expect(agentSwitches({ trace, acts, venues, notes: [named] })).toEqual([
      { from: OTHER, to: ROOM, acts: 2, note: 0 },
    ]);
    expect(
      agentSwitches({
        trace,
        acts,
        venues,
        notes: [{ at: 10, text: "Try Owyhee Room." }],
      }),
    ).toEqual([]);
  });

  it("adds nothing when a venue call names no venue the build read, or two of them", () => {
    expect(
      agentSwitches(
        boiseShaped({
          trace: [
            ...boiseShaped().trace.slice(0, 11),
            read("Mid", { name: "Owyhee Annex" }),
          ],
        }),
      ),
    ).toEqual([]);
    expect(
      agentSwitches(
        boiseShaped({
          venues: [HALL, ARTS, ROOM, { entityId: "v-9", name: ROOM.name }],
        }),
      ),
    ).toEqual([]);
  });

  it("reads a venue call by the longest venue name it holds", () => {
    const LOUNGE = venue(5, "Owyhee Room Lounge");
    const trace = [...boiseShaped().trace.slice(0, 11), read("Mid", LOUNGE)];
    expect(
      agentSwitches(
        boiseShaped({
          trace,
          venues: [HALL, ARTS, ROOM, LOUNGE],
          acts: [...on(ARTS, 8), ...on(LOUNGE, 2)],
          notes: [
            boiseShaped().notes[0],
            {
              at: 11,
              text: "Lamplight Hall lifted nothing; try Owyhee Room Lounge.",
            },
          ],
        }),
      ),
    ).toEqual([{ from: HALL, to: LOUNGE, acts: 2, note: 1 }]);
  });

  it("names a venue in the line by its full name, its name without the note in brackets, or that note", () => {
    // A first plan with one anchor; JAC is read in a second round, after its result.
    const notes = [{ at: 4, text: "Anchors: Lamplight Hall for both bands." }];
    const trace = [
      ...SETUP,
      read("Mid", HALL),
      read("Opener", HALL),
      read("Mid", ARTS),
    ];
    const acts = on(ARTS, 3);
    for (const text of [
      "Lamplight Hall lifted nothing; try JAC.",
      "Lamplight Hall lifted nothing; try Juniper Arts Collective.",
      "Lamplight Hall lifted nothing; try Juniper Arts Collective (JAC).",
    ])
      expect(
        agentSwitches({
          trace,
          acts,
          venues: [HALL, ARTS],
          notes: [notes[0], { at: 9, text }],
        }),
        text,
      ).toEqual([{ from: HALL, to: ARTS, acts: 3, note: 1 }]);
    // A name inside another word isn't a mention.
    expect(
      agentSwitches({
        trace,
        acts,
        venues: [HALL, ARTS],
        notes: [
          notes[0],
          { at: 9, text: "Lamplight Hall lifted nothing; try JACKSON's." },
        ],
      }),
    ).toEqual([]);
  });

  it("finds none in the synthetic build, and one in the synthetic build whose planner switched", () => {
    const of = (
      build: ReturnType<typeof syntheticSavedBuild>,
    ): SwitchTrace => ({
      trace: build.trace,
      notes: build.notes ?? [],
      acts: build.lineup.acts,
      venues: [
        ...(build.context.anchors.mid ?? []),
        ...(build.context.anchors.opener ?? []),
      ],
    });
    expect(agentSwitches(of(syntheticSavedBuild()))).toEqual([]);
    const [found, ...more] = agentSwitches(of(syntheticSwitchBuild()));
    expect(more).toEqual([]);
    expect(switchLine(found)).toBe(
      "Cottonwood Social Hall's fans moved no act onto the lineup, so the agent read Fort Street Ballroom; 3 acts come from that read.",
    );
  });
});
