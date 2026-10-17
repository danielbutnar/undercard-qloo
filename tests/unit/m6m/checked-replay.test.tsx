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
import { YourFestival } from "@/components/your-festival";
import type { BuildEvent } from "@/lib/build-events";
import { CHECKED_TOWNS } from "@/lib/checked-towns";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { checkedFestival, festivalById, townBySlug } from "@/lib/towns";
import { handleUndercardBuild } from "@/server/undercard-build";
import { createMemoryLimiter } from "@/server/rate-limit";
import { readEvents, syntheticServer } from "../m3/scripted";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const town = (city: string) =>
  CHECKED_TOWNS.find((entry) => entry.city === city)!;

describe("a checked town's festival", () => {
  it("has an id of its own; Boise keeps the demo's, and the M6d towns keep theirs", () => {
    expect(checkedFestival(town("Boise"))).toBe(SAGEBRUSH_SOUND);
    expect(checkedFestival(town("Austin")).id).toBe(
      townBySlug("austin")!.festival.id,
    );
    expect(checkedFestival(town("Reykjavík")).id).toBe(
      "sagebrush-sound-reykjavik",
    );
    expect(checkedFestival(town("Kansas City")).id).toBe(
      "sagebrush-sound-kansas-city",
    );
    const tallinn = checkedFestival(town("Tallinn"));
    expect(tallinn).toMatchObject({
      city: "Tallinn",
      region: "Estonia",
      headliners: SAGEBRUSH_SOUND.headliners,
    });
    const ids = CHECKED_TOWNS.map((entry) => checkedFestival(entry).id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is a festival the routes accept", () => {
    for (const entry of CHECKED_TOWNS)
      expect(festivalById(checkedFestival(entry).id)).toEqual(
        checkedFestival(entry),
      );
  });
});

describe("a replay-only request", () => {
  it("replays a saved build, and never runs the agent when there isn't one", async () => {
    const server = syntheticServer();
    const festival = checkedFestival(town("Tallinn"));
    const events: BuildEvent[] = await readEvents(
      await handleUndercardBuild({
        festival,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        qloo: () => server.qloo,
        model: () => server.planner.model,
        store: server.store,
        fresh: false,
        replayOnly: true,
      }),
    );
    expect(server.planner.turns()).toBe(0);
    expect(events.some((event) => event.type === "call")).toBe(false);
    expect(events.find((event) => event.type === "error")).toMatchObject({
      code: "no-saved-build",
    });
  });
});

describe("a replay-only request with a saved build", () => {
  it("replays it", async () => {
    const server = syntheticServer();
    await readEvents(server.build({ fresh: true }));
    const turns = server.planner.turns();
    const events = await readEvents(
      handleUndercardBuild({
        festival: SAGEBRUSH_SOUND,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        qloo: () => server.qloo,
        model: () => server.planner.model,
        store: server.store,
        fresh: false,
        replayOnly: true,
        replayDelayMs: 0,
      }),
    );
    expect(server.planner.turns()).toBe(turns);
    expect(events.find((event) => event.type === "build")).toMatchObject({ replayed: true });
    expect(events.some((event) => event.type === "lineup")).toBe(true);
  });
});

describe("a checked-town button", () => {
  const ndjson = (events: unknown[]) =>
    new Response(
      events.map((event) => JSON.stringify(event)).join("\n") + "\n",
      {
        headers: { "content-type": "application/x-ndjson" },
      },
    );

  it("replays the town's saved build when the headliners are the demo's", async () => {
    const fetch = vi.fn(async () =>
      ndjson([{ type: "done", calls: 0, ms: 0 }]),
    );
    vi.stubGlobal("fetch", fetch);
    render(<YourFestival />);
    fireEvent.click(
      within(
        screen.getByRole("list", { name: "Towns Undercard has already read" }),
      ).getByRole("button", {
        name: /^Tallinn, Estonia/,
      }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      fresh: false,
      replayOnly: true,
      festival: "sagebrush-sound-tallinn",
    });
    expect(body.brief).toBeUndefined();
    // Back to the towns, with the live run still next to the replay.
    expect(
      screen.getByRole("button", { name: "Pick another town" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pick another town" }));
    expect(
      screen.getByRole("list", { name: "Towns Undercard has already read" }),
    ).toBeTruthy();
  });

  it("runs live, as before, once the headliners are edited", async () => {
    const fetch = vi.fn(async () =>
      ndjson([{ type: "done", calls: 0, ms: 0 }]),
    );
    vi.stubGlobal("fetch", fetch);
    render(<YourFestival />);
    fireEvent.change(screen.getByLabelText("Second headliner"), {
      target: { value: "Mitski" },
    });
    fireEvent.click(
      within(
        screen.getByRole("list", { name: "Towns Undercard has already read" }),
      ).getByRole("button", {
        name: /^Tallinn, Estonia/,
      }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      fresh: true,
      brief: {
        city: "Tallinn",
        region: "Estonia",
        headliners: ["Khruangbin", "Mitski"],
      },
    });
  });
});
