// @vitest-environment jsdom
// WS13 item 8: live is first-class. "Run it live" sits under Watch on every town; a live run
// plays in the town as Watch does, and once it ends it states its time and its Qloo calls. The
// rate limits stay. Invented data only.
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
import { liveRunFacts, RUN_IT_LIVE, runItLiveSub } from "@/lib/agent-words";
import type { BuildEvent } from "@/lib/build-events";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { TOWNS } from "@/lib/towns";
import { FIRST_BILL } from "../m4b/first-bill-fixture";
import { readEvents, syntheticServer } from "../m3/scripted";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The server: a 404 for the venue switch, the given events for a build. */
function serve(events: readonly BuildEvent[] | (() => Response)) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("/api/venue-switch"))
      return new Response("{}", { status: 404 });
    if (typeof events === "function") return events();
    void init;
    return new Response(
      events.map((event) => JSON.stringify(event)).join("\n") + "\n",
      { headers: { "content-type": "application/x-ndjson" } },
    );
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const watchArea = () =>
  screen
    .getByRole("button", { name: /Watch the AI agent build it/ })
    .closest(".fs-watch") as HTMLElement;

describe("Run it live, under Watch (WS13.8)", () => {
  it("is under Watch on Boise's saved build, saying what a live run costs", () => {
    serve([]);
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    const area = watchArea();
    expect(
      within(area).getByRole("button", { name: RUN_IT_LIVE }),
    ).toBeTruthy();
    expect(within(area).getByText(runItLiveSub("Boise"))).toBeTruthy();
    expect(runItLiveSub("Boise")).toBe(
      "The AI agent drafts Boise again now, with up to 28 Qloo calls. Live runs are limited each day.",
    );
  });

  it("is under Watch on every town with a saved build", () => {
    serve([]);
    for (const town of TOWNS.slice(1, 4)) {
      render(
        <FestivalScreen
          festival={town.festival}
          firstBill={{ ...FIRST_BILL, build: { ...FIRST_BILL.build } }}
        />,
      );
      expect(
        within(watchArea()).getByRole("button", { name: RUN_IT_LIVE }),
      ).toBeTruthy();
      cleanup();
    }
  });

  it("starts a fresh, rate-limited build, never the replay", async () => {
    const fetch = serve([]);
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    fireEvent.click(
      within(watchArea()).getByRole("button", { name: RUN_IT_LIVE }),
    );
    await waitFor(
      () =>
        expect(fetch.mock.calls.some(([url]) => url === "/api/undercard")).toBe(
          true,
        ),
      { timeout: 10_000 },
    );
    const [, init] = fetch.mock.calls.find(
      ([url]) => url === "/api/undercard",
    )!;
    expect(JSON.parse(String(init?.body))).toMatchObject({ fresh: true });
  });

  it("states its time and its Qloo calls once it ends", async () => {
    const server = syntheticServer();
    const events = await readEvents(server.build({ fresh: true }));
    const done = events.find((event) => event.type === "done")!;
    expect(done.type).toBe("done");
    serve(events);
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    fireEvent.click(
      within(watchArea()).getByRole("button", { name: RUN_IT_LIVE }),
    );
    // Skip Watch's pace: the lineup is in, and the run's facts are under Watch.
    fireEvent.click(
      await screen.findByRole("button", { name: /Skip/ }, { timeout: 10_000 }),
    );
    const facts =
      done.type === "done"
        ? liveRunFacts({ calls: done.calls, ms: done.ms })
        : "";
    await waitFor(
      () => expect(within(watchArea()).getByText(facts)).toBeTruthy(),
      { timeout: 10_000 },
    );
    expect(liveRunFacts({ calls: 19, ms: 23_440 })).toBe(
      "This live run took 23.4 s and 19 Qloo calls.",
    );
  });

  it("says when today's live runs are used, and keeps the saved build", async () => {
    serve(
      () =>
        new Response(
          [
            {
              type: "error",
              code: "limit",
              message:
                "You've used today's 10 fresh builds from this network. The saved build still replays instantly. Try again tomorrow (UTC).",
            },
            { type: "done", calls: 0, ms: 0 },
          ]
            .map((event) => JSON.stringify(event))
            .join("\n") + "\n",
          { status: 429, headers: { "content-type": "application/x-ndjson" } },
        ),
    );
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    fireEvent.click(
      within(watchArea()).getByRole("button", { name: RUN_IT_LIVE }),
    );
    await waitFor(
      () =>
        expect(
          within(watchArea()).getByText(/today's 10 fresh builds/),
        ).toBeTruthy(),
      { timeout: 10_000 },
    );
    expect(
      screen.getByRole("button", { name: /Watch the AI agent build it/ }),
    ).toBeTruthy();
    // Running again can only be refused today: the reason takes the button's place.
    expect(
      within(watchArea()).queryByRole("button", { name: RUN_IT_LIVE }),
    ).toBeNull();
  });
});
