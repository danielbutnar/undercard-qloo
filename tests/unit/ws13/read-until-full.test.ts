// WS13 item 2: read until full. The planner reads music rooms until every tier is full or it has
// tried every music room Qloo listed, within Daniel's cap of 28 Qloo calls a live run; each venue
// read tells it how full each tier is, and the trace's last line says why it stopped.
import { describe, expect, it } from "vitest";
import { stopLine } from "@/lib/agent-words";
import { buildReducer, IDLE_BUILD, type BuildState } from "@/lib/build-state";
import { MAX_AGENT_TURNS, SYSTEM_PROMPT } from "@/server/agent";
import { AGENT_TOOLS, QLOO_CALL_CAP } from "@/server/agent-tools";
import { createBuildStore } from "@/server/build-store";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleUndercardBuild } from "@/server/undercard-build";
import { fakeFetch, syntheticQloo } from "../m2/fake-qloo";
import { readEvents } from "../m3/scripted";
import {
  DINER,
  HALL,
  LANTERN,
  LARKSPUR_FESTIVAL,
  opened,
  OPENING,
  read,
  resultOf,
  runAgent,
  scriptedModel,
  type Turn,
} from "./agent-kit";

const finishBecause = (venues: string[], because: string): Turn => [
  {
    name: "finish",
    input: {
      anchor_venue_ids: venues,
      summary: "Read until the tiers were full or the rooms ran out.",
      stopped_because: because,
    },
  },
];

describe("Daniel's cap (WS13.2)", () => {
  it("is 28 Qloo calls a live run", () => {
    expect(QLOO_CALL_CAP).toBe(28);
  });

  it("lets 28 calls through and refuses the 29th without calling Qloo", async () => {
    const { toolbox, requests } = await opened();
    while (toolbox.callsUsed() < QLOO_CALL_CAP)
      await toolbox.run("search_artist", {
        name: `Synthetic ${toolbox.callsUsed()}`,
      });
    const sent = requests.length;
    const refused = await toolbox.run("search_artist", { name: "One more" });
    expect(refused.isError).toBe(true);
    expect(refused.content).toMatch(/28/);
    expect(requests).toHaveLength(sent);
  });

  it("gives the planner enough turns to read room after room", () => {
    expect(MAX_AGENT_TURNS).toBeGreaterThanOrEqual(12);
  });
});

describe("each venue read says how full each tier is (WS13.2)", () => {
  it("counts the slots the rule fills so far, per tier, and the calls left", async () => {
    const { toolbox } = await opened();
    const hall = resultOf(
      await toolbox.run("venue_artists", { band: "mid", venue_id: HALL }),
    );
    expect(hall.tiers).toEqual({
      mid: { filled: 0, slots: 4 },
      opener: { filled: 0, slots: 6 },
    });
    expect(hall.every_tier_full).toBe(false);
    const lantern = resultOf(
      await toolbox.run("venue_artists", { band: "mid", venue_id: LANTERN }),
    );
    expect(lantern.tiers).toEqual({
      mid: { filled: 4, slots: 4 },
      opener: { filled: 0, slots: 6 },
    });
    expect(lantern.qloo_calls_left).toBe(QLOO_CALL_CAP - toolbox.callsUsed());
    const full = resultOf(
      await toolbox.run("venue_artists", { band: "opener", venue_id: LANTERN }),
    );
    expect(full.every_tier_full).toBe(true);
  });

  it("tells the planner, in one step of its prompt, to read until every tier is full or the rooms run out, within 28 calls", () => {
    expect(SYSTEM_PROMPT).toMatch(/28 Qloo calls/);
    const steps = SYSTEM_PROMPT.split("\n").filter((line) =>
      /until every (fee band|band|tier) is full/i.test(line),
    );
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatch(/every music venue/);
  });

  it("asks the planner, when it finishes, why it stopped", () => {
    const finishTool = AGENT_TOOLS.find((tool) => tool.name === "finish")!;
    const schema = finishTool.input_schema as {
      properties: Record<string, { enum?: string[] }>;
      required: string[];
    };
    expect(schema.properties.stopped_because.enum).toEqual([
      "every_band_full",
      "tried_every_music_room",
    ]);
    expect(schema.required).toContain("stopped_because");
  });
});

