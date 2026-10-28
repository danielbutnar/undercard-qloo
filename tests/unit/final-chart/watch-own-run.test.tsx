// @vitest-environment jsdom
// The line under Watch says what Watch will do, and it does it. A judge's own run is never
// saved, so Watch replays it from the run the screen already holds, with no new request (no
// live run spent and no draft lost). Elsewhere Watch replays the saved build: the count is the
// one on screen only while the screen shows that build.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { yourFestival } from "@/lib/your-festival";
import { readEvents, syntheticServer } from "../m3/scripted";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ndjson = (events: unknown[]) =>
  new Response(events.map((event) => JSON.stringify(event)).join("\n") + "\n", {
    headers: { "content-type": "application/x-ndjson" },
  });
const builds = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.filter(([url]) => url === "/api/undercard").length;
const SKIP = { name: "Skip to the lineup" };
const WATCH = { name: "Watch the AI agent build it" };
const under = () => document.querySelector(".watch-sub")?.textContent ?? "";

describe("Watch on a judge's own run", () => {
  it("replays the run on screen, with no new request, and the lineup stays", async () => {
    const server = syntheticServer();
    const events = await readEvents(server.build({ fresh: true }));
    const done = events.find((event) => event.type === "done") as {
      calls: number;
    };
    const fetch = vi.fn(async (url: string) =>
      url === "/api/undercard"
        ? ndjson(events)
        : new Response("{}", { status: 404 }),
    );
    vi.stubGlobal("fetch", fetch);
    const brief = {
      city: "Duluth",
      region: "Minnesota",
      headliners: ["Khruangbin", "Japanese Breakfast"] as [string, string],
    };
    render(
      <FestivalScreen
        festival={yourFestival(brief, "yours-duluth")}
        custom={{ brief, onEdit: () => {} }}
      />,
    );
    // The run opens with its own show; skip to its lineup.
    fireEvent.click(await screen.findByRole("button", SKIP));
    const draft = screen.getByRole("region", { name: "Undercard draft" });
    await waitFor(() =>
      expect(within(draft).getAllByRole("article")).toHaveLength(10),
    );
    expect(builds(fetch)).toBe(1);
    expect(under()).toBe(`Replays its ${done.calls} Qloo calls`);

    fireEvent.click(screen.getByRole("button", WATCH));
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    // The run's own editions play again, and nothing was asked of the server. WS9: Watch's own
    // button turns into Skip while the show plays.
    expect(screen.getByRole("button", SKIP)).toBeTruthy();
    expect(document.querySelector(".edition-title")?.textContent).toMatch(
      /^Replaying the AI agent's build$|fans/,
    );
    expect(builds(fetch)).toBe(1);
    fireEvent.click(screen.getByRole("button", SKIP));
    expect(within(draft).getAllByRole("article")).toHaveLength(10);
    expect(builds(fetch)).toBe(1);
  }, 15000);
});

describe("The line under Watch on a saved town", () => {
  it("names the saved build's calls without a count once a live run is on screen", async () => {
    const server = syntheticServer();
    await readEvents(server.build({ fresh: true }));
    const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
    // A later live run, here never saved (as on a preview): Watch would replay the first build.
    const live = await readEvents(server.build({ fresh: true }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/undercard"
          ? ndjson(live)
          : new Response("{}", { status: 404 }),
      ),
    );
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
    expect(under()).toBe(
      "Replays how the agent drafted Boise",
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Play it live" })[0],
    );
    fireEvent.click(await screen.findByRole("button", SKIP));
    await waitFor(() => expect(screen.getByRole("button", WATCH)).toBeTruthy());
    expect(under()).toBe("Replays the saved build's Qloo calls");
  }, 15000);
});

