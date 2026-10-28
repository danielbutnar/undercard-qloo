// @vitest-environment jsdom
// Daniel, 28 October (19:10), on not_music_venues: "OK only if it's visible. Every place excluded
// this way gets a decision line with the planner's reason, in the trace and on the setlist (e.g.
// "Skipped Venue 141: listed by Qloo, but a restaurant, not a music room")." Each place carries the
// planner's reason, required; its line is one of the planner's lines (a status event with
// planner: true), so the trace prints it, the build saves it in its notes and a replay says it
// again where it was said. Invented data only.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TracePanel } from "@/components/trace-panel";
import { skippedLine } from "@/lib/agent-words";
import type { BuildEvent } from "@/lib/build-events";
import { buildReducer, IDLE_BUILD, type BuildState } from "@/lib/build-state";
import { AGENT_TOOLS } from "@/server/agent-tools";
import { createBuildStore } from "@/server/build-store";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleUndercardBuild } from "@/server/undercard-build";
import { fakeFetch, syntheticQloo } from "../m2/fake-qloo";
import { readEvents } from "../m3/scripted";
import {
  DINER,
  FORT,
  LANTERN,
  LARKSPUR_FESTIVAL,
  opened,
  OPENING,
  read,
  runAgent,
  scriptedModel,
  type Turn,
} from "./agent-kit";

afterEach(cleanup);

const REASON = "a restaurant, not a music room";
const LINE = `Skipped Sagebrush Diner: listed by Qloo, but ${REASON}`;

const finishSkipping = (skipped: unknown[]): Turn => [
  {
    name: "finish",
    input: {
      anchor_venue_ids: [LANTERN, FORT],
      summary: "Two venues filled both tiers.",
      stopped_because: "every_band_full",
      not_music_venues: skipped,
    },
  },
];
const PLAN: Turn[] = [
  ...OPENING,
  [read("mid", LANTERN), read("opener", LANTERN)],
  [read("mid", FORT), read("opener", FORT)],
  finishSkipping([{ entity_id: DINER, reason: REASON }]),
];

const plannerLines = (events: BuildEvent[]) =>
  events.flatMap((event) =>
    event.type === "status" && event.planner ? [event.text] : [],
  );

describe("a place the planner skips as not a music venue (Daniel, 19:10)", () => {
  it("is named with the planner's reason, both required", () => {
    const finish = AGENT_TOOLS.find((tool) => tool.name === "finish")!;
    const schema = finish.input_schema as {
      properties: Record<
        string,
        { items?: { properties: Record<string, unknown>; required: string[] } }
      >;
    };
    expect(schema.properties.not_music_venues.items?.required).toEqual([
      "entity_id",
      "reason",
    ]);
    expect(skippedLine("Venue 141", REASON)).toBe(
      "Skipped Venue 141: listed by Qloo, but a restaurant, not a music room",
    );
  });

  it("isn't skipped without a reason", async () => {
    const { toolbox, events } = await opened();
    const outcome = await toolbox.run("finish", {
      anchor_venue_ids: [],
      summary: "Done.",
      stopped_because: "every_band_full",
      not_music_venues: [{ entity_id: DINER, reason: "  " }],
    });
    expect(outcome.isError).toBe(true);
    expect(
      plannerLines(events).some((text) => text.startsWith("Skipped")),
    ).toBe(false);
  });

  it("gets its decision line in the trace, where the planner skipped it", async () => {
    const { events } = await runAgent(scriptedModel(PLAN).model);
    expect(plannerLines(events)).toContain(LINE);
    // Said before the planner's closing sentence, after the last venue read.
    const lines = plannerLines(events);
    expect(lines.indexOf(LINE)).toBeLessThan(
      lines.indexOf("Two venues filled both tiers."),
    );
    const state = events.reduce<BuildState>(
      (board, event) => buildReducer(board, { type: "event", event }),
      { ...IDLE_BUILD, status: "building" },
    );
    expect(state.notes.map((note) => note.text)).toContain(LINE);
    render(<TracePanel state={state} onBuild={() => {}} />);
    expect(screen.getByText(LINE)).toBeTruthy();
  });

  it("is saved with the build and said again in its replay", async () => {
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
    await run(true);
    const saved = await store.latest(LARKSPUR_FESTIVAL.id);
    expect(saved?.notes?.map((note) => note.text)).toContain(LINE);
    const replay = await run(false);
    expect(replay[0]).toMatchObject({ type: "build", replayed: true });
    expect(plannerLines(replay)).toContain(LINE);
  });

  it("is said once, and never for a place the planner read", async () => {
    const { events } = await runAgent(
      scriptedModel([
        ...OPENING,
        [read("mid", LANTERN), read("opener", LANTERN)],
        [read("mid", FORT), read("opener", FORT)],
        finishSkipping([
          { entity_id: DINER, reason: REASON },
          { entity_id: DINER, reason: REASON },
          { entity_id: FORT, reason: "a ballroom" },
        ]),
      ]).model,
    );
    const skipped = plannerLines(events).filter((text) =>
      text.startsWith("Skipped"),
    );
    expect(skipped).toEqual([LINE]);
  });
});