describe("the trace's last line says why the agent stopped (WS13.2)", () => {
  it("full: the next room after a venue with no fan data filled every tier", async () => {
    const { model } = scriptedModel([
      ...OPENING,
      [read("mid", HALL), read("opener", HALL)],
      [read("mid", LANTERN), read("opener", LANTERN)],
      finishBecause([LANTERN], "every_band_full"),
    ]);
    const { result, events } = await runAgent(model);
    expect(result.complete).toBe(true);
    const stopped = events.filter((event) => event.type === "stopped");
    expect(stopped).toEqual([
      {
        type: "stopped",
        reason: "full",
        text: stopLine({
          reason: "full",
          calls: 11,
          cap: QLOO_CALL_CAP,
          city: LARKSPUR_FESTIVAL.city,
          open: { mid: 0, opener: 0 },
        }),
      },
    ]);
    // After the last call; the lineup and done follow.
    const types = events.map((event) => event.type);
    expect(types.indexOf("stopped")).toBeGreaterThan(types.lastIndexOf("call"));
  });

  it("rooms: every music room was tried and slots stay open", async () => {
    const { model } = scriptedModel([
      ...OPENING,
      [
        read("mid", HALL),
        read("opener", HALL),
        read("mid", DINER),
        read("opener", DINER),
      ],
      finishBecause([], "tried_every_music_room"),
    ]);
    const { events } = await runAgent(model);
    const stopped = events.find((event) => event.type === "stopped");
    expect(stopped).toMatchObject({ reason: "rooms" });
    expect(stopped?.type === "stopped" && stopped.text).toBe(
      stopLine({
        reason: "rooms",
        calls: 11,
        cap: QLOO_CALL_CAP,
        city: LARKSPUR_FESTIVAL.city,
        open: { mid: 4, opener: 6 },
      }),
    );
  });

  it("cap: the run spent its 28 calls with slots open", async () => {
    const searches = (turn: number): Turn =>
      Array.from({ length: 6 }, (_, i) => ({
        name: "search_artist",
        input: { name: `Synthetic ${turn}-${i}` },
      }));
    const { model } = scriptedModel(searches);
    const { events, calls } = await runAgent(model);
    expect(calls).toHaveLength(QLOO_CALL_CAP);
    expect(events.find((event) => event.type === "stopped")).toMatchObject({
      reason: "cap",
    });
  });

  it("planner: it ended its turn with slots open and calls left, without saying the rooms ran out", async () => {
    const { model } = scriptedModel([
      ...OPENING,
      [read("mid", HALL), read("opener", HALL)],
      { text: "That is enough." },
    ]);
    const { events } = await runAgent(model);
    expect(events.find((event) => event.type === "stopped")).toMatchObject({
      reason: "planner",
    });
  });

  it("words each reason with the open slots in plain words", () => {
    const base = { calls: 15, cap: 28, city: "Larkspur" };
    expect(
      stopLine({ ...base, reason: "full", open: { mid: 0, opener: 0 } }),
    ).toBe(
      "The agent stopped reading venues: every tier is full, after 15 of its 28 Qloo calls.",
    );
    expect(
      stopLine({ ...base, reason: "rooms", open: { mid: 1, opener: 2 } }),
    ).toBe(
      "The agent stopped after trying every music venue Qloo listed in Larkspur: 1 mid-size slot and 2 opening slots stay open.",
    );
    expect(
      stopLine({ ...base, reason: "cap", open: { mid: 0, opener: 1 } }),
    ).toBe(
      "The agent stopped at its cap of 28 Qloo calls: 1 opening slot stays open.",
    );
    expect(
      stopLine({ ...base, reason: "planner", open: { mid: 2, opener: 0 } }),
    ).toBe(
      "The agent stopped before every tier was full: 2 mid-size slots stay open.",
    );
  });

  it("keeps the line with the board and with a saved build, so a replay ends on it too", async () => {
    const cache = createMemoryCache();
    const store = createBuildStore(cache);
    const plan = [
      ...OPENING,
      [read("mid", LANTERN), read("opener", LANTERN)],
      finishBecause([LANTERN], "every_band_full"),
    ];
    const qloo = createQlooClient({
      apiKey: "test-key",
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
          model: () => scriptedModel(plan).model,
          cachedQloo: () => qloo,
        }),
      );
    const live = await run(true);
    const saved = await store.latest(LARKSPUR_FESTIVAL.id);
    expect(saved?.stopped?.reason).toBe("full");
    const replay = await run(false);
    expect(replay[0]).toMatchObject({ type: "build", replayed: true });
    const line = (events: typeof live) =>
      events.flatMap((event) => (event.type === "stopped" ? [event] : []))[0];
    expect(line(replay)).toEqual(line(live));
    const types = replay.map((event) => event.type);
    expect(types.indexOf("stopped")).toBeGreaterThan(types.lastIndexOf("call"));

    const state = replay.reduce<BuildState>(
      (board, event) => buildReducer(board, { type: "event", event }),
      { ...IDLE_BUILD, status: "building" },
    );
    expect(state.stopped?.text).toBe(line(live).text);
  });
});
