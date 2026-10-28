// @vitest-environment jsdom
// WS13 item 1: the trace says so. A 2.0 call that read a venue Qloo had no fan data for says it
// on its line in the Qloo calls list, and the first screen's no-fan-data venues come from the
// build's own calls, never inferred from the cache.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { TraceCall } from "@/lib/build-events";
import { IDLE_BUILD } from "@/lib/build-state";
import { noFanDataCallLine } from "@/lib/agent-words";
import { TracePanel } from "@/components/trace-panel";
import { createBuildStore, type SavedBuild } from "@/server/build-store";
import { noFanDataFor } from "@/server/fan-data";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { HALL, HALL_NAME, LARKSPUR_FESTIVAL } from "./agent-kit";

afterEach(cleanup);

const call = (n: number, venue: string, noFanData?: string): TraceCall => ({
  n,
  tool: "venue_artists",
  endpoint: "/v2/insights",
  summary: `Mid-band artists for the headliners and ${venue}`,
  params: [],
  resultCount: 50,
  ms: 900,
  cached: false,
  ...(noFanData ? { noFanData } : {}),
});

describe("the Qloo calls list (WS13.1)", () => {
  it("says on a call's line that Qloo had no fan data for the venue it read", () => {
    render(
      <TracePanel
        state={{
          ...IDLE_BUILD,
          status: "done",
          calls: [call(8, "The Lantern Room"), call(9, HALL_NAME, HALL_NAME)],
          summary: { calls: 2, ms: 1800 },
        }}
        onBuild={() => {}}
      />,
    );
    const rows = within(
      screen.getByRole("list", { name: "Qloo calls" }),
    ).getAllByRole("listitem");
    expect(
      within(rows[1]).getByText(noFanDataCallLine(HALL_NAME)),
    ).toBeTruthy();
    expect(within(rows[0]).queryByText(/no fan data/)).toBeNull();
    expect(noFanDataCallLine(HALL_NAME)).toBe(
      `Qloo had no fan data for ${HALL_NAME}: the agent skips it.`,
    );
  });
});

describe("the Qloo calls list's last line (WS13.2)", () => {
  it("says why the agent stopped, after the last call", () => {
    const text =
      "The agent stopped reading venues: every tier is full, after 11 of its 28 Qloo calls.";
    render(
      <TracePanel
        state={{
          ...IDLE_BUILD,
          status: "done",
          calls: [call(8, "The Lantern Room")],
          summary: { calls: 11, ms: 1800 },
          stopped: { reason: "full", text },
        }}
        onBuild={() => {}}
      />,
    );
    const line = screen.getByText(text);
    const list = screen.getByRole("list", { name: "Qloo calls" });
    expect(
      list.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("says nothing on a 1.0 replay, which has no such line", () => {
    render(
      <TracePanel
        state={{
          ...IDLE_BUILD,
          status: "done",
          calls: [call(8, "The Lantern Room")],
          summary: { calls: 12, ms: 1800 },
        }}
        onBuild={() => {}}
      />,
    );
    expect(screen.queryByText(/The agent stopped/)).toBeNull();
  });
});

describe("a 2.0 build's no-fan-data venues (WS13.1)", () => {
  it("come from its calls, with no read of the Qloo cache", async () => {
    const store = createBuildStore(createMemoryCache());
    const lantern = { entityId: "lantern", name: "The Lantern Room" };
    const hall = { entityId: HALL, name: HALL_NAME };
    const build: SavedBuild = {
      id: "two-point-oh",
      festivalId: LARKSPUR_FESTIVAL.id,
      createdAt: "2026-10-28T08:00:00.000Z",
      trace: [call(8, lantern.name), call(9, hall.name, hall.name)],
      lineup: { festivalId: LARKSPUR_FESTIVAL.id, acts: [] },
      context: {
        headliners: [],
        comparedTags: [],
        baselines: {},
        anchors: { mid: [lantern, hall] },
      },
      engine: 2,
      cachePrefix: "qloo:a2:",
    };
    await store.save(build);
    const untouchable = createQlooClient({
      apiKey: "k",
      cache: {
        kind: "memory",
        get: async () => {
          throw new Error("a 2.0 build's calls already say it");
        },
        set: async () => {},
      },
      cacheOnly: true,
    });
    await expect(
      noFanDataFor({
        store,
        festival: LARKSPUR_FESTIVAL,
        qloo: untouchable,
        buildId: build.id,
      }),
    ).resolves.toEqual([HALL]);
  });
});
