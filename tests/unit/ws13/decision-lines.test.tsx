// @vitest-environment jsdom
// WS13 item 7: a line for every decision. The planner writes one line per choice: why this
// venue (with each venue read), why skip (the read that replaces a venue Qloo had no fan data
// for says so), why stop (finish's summary, a planner line saved with the build). The fallback
// line stays only for old saved runs. With WS8's item 16: the venue note says why these venues,
// from the agent's own line when the build has one. Invented data only.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { agentLineFor } from "@/lib/agent-words";
import type { TraceCall } from "@/lib/build-events";
import { AGENT_DECIDES } from "@/components/chart/words";
import { legendLine } from "@/components/chart/poster-words";
import { CallRow } from "@/components/trace-panel";
import { SYSTEM_PROMPT } from "@/server/agent";
import { AGENT_TOOLS } from "@/server/agent-tools";
import { createBuildStore, type SavedBuild } from "@/server/build-store";
import { readFirstBill } from "@/server/first-bill";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleUndercardBuild } from "@/server/undercard-build";
import { fakeFetch, syntheticQloo } from "../m2/fake-qloo";
import { readEvents } from "../m3/scripted";
import {
  FORT,
  HALL,
  HALL_NAME,
  LANTERN,
  LARKSPUR_FESTIVAL,
  opened,
  OPENING,
  scriptedModel,
  type Turn,
} from "./agent-kit";

afterEach(cleanup);

const why = (band: "mid" | "opener", venue: string, line: string) => ({
  name: "venue_artists",
  input: { band, venue_id: venue, why: line },
});
const PLAN_SUMMARY =
  "Read the Lantern Room and Larkspur Music Hall first; Qloo had no fan data for the hall, so Fort Street Ballroom took its place, and both tiers filled.";
const PLAN: Turn[] = [
  ...OPENING,
  [
    why("mid", LANTERN, "The Lantern Room books touring indie acts."),
    why("opener", LANTERN, "The Lantern Room books touring indie acts."),
    why("mid", HALL, "Larkspur Music Hall is the town's other club."),
    why("opener", HALL, "Larkspur Music Hall is the town's other club."),
  ],
  [
    why(
      "mid",
      FORT,
      `Qloo had no fan data for ${HALL_NAME}, so I read Fort Street Ballroom in its place.`,
    ),
    why(
      "opener",
      FORT,
      `Qloo had no fan data for ${HALL_NAME}, so I read Fort Street Ballroom in its place.`,
    ),
  ],
  [
    {
      name: "finish",
      input: {
        anchor_venue_ids: [LANTERN, FORT],
        summary: PLAN_SUMMARY,
        stopped_because: "every_band_full",
      },
    },
  ],
];

async function savedRun() {
  const cache = createMemoryCache();
  const store = createBuildStore(cache);
  const qloo = createQlooClient({
    apiKey: "k",
    cache,
    fetch: fakeFetch(syntheticQloo).fetch,
  });
  const events = await readEvents(
    handleUndercardBuild({
      festival: LARKSPUR_FESTIVAL,
      limiter: createMemoryLimiter(),
      ip: "203.0.113.7",
      store,
      fresh: true,
      qloo: () => qloo,
      model: () => scriptedModel(PLAN).model,
    }),
  );
  const saved = await store.latest(LARKSPUR_FESTIVAL.id);
  return { events, saved: saved!, store };
}

