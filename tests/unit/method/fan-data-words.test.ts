// WS2, no fan data, in words: where Qloo had no fan data for a venue, the switch sentence, How it
// works' "The AI agent's choices" box and Watch's edition say so; every other venue keeps today's
// words. Invented names only.
import { describe, expect, it } from "vitest";
import { noFanDataLine, switchLine, watchLine } from "@/components/chart/words";
import type { ClimbEvent } from "@/lib/lift-climb";

const HALL = { entityId: "v-1", name: "Lamplight Hall" };
const ROOM = { entityId: "v-2", name: "Owyhee Room" };
const step = (moves: (number | null)[]): ClimbEvent => ({
  type: "climb",
  band: "mid",
  venue: HALL,
  acts: moves.map((move, n) => ({
    entityId: `a-${n}`,
    name: `Act ${n}`,
    move,
  })),
});
const NO_FAN =
  "Qloo had no fan data for this venue, so its ranking stays the headliners' own.";

describe("the switch sentence", () => {
  const found = { from: HALL, to: ROOM, acts: 2 };

  it("says Qloo had no fan data for venue A when it had none", () => {
    expect(switchLine(found, [HALL.entityId])).toBe(
      "Qloo had no fan data for Lamplight Hall, so the agent read Owyhee Room; 2 acts come from that read.",
    );
    expect(switchLine({ ...found, acts: 1 }, [HALL.entityId])).toBe(
      "Qloo had no fan data for Lamplight Hall, so the agent read Owyhee Room; 1 act comes from that read.",
    );
  });

  it("keeps its words where venue A's fans were read and moved nothing", () => {
    for (const noFanData of [undefined, [], [ROOM.entityId]])
      expect(switchLine(found, noFanData)).toBe(
        "Lamplight Hall's fans moved no act onto the lineup, so the agent read Owyhee Room; 2 acts come from that read.",
      );
  });
});

describe("How it works' line for venues Qloo had no fan data for", () => {
  it("names one venue or several", () => {
    expect(noFanDataLine([HALL.name])).toBe(
      "Lamplight Hall: the agent read it too, but Qloo had no fan data for it.",
    );
    expect(noFanDataLine([HALL.name, ROOM.name])).toBe(
      "Lamplight Hall and Owyhee Room: the agent read them too, but Qloo had no fan data for them.",
    );
  });
});

describe("Watch's edition for a venue Qloo had no fan data for", () => {
  it("says so in place of its no-act-climbs line, before and after the lineup is in", () => {
    expect(
      watchLine({
        first: false,
        step: step([null, null]),
        lifted: 0,
        noFanData: true,
      }),
    ).toBe(NO_FAN);
    expect(
      watchLine({
        first: false,
        step: step([null, null]),
        lifted: null,
        noFanData: true,
      }),
    ).toBe(NO_FAN);
  });

  it("keeps today's words for every other venue, and for one whose acts climb", () => {
    expect(
      watchLine({ first: false, step: step([null, null]), lifted: 0 }),
    ).toBe(
      "Qloo's ranking re-sorts with this venue's fans added: no act climbs 5 places onto the lineup.",
    );
    expect(
      watchLine({
        first: false,
        step: step([null, null]),
        lifted: null,
        noFanData: false,
      }),
    ).toBe(
      "Qloo's ranking re-sorts with this venue's fans added: no act in view climbs 5 places.",
    );
    expect(
      watchLine({
        first: false,
        step: step([7, null]),
        lifted: 1,
        noFanData: true,
      }),
    ).toBe(
      "Qloo's ranking re-sorts with this venue's fans added: 1 act climbs onto the lineup.",
    );
  });
});
