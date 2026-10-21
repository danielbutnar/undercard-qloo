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
import type { BuildEvent, TraceCall } from "@/lib/build-events";
import { CHECKED_TOWNS, townsNear } from "@/lib/checked-towns";
import { diagnoseRun } from "@/lib/your-festival";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const cities = (region: string) =>
  townsNear(region).towns.map((town) => town.city);

describe("the checked towns offered after a thin town", () => {
  it("are the ones in the typed town's country", () => {
    expect(townsNear("Oregon")).toMatchObject({ country: "United States" });
    expect(cities("Oregon")).toContain("Boise");
    expect(cities("Oregon")).not.toContain("Calgary");
    expect(townsNear("british columbia")).toMatchObject({ country: "Canada" });
    expect(cities("British Columbia")).toEqual([
      "Calgary",
      "Toronto",
      "Montreal",
    ]);
    expect(cities("Estonia")).toEqual(["Tallinn"]);
    expect(cities("Germany")).toEqual(["Berlin", "Hamburg"]);
    expect(townsNear("England")).toMatchObject({ country: "United Kingdom" });
    expect(cities("Scotland")).toEqual(["Wrexham"]);
    expect(cities("USA")).toContain("Austin");
  });

  it("are all of them when the country has none", () => {
    expect(townsNear("Peru")).toEqual({ country: null, towns: CHECKED_TOWNS });
    expect(townsNear("")).toEqual({ country: null, towns: CHECKED_TOWNS });
  });
});

const call = (tool: string, resultCount: number, n: number): TraceCall =>
  ({
    n,
    tool,
    endpoint: "/v2/insights",
    summary: tool,
    params: [],
    resultCount,
    ms: 1,
    cached: false,
  }) as unknown as TraceCall;

describe("what happened, in one sentence", () => {
  const events = (venues: number): BuildEvent[] => [
    { type: "call", call: call("search_artist", 1, 1) },
    { type: "call", call: call("find_venues", venues, 2) },
  ];

  it("says when Qloo found no places in the town", () => {
    const problem = diagnoseRun(events(0), false, "Tiny Town", 0);
    expect(problem?.code).toBe("town-not-found");
    expect(problem?.message).toMatch(/Tiny Town/);
    expect(
      problem?.message.split(/[.!?](\s|$)/).filter((part) => part?.trim())
        .length,
    ).toBe(1);
  });

  it("says how few places it found in a thin town", () => {
    const problem = diagnoseRun(events(1), false, "Hamlet", 1);
    expect(problem).toMatchObject({ code: "too-few-rooms" });
    expect(problem?.message).toMatch(/only 1 live-music place in Hamlet/);
    expect(
      problem?.message.split(/[.!?](\s|$)/).filter((part) => part?.trim())
        .length,
    ).toBe(1);
  });
});

describe("a thin town's state", () => {
  const ndjson = (events: unknown[]) =>
    new Response(
      events.map((event) => JSON.stringify(event)).join("\n") + "\n",
      {
        headers: { "content-type": "application/x-ndjson" },
      },
    );

  it("offers the checked towns in the same country, one click each", async () => {
    // The checked town's screen also asks GET /api/venue-switch once on mount; a 404 is fine
    // (the switch then says it isn't available), and it isn't a build.
    const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async (url) =>
        url.startsWith("/api/venue-switch")
          ? new Response("", { status: 404 })
          : ndjson([
              {
                type: "build",
                id: "yours-1",
                createdAt: "2026-10-17T10:00:00.000Z",
                replayed: false,
              },
              {
                type: "error",
                code: "too-few-rooms",
                message:
                  "Qloo lists only 1 live-music place in Brighton, too few for the agent to compare rooms.",
              },
              { type: "done", calls: 3, ms: 900 },
            ]),
    );
    vi.stubGlobal("fetch", fetch);
    render(<YourFestival />);
    fireEvent.change(screen.getByLabelText("Town"), {
      target: { value: "Brighton" },
    });
    fireEvent.change(screen.getByLabelText("State or country"), {
      target: { value: "England" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Draft my undercard" }));
    const offer = await screen.findByRole("list", {
      name: "Towns Undercard has already read in the United Kingdom",
    });
    const buttons = within(offer).getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Wrexham, Wales, United Kingdom",
    ]);
    fireEvent.click(buttons[0]);
    // The brief's own live run came first; the checked town's replay is the second build.
    const builds = () =>
      fetch.mock.calls.filter(([url]) => url === "/api/undercard");
    await waitFor(() => expect(builds()).toHaveLength(2));
    expect(JSON.parse(String(builds()[1][1]?.body))).toMatchObject({
      festival: "sagebrush-sound-wrexham",
      replayOnly: true,
    });
  });
});
