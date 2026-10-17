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
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ type: "done", calls: 0, ms: 0 }) + "\n", {
          headers: { "content-type": "application/x-ndjson" },
        }),
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
    for (const act of [acts[0], acts[4], acts[5]]) {
      fireEvent.click(within(bill).getByRole("button", { name: act.name }));
      const card = screen.getByRole("region", { name: "Act card" });
      fireEvent.click(within(card).getByRole("button", { name: "Keep" }));
      expect(
        within(card)
          .getByRole("button", { name: "Keep" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
    }
    expect(within(bill).getAllByText("Kept")).toHaveLength(3);
    fireEvent.click(
      within(bill).getByRole("button", { name: "Redraft the rest" }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/redraft");
    const body = JSON.parse(String(init.body));
    expect(body.buildId).toBe(saved.id);
    expect(body.replace).toHaveLength(7);
    expect(
      body.replace.map((slot: { entityId: string }) => slot.entityId),
    ).not.toContain(acts[0].entityId);
  });
});
