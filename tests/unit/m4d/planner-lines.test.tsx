// @vitest-environment jsdom
import type Anthropic from "@anthropic-ai/sdk";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { syntheticSavedBuild } from "../../e2e/synthetic-build";
import { fakeFetch, syntheticQloo } from "../m2/fake-qloo";
import { readEvents, scriptedPlanner } from "../m3/scripted";
import { TracePanel } from "@/components/trace-panel";
import type { BuildEvent } from "@/lib/build-events";
import { buildReducer, IDLE_BUILD, type BuildState } from "@/lib/build-state";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import type { AgentModel } from "@/server/ai";
import { createBuildStore, SavedBuildSchema } from "@/server/build-store";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleUndercardBuild } from "@/server/undercard-build";

afterEach(cleanup);

// What the scripted planner says before each turn's tool calls (invented text).
const LINES = [
  "Resolve both headliners and find the tag for live music venues.",
  "List Boise's places with that tag.",
  "Compare the headliners and rank each band for them alone.",
  "Seed each band with the two strongest rooms.",
  "Both rooms lifted acts in both bands; finish.",
];

function talkingPlanner(): AgentModel {
  const base = scriptedPlanner();
  let turn = 0;
  return {
    async nextTurn(request) {
      const message = await base.model.nextTurn(request);
      const text = LINES[turn++];
      return {
        ...message,
        content: text
          ? [{ type: "text", text, citations: null }, ...message.content]
          : message.content,
      } as Anthropic.Message;
    },
  };
}

function server() {
  const cache = createMemoryCache();
  const fake = fakeFetch(syntheticQloo);
  const store = createBuildStore(cache);
  const qloo = createQlooClient({
    apiKey: "test-key",
    cache,
    fetch: fake.fetch,
  });
  const model = talkingPlanner();
  const build = (fresh = false) =>
    handleUndercardBuild({
      festival: SAGEBRUSH_SOUND,
      limiter: createMemoryLimiter(),
      ip: "203.0.113.7",
      qloo: () => qloo,
      model: () => model,
      store,
      fresh,
      replayDelayMs: 1,
    });
  return { store, build };
}

// The planner lines and calls in the order a stream sends them.
const sequence = (events: BuildEvent[]) =>
  events.flatMap((event) =>
    event.type === "call"
      ? [`call ${event.call.n}`]
      : event.type === "status" && event.planner
        ? [`says ${event.text}`]
        : [],
  );

describe("the planner's lines", () => {
  it("are saved with a live build, each placed among the calls where it was said", async () => {
    const { store, build } = server();
    await readEvents(build(true));
    const saved = (await store.latest(SAGEBRUSH_SOUND.id))!;
    expect(saved.notes?.map((note) => note.text)).toEqual(LINES);
    expect(saved.notes?.[0].at).toBe(0);
    for (const [index, note] of (saved.notes ?? []).entries())
      if (index > 0)
        expect(note.at).toBeGreaterThan(saved.notes![index - 1].at);
  });

  it("replay in the order the live build said them", async () => {
    const { build } = server();
    const live = sequence(await readEvents(build(true)));
    const replay = sequence(await readEvents(build(false)));
    expect(replay).toEqual(live);
    expect(replay.filter((step) => step.startsWith("says"))).toHaveLength(5);
  });

  it("are optional, so a build saved before them still parses and replays", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { notes, ...older } = syntheticSavedBuild();
    expect("notes" in older).toBe(false);
    expect(SavedBuildSchema.safeParse(older).success).toBe(true);
  });
});

describe("the trace panel", () => {
  function replayed(): BuildState {
    let state = buildReducer(IDLE_BUILD, { type: "start" });
    const events: BuildEvent[] = [
      {
        type: "build",
        id: "b",
        createdAt: "2026-10-15T14:02:00.000Z",
        replayed: true,
      },
      { type: "status", text: "Replaying the saved build." },
      { type: "status", text: LINES[0], planner: true },
      ...[1, 2].map((n): BuildEvent => ({
        type: "call",
        call: {
          n,
          tool: "search_artist",
          endpoint: "/search",
          summary: `Call ${n}`,
          params: [],
          resultCount: 3,
          ms: 10,
          cached: true,
        },
      })),
      { type: "status", text: LINES[4], planner: true },
      { type: "done", calls: 2, ms: 20 },
    ];
    for (const event of events)
      state = buildReducer(state, { type: "event", event });
    return state;
  }

  it("keeps the planner's lines, not the server's status, with the call count when each was said", () => {
    expect(replayed().notes).toEqual([
      { at: 0, text: LINES[0] },
      { at: 2, text: LINES[4] },
    ]);
  });

  it("prints each line in the trace, before the call it led to and after the last call", () => {
    render(<TracePanel state={replayed()} onBuild={() => {}} />);
    const rows = within(
      screen.getByRole("list", { name: "Qloo calls" }),
    ).getAllByRole("listitem");
    expect(rows[0].textContent).toMatch(
      new RegExp(`^Agent: ${LINES[0]}1\\. Call 1`),
    );
    expect(rows[1].textContent).toMatch(/^2\. Call 2/);
    expect(rows[1].textContent).toContain(`Agent: ${LINES[4]}`);
  });
});
