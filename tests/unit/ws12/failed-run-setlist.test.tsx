// @vitest-environment jsdom
// WS12 item 9: after a live run fails (Qloo busy, or the connection drops), the bill on screen is
// still the saved build, so the setlist still lists the saved build's calls; it showed "0 Qloo
// calls" under the saved build's own lines. A refill's call follows the saved build's calls.
// Synthetic data: invented acts and venues, no Qloo data.
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
import { billPlaces } from "@/lib/places";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { syntheticSavedBuild } from "../../e2e/synthetic-build";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const saved = syntheticSavedBuild();
const BILL = {
  ...FIRST_BILL,
  places: billPlaces(saved.lineup.acts, saved.context.baselines),
  trace: saved.trace,
  notes: saved.notes,
};
const NDJSON = { headers: { "content-type": "application/x-ndjson" } };
const stream = (events: unknown[]) =>
  new Response(events.map((event) => JSON.stringify(event)).join("\n"), NDJSON);

describe("the setlist after a live run fails (WS12 item 9)", () => {
  it("still lists the saved build's calls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/undercard"
          ? stream([
              {
                type: "build",
                id: "live",
                createdAt: "2026-10-28T20:00:00.000Z",
                replayed: false,
              },
              {
                type: "error",
                code: "qloo-busy",
                message: "Qloo is busy right now, so the live run stopped.",
              },
              { type: "done", calls: 0, ms: 900 },
            ])
          : new Response(null, { status: 404 }),
      ),
    );
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={BILL} />);
    fireEvent.click(screen.getByRole("button", { name: "Play it live" }));
    await screen.findByText("Qloo is busy right now, so the live run stopped.");
    const sheet = screen.getByRole("region", {
      name: "The AI agent's setlist",
    });
    await waitFor(() =>
      expect(
        within(sheet).getAllByRole("listitem", { name: /^Call \d+/ }),
      ).toHaveLength(saved.trace.length),
    );
    expect(sheet.textContent).toContain(`${saved.trace.length} Qloo calls`);
  });
});
