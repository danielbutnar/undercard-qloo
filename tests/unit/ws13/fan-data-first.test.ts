// WS13 item 1: fan data first. Qloo's not_found warning reaches the planner in venue_artists'
// result, in plain words; the planner skips that venue and reads the next music room, and the
// trace says so. Invented data only (tests/unit/m2/fake-qloo.ts's Larkspur).
import { describe, expect, it } from "vitest";
import { agentSwitches } from "@/lib/agent-switch";
import { SYSTEM_PROMPT } from "@/server/agent";
import { switchLine } from "@/components/chart/words";
import { syntheticQloo } from "../m2/fake-qloo";
import {
  DINER,
  finish,
  FORT,
  HALL,
  HALL_NAME,
  LANTERN,
  LARKSPUR_FESTIVAL,
  opened,
  OPENING,
  read,
  resultOf,
  runAgent,
  scriptedModel,
} from "./agent-kit";

describe("venue_artists passes Qloo's fan data to the planner (WS13.1)", () => {
  it("says in plain words that Qloo had no fan data for a venue, and tells the planner to read the next music room", async () => {
    const { toolbox, calls } = await opened();
    const outcome = await toolbox.run("venue_artists", {
      band: "mid",
      venue_id: HALL,
    });
    expect(outcome.isError).toBe(false);
    const result = resultOf(outcome);
    expect(result.fan_data).toBe(false);
    expect(result.note).toContain(`Qloo had no fan data for ${HALL_NAME}`);
    expect(result.note).toMatch(/next music venue/);
    // The call's trace line carries it, so the Qloo calls list, Watch and a replay can say so.
    expect(calls().at(-1)).toMatchObject({
      tool: "venue_artists",
      noFanData: HALL_NAME,
    });
  });

  it("says a venue with fan data has it, and lists what it lifts", async () => {
    const { toolbox, calls } = await opened();
    const result = resultOf(
      await toolbox.run("venue_artists", { band: "mid", venue_id: LANTERN }),
    );
    expect(result.fan_data).toBe(true);
    expect(result.acts_lifted_5_or_more_places).toBeGreaterThan(0);
    expect(calls().at(-1)!.noFanData).toBeUndefined();
  });

  it("reads Qloo's warning itself: a venue it names has no fan data even when its ranking moved", async () => {
    // The Lantern Room's answer, with Qloo's not_found warning naming it.
    const warned = (url: URL) => {
      const body = syntheticQloo(url) as Record<string, unknown>;
      const signal = url.searchParams.get("signal.interests.entities") ?? "";
      return signal.endsWith(LANTERN)
        ? {
            ...body,
            warnings: [
              { type: "not_found", "signal.interests.entities": [LANTERN] },
            ],
          }
        : body;
    };
    const { toolbox, calls } = await opened(LARKSPUR_FESTIVAL, warned);
    const result = resultOf(
      await toolbox.run("venue_artists", { band: "opener", venue_id: LANTERN }),
    );
    expect(result.fan_data).toBe(false);
    expect(calls().at(-1)!.noFanData).toBe("The Lantern Room");
  });

  it("also knows when a ranking is the headliners' own, score for score, with no warning (evidence 35)", async () => {
    // The invented diner's answer is the headliners-only ranking with no warning.
    const { toolbox, calls } = await opened();
    const result = resultOf(
      await toolbox.run("venue_artists", { band: "mid", venue_id: DINER }),
    );
    expect(result.fan_data).toBe(false);
    expect(calls().at(-1)!.noFanData).toBe("Sagebrush Diner");
  });

  it("never spends a Qloo call reading a venue again once Qloo had no fan data for it", async () => {
    const { toolbox, requests, calls } = await opened();
    await toolbox.run("venue_artists", { band: "mid", venue_id: HALL });
    const before = requests.length;
    const used = toolbox.callsUsed();
    const again = resultOf(
      await toolbox.run("venue_artists", { band: "opener", venue_id: HALL }),
    );
    expect(requests).toHaveLength(before);
    expect(toolbox.callsUsed()).toBe(used);
    expect(calls()).toHaveLength(used);
    expect(again.fan_data).toBe(false);
    expect(again.note).toMatch(/no call was made/i);
  });

  it("tells the planner, in the system prompt, to skip a venue Qloo had no fan data for", () => {
    expect(SYSTEM_PROMPT).toMatch(/no fan data/);
    expect(SYSTEM_PROMPT).toMatch(/next music venue/);
  });
});

describe("the trace of a new run says why the agent read the next venue (WS13.1)", () => {
  // The planner reads the first two music rooms, learns Qloo had no fan data for the second,
  // and reads the next one in its place.
  const PLAN = [
    ...OPENING,
    [
      read("mid", LANTERN),
      read("opener", LANTERN),
      read("mid", HALL),
      read("opener", HALL),
    ],
    {
      text: `Qloo had no fan data for ${HALL_NAME}, so I read Fort Street Ballroom next.`,
      calls: [read("mid", FORT), read("opener", FORT)],
    },
    finish([LANTERN, FORT]),
  ];

  it("skips the venue with no fan data and books from the rooms with it", async () => {
    const { model } = scriptedModel(PLAN);
    const { result, calls } = await runAgent(model);
    expect(result.complete).toBe(true);
    const booked = new Set(
      result.lineup!.acts.map((act) => act.anchorVenue.entityId),
    );
    expect(booked.has(HALL)).toBe(false);
    expect(calls.filter((call) => call.noFanData === HALL_NAME)).toHaveLength(
      2,
    );
  });

  it('gives "Qloo had no fan data for X, so the agent read Y" from the trace itself', async () => {
    const { model } = scriptedModel(PLAN);
    const { result, calls } = await runAgent(model);
    const venues = Object.values(result.context.anchors).flatMap(
      (list) => list ?? [],
    );
    const switches = agentSwitches({
      trace: calls,
      notes: [],
      acts: result.lineup!.acts,
      venues,
    });
    expect(switches).toHaveLength(1);
    expect(switches[0]).toMatchObject({
      from: { entityId: HALL, name: HALL_NAME },
      to: { entityId: FORT, name: "Fort Street Ballroom" },
      because: "no-fan-data",
    });
    const fort = result.lineup!.acts.filter(
      (act) => act.anchorVenue.entityId === FORT,
    ).length;
    expect(switchLine(switches[0], [HALL])).toBe(
      `Qloo had no fan data for ${HALL_NAME}, so the agent read Fort Street Ballroom. ${fort === 1 ? "1 act comes" : `${fort} acts come`} from that read.`,
    );
  });

  it("keeps WS8's order-only words for a saved 1.0 run, whose calls carry no warning", () => {
    const line = switchLine(
      {
        from: { entityId: HALL, name: HALL_NAME },
        to: { entityId: FORT, name: "Fort Street Ballroom" },
        acts: 2,
      },
      [HALL],
    );
    expect(line).toBe(
      `Qloo had no fan data for ${HALL_NAME}; the agent read Fort Street Ballroom next. 2 acts come from that read.`,
    );
  });

  it("runs in the town the brief names", () => {
    expect(LARKSPUR_FESTIVAL.city).toBe("Larkspur");
  });
});
