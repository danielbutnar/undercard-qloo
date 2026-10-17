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
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import {
  diagnoseRun,
  YourBriefSchema,
  yourFestival,
} from "@/lib/your-festival";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const call = (
  n: number,
  tool: string,
  resultCount: number,
  query = "",
): TraceCall => ({
  n,
  tool,
  endpoint: "/v2/insights",
  summary: tool,
  params: query ? [{ key: "query", value: query }] : [],
  resultCount,
  ms: 10,
  cached: false,
});
const calls = (...list: TraceCall[]): BuildEvent[] =>
  list.map((c) => ({ type: "call", call: c }));

describe("a buyer's own brief", () => {
  it("takes a town and two different headliners, and nothing that isn't a name", () => {
    const ok = (city: string, a = "Khruangbin", b = "Japanese Breakfast") =>
      YourBriefSchema.safeParse({ city, region: "Idaho", headliners: [a, b] })
        .success;
    expect(ok("Reykjavík")).toBe(true);
    expect(ok("St. Louis")).toBe(true);
    expect(ok("Coeur d'Alene")).toBe(true);
    expect(ok("B")).toBe(false);
    expect(ok("<script>")).toBe(false);
    expect(ok("x".repeat(61))).toBe(false);
    expect(ok("Boise", "Khruangbin", "khruangbin ")).toBe(false);
    expect(ok("Boise", "", "Japanese Breakfast")).toBe(false);
  });

  it("becomes a festival of its own: the demo's crowd and fee bands, the buyer's town and headliners", () => {
    const festival = yourFestival(
      { city: " Duluth ", region: "Minnesota", headliners: ["A", "B"] },
      "yours-1234",
    );
    expect(festival.id).toBe("yours-1234");
    expect(festival.city).toBe("Duluth");
    expect(festival.region).toBe("Minnesota");
    expect(festival.headliners).toEqual(["A", "B"]);
    expect(festival.feeBands).toEqual(SAGEBRUSH_SOUND.feeBands);
    expect(festival.crowdAge).toEqual(SAGEBRUSH_SOUND.crowdAge);
    expect(festival.id).not.toBe(SAGEBRUSH_SOUND.id);
  });
});

describe("what went wrong in a run, read from its stream", () => {
  it("a headliner Qloo can't find", () => {
    const events = calls(
      call(1, "search_artist", 3, "Khruangbin"),
      call(2, "search_artist", 0, "Nobody Atall"),
    );
    expect(diagnoseRun(events, false, "Duluth")).toEqual({
      code: "headliner-not-found",
      message:
        "Qloo found no artist called “Nobody Atall”. Check the spelling, or try another headliner.",
    });
  });

  it("a town with too few music rooms to read", () => {
    const events = calls(
      call(1, "search_artist", 3, "A"),
      call(2, "search_artist", 4, "B"),
      call(3, "find_tag", 10),
      call(4, "find_venues", 1),
    );
    expect(diagnoseRun(events, false, "Smalltown")?.code).toBe("too-few-rooms");
    expect(diagnoseRun(events, false, "Smalltown")?.message).toContain(
      "Smalltown",
    );
  });

  it("rooms that lifted too few acts to fill every slot", () => {
    const events = calls(
      call(1, "search_artist", 3, "A"),
      call(4, "find_venues", 9),
      call(8, "venue_artists", 50),
    );
    expect(diagnoseRun(events, false, "Missoula")?.code).toBe("not-full");
  });

  it("nothing, when both bands filled", () => {
    expect(
      diagnoseRun(calls(call(4, "find_venues", 9)), true, "Boise"),
    ).toBeNull();
  });
});

describe("the Your festival page", () => {
  const ndjson = (events: unknown[]) =>
    new Response(
      events.map((event) => JSON.stringify(event)).join("\n") + "\n",
      {
        headers: { "content-type": "application/x-ndjson" },
      },
    );

  function fill(city: string, a: string, b: string) {
    fireEvent.change(screen.getByLabelText("Town"), {
      target: { value: city },
    });
    // M6j: the town's state or country resolves it.
    fireEvent.change(screen.getByLabelText("State or country"), {
      target: { value: "Minnesota" },
    });
    fireEvent.change(screen.getByLabelText("First headliner"), {
      target: { value: a },
    });
    fireEvent.change(screen.getByLabelText("Second headliner"), {
      target: { value: b },
    });
    fireEvent.click(screen.getByRole("button", { name: "Draft my undercard" }));
  }

  it("says what's wrong with a brief before it runs anything", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<YourFestival />);
    fill("<b>", "Khruangbin", "Khruangbin");
    expect(screen.getByRole("alert").textContent).toMatch(/town/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("runs the agent live for the brief, with no Without Qloo and no refill, and saves nothing", async () => {
    const fetch = vi.fn(async () =>
      ndjson([{ type: "done", calls: 0, ms: 0 }]),
    );
    vi.stubGlobal("fetch", fetch);
    render(<YourFestival />);
    fill("Duluth", "Khruangbin", "Japanese Breakfast");
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/undercard");
    expect(JSON.parse(String(init.body))).toMatchObject({
      fresh: true,
      brief: {
        city: "Duluth",
        region: "Minnesota",
        headliners: ["Khruangbin", "Japanese Breakfast"],
      },
    });
    expect(screen.queryByRole("group", { name: "Which bill" })).toBeNull();
    expect(screen.getByText(/Duluth/)).toBeTruthy();
  });

  it("shows a headliner Qloo can't find, and takes the buyer back to the brief with it kept", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ndjson([
          {
            type: "build",
            id: "b",
            createdAt: "2026-10-17T12:00:00.000Z",
            replayed: false,
          },
          {
            type: "error",
            code: "headliner-not-found",
            message:
              "Qloo found no artist called “Nobody Atall”. Check the spelling, or try another headliner.",
          },
          { type: "done", calls: 2, ms: 900 },
        ]),
      ),
    );
    render(<YourFestival />);
    fill("Duluth", "Nobody Atall", "Japanese Breakfast");
    const notice = await screen.findByRole("region", {
      name: "This draft couldn't be finished",
    });
    expect(notice.textContent).toContain("Nobody Atall");
    fireEvent.click(
      within(notice).getByRole("button", { name: "Change the brief" }),
    );
    expect(
      (screen.getByLabelText("First headliner") as HTMLInputElement).value,
    ).toBe("Nobody Atall");
  });

  it("shows the daily limit as its own state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ndjson([
          {
            type: "error",
            code: "limit",
            message: "You've reached today's limit of 5 fresh builds.",
          },
          { type: "done", calls: 0, ms: 0 },
        ]),
      ),
    );
    render(<YourFestival />);
    fill("Duluth", "Khruangbin", "Japanese Breakfast");
    const notice = await screen.findByRole("region", {
      name: "This draft couldn't be finished",
    });
    expect(notice.textContent).toContain("today's limit");
    expect(
      within(notice)
        .getByRole("link", { name: /Sagebrush Sound/ })
        .getAttribute("href"),
    ).toBe("/");
  });
});
