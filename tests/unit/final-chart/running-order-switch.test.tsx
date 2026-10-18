// @vitest-environment jsdom
// The running order is planned for the saved lineup, so it steps aside while a venue is off and
// the chart shows the re-formed lineup, and comes back once every venue is on again.
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
import { planRunningOrder } from "@/lib/running-order";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createQlooClient } from "@/server/qloo";
import { readVenueSwitch } from "@/server/venue-switch";
import { readEvents, syntheticServer } from "../m3/scripted";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Running order while a venue is off", () => {
  it("steps aside while the chart shows the re-formed lineup, and returns with every venue on", async () => {
    const server = syntheticServer();
    await readEvents(server.build({ fresh: true }));
    const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
    const data = await readVenueSwitch({
      store: server.store,
      festival: SAGEBRUSH_SOUND,
      qloo: createQlooClient({
        apiKey: "k",
        cache: server.cache,
        fetch: () => {
          throw new Error("the venue switch must not call Qloo");
        },
        cacheOnly: true,
      }),
      buildId: saved.id,
    });
    const slots = planRunningOrder(
      saved.lineup.acts,
      () => 0.83,
      SAGEBRUSH_SOUND.feeBands,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/venue-switch")
          ? Response.json(data)
          : new Response(
              [
                { type: "running-order", slots },
                { type: "done", calls: 8, ms: 900 },
              ]
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
        }}
      />,
    );
    fireEvent.click(
      within(screen.getByRole("region", { name: "Undercard draft" })).getByRole(
        "button",
        { name: "Running order" },
      ),
    );
    await screen.findByRole("region", { name: "Running order" });

    const venue = data!.venues[0];
    const toggle = screen.getByRole("button", {
      name: (name) => name.startsWith(`${venue.name}: on`),
    }) as HTMLButtonElement;
    await waitFor(() => expect(toggle.disabled).toBe(false));
    fireEvent.click(toggle);
    expect(screen.queryByRole("region", { name: "Running order" })).toBeNull();

    // The what-if line and the switch each offer it.
    fireEvent.click(
      screen.getAllByRole("button", { name: "All venues on" })[0],
    );
    expect(screen.getByRole("region", { name: "Running order" })).toBeTruthy();
  });
});
