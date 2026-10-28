// Daniel, 28 October (17:10): "Controls, worded honestly. On the card and in the trace, the control
// is "a room in <town> with similar Qloo popularity", not "a matched venue"." The planner's own
// lines follow: neither its prompt nor what the tools tell it says matched. The card's line is in
// local-lift.test.tsx, the refill's and redraft's in second-venue.test.ts. Invented data only.
import { describe, expect, it } from "vitest";
import { controlCallLine } from "@/lib/agent-words";
import { SYSTEM_PROMPT, systemPrompt } from "@/server/agent";
import { AGENT_TOOLS } from "@/server/agent-tools";
import { syntheticQloo } from "../m2/fake-qloo";
import {
  DINER,
  FORT,
  HALL,
  LANTERN,
  LARKSPUR_FESTIVAL,
  opened,
  OPENING,
  read,
  resultOf,
  runAgent,
  scriptedModel,
} from "./agent-kit";

const SIMILAR = "a room in Aarhus with similar Qloo popularity";

describe("the control in the trace (Daniel, 17:10)", () => {
  it("names the room, its town and the venue it is the control for, and never says matched", async () => {
    const { model } = scriptedModel([
      ...OPENING,
      [read("mid", LANTERN), read("opener", LANTERN)],
      [read("mid", FORT), read("opener", FORT)],
      [
        {
          name: "finish",
          input: {
            anchor_venue_ids: [LANTERN, FORT],
            summary: "Two venues.",
            stopped_because: "every_band_full",
          },
        },
      ],
    ]);
    const { calls } = await runAgent(model);
    const reads = calls.filter(
      (call) => call.tool === "control_artists" && !call.noFanData,
    );
    expect(reads.length).toBeGreaterThan(0);
    for (const call of reads)
      expect(call.summary).toMatch(
        new RegExp(
          `-band artists for the headliners and Aarhus Hall, ${SIMILAR}, the control for (The Lantern Room|Fort Street Ballroom)`,
        ),
      );
    expect(calls.find((call) => call.tool === "control_venues")?.summary).toBe(
      `Aarhus places tagged Live music venue, to find each venue's control: ${SIMILAR}`,
    );
    for (const call of calls) expect(call.summary).not.toMatch(/matched/i);
  });

  it("gives a control's call line in the same words", () => {
    expect(
      controlCallLine({ controlFor: "The Lantern Room", town: "Aarhus" }),
    ).toBe(`The control for The Lantern Room: ${SIMILAR}.`);
    expect(controlCallLine({ noFanData: "Aarhus Club", town: "Aarhus" })).toBe(
      "Qloo had no fan data for Aarhus Club: the next room in Aarhus with similar Qloo popularity is read.",
    );
  });
});

describe("the control in the planner's words (Daniel, 17:10)", () => {
  it("is described in the prompt as a room with similar Qloo popularity, and nothing the planner reads says matched", () => {
    expect(systemPrompt(LARKSPUR_FESTIVAL)).toMatch(
      /its control, a room in another town with similar Qloo popularity/,
    );
    expect(SYSTEM_PROMPT).not.toMatch(/matched/i);
    expect(JSON.stringify(AGENT_TOOLS)).not.toMatch(/matched/i);
  });

  it("comes back from a venue read in the same words", async () => {
    const { toolbox } = await opened();
    const outcome = await toolbox.run("venue_artists", {
      band: "mid",
      venue_id: LANTERN,
    });
    expect(resultOf(outcome).control).toBe(`Aarhus Hall, ${SIMILAR}`);
    expect(outcome.content).not.toMatch(/match/i);
  });

  it("says so in the same words when no room in the control town had fan data", async () => {
    // Every room in Aarhus is left out of the signal: Qloo has no fan data for any of them.
    const town = new Set([LANTERN, FORT, DINER, HALL]);
    const noControl = (url: URL) => {
      const room = (url.searchParams.get("signal.interests.entities") ?? "")
        .split(",")
        .at(2);
      const body = syntheticQloo(url) as object;
      return room &&
        !town.has(room) &&
        url.searchParams.get("filter.type") === "urn:entity:artist"
        ? {
            ...body,
            warnings: [
              { type: "not_found", "signal.interests.entities": [room] },
            ],
          }
        : body;
    };
    const { toolbox } = await opened(LARKSPUR_FESTIVAL, noControl);
    const outcome = await toolbox.run("venue_artists", {
      band: "mid",
      venue_id: LANTERN,
    });
    const result = resultOf(outcome);
    expect(result.control).toBeNull();
    expect(result.note).toBe(
      "No room in Aarhus with similar Qloo popularity had fan data to serve as The Lantern Room's control, so its acts can't be booked: read the next music venue.",
    );
    expect(outcome.content).not.toMatch(/match/i);
  });
});
