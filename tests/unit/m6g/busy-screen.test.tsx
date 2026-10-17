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

describe("a busy Qloo on the bill's screen", () => {
  it("shows a retried call on its own line, and offers the saved build's replay when the budget runs out", async () => {
    const fetch = vi.fn(async () =>
      ndjson([
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
      screen.getAllByRole("button", { name: "Run the agent live instead" })[0],
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
    const [, init] = fetch.mock.calls[1] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ fresh: false });
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
    expect(within(notice).getByRole("heading").textContent).toMatch(
      /Qloo is busy/i,
    );
    expect(notice.textContent).toContain("Try again in a minute");
    fireEvent.click(
      within(notice).getByRole("button", { name: "Change the brief" }),
    );
    expect((screen.getByLabelText("Town") as HTMLInputElement).value).toBe(
      "Duluth",
    );
  });
});