describe("A judge's run that didn't finish", () => {
  const brief = {
    city: "Duluth",
    region: "Minnesota",
    headliners: ["Khruangbin", "Japanese Breakfast"] as [string, string],
  };
  // Every POST /api/undercard, with its body; the first is answered by `first`, later ones wait.
  function serve(first: () => Promise<Response>) {
    const bodies: { fresh?: boolean }[] = [];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url !== "/api/undercard") return new Response("{}", { status: 404 });
      bodies.push(JSON.parse(String(init?.body)));
      return bodies.length === 1 ? first() : new Promise<Response>(() => {});
    });
    vi.stubGlobal("fetch", fetch);
    render(
      <FestivalScreen
        festival={yourFestival(brief, "yours-duluth")}
        custom={{ brief, onEdit: () => {} }}
      />,
    );
    return bodies;
  }
  const AGAIN = { name: "Run the agent again" };

  it("offers to run the agent again after the stream stops partway, and does", async () => {
    const server = syntheticServer();
    const events = await readEvents(server.build({ fresh: true }));
    const climbs = events.flatMap((event, index) =>
      event.type === "climb" ? [index] : [],
    );
    // The stream ends after the fourth edition, with no lineup and no "done".
    const bodies = serve(async () => ndjson(events.slice(0, climbs[3] + 1)));
    const again = await screen.findByRole("button", AGAIN, { timeout: 5000 });
    expect(under()).toBe("Runs the AI agent again; its Qloo calls list below");
    fireEvent.click(again);
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1].fresh).toBe(true);
  }, 15000);

  it("offers no run once the day's live runs are used: the notice points to the replay instead", async () => {
    serve(async () =>
      ndjson([
        {
          type: "error",
          code: "limit",
          message: "Today's live runs from this connection are used.",
        },
        { type: "done", calls: 0, ms: 0 },
      ]),
    );
    expect(
      await screen.findByRole("region", {
        name: "This draft couldn't be finished",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", {
        name: "Back to Sagebrush Sound, which replays without a limit",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", AGAIN)).toBeNull();
    expect(screen.queryByRole("button", { name: "Build undercard" })).toBeNull();
    expect(under()).toBe("");
  });

  it("offers to run the agent again when the build service can't be reached", async () => {
    const bodies = serve(async () => {
      throw new TypeError("Failed to fetch");
    });
    const again = await screen.findByRole("button", AGAIN);
    fireEvent.click(again);
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1].fresh).toBe(true);
  });
});

describe("A judge's run run again over a lineup on screen", () => {
  const brief = {
    city: "Duluth",
    region: "Minnesota",
    headliners: ["Khruangbin", "Japanese Breakfast"] as [string, string],
  };
  // The first run fills some slots and stops short (not-full); `again` answers the next one.
  async function partlyFilled(again: () => Promise<Response>) {
    const server = syntheticServer();
    const events = await readEvents(server.build({ fresh: true }));
    const upToLineup = events.slice(
      0,
      events.findIndex((event) => event.type === "lineup") + 1,
    );
    const bodies: { fresh?: boolean }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url !== "/api/undercard")
          return new Response("{}", { status: 404 });
        bodies.push(JSON.parse(String(init?.body)));
        return bodies.length === 1
          ? ndjson([
              ...upToLineup,
              {
                type: "error",
                code: "not-full",
                message: "Some slots stayed open.",
              },
              { type: "done", calls: 9, ms: 900 },
            ])
          : bodies.length === 2
            ? again()
            : new Promise<Response>(() => {});
      }),
    );
    render(
      <FestivalScreen
        festival={yourFestival(brief, "yours-duluth")}
        custom={{ brief, onEdit: () => {} }}
      />,
    );
    const draft = screen.getByRole("region", { name: "Undercard draft" });
    fireEvent.click(
      await screen.findByRole("button", { name: "Run the agent again" }, {
        timeout: 5000,
      }),
    );
    await waitFor(() => expect(bodies).toHaveLength(2));
    return { bodies, draft };
  }

  it("keeps the draft when the day's live runs are used, and offers no run or replay", async () => {
    const { bodies, draft } = await partlyFilled(async () =>
      ndjson([
        {
          type: "error",
          code: "limit",
          message: "Today's live runs from this connection are used.",
        },
        { type: "done", calls: 0, ms: 0 },
      ]),
    );
    await screen.findByText("Today's live runs from this connection are used.");
    expect(within(draft).getAllByRole("article").length).toBeGreaterThan(0);
    // A judge's run is never saved: nothing offers to replay one.
    expect(
      screen.queryByRole("button", { name: "Replay the saved build" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Run the agent again" }),
    ).toBeNull();
    expect(bodies).toHaveLength(2);
  }, 15000);

  it("keeps the draft when the build service can't be reached, and offers to run it again", async () => {
    const { draft } = await partlyFilled(async () => {
      throw new TypeError("Failed to fetch");
    });
    await screen.findByText("Couldn't reach the build service. Try again.");
    expect(within(draft).getAllByRole("article").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "Replay the saved build" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Run the agent again" }),
    ).toBeTruthy();
  }, 15000);
});
