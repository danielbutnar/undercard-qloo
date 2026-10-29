// @vitest-environment jsdom
// A live run sends its lineup only after its last Qloo call, so while Watch plays its editions
// the banner can't count the acts each venue put on the lineup yet: it counts the climbs the
// edition itself shows, and never says a venue lifted nothing beside a chart of climbs.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import type { ClimbEvent } from "@/lib/lift-climb";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { readEvents, syntheticServer } from "../m3/scripted";
import { lag, settle, SLOW_MS } from "../test-clock";

// The tests read a clock they move themselves, never the wall clock (Daniel, 2026-10-28), so a
// loaded machine can't fail them: Watch's pace runs on it, and the banner is read on the first
// edition with the Lantern Room's title. requestAnimationFrame and performance.now stay real:
// the page's one frame-paced motion, the town's camera glide, needs a measured viewport that
// jsdom never gives, so no frame is asked for here.
beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// The venue switch's request gets a 404; the build's stream sends everything before the lineup
// and then stays open, as a live run does while the agent is still working.
function liveRunBeforeItsLineup(events: { type: string }[], latency: number) {
  const head = events.slice(
    0,
    events.findIndex((event) => event.type === "lineup"),
  );
  return vi.fn(async (url: string) => {
    await lag(latency);
    if (url.startsWith("/api/venue-switch"))
      return new Response("{}", { status: 404 });
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            head.map((event) => JSON.stringify(event)).join("\n") + "\n",
          ),
        );
      },
    });
    return new Response(body, {
      headers: { "content-type": "application/x-ndjson" },
    });
  });
}

describe.each([
  { speed: "at full speed", latency: 0 },
  { speed: "on a slow machine", latency: SLOW_MS },
])("Watch's banner during a live run, $speed", ({ latency }) => {
  it("counts the climbs the edition shows until the lineup is in", async () => {
    const server = syntheticServer();
    const events = await readEvents(server.build({ fresh: true }));
    const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
    // The live order: every edition comes before the lineup.
    expect(
      events.findIndex((event) => event.type === "lineup"),
    ).toBeGreaterThan(events.findLastIndex((event) => event.type === "climb"));
    vi.stubGlobal("fetch", liveRunBeforeItsLineup(events, latency));
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
    fireEvent.click(screen.getAllByRole("button", { name: "Play it live" })[0]);
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    await settle(() =>
      expect(
        within(bill).queryAllByText("+ The Lantern Room's fans"),
      ).toHaveLength(1),
    );
    const edition = events
      .filter((event): event is ClimbEvent => event.type === "climb")
      .find(
        (step) =>
          step.band === "mid" && step.venue?.name === "The Lantern Room",
      )!;
    const climbs = edition.acts.filter((listed) => listed.move !== null).length;
    expect(climbs).toBeGreaterThan(1);
    expect(bill.querySelector(".edition-line")?.textContent).toBe(
      `Qloo's ranking re-sorts with this venue's fans added: ${climbs} of the top ${edition.acts.length} climb 5 places or more.`,
    );
  });

  it("counts the acts the venue put on the lineup once the lineup is in, as in a replay", async () => {
    const server = syntheticServer();
    const events = await readEvents(server.build({ fresh: true }));
    const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
    // A replay's stream: every event at once, so the lineup is in before the editions play.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        await lag(latency);
        return url.startsWith("/api/venue-switch")
          ? new Response("{}", { status: 404 })
          : new Response(
              events
                .map((event) =>
                  JSON.stringify(
                    event.type === "build"
                      ? { ...event, replayed: true }
                      : event,
                  ),
                )
                .join("\n") + "\n",
              { headers: { "content-type": "application/x-ndjson" } },
            );
      }),
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
      screen.getByRole("button", { name: "Watch the AI agent build it" }),
    );
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    await settle(() =>
      expect(
        within(bill).queryAllByText("+ The Lantern Room's fans"),
      ).toHaveLength(1),
    );
    const booked = saved.lineup.acts.filter(
      (act) =>
        act.band === "mid" && act.anchorVenue.name === "The Lantern Room",
    ).length;
    expect(booked).toBeGreaterThan(1);
    expect(bill.querySelector(".edition-line")?.textContent).toBe(
      `Qloo's ranking re-sorts with this venue's fans added: ${booked} acts climb onto the lineup.`,
    );
  });
});
