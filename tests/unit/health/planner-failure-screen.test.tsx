// @vitest-environment jsdom
// A live run whose planner call failed or refused ends in the busy-Qloo state's place: on Your
// festival the notice offers the country's checked towns (or Sagebrush Sound's replay), and on
// a saved town the trace offers the saved build. The build stream is stubbed; no call is made.
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
const FAILED = {
  type: "error",
  code: "planner-failed",
  message:
    "The planning model is unavailable right now. Try again in a minute.",
};
const run = (id: string) => [
  {
    type: "build",
    id,
    createdAt: "2026-10-22T09:00:00.000Z",
    replayed: false,
  },
  FAILED,
  { type: "done", calls: 0, ms: 900 },
];

async function draft(region: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ndjson(run("yours-1"))),
  );
  render(<YourFestival />);
  fireEvent.change(screen.getByLabelText("Town"), {
    target: { value: "Duluth" },
  });
  fireEvent.change(screen.getByLabelText("State or country"), {
    target: { value: region },
  });
  fireEvent.change(screen.getByLabelText("First headliner"), {
    target: { value: "Khruangbin" },
  });
  fireEvent.change(screen.getByLabelText("Second headliner"), {
    target: { value: "Japanese Breakfast" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Draft my undercard" }));
  return screen.findByRole("region", {
    name: "This draft couldn't be finished",
  });
}

describe("a failed planner call on Your festival", () => {
  it("says so and offers the country's checked towns, with the brief kept", async () => {
    const notice = await draft("Minnesota");
    expect(within(notice).getByRole("heading", { level: 2 }).textContent).toBe(
      "The AI agent couldn't plan this draft",
    );
    expect(notice.textContent).toContain(FAILED.message);
    const towns = within(notice).getByRole("list", {
      name: "Towns Undercard has already read in the United States",
    });
    expect(within(towns).getAllByRole("button").length).toBeGreaterThan(0);
    fireEvent.click(
      within(notice).getByRole("button", { name: "Change the brief" }),
    );
    expect((screen.getByLabelText("Town") as HTMLInputElement).value).toBe(
      "Duluth",
    );
  });

  it("with no checked town in that country, offers Sagebrush Sound's replay", async () => {
    const notice = await draft("Japan");
    expect(within(notice).queryByRole("list")).toBeNull();
    expect(
      within(notice)
        .getByRole("link", { name: /Back to Sagebrush Sound/ })
        .getAttribute("href"),
    ).toBe("/");
  });
});

describe("a failed planner call on a saved town's live run", () => {
  it("offers the saved build's replay, as a busy Qloo does", async () => {
    // The venue switch asks GET /api/venue-switch once on mount; a 404 is fine there.
    const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async (url) =>
        url.startsWith("/api/venue-switch")
          ? new Response("", { status: 404 })
          : ndjson(run("live-1")),
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Run the agent live instead" }),
    );
    await waitFor(() => expect(screen.getByText(FAILED.message)).toBeTruthy());
    fireEvent.click(
      screen.getByRole("button", { name: "Watch the saved build instead" }),
    );
    const builds = fetch.mock.calls.filter(([url]) => url === "/api/undercard");
    expect(builds).toHaveLength(2);
    expect(JSON.parse(String(builds[1][1]?.body))).toMatchObject({
      fresh: false,
    });
  });
});
