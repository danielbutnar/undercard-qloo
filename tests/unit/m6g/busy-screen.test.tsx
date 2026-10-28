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
import { YourFestival } from "@/components/your-festival";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ndjson = (events: unknown[]) =>
  new Response(events.map((event) => JSON.stringify(event)).join("\n") + "\n", {
    headers: { "content-type": "application/x-ndjson" },
  });
const BUSY = {
  type: "error",
  code: "qloo-busy",
  message: "Qloo is busy right now. Try again in a minute.",
};
const call = {
  n: 1,
  tool: "search_artist",
  endpoint: "/search",
  summary: 'Search for "Khruangbin"',
  params: [],
  resultCount: 3,
  ms: 1800,
  cached: false,
  retried: [429],
};

describe("a busy Qloo on the first screen", () => {
  it("shows a retried call on its own line, and offers the saved build's replay when the budget runs out", async () => {
    // The venue switch also asks GET /api/venue-switch once on mount; a 404 is fine (the switch
    // then says it isn't available), and it isn't a build.
    const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async (url) =>
        url.startsWith("/api/venue-switch")
          ? new Response("", { status: 404 })
          : ndjson([
              {
                type: "build",
                id: "live-1",
                createdAt: "2026-10-18T09:00:00.000Z",
                replayed: false,
              },
              { type: "call", call },
              BUSY,
              { type: "done", calls: 1, ms: 45000 },
            ]),
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Play it live" }),
    );

    const trace = await screen.findByRole("list", { name: "Qloo calls" });
    await waitFor(() =>
      expect(within(trace).getByText(/retried after 429/)).toBeTruthy(),
    );
    expect(
      screen.getByText("Qloo is busy right now. Try again in a minute."),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Watch the saved build instead" }),
    );
    // The first build was the live run; the second replays the saved build.
    const builds = fetch.mock.calls.filter(([url]) => url === "/api/undercard");
    expect(builds).toHaveLength(2);
    expect(JSON.parse(String(builds[0][1]?.body))).toMatchObject({
      fresh: true,
    });
    expect(JSON.parse(String(builds[1][1]?.body))).toMatchObject({
      fresh: false,
    });
  });
});

describe("a busy Qloo on Your festival", () => {
  it("has its own state, with the brief kept", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ndjson([
          {
            type: "build",
            id: "yours-1",
            createdAt: "2026-10-18T09:00:00.000Z",
            replayed: false,
          },
          BUSY,
          { type: "done", calls: 0, ms: 45000 },
        ]),
      ),
    );
    render(<YourFestival />);
    fireEvent.change(screen.getByLabelText("Town"), {
      target: { value: "Duluth" },
    });
    // M6j: the town's state or country resolves it.
    fireEvent.change(screen.getByLabelText("State or country"), {
      target: { value: "Minnesota" },
    });
    fireEvent.change(screen.getByLabelText("First headliner"), {
      target: { value: "Khruangbin" },
    });
    fireEvent.change(screen.getByLabelText("Second headliner"), {
      target: { value: "Japanese Breakfast" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Draft my undercard" }));
    const notice = await screen.findByRole("region", {
      name: "This draft couldn't be finished",
    });
    expect(
      within(notice).getByRole("heading", { level: 2 }).textContent,
    ).toMatch(/Qloo is busy/i);
    expect(notice.textContent).toContain("Try again in a minute");
    // Plan.md item 2: a busy run offers the country's checked towns to replay meanwhile.
    expect(
      within(notice).getByRole("list", {
        name: "Towns Undercard has already read in the United States",
      }),
    ).toBeTruthy();
    fireEvent.click(
      within(notice).getByRole("button", { name: "Change the brief" }),
    );
    expect((screen.getByLabelText("Town") as HTMLInputElement).value).toBe(
      "Duluth",
    );
  });
});
