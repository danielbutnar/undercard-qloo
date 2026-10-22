// @vitest-environment jsdom
// Plan.md item 3 (the review's T4): in Watch, the AI agent's own line from the saved trace sits
// under each venue's edition; where the trace has none for that step, one fixed line says what
// the agent decides. No reason is ever invented.
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
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { readEvents, syntheticServer } from "../m3/scripted";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Event = { type: string; planner?: boolean };
const FIXED =
  "The AI agent chose which venues to read, and in what order; Qloo's numbers and the rule pick the acts.";

async function watchWith(transform: (events: Event[]) => Event[]) {
  const server = syntheticServer();
  const events = (await readEvents(server.build({ fresh: true }))) as Event[];
  const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
  const stream = transform(
    events.map((e) => (e.type === "build" ? { ...e, replayed: true } : e)),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.startsWith("/api/venue-switch")
        ? new Response("{}", { status: 404 })
        : new Response(stream.map((e) => JSON.stringify(e)).join("\n") + "\n", {
            headers: { "content-type": "application/x-ndjson" },
          }),
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
  fireEvent.click(
    screen.getByRole("button", { name: "Watch how it picked these acts" }),
  );
  const bill = screen.getByRole("region", { name: "Undercard draft" });
  await waitFor(
    () => expect(within(bill).getByText(/^\+ .+'s fans$/)).toBeTruthy(),
    { timeout: 8000 },
  );
  return bill;
}

describe("the AI agent's line in Watch (plan.md item 3)", () => {
  it("shows the agent's own line from the trace under a venue's edition", async () => {
    const line = "Anchors: The Lantern Room first, then the others.";
    const bill = await watchWith((events) => {
      const at = events.findIndex((e) => e.type === "build") + 1;
      const plain = events.filter((e) => !(e.type === "status" && e.planner));
      return [
        ...plain.slice(0, at),
        { type: "status", text: line, planner: true } as Event,
        ...plain.slice(at),
      ];
    });
    // WS2: the label reads "The AI agent's plan:", with the Anchors key under its first line.
    expect(within(bill).getByText(`The AI agent's plan: ${line}`)).toBeTruthy();
    expect(
      within(bill).getByText("Anchors are the venues whose fans it reads."),
    ).toBeTruthy();
    expect(within(bill).queryByText(FIXED)).toBeNull();
  }, 15000);

  it("says what the agent decides, in one fixed line, where the trace has no line of its own", async () => {
    const bill = await watchWith((events) =>
      events.filter((e) => !(e.type === "status" && e.planner)),
    );
    expect(within(bill).getByText(FIXED)).toBeTruthy();
    expect(within(bill).queryByText(/^The AI agent's plan: /)).toBeNull();
  }, 15000);
});
