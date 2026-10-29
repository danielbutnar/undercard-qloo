// @vitest-environment jsdom
// A live run on a saved town is no longer the build other visitors open on (Daniel's brief of
// 2026-10-21, night). Whoever ran it keeps their own lineup on screen, with its venue switch and
// its Watch, and a reload opens on the saved build again. The screen talks to the real build
// handler and store over a synthetic Qloo; everything here is invented data.
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
import { yourFestival, type YourBrief } from "@/lib/your-festival";
import { readFirstBill } from "@/server/first-bill";
import { createQlooClient } from "@/server/qloo";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleUndercardBuild } from "@/server/undercard-build";
import { readVenueSwitch } from "@/server/venue-switch";
import { readEvents, scriptedPlanner, syntheticServer } from "../m3/scripted";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const SKIP = { name: "Skip to the lineup" };
const WATCH = { name: "Watch the AI agent build it" };
const RUN_LIVE = { name: "Play it live" };
const drafted = () => document.querySelector(".drafted")?.textContent ?? "";
// The line's own words, without its link to the setlist's "Play it live" (Daniel, 29 Oct).
const under = () => {
  const line = document.querySelector(".watch-sub")?.cloneNode(true) as
    HTMLElement | undefined;
  line?.querySelector(".watch-live-link")?.remove();
  return line?.textContent ?? "";
};

/**
 * A server holding Boise's saved build, dated like production's (12:13 UTC on 17 October), or
 * none, and a browser whose requests reach it: builds through the build handler, each with a
 * planner of its own (a judge's brief runs live and unsaved, as the route runs it), and the venue
 * switch through its reader.
 */
async function boiseWithSaved({ saved = true }: { saved?: boolean } = {}) {
  const server = syntheticServer();
  if (saved) {
    await readEvents(server.build({ fresh: true }));
    const first = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
    await server.cache.set(
      `undercard:build:v1:id:${first.id}`,
      { ...first, createdAt: "2026-10-17T12:13:00.000Z" },
      600,
    );
  }
  const cacheOnly = createQlooClient({
    apiKey: "k",
    cache: server.cache,
    fetch: () => {
      throw new Error("no Qloo call from a replay or the venue switch");
    },
    cacheOnly: true,
  });
  const builds: { fresh?: boolean; id: string }[] = [];
  const switches: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/undercard") {
        const body = JSON.parse(String(init?.body)) as {
          fresh?: boolean;
          brief?: YourBrief;
        };
        const planner = scriptedPlanner();
        const text = await (
          await handleUndercardBuild({
            festival: body.brief
              ? yourFestival(body.brief, "yours-test")
              : SAGEBRUSH_SOUND,
            limiter: createMemoryLimiter(),
            ip: "203.0.113.7",
            qloo: () => server.qloo,
            model: () => planner.model,
            store: server.store,
            fresh: body.fresh === true || body.brief !== undefined,
            save: body.brief === undefined,
            replayDelayMs: 0,
            cachedQloo: () => cacheOnly,
          })
        ).text();
        builds.push({
          fresh: body.fresh,
          id: JSON.parse(text.split("\n")[0]).id,
        });
        return new Response(text, {
          headers: { "content-type": "application/x-ndjson" },
        });
      }
      if (url.startsWith("/api/venue-switch")) {
        const buildId =
          new URL(url, "http://localhost").searchParams.get("build") ??
          undefined;
        switches.push(buildId ?? "");
        const data = await readVenueSwitch({
          store: server.store,
          festival: SAGEBRUSH_SOUND,
          qloo: cacheOnly,
          buildId,
        });
        return data ? Response.json(data) : new Response("{}", { status: 404 });
      }
      return new Response("{}", { status: 404 });
    }),
  );
  /** The first screen as the server serves it: the festival's latest saved build. */
  const firstScreen = async () => (
    <FestivalScreen
      festival={SAGEBRUSH_SOUND}
      firstBill={await readFirstBill(server.store, SAGEBRUSH_SOUND.id)}
    />
  );
  return { server, builds, switches, firstScreen };
}

describe("a live run on the first screen", () => {
  it("shows the run's lineup with its own venue switch and Watch, and a reload shows the saved build again", async () => {
    const boise = await boiseWithSaved();
    render(await boise.firstScreen());
    expect(drafted()).toContain("saved Oct 17, 12:13 UTC");

    fireEvent.click(screen.getAllByRole("button", RUN_LIVE)[0]);
    const draft = screen.getByRole("region", { name: "Undercard draft" });
    fireEvent.click(await screen.findByRole("button", SKIP, { timeout: 8000 }));
    await waitFor(() => expect(screen.getByRole("button", WATCH)).toBeTruthy());
    const run = boise.builds[0];
    expect(run.fresh).toBe(true);
    // The run is kept under its own id.
    expect((await boise.server.store.byId(run.id))?.id).toBe(run.id);
    // The run's lineup, not the saved one, and the venue switch works from the run's own id.
    expect(within(draft).getAllByRole("article")).toHaveLength(10);
    expect(drafted()).not.toContain("Oct 17, 12:13");
    await waitFor(() => expect(boise.switches).toContain(run.id));
    // Where the run finishes, it says it isn't the build other visitors open on.
    expect(drafted()).toMatch(
      /^Drafted from \d+ Qloo calls the AI agent planned · run live .+ UTC, not saved for other visitors$/,
    );

    // Watch replays the run on screen: no request, so the saved build can't take its place.
    expect(under()).toBe("Replays how the agent drafted Boise");
    fireEvent.click(screen.getByRole("button", WATCH));
    fireEvent.click(await screen.findByRole("button", SKIP));
    await waitFor(() => expect(screen.getByRole("button", WATCH)).toBeTruthy());
    expect(boise.builds).toHaveLength(1);
    expect(within(draft).getAllByRole("article")).toHaveLength(10);
    expect(drafted()).not.toContain("Oct 17, 12:13");

    // A reload: the server still serves the saved build.
    cleanup();
    render(await boise.firstScreen());
    expect(drafted()).toContain("saved Oct 17, 12:13 UTC");
  }, 20000);
});

describe("where a live run finishes", () => {
  it("calls an empty board's first build saved, since every later visitor opens on it", async () => {
    const boise = await boiseWithSaved({ saved: false });
    render(await boise.firstScreen());
    fireEvent.click(screen.getByRole("button", { name: "Build undercard" }));
    fireEvent.click(await screen.findByRole("button", SKIP, { timeout: 8000 }));
    await waitFor(() => expect(screen.getByRole("button", WATCH)).toBeTruthy());
    expect((await boise.server.store.latest(SAGEBRUSH_SOUND.id))?.id).toBe(
      boise.builds[0].id,
    );
    expect(drafted()).toMatch(
      /^Drafted from \d+ Qloo calls the AI agent planned · saved .+ UTC$/,
    );
  }, 20000);

  it("says a judge's own run isn't saved for other visitors", async () => {
    await boiseWithSaved();
    const brief: YourBrief = {
      city: SAGEBRUSH_SOUND.city,
      region: SAGEBRUSH_SOUND.region,
      headliners: [...SAGEBRUSH_SOUND.headliners] as [string, string],
    };
    render(
      <FestivalScreen
        festival={yourFestival(brief, "yours-test")}
        custom={{ brief, onEdit: () => {} }}
      />,
    );
    fireEvent.click(await screen.findByRole("button", SKIP, { timeout: 8000 }));
    await waitFor(() =>
      expect(drafted()).toContain("not saved for other visitors"),
    );
    expect(drafted()).not.toContain("· saved");
  }, 20000);
});
