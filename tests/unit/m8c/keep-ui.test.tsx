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
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { readEvents, syntheticServer } from "../m3/scripted";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Keep and Redraft the rest (M8c)", () => {
  it("keeps acts from their cards, then redrafts the other slots in one click from the bill", async () => {
    const server = syntheticServer();
    await readEvents(server.build());
    const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
    const acts = saved.lineup.acts;
    // The venue switch asks GET /api/venue-switch once on mount; a 404 makes it say it isn't
    // available. Every other request is the redraft's stream.
    const fetch = vi.fn(async (url: string) =>
      url.startsWith("/api/venue-switch")
        ? new Response("{}", { status: 404 })
        : new Response(
            JSON.stringify({ type: "done", calls: 0, ms: 0 }) + "\n",
            {
              headers: { "content-type": "application/x-ndjson" },
            },
          ),
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={{
          build: { id: saved.id, createdAt: saved.createdAt },
          acts,
          calls: saved.trace.length,
          placesListed: null,
          anchors: {},
          baselineTop: {},
        }}
      />,
    );
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    expect(
      within(bill).queryByRole("button", { name: "Redraft the rest" }),
    ).toBeNull();
    const kept = [acts[0], acts[4], acts[5]];
    for (const act of kept) {
      fireEvent.click(within(bill).getByRole("button", { name: act.name }));
      const card = screen.getByRole("region", { name: "Act card" });
      expect(
        within(card)
          .getByRole("button", { name: "Keep" })
          .getAttribute("aria-pressed"),
      ).toBe("false");
      fireEvent.click(within(card).getByRole("button", { name: "Keep" }));
      // Keep is a toggle: same name, now pressed.
      expect(
        within(card)
          .getByRole("button", { name: "Keep" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
    }
    // Close the open card: each kept act's row is flagged Kept, and no other row is.
    fireEvent.click(screen.getByRole("button", { name: "Close the card" }));
    expect(screen.queryByRole("region", { name: "Act card" })).toBeNull();
    expect(within(bill).getAllByText("Kept")).toHaveLength(3);
    for (const act of acts)
      expect(
        within(
          within(bill).getByRole("article", { name: act.name }),
        ).queryByText("Kept") !== null,
      ).toBe(kept.includes(act));
    expect(
      within(bill).getByText(
        "Redraft the rest keeps 3 acts and refills the other slots from the same venues, in at most 5 Qloo calls.",
      ),
    ).toBeTruthy();
    fireEvent.click(
      within(bill).getByRole("button", { name: "Redraft the rest" }),
    );
    const redrafts = () =>
      fetch.mock.calls.filter(([url]) => url === "/api/redraft");
    await waitFor(() => expect(redrafts()).toHaveLength(1));
    const [url, init] = redrafts()[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/redraft");
    const body = JSON.parse(String(init.body));
    expect(body.buildId).toBe(saved.id);
    expect(body.replace).toHaveLength(7);
    expect(
      body.replace.map((slot: { entityId: string }) => slot.entityId),
    ).not.toContain(acts[0].entityId);
    // Apart from the venue switch's one GET, the redraft is the only request.
    expect(
      fetch.mock.calls.filter(([url]) => !url.startsWith("/api/venue-switch")),
    ).toHaveLength(1);
  });
});
