// @vitest-environment jsdom
// Artist images in Watch (Daniel's brief of 2026-10-21, item A, on WS9's first screen): while
// Watch plays, the headliners keep their Qloo photos on the poster and no picture is ever an
// empty grey box; each act lands in its slot as the poster sets it. Invented image URLs.
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

const image = (n: number) => `https://images.qloo.com/i/synthetic-${n}.jpg`;

describe("artist images in Watch", () => {
  it("keeps the headliners' photos while the venues' acts land, with no empty box", async () => {
    const server = syntheticServer();
    const events = await readEvents(server.build({ fresh: true }));
    const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
    const images = Object.fromEntries(
      saved.lineup.acts.map((act, n) => [act.entityId, image(n)]),
    );
    const headliners = saved.context.headliners.map(({ entityId, name }) => ({
      entityId,
      name,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/venue-switch")
          ? new Response("{}", { status: 404 })
          : new Response(
              events
                .map((e) => (e.type === "build" ? { ...e, replayed: true } : e))
                .map((event) => JSON.stringify(event))
                .join("\n") + "\n",
              { headers: { "content-type": "application/x-ndjson" } },
            ),
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
          images,
          headliners,
          headlinerImages: Object.fromEntries(
            headliners.map((headliner, n) => [
              headliner.entityId,
              image(90 + n),
            ]),
          ),
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Watch the AI agent build it" }),
    );
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    const mid = within(bill).getByRole("region", { name: "Mid-size acts" });
    await waitFor(
      () =>
        expect(
          within(mid).getByText("With The Lantern Room's fans added"),
        ).toBeTruthy(),
      { timeout: 8000 },
    );
    expect(
      [
        ...within(bill)
          .getByRole("list", { name: "Booked headliners" })
          .querySelectorAll("img.cover-photo"),
      ].map((photo) => photo.getAttribute("src")),
    ).toEqual([image(90), image(91)]);
    expect(within(mid).getAllByRole("article").length).toBeGreaterThan(0);
    // Daniel's brief of 2026-10-22, item 5: the drawn cover, never an empty grey box.
    expect(document.querySelector(".sleeve-blank")).toBeNull();
  }, 15000);
});
