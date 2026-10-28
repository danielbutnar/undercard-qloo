// @vitest-environment jsdom
// Daniel, 28 October (19:20): "Keep the client's own policy (section 8: up to 5 retries with
// backoff up to 8 s), so live builds stay as resilient as they are. "At most one" meant the agent
// adds no retries of its own on top. What I need is visibility: retries counted in the trace and
// stated wherever the page gives the call count ("20 Qloo calls, plus 2 retries"). If retries
// would push a run past the route's 120 s, the run stops retrying and says the bill may be
// short." So the agent retries only a call the client didn't (a 4xx, a network error, a
// timeout), once, after 1-2 s; a busy answer the client gave up on is a failed call, not the end
// of the build; and every retry, the client's included, is counted. Invented data only.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TracePanel } from "@/components/trace-panel";
import { stopLine } from "@/lib/agent-words";
import type { BuildEvent, TraceCall } from "@/lib/build-events";
import { buildReducer, IDLE_BUILD, type BuildState } from "@/lib/build-state";
import { createToolbox } from "@/server/agent-tools";
import { createQlooClient, QLOO_RETRY } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { fakeFetch, syntheticQloo } from "../m2/fake-qloo";
import {
  FORT,
  LANTERN,
  LARKSPUR_FESTIVAL,
  OPENING,
  read,
  runAgent,
  scriptedModel,
  type ToolCall,
  type Turn,
} from "./agent-kit";

afterEach(cleanup);

/** The Lantern Room's mid-size read, the call these tests make fail. */
const isLanternMid = (url: URL) =>
  (url.searchParams.get("signal.interests.entities") ?? "").endsWith(LANTERN) &&
  url.searchParams.get("filter.type") === "urn:entity:artist" &&
  url.searchParams.get("filter.popularity.min") === "0.8";

/** Answers `fail(n)` to the first matching requests, then Qloo's synthetic answer. */
function failing(times: number, fail: () => Response | never) {
  let seen = 0;
  return (url: URL) => {
    if (isLanternMid(url) && seen++ < times) return fail();
    return syntheticQloo(url);
  };
}
const status = (code: number) => () => new Response("{}", { status: code });

