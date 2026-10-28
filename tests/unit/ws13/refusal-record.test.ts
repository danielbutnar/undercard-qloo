// Daniel, 28 October (19:20): "Tonight's comparison must list every time the planner tried to
// finish before reading two rooms and was refused." Each refusal is one of the run's decision
// lines (a status event with planner: true): the trace prints it, the build saves it in its
// notes, a replay says it again, and it can be counted by its first words. Invented data only.
import { describe, expect, it } from "vitest";
import { REFUSED_PREFIX, refusedLine } from "@/lib/agent-words";
import type { BuildEvent } from "@/lib/build-events";
import { createBuildStore } from "@/server/build-store";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleUndercardBuild } from "@/server/undercard-build";
import { fakeFetch, syntheticQloo } from "../m2/fake-qloo";
import { readEvents } from "../m3/scripted";
import {
  FORT,
  HALL,
  LANTERN,
  LARKSPUR_FESTIVAL,
  OPENING,
  read,
  runAgent,
  scriptedModel,
  type ToolCall,
  type Turn,
} from "./agent-kit";

const finish: ToolCall[] = [
  {
    name: "finish",
    input: {
      anchor_venue_ids: [],
      summary: "Done reading.",
      stopped_because: "every_band_full",
    },
  },
];
const both = (venue: string): ToolCall[] => [
  read("mid", venue),
  read("opener", venue),
];
const PLAN: Turn[] = [
  ...OPENING,
  both(HALL), // no fan data
  finish, // refused: none yet
  both(LANTERN),
  { text: "That is enough." }, // refused: one
  both(FORT),
  finish,
];

const refusals = (events: BuildEvent[]) =>
  events.flatMap((event) =>
    event.type === "status" &&
    event.planner &&
    event.text.startsWith(REFUSED_PREFIX)
      ? [event.text]
      : [],
  );

describe("each refusal to stop before two rooms is recorded (Daniel, 19:20)", () => {
  it("words a refusal with the venues read and those not tried yet", () => {
    expect(refusedLine(1, ["Fort Street Ballroom", "Sagebrush Diner"])).toBe(
      "Tried to stop after 1 music venue with fan data; refused: two are needed. Not tried yet: Fort Street Ballroom, Sagebrush Diner.",
    );
    expect(refusedLine(0, ["The Lantern Room"])).toBe(
      "Tried to stop after 0 music venues with fan data; refused: two are needed. Not tried yet: The Lantern Room.",
    );
    expect(refusedLine(1, [])).toMatch(new RegExp(`^${REFUSED_PREFIX}`));
  });

  it("is a decision line of the run, for a refused finish and for a turn ended without one", async () => {
    const { events } = await runAgent(scriptedModel(PLAN).model);
    expect(refusals(events)).toEqual([
      "Tried to stop after 0 music venues with fan data; refused: two are needed. Not tried yet: The Lantern Room, Fort Street Ballroom, Sagebrush Diner.",
      "Tried to stop after 1 music venue with fan data; refused: two are needed. Not tried yet: Fort Street Ballroom, Sagebrush Diner.",
    ]);
  });

  it("is saved with the build and said again in its replay, so it can be counted", async () => {
    const cache = createMemoryCache();
    const store = createBuildStore(cache);
    const qloo = createQlooClient({
      apiKey: "k",
      cache,
      fetch: fakeFetch(syntheticQloo).fetch,
    });
    const run = (fresh: boolean) =>
      readEvents(
        handleUndercardBuild({
          festival: LARKSPUR_FESTIVAL,
          limiter: createMemoryLimiter(),
          ip: "203.0.113.7",
          store,
          fresh,
          replayDelayMs: 0,
          qloo: () => qloo,
          model: () => scriptedModel(PLAN).model,
          cachedQloo: () => qloo,
        }),
      );
    const live = await run(true);
    const saved = await store.latest(LARKSPUR_FESTIVAL.id);
    expect(
      saved?.notes?.filter((note) => note.text.startsWith(REFUSED_PREFIX)),
    ).toHaveLength(2);
    const replay = await run(false);
    expect(refusals(replay)).toEqual(refusals(live));
  });
});
