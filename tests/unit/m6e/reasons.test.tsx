// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../../fixtures/lineup.synthetic.json";
import { ActCard } from "@/components/act-card";
import { buildReducer, firstBoard } from "@/lib/build-state";
import { lineupCsv } from "@/lib/csv";
import { LineupSchema } from "@/lib/lineup";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { UNAVAILABLE_REASONS } from "@/lib/unavailable";
import type { BuildEvent } from "@/lib/build-events";
import { handleRefill, RefillRequestSchema } from "@/server/refill";
import { createBuildStore } from "@/server/build-store";
import { createMemoryCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import { createMemoryLimiter } from "@/server/rate-limit";
import { fakeFetch, syntheticQloo } from "../m2/fake-qloo";
import { readEvents, syntheticServer } from "../m3/scripted";

afterEach(cleanup);

const { acts } = LineupSchema.parse(fixture);

describe("the reasons an act is unavailable", () => {
  it("are a radius clause, routing and the fee", () => {
    expect(Object.entries(UNAVAILABLE_REASONS)).toEqual([
      ["radius", "radius clause"],
      ["routing", "routing"],
      ["fee", "fee"],
    ]);
  });

  it("are the only reasons a refill request takes", () => {
    const base = {
      buildId: "b",
      unavailableId: "a",
      band: "mid",
      anchorVenueId: null,
      excludeIds: [],
    };
    expect(
      RefillRequestSchema.safeParse({ ...base, reason: "radius" }).success,
    ).toBe(true);
    expect(
      RefillRequestSchema.safeParse({ ...base, reason: "weather" }).success,
    ).toBe(false);
  });
});

describe("Unavailable on the card", () => {
  it("asks why before it refills, and passes the reason on", () => {
    const onUnavailable = vi.fn();
    render(<ActCard act={acts[0]} onUnavailable={onUnavailable} />);
    fireEvent.click(screen.getByRole("button", { name: "Unavailable" }));
    expect(onUnavailable).not.toHaveBeenCalled();

    const why = screen.getByRole("group", { name: "Why is it unavailable?" });
    expect(
      within(why)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Radius clause", "Routing", "Fee", "Cancel"]);
    fireEvent.click(within(why).getByRole("button", { name: "Radius clause" }));
    expect(onUnavailable).toHaveBeenCalledWith(acts[0], "radius");
  });

  it("can be cancelled", () => {
    render(<ActCard act={acts[0]} onUnavailable={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Unavailable" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("group", { name: "Why is it unavailable?" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Unavailable" })).toBeTruthy();
  });
});

describe("a refill with a reason", () => {
  async function refill(reason?: string) {
    const server = syntheticServer();
    await readEvents(server.build());
    const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
    const cache = createMemoryCache();
    const store = createBuildStore(cache);
    await store.save(saved);
    const gone = saved.lineup.acts.find((act) => act.band === "mid")!;
    const events = await readEvents(
      handleRefill({
        festival: SAGEBRUSH_SOUND,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        qloo: () =>
          createQlooClient({
            apiKey: "k",
            cache,
            fetch: fakeFetch(syntheticQloo).fetch,
          }),
        store,
        body: {
          buildId: saved.id,
          unavailableId: gone.entityId,
          band: "mid",
          anchorVenueId: gone.anchorVenue.entityId,
          excludeIds: saved.lineup.acts.map((act) => act.entityId),
          ...(reason ? { reason } : {}),
        },
      }),
    );
    return events.flatMap((event: BuildEvent) =>
      event.type === "call" ? [event.call.summary] : [],
    );
  }

  it("names the reason in the refill's trace line", async () => {
    const [summary] = await refill("routing");
    expect(summary).toMatch(
      /^Refill \(routing\): Mid-band artists for the headliners and /,
    );
  });

  it("reads as before without one", async () => {
    const [summary] = await refill();
    expect(summary).toMatch(/^Refill: Mid-band artists/);
  });
});

describe("the board and the CSV remember why", () => {
  it("records which act a replacement took over from, and why", () => {
    const board = firstBoard({
      build: { id: "b1", createdAt: "2026-10-17T12:00:00.000Z" },
      acts,
      calls: [],
      notes: [],
    } as never);
    const gone = acts[0];
    const replacement = { ...acts[0], entityId: "new-1", name: "New Act" };
    let state = buildReducer(board, {
      type: "markUnavailable",
      entityId: gone.entityId,
      reason: "fee",
    });
    state = buildReducer(state, {
      type: "refillEvent",
      event: { type: "refill", replaces: gone.entityId, act: replacement },
    });
    expect(state.replaced).toEqual({
      "new-1": { name: gone.name, reason: "fee" },
    });

    const csv = lineupCsv(
      state.acts,
      SAGEBRUSH_SOUND.feeBands,
      state.replaced,
    ).split("\r\n");
    expect(csv[0]).toBe(
      "act,band,affinity,popularity,anchor_venue,reason,replaces,unavailable_reason",
    );
    const row = csv.find((line) => line.startsWith("New Act,"))!;
    expect(row.endsWith(`,${gone.name},fee`)).toBe(true);
    const untouched = csv.find((line) => line.startsWith(`${acts[1].name},`))!;
    expect(untouched.endsWith(",,")).toBe(true);
  });
});
