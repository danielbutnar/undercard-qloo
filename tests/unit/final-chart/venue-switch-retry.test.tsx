// @vitest-environment jsdom
// A live run's "done" reaches the screen before the server has saved the run, so the venue
// switch's first request can find nothing: it asks once more before saying it isn't available.
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createQlooClient } from "@/server/qloo";
import { readVenueSwitch } from "@/server/venue-switch";
import { readEvents, syntheticServer } from "../m3/scripted";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the venue switch's request", () => {
  it("asks once more when the build isn't in the store yet", async () => {
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
    let asked = 0;
    const fetch = vi.fn(async (url: string) => {
      if (!url.startsWith("/api/venue-switch"))
        return new Promise<Response>(() => {});
      asked += 1;
      return asked === 1
        ? new Response("{}", { status: 404 })
        : Response.json(data);
    });
    vi.stubGlobal("fetch", fetch);
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
    const venues = screen.getByRole("region", {
      name: "Boise venues whose fans shaped this lineup",
    });
    await waitFor(
      () => {
        const toggles = within(venues).getAllByRole(
          "button",
        ) as HTMLButtonElement[];
        expect(toggles.every((toggle) => !toggle.disabled)).toBe(true);
      },
      { timeout: 4000 },
    );
    expect(asked).toBe(2);
  }, 10000);
});