/** A toolbox past the opening turns, with the agent's wait and clock in the test's hands. */
async function opened(route: (url: URL) => unknown) {
  const fake = fakeFetch(route);
  const waits: number[] = [];
  let now = 1_000_000;
  const events: BuildEvent[] = [];
  const toolbox = createToolbox({
    festival: LARKSPUR_FESTIVAL,
    qloo: createQlooClient({
      apiKey: "k",
      cache: createMemoryCache(),
      fetch: fake.fetch,
      // The client's own backoff, instant here.
      sleep: async () => {},
      random: () => 0.5,
    }),
    emit: (event) => events.push(event),
    timing: {
      sleep: async (ms) => {
        waits.push(ms);
      },
      clock: () => now,
      random: () => 0.5,
    },
  });
  for (const turn of OPENING)
    for (const call of turn as ToolCall[])
      await toolbox.run(call.name, call.input);
  const lanternMid = () =>
    events.flatMap((event) =>
      event.type === "call" &&
      event.call.tool === "venue_artists" &&
      event.call.summary.startsWith("Mid-band") &&
      event.call.summary.includes("The Lantern Room")
        ? [event.call]
        : [],
    )[0] as TraceCall | undefined;
  const sent = () =>
    fake.requests.filter(({ url }) => isLanternMid(url)).length;
  return {
    toolbox,
    waits,
    sent,
    lanternMid,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
const readLantern = (kit: Awaited<ReturnType<typeof opened>>) =>
  kit.toolbox.run("venue_artists", { band: "mid", venue_id: LANTERN });

describe("who retries a call (Daniel, 19:20)", () => {
  it("keeps the client's own policy for a busy answer: up to 5 retries with backoff", () => {
    expect(QLOO_RETRY).toMatchObject({
      maxRetries: 5,
      baseDelayMs: 500,
      maxDelayMs: 8_000,
    });
  });

  it("leaves a busy answer to the client, with no retry of the agent's on top", async () => {
    const kit = await opened(failing(1, status(429)));
    const outcome = await readLantern(kit);
    expect(outcome.isError).toBe(false);
    expect(kit.sent()).toBe(2);
    expect(kit.waits).toEqual([]);
    expect(kit.lanternMid()?.retried).toEqual([429]);
  });

  it("treats a busy answer the client gave up on as a failed call: the venue unchecked, the run going on", async () => {
    const kit = await opened(failing(99, status(503)));
    const outcome = await readLantern(kit);
    expect(outcome.isError).toBe(true);
    expect(kit.sent()).toBe(1 + QLOO_RETRY.maxRetries);
    expect(kit.waits).toEqual([]);
    const line = kit.lanternMid();
    expect(line?.retried).toEqual(Array(QLOO_RETRY.maxRetries).fill(503));
    expect(line?.unchecked).toBe("The Lantern Room");
    expect(kit.toolbox.state.unchecked).toEqual(["The Lantern Room"]);
  });

  it("retries a 4xx the client doesn't retry, once, after 1 to 2 seconds", async () => {
    const kit = await opened(failing(1, status(400)));
    const outcome = await readLantern(kit);
    expect(outcome.isError).toBe(false);
    expect(kit.sent()).toBe(2);
    expect(kit.waits).toHaveLength(1);
    expect(kit.waits[0]).toBeGreaterThanOrEqual(1_000);
    expect(kit.waits[0]).toBeLessThanOrEqual(2_000);
    expect(kit.lanternMid()?.retried).toEqual([400]);
  });

  it("never tries a failed call a third time", async () => {
    const kit = await opened(failing(99, status(400)));
    const outcome = await readLantern(kit);
    expect(outcome.isError).toBe(true);
    expect(kit.sent()).toBe(2);
    expect(kit.waits).toHaveLength(1);
    expect(kit.lanternMid()?.unchecked).toBe("The Lantern Room");
  });

  it("retries a network error once, after the wait", async () => {
    const kit = await opened(
      failing(1, () => {
        throw new TypeError("fetch failed");
      }),
    );
    const outcome = await readLantern(kit);
    expect(outcome.isError).toBe(false);
    expect(kit.sent()).toBe(2);
    expect(kit.waits).toHaveLength(1);
    expect(kit.lanternMid()?.retried).toEqual([0]);
  });

  it("stops retrying where the run's retry time is spent: the call fails and its venue is unchecked", async () => {
    const kit = await opened(failing(1, status(400)));
    kit.advance(QLOO_RETRY.budgetMs);
    const outcome = await readLantern(kit);
    expect(outcome.isError).toBe(true);
    expect(kit.sent()).toBe(1);
    expect(kit.waits).toEqual([]);
    expect(kit.lanternMid()?.unchecked).toBe("The Lantern Room");
  });
});

describe("every stop line states the total, retries included (Daniel, 19:20)", () => {
  const boise = { cap: 28, city: "Boise" };
  it("words each reason with the calls, the location reads and the retries", () => {
    expect(
      stopLine({
        ...boise,
        reason: "full",
        calls: 16,
        located: 4,
        retries: 2,
        open: { mid: 0, opener: 0 },
      }),
    ).toBe(
      "The agent stopped reading venues: every tier is full, after 16 of its 28 Qloo calls, then 4 reads of Qloo's location signal for the cards (20 in all, plus 2 retries).",
    );
    expect(
      stopLine({
        ...boise,
        reason: "rooms",
        calls: 14,
        located: 4,
        retries: 1,
        open: { mid: 1, opener: 0 },
      }),
    ).toBe(
      "The agent stopped once it had tried every music venue Qloo listed in Boise, after 14 of its 28 Qloo calls, then 4 reads of Qloo's location signal for the cards (18 in all, plus 1 retry): 1 mid-size slot stays open.",
    );
    expect(
      stopLine({
        ...boise,
        reason: "cap",
        calls: 28,
        retries: 3,
        open: { mid: 0, opener: 2 },
      }),
    ).toBe(
      "The agent stopped at its cap of 28 Qloo calls, plus 3 retries: 2 opening slots stay open.",
    );
    expect(
      stopLine({
        ...boise,
        reason: "planner",
        calls: 13,
        retries: 1,
        open: { mid: 2, opener: 0 },
      }),
    ).toBe(
      "The agent stopped before every tier was full, after 13 of its 28 Qloo calls, plus 1 retry: 2 mid-size slots stay open.",
    );
    expect(
      stopLine({
        ...boise,
        reason: "planner",
        calls: 13,
        located: 2,
        open: { mid: 2, opener: 0 },
      }),
    ).toBe(
      "The agent stopped before every tier was full, after 13 of its 28 Qloo calls, then 2 reads of Qloo's location signal for the cards (15 in all): 2 mid-size slots stay open.",
    );
  });
});

const PLAN: Turn[] = [
  ...OPENING,
  [read("mid", LANTERN), read("opener", LANTERN)],
  [read("mid", FORT), read("opener", FORT)],
  [
    {
      name: "finish",
      input: {
        anchor_venue_ids: [LANTERN, FORT],
        summary: "Two venues filled both tiers.",
        stopped_because: "every_band_full",
      },
    },
  ],
];

describe("the page states the retries wherever it gives the call count (Daniel, 19:20)", () => {
  it("in the stop line, the trace's counter and the Built with line", async () => {
    const { events, calls } = await runAgent(
      scriptedModel(PLAN).model,
      LARKSPUR_FESTIVAL,
      failing(1, status(400)),
    );
    const total = calls.length;
    const located = calls.filter(
      (call) => call.tool === "location_signal",
    ).length;
    expect(calls.flatMap((call) => call.retried ?? [])).toEqual([400]);
    const stopped = events.find((event) => event.type === "stopped");
    expect(stopped?.type === "stopped" && stopped.text).toBe(
      `The agent stopped reading venues: every tier is full, after ${total - located} of its 28 Qloo calls, then ${located} reads of Qloo's location signal for the cards (${total} in all, plus 1 retry).`,
    );
    const state = events.reduce<BuildState>(
      (board, event) => buildReducer(board, { type: "event", event }),
      { ...IDLE_BUILD, status: "building" },
    );
    render(<TracePanel state={state} onBuild={() => {}} />);
    expect(screen.getByText(`${total} of 28, plus 1 retry`)).toBeTruthy();
    expect(
      screen.getByText(
        new RegExp(`^Built with ${total} Qloo calls, plus 1 retry, in `),
      ),
    ).toBeTruthy();
  });

  it("goes on past a busy answer the client gave up on, and says the bill may be short", async () => {
    const { events, calls } = await runAgent(
      scriptedModel(PLAN).model,
      LARKSPUR_FESTIVAL,
      failing(99, status(429)),
    );
    expect(
      events.some(
        (event) => event.type === "error" && event.code === "qloo-busy",
      ),
    ).toBe(false);
    expect(events.find((event) => event.type === "short")).toMatchObject({
      venues: ["The Lantern Room"],
    });
    expect(events.some((event) => event.type === "lineup")).toBe(true);
    const retries = calls.flatMap((call) => call.retried ?? []).length;
    expect(retries).toBe(QLOO_RETRY.maxRetries);
    const stopped = events.find((event) => event.type === "stopped");
    expect(stopped?.type === "stopped" && stopped.text).toMatch(
      new RegExp(`plus ${retries} retries\\)`),
    );
  });
});
