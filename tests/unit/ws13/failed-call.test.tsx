// @vitest-environment jsdom
// Must-fix before the 2.0 deploy (Daniel, 28 October, 14:10): a failed or busy Qloo call in a run
// never passes silently. The run retries the call once; if it still fails, the trace says which
// venue wasn't checked, and the page says the bill may be short. Every call: venue, control,
// control-town search and the location reading. Invented data only.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { shortLine } from "@/lib/agent-words";
import { buildReducer, IDLE_BUILD, type BuildState } from "@/lib/build-state";
import { TracePanel } from "@/components/trace-panel";
import { syntheticId, syntheticQloo } from "../m2/fake-qloo";
import {
  LANTERN,
  OPENING,
  read,
  runAgent,
  scriptedModel,
  type Turn,
} from "./agent-kit";

afterEach(cleanup);

const PLAN: Turn[] = [
  ...OPENING,
  [read("mid", LANTERN), read("opener", LANTERN)],
  [
    {
      name: "finish",
      input: {
        anchor_venue_ids: [LANTERN],
        summary: "One venue filled both tiers.",
        stopped_because: "every_band_full",
      },
    },
  ],
];
const HALL = syntheticId(401);

/** A route that answers HTTP 400 (not retried by the client) to the calls `fails` picks. */
function failing(fails: (url: URL, seen: number) => boolean) {
  let seen = 0;
  return (url: URL) => {
    if (fails(url, seen++)) return new Response("{}", { status: 400 });
    return syntheticQloo(url);
  };
}
const isMidControl = (url: URL) =>
  (url.searchParams.get("signal.interests.entities") ?? "").endsWith(HALL) &&
  url.searchParams.get("filter.popularity.min") === "0.8";

describe("a failed control call (Daniel, 14:10)", () => {
  it("is retried once, and the run books as if it hadn't failed", async () => {
    let failed = 0;
    const route = failing((url) => isMidControl(url) && failed++ === 0);
    const { result, calls } = await runAgent(
      scriptedModel(PLAN).model,
      undefined,
      route,
    );
    expect(failed).toBe(2);
    expect(result.complete).toBe(true);
    const control = calls.find(
      (call) =>
        call.tool === "control_artists" &&
        call.summary.startsWith("Mid") &&
        call.summary.includes("Aarhus Hall"),
    )!;
    expect(control.error).toBeUndefined();
    expect(control.retried).toContain(400);
    expect(calls.some((call) => call.unchecked)).toBe(false);
  });

  it("says which venue wasn't checked, and that the bill may be short, when the retry fails too", async () => {
    const route = failing((url) => isMidControl(url));
    const { result, calls, events } = await runAgent(
      scriptedModel(PLAN).model,
      undefined,
      route,
    );
    const failedCall = calls.find((call) => call.unchecked);
    expect(failedCall?.unchecked).toBe("The Lantern Room");
    expect(failedCall?.error).toBeDefined();
    const short = events.find((event) => event.type === "short");
    expect(short).toEqual({
      type: "short",
      venues: ["The Lantern Room"],
      text: shortLine(["The Lantern Room"]),
    });
    expect(shortLine(["The Lantern Room"])).toBe(
      "Qloo didn't answer for The Lantern Room, so it wasn't checked: this bill may be short.",
    );
    expect(result.short?.venues).toEqual(["The Lantern Room"]);

    // The page says so: the Qloo calls list ends on it.
    const state = events.reduce<BuildState>(
      (board, event) => buildReducer(board, { type: "event", event }),
      { ...IDLE_BUILD, status: "building" },
    );
    render(<TracePanel state={state} onBuild={() => {}} />);
    expect(screen.getByText(shortLine(["The Lantern Room"]))).toBeTruthy();
  });
});

describe("every other call in the run (Daniel, 14:10)", () => {
  it("retries a failed venue read once", async () => {
    let failed = 0;
    const route = failing(
      (url) =>
        (url.searchParams.get("signal.interests.entities") ?? "").endsWith(
          LANTERN,
        ) &&
        url.searchParams.get("filter.popularity.min") === "0.8" &&
        failed++ === 0,
    );
    const { result, calls } = await runAgent(
      scriptedModel(PLAN).model,
      undefined,
      route,
    );
    expect(result.complete).toBe(true);
    expect(
      calls.find(
        (call) =>
          call.tool === "venue_artists" && call.summary.startsWith("Mid"),
      )?.retried,
    ).toContain(400);
  });

  it("marks the venue unchecked when the control town's search fails twice", async () => {
    const route = failing(
      (url) =>
        url.searchParams.get("filter.type") === "urn:entity:place" &&
        url.searchParams.get("filter.location.query") === "Aarhus",
    );
    const { calls, events } = await runAgent(
      scriptedModel(PLAN).model,
      undefined,
      route,
    );
    const search = calls.find((call) => call.tool === "control_venues")!;
    expect(search.error).toBeDefined();
    expect(search.unchecked).toBe("The Lantern Room");
    expect(events.find((event) => event.type === "short")).toMatchObject({
      venues: ["The Lantern Room"],
    });
  });

  it("says when a location reading wasn't made, without calling the bill short", async () => {
    const route = failing((url) =>
      url.searchParams.has("signal.location.query"),
    );
    const { result, calls, events } = await runAgent(
      scriptedModel(PLAN).model,
      undefined,
      route,
    );
    expect(result.complete).toBe(true);
    const located = calls.filter(
      (call) =>
        call.tool === "location_signal" &&
        call.params.length === 0 &&
        call.error !== undefined,
    );
    expect(located.length).toBeGreaterThan(0);
    expect(located[0].unchecked).toMatch(/location reading/);
    expect(events.some((event) => event.type === "short")).toBe(false);
  });
});
