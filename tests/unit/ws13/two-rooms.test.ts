// Daniel, 28 October (17:10): "At least two rooms. The agent reads at least two music rooms with
// fan data, each with its control, before it may stop. Then it keeps reading until every tier is
// full, and the rule takes the strongest matches across all rooms read. A town with only one room
// with fan data says so in its stop line." Enforced in code: finish isn't accepted until two
// rooms with fan data have been read with their controls, unless every music venue find_venues
// listed has been tried, or the cap is reached. Invented data only.
import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "@/server/agent";
import { syntheticId, syntheticQloo } from "../m2/fake-qloo";
import {
  DINER,
  FORT,
  HALL,
  LANTERN,
  OPENING,
  read,
  runAgent,
  scriptedModel,
  type ToolCall,
  type Turn,
} from "./agent-kit";

const finish = (notMusic: string[] = []): ToolCall[] => [
  {
    name: "finish",
    input: {
      anchor_venue_ids: [],
      summary: "Done reading.",
      stopped_because: "every_band_full",
      not_music_venues: notMusic.map((id) => ({
        entity_id: id,
        reason: "a restaurant, not a music room",
      })),
    },
  },
];
const both = (venue: string): ToolCall[] => [
  read("mid", venue),
  read("opener", venue),
];

describe("at least two rooms with fan data (Daniel, 17:10)", () => {
  it("asks for it in the prompt", () => {
    expect(SYSTEM_PROMPT).toMatch(/at least two music venues with fan data/);
  });

  it("refuses finish until a second room with fan data is read, when the first had none", async () => {
    const { model, requests } = scriptedModel([
      ...OPENING,
      both(HALL), // no fan data
      finish(), // refused: no room with fan data yet
      both(LANTERN),
      finish(), // refused: one room
      both(FORT),
      finish(), // accepted: two rooms
    ]);
    const { result, calls } = await runAgent(model);
    // The two refusals came back to the planner as errors.
    const finishes = requests.flatMap((request) =>
      request.messages.flatMap((message) =>
        Array.isArray(message.content)
          ? message.content.filter(
              (block) =>
                block.type === "tool_result" &&
                typeof block.content === "string" &&
                block.content.includes("at least two music venues"),
            )
          : [],
      ),
    );
    expect(finishes.length).toBeGreaterThanOrEqual(2);
    const read = new Set(
      calls
        .filter((call) => call.tool === "venue_artists")
        .map((call) => call.summary),
    );
    expect([...read].some((summary) => summary.includes("Fort Street"))).toBe(
      true,
    );
    expect(result.context.anchors.mid?.map((venue) => venue.entityId)).toEqual([
      HALL,
      LANTERN,
      FORT,
    ]);
  });

  it("lets the second room's stronger acts take slots from the first room's", async () => {
    // Fort Street Ballroom's fans give its acts a stronger match than the Lantern Room's.
    const stronger = (url: URL) => {
      const body = syntheticQloo(url) as {
        results?: { entities: { query?: { affinity?: number } }[] };
      };
      const signal = url.searchParams.get("signal.interests.entities") ?? "";
      if (!signal.endsWith(FORT) || !body.results) return body;
      return {
        ...body,
        results: {
          entities: body.results.entities.map((entity, position) => ({
            ...entity,
            query: { affinity: 0.99 - position * 0.001 },
          })),
        },
      };
    };
    const { model } = scriptedModel([
      ...OPENING,
      both(LANTERN),
      finish(), // refused: one room
      both(FORT),
      finish(),
    ]);
    const { result } = await runAgent(model, undefined, stronger);
    const mid = result.lineup!.acts.filter((act) => act.band === "mid");
    expect(mid).toHaveLength(4);
    expect(mid.every((act) => act.anchorVenue.entityId === FORT)).toBe(true);
  });

  it("says so in its stop line when only one room had fan data", async () => {
    // Fort Street Ballroom has no fan data in this town either: Qloo leaves it out of the
    // signal, ranks the headliners' own list and says so.
    const oneRoom = (url: URL) => {
      const signal = url.searchParams.get("signal.interests.entities") ?? "";
      if (
        !signal.endsWith(FORT) ||
        url.searchParams.get("filter.type") !== "urn:entity:artist"
      )
        return syntheticQloo(url);
      const alone = new URL(url);
      alone.searchParams.set(
        "signal.interests.entities",
        signal.split(",").slice(0, 2).join(","),
      );
      return {
        ...(syntheticQloo(alone) as object),
        warnings: [{ type: "not_found", "signal.interests.entities": [FORT] }],
      };
    };
    const { model } = scriptedModel([
      ...OPENING,
      both(LANTERN),
      both(HALL),
      both(FORT),
      finish([DINER]), // every music venue tried; the diner isn't one
    ]);
    const { events } = await runAgent(model, undefined, oneRoom);
    const stopped = events.find((event) => event.type === "stopped");
    expect(stopped?.type === "stopped" && stopped.text).toMatch(
      /Only one music venue in Larkspur had fan data\./,
    );
  });

  it("counts the venues read in finish's own turn", async () => {
    const { model, requests } = scriptedModel([
      ...OPENING,
      both(LANTERN),
      [...both(FORT), ...finish()],
    ]);
    const { result } = await runAgent(model);
    const refused = requests.flatMap((request) =>
      request.messages.flatMap((message) =>
        Array.isArray(message.content)
          ? message.content.filter(
              (block) => block.type === "tool_result" && block.is_error,
            )
          : [],
      ),
    );
    expect(refused).toEqual([]);
    expect(requests).toHaveLength(OPENING.length + 2);
    expect(result.context.anchors.mid?.map((venue) => venue.entityId)).toEqual([
      LANTERN,
      FORT,
    ]);
  });

  it("asks again when the planner ends its turn without finishing", async () => {
    const { model, requests } = scriptedModel([
      ...OPENING,
      both(LANTERN),
      { text: "That is enough." },
      both(FORT),
      finish(),
    ]);
    const { result } = await runAgent(model);
    const asked = requests[OPENING.length + 2].messages.at(-1);
    expect(asked?.role).toBe("user");
    expect(String(asked?.content)).toMatch(/at least two music venues/);
    expect(result.context.anchors.mid?.map((venue) => venue.entityId)).toEqual([
      LANTERN,
      FORT,
    ]);
  });

  it("accepts finish with one room at the cap", async () => {
    const searches = (turn: number): Turn =>
      Array.from({ length: 7 }, (_, i) => ({
        name: "search_artist",
        input: { name: `Spent ${turn}-${i}` },
      }));
    const { model } = scriptedModel([
      ...OPENING,
      searches(0),
      searches(1),
      both(LANTERN),
      finish(),
    ]);
    const { result, events } = await runAgent(model);
    expect(result.context.anchors.mid?.map((venue) => venue.entityId)).toEqual([
      LANTERN,
    ]);
    expect(syntheticId(201)).toBe(LANTERN);
    // Fort Street Ballroom was never tried, so the line speaks of the reading, not the town.
    const stopped = events.find((event) => event.type === "stopped");
    expect(stopped?.type === "stopped" && stopped.text).toMatch(
      /Only one music venue with fan data was read\.$/,
    );
  });
});
