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
const WATCH = { name: "Watch how it picked these acts" };
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
    // The run's own editions play again, and nothing was asked of the server.
    expect(within(draft).getByRole("button", SKIP)).toBeTruthy();
    expect(document.querySelector(".edition-title")?.textContent).toMatch(
      /^Replaying the AI agent's build$|fans/,
    );
    expect(builds(fetch)).toBe(1);
    fireEvent.click(within(draft).getByRole("button", SKIP));
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
    expect(under()).toBe(`Replays its ${saved.trace.length} Qloo calls`);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Run the agent live instead" })[0],
    );
    fireEvent.click(await screen.findByRole("button", SKIP));
    await waitFor(() => expect(screen.getByRole("button", WATCH)).toBeTruthy());
    expect(under()).toBe("Replays the saved build's Qloo calls");
  }, 15000);
});