describe("the planner writes a line for every choice (WS13.7)", () => {
  it("gives each venue read its own line, which the planner must write", async () => {
    const tool = AGENT_TOOLS.find((entry) => entry.name === "venue_artists")!;
    const schema = tool.input_schema as { required: string[] };
    expect(schema.required).toContain("why");
    const { toolbox, calls } = await opened();
    await toolbox.run("venue_artists", {
      band: "mid",
      venue_id: LANTERN,
      why: "The Lantern Room books touring indie acts.",
    });
    expect(calls().at(-1)!.why).toBe(
      "The Lantern Room books touring indie acts.",
    );
  });

  it("asks for why this venue, why skip and why stop in the prompt", () => {
    expect(SYSTEM_PROMPT).toMatch(/why/);
    expect(SYSTEM_PROMPT).toMatch(/no fan data[^.]*say so/i);
    expect(SYSTEM_PROMPT).toMatch(/why you stopped/);
  });

  it("keeps each read's line with its call, and the reason it stopped as a planner line, in a saved build", async () => {
    const { saved } = await savedRun();
    const reads = saved.trace.filter((call) => call.tool === "venue_artists");
    expect(reads.every((call) => call.why && call.why.length > 0)).toBe(true);
    expect(reads.at(-1)!.why).toMatch(/no fan data for Larkspur Music Hall/);
    expect(saved.notes?.map((note) => note.text)).toContain(PLAN_SUMMARY);
    expect(saved.plan).toBe(PLAN_SUMMARY);
  });
});

const call = (extra: Partial<TraceCall> = {}): TraceCall => ({
  n: 8,
  tool: "venue_artists",
  endpoint: "/v2/insights",
  summary: "Mid-band artists for the headliners and The Lantern Room",
  params: [],
  resultCount: 50,
  ms: 900,
  cached: false,
  ...extra,
});

describe("where the lines show (WS13.7)", () => {
  it("puts a read's line on its row of the Qloo calls list", () => {
    render(
      <ol>
        <CallRow
          call={call({ why: "The Lantern Room books touring indie acts." })}
          highlighted={false}
        />
      </ol>,
    );
    expect(
      screen.getByText("The Lantern Room books touring indie acts."),
    ).toBeTruthy();
  });

  it("gives Watch the read's own line, and the fallback only to an old run with no line", () => {
    expect(
      agentLineFor({ call: call({ why: "Its own line." }), note: "A note." }),
    ).toBe("Its own line.");
    expect(agentLineFor({ call: call(), note: "A note." })).toBe("A note.");
    expect(agentLineFor({ call: call(), note: null })).toBeNull();
    // A 2.0 read always carries its line, so Watch never needs the fallback there.
    expect(AGENT_DECIDES).toMatch(/chose which venues/);
  });

  it("says why these venues in the town's note, from the agent's own line", async () => {
    const { saved, store } = await savedRun();
    const bill = await readFirstBill(store, LARKSPUR_FESTIVAL.id);
    expect(bill?.plan).toBe(saved.plan);
    const legend = legendLine({
      city: "Larkspur",
      placesListed: 4,
      tested: 3,
      lifting: 2,
      plan: bill?.plan,
    });
    expect(legend.text).toContain(`The agent's plan: ${PLAN_SUMMARY}`);
  });

  it("uses a 1.0 build's line naming its anchors, and stays as it is without one", async () => {
    const store = createBuildStore(createMemoryCache());
    const old: SavedBuild = {
      id: "one-point-oh",
      festivalId: LARKSPUR_FESTIVAL.id,
      createdAt: "2026-10-17T12:13:00.000Z",
      trace: [call()],
      lineup: { festivalId: LARKSPUR_FESTIVAL.id, acts: [] },
      context: {
        headliners: [],
        comparedTags: [],
        baselines: {},
        anchors: {},
      },
      notes: [
        { at: 0, text: "Search both headliners." },
        { at: 5, text: "Anchors: The Lantern Room for both tiers." },
      ],
    };
    await store.save(old);
    expect((await readFirstBill(store, LARKSPUR_FESTIVAL.id))?.plan).toBe(
      "Anchors: The Lantern Room for both tiers.",
    );
    const plain = legendLine({
      city: "Larkspur",
      placesListed: 4,
      tested: 1,
      lifting: 1,
    });
    expect(plain.text).not.toMatch(/plan/);
  });

  it("shows nothing for a call with no line", () => {
    render(
      <ol>
        <CallRow call={call()} highlighted={false} />
      </ol>,
    );
    const row = screen.getByRole("listitem");
    expect(within(row).queryByText(/^Agent:/)).toBeNull();
  });
});
