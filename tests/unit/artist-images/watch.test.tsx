// @vitest-environment jsdom
// Artist images in Watch (Daniel's brief of 2026-10-21, item A): an act on the lineup keeps its
// picture in Watch's editions, as on the lineup; every other act there keeps its drawn cover,
// since images are read for the lineup's acts only. Invented image URLs.
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
import type { ClimbEvent } from "@/lib/lift-climb";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { readEvents, syntheticServer } from "../m3/scripted";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const image = (n: number) => `https://images.qloo.com/i/synthetic-${n}.jpg`;

describe("artist images in Watch", () => {
  it("shows each lineup act's picture in the editions, and the drawn cover for the rest", async () => {
    const server = syntheticServer();
    const events = await readEvents(server.build({ fresh: true }));
    const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
    const images = Object.fromEntries(
      saved.lineup.acts.map((act, n) => [act.entityId, image(n)]),
    );
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
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Watch how it picked these acts" }),
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
    const edition = events
      .filter((e): e is ClimbEvent => e.type === "climb")
      .find(
        (step) =>
          step.band === "mid" && step.venue?.name === "The Lantern Room",
      )!;
    const onLineup = edition.acts.filter((listed) => images[listed.entityId]);
    const offLineup = edition.acts.filter((listed) => !images[listed.entityId]);
    expect(onLineup.length).toBeGreaterThan(0);
    expect(offLineup.length).toBeGreaterThan(0);
    for (const listed of onLineup) {
      const row = within(mid).getByText(listed.name).closest("li")!;
      expect(row.querySelector("img.cover-photo")?.getAttribute("src")).toBe(
        images[listed.entityId],
      );
    }
    for (const listed of offLineup) {
      const row = within(mid).getByText(listed.name).closest("li")!;
      expect(row.querySelector("img.cover-photo")).toBeNull();
    }
  }, 15000);
});
