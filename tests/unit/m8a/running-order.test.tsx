// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import type { BuildEvent } from "@/lib/build-events";
import { buildReducer, firstBoard } from "@/lib/build-state";
import { planRunningOrder } from "@/lib/running-order";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createBuildStore } from "@/server/build-store";
import { createMemoryCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleRunningOrder, ORDER_CALL_CAP } from "@/server/running-order";
import { fakeFetch, params } from "../m2/fake-qloo";
import { readEvents, syntheticServer } from "../m3/scripted";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const act = (id: string, band: "mid" | "opener", popularity: number) => ({
  entityId: id,
  name: id.toUpperCase(),
  band,
  popularity,
});

describe("planning the running order (M8a)", () => {
  // o1 and o2 share a lot, as do o3 and o4, and o5 and o6: none of those pairs should clash.
  const close = new Set(["o1|o2", "o3|o4", "o5|o6", "m1|m2"]);
  const score = (a: string, b: string) =>
    close.has([a, b].sort().join("|")) ? 0.95 : 0.8;
  const acts = [
    act("o1", "opener", 0.6),
    act("o2", "opener", 0.62),
    act("o3", "opener", 0.7),
    act("o4", "opener", 0.72),
    act("o5", "opener", 0.75),
    act("o6", "opener", 0.78),
    act("m1", "mid", 0.85),
    act("m2", "mid", 0.86),
    act("m3", "mid", 0.88),
    act("m4", "mid", 0.9),
  ];

  it("puts openers early and Mid acts later, two stages at a time", () => {
    const slots = planRunningOrder(acts, score, SAGEBRUSH_SOUND.feeBands);
    expect(slots.map((slot) => slot.band)).toEqual([
      "opener",
      "opener",
      "opener",
      "mid",
      "mid",
    ]);
    expect(slots.every((slot) => slot.second !== null)).toBe(true);
  });

  it("pairs the acts that share the least audience", () => {
    const slots = planRunningOrder(acts, score, SAGEBRUSH_SOUND.feeBands);
    for (const slot of slots) {
      const pair = [slot.main.entityId, slot.second!.entityId].sort().join("|");
      expect(close.has(pair)).toBe(false);
      expect(slot.shared).toBe(0.8);
    }
  });

  it("puts the bigger draw on the main stage, and the bigger pairs later", () => {
    const slots = planRunningOrder(acts, score, SAGEBRUSH_SOUND.feeBands);
    for (const slot of slots)
      expect(slot.main.popularity).toBeGreaterThanOrEqual(
        slot.second!.popularity,
      );
    const mean = (slot: (typeof slots)[number]) =>
      (slot.main.popularity + slot.second!.popularity) / 2;
    expect(mean(slots[0])).toBeLessThanOrEqual(mean(slots[1]));
    expect(mean(slots[3])).toBeLessThanOrEqual(mean(slots[4]));
  });
});

describe("the running-order route", () => {
  it("scores the pairs in each band within 10 Qloo calls and plans five sets", async () => {
    const server = syntheticServer();
    await readEvents(server.build());
    const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
    const cache = createMemoryCache();
    const store = createBuildStore(cache);
    await store.save(saved);
    const fake = fakeFetch((url) => {
      const among = (params(url)["filter.results.entities"] ?? "")
        .split(",")
        .filter(Boolean);
      return {
        results: {
          entities: among.map((id, index) => ({
            entity_id: id,
            name: id,
            query: { affinity: 0.8 + index * 0.01 },
            tags: [],
          })),
        },
      };
    });
    const qloo = createQlooClient({ apiKey: "k", cache, fetch: fake.fetch });
    const events: BuildEvent[] = await readEvents(
      handleRunningOrder({
        festival: SAGEBRUSH_SOUND,
        qloo: () => qloo,
        store,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        body: {
          buildId: saved.id,
          acts: saved.lineup.acts.map(
            ({ entityId, name, band, popularity }) => ({
              entityId,
              name,
              band,
              popularity,
            }),
          ),
        },
      }),
    );
    const calls = events.filter((event) => event.type === "call");
    expect(ORDER_CALL_CAP).toBe(10);
    expect(calls.length).toBeLessThanOrEqual(10);
    expect(fake.requests.length).toBe(calls.length);
    for (const request of fake.requests)
      expect(params(request.url)["filter.results.entities"]).toBeTruthy();
    const order = events.find((event) => event.type === "running-order");
    if (order?.type !== "running-order") throw new Error("no running order");
    expect(order.slots).toHaveLength(5);
    expect(order.slots.every((slot) => typeof slot.shared === "number")).toBe(
      true,
    );
  });
});

describe("the board's running order", () => {
  it("is shown after it streams in, and dropped when the bill changes", async () => {
    const server = syntheticServer();
    await readEvents(server.build());
    const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
    let state = firstBoard({
      acts: saved.lineup.acts,
      build: { id: saved.id, createdAt: saved.createdAt },
    } as never);
    state = buildReducer(state, { type: "startOrder" });
    expect(state.ordering).toBe(true);
    const slots = planRunningOrder(
      saved.lineup.acts,
      () => 0.8,
      SAGEBRUSH_SOUND.feeBands,
    );
    state = buildReducer(state, {
      type: "refillEvent",
      event: { type: "running-order", slots },
    });
    state = buildReducer(state, {
      type: "refillEvent",
      event: { type: "done", calls: 8, ms: 5 },
    });
    expect(state.order).toEqual(slots);
    expect(state.ordering).toBe(false);
    state = buildReducer(state, {
      type: "refillEvent",
      event: {
        type: "refill",
        replaces: saved.lineup.acts[0].entityId,
        act: { ...saved.lineup.acts[0], entityId: "new" },
      },
    });
    expect(state.order).toBeNull();
  });
});

describe("Running order on the bill", () => {
  it("is one click from the bill, and each set says who plays against whom and how much they share", async () => {
    const server = syntheticServer();
    await readEvents(server.build());
    const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
    const slots = planRunningOrder(
      saved.lineup.acts,
      () => 0.83,
      SAGEBRUSH_SOUND.feeBands,
    );
    const fetch = vi.fn(
      async () =>
        new Response(
          [
            { type: "running-order", slots },
            { type: "done", calls: 8, ms: 900 },
          ]
            .map((event) => JSON.stringify(event))
            .join("\n") + "\n",
          { headers: { "content-type": "application/x-ndjson" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={{
          build: { id: saved.id, createdAt: saved.createdAt },
          acts: saved.lineup.acts,
          calls: saved.trace.length,
          placesListed: null,
          anchors: {},
          baselineTop: {},
        }}
      />,
    );
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    fireEvent.click(
      within(bill).getByRole("button", { name: "Running order" }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url] = fetch.mock.calls[0] as unknown as [string];
    expect(url).toBe("/api/running-order");
    const panel = await screen.findByRole("region", { name: "Running order" });
    const sets = within(panel).getAllByRole("listitem");
    expect(sets).toHaveLength(5);
    expect(sets[0].textContent).toContain(slots[0].main.name);
    expect(sets[0].textContent).toContain(slots[0].second!.name);
    expect(sets[0].textContent).toMatch(/closest of \d+ pairs on this lineup/);
  });
});
