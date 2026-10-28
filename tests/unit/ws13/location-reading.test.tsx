// @vitest-environment jsdom
// WS13 item 4: more of Qloo. The crowd's age is already a signal (nothing to add); Qloo's location
// signal becomes a second reading on the card where Qloo answers it, never the booking basis; no
// "rising" mark, as Qloo offers no per-act trend data. Invented data only.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { locationLine } from "@/lib/agent-words";
import { ActSchema, type Act } from "@/lib/lineup";
import { ActCard } from "@/components/act-card";
import { QLOO_CALL_CAP } from "@/server/agent-tools";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { fakeFetch, params, syntheticQloo } from "../m2/fake-qloo";
import {
  FORT,
  HALL,
  LANTERN,
  LARKSPUR_FESTIVAL,
  OPENING,
  read,
  runAgent,
  scriptedModel,
  type Turn,
} from "./agent-kit";

afterEach(cleanup);

const TOWN = `${LARKSPUR_FESTIVAL.city}, ${LARKSPUR_FESTIVAL.region}`;
const finished: Turn = [
  {
    name: "finish",
    input: {
      anchor_venue_ids: [LANTERN],
      summary: "One room filled both tiers.",
      stopped_because: "every_band_full",
    },
  },
];
const PLAN: Turn[] = [
  ...OPENING,
  [read("mid", LANTERN), read("opener", LANTERN)],
  finished,
];

describe("the crowd's age (WS13.4)", () => {
  it("is already a signal on every artist ranking the agent reads: nothing to add", async () => {
    const { requests } = await runAgent(scriptedModel(PLAN).model);
    const rankings = requests.filter(
      ({ url }) => params(url)["filter.type"] === "urn:entity:artist",
    );
    expect(rankings.length).toBeGreaterThan(0);
    for (const { url } of rankings)
      expect(params(url)["signal.demographics.age"]).toBe("25_to_29,30_to_34");
  });
});

describe("Qloo's location signal, a second reading (WS13.4)", () => {
  it("asks Qloo for the lineup's acts among themselves, with the town as the location signal", async () => {
    const fake = fakeFetch(syntheticQloo);
    const qloo = createQlooClient({
      apiKey: "k",
      cache: createMemoryCache(),
      fetch: fake.fetch,
    });
    await qloo.rankAmong({
      signalEntityIds: ["h1", "h2"],
      amongIds: ["a", "b"],
      ages: ["25_to_29"],
      locationQuery: TOWN,
    });
    expect(params(fake.requests[0].url)).toEqual({
      "filter.type": "urn:entity:artist",
      "signal.interests.entities": "h1,h2",
      "signal.location.query": TOWN,
      "filter.results.entities": "a,b",
      "signal.demographics.age": "25_to_29",
      take: "2",
    });
  });

  it("reads each tier's lineup acts twice, alone and with the town, and records it only where Qloo answered both", async () => {
    const { result, calls } = await runAgent(scriptedModel(PLAN).model);
    const located = calls.filter((call) => call.tool === "location_signal");
    expect(located).toHaveLength(4);
    expect(
      located.filter((call) =>
        call.params.some(
          (param) =>
            param.key === "signal.location.query" && param.value === TOWN,
        ),
      ),
    ).toHaveLength(2);
    const acts = result.lineup!.acts;
    const read = acts.filter((act) => act.location);
    // The invented Qloo answers every other act with the location signal.
    expect(read.length).toBeGreaterThan(0);
    expect(read.length).toBeLessThan(acts.length);
    for (const act of read) {
      expect(ActSchema.parse(act).location).toMatchObject({ town: TOWN });
      expect(act.location!.withSignal).not.toBe(act.location!.without);
    }
  });

  it("never changes which acts are booked", async () => {
    const { result } = await runAgent(scriptedModel(PLAN).model);
    const noLocation = await runAgent(
      scriptedModel(PLAN).model,
      LARKSPUR_FESTIVAL,
      (url) =>
        url.searchParams.has("signal.location.query")
          ? { success: true, results: { entities: [] } }
          : syntheticQloo(url),
    );
    expect(noLocation.result.lineup!.acts.map((act) => act.entityId)).toEqual(
      result.lineup!.acts.map((act) => act.entityId),
    );
    expect(noLocation.result.lineup!.acts.some((act) => act.location)).toBe(
      false,
    );
  });

  it("fits inside the cap: two calls a tier while they last, none past it", async () => {
    // The opening's 7 calls, then searches, then the room that fills both tiers.
    const spending = (searches: number): Turn[] => [
      ...OPENING,
      Array.from({ length: searches }, (_, i) => ({
        name: "search_artist",
        input: { name: `Spent ${searches}-${i}` },
      })),
      [read("mid", LANTERN), read("opener", LANTERN)],
      finished,
    ];
    const located = (calls: { tool: string }[]) =>
      calls.filter((call) => call.tool === "location_signal").length;
    // The opening's 7, the searches, then 7 for the room: its two reads, the control town's
    // venues, and its matched controls (Aarhus Club, without fan data, then Aarhus Hall) for
    // both tiers (WS13.3). 26 used: the mid-size tier's two calls fit, the opening tier's don't.
    const two = await runAgent(scriptedModel(spending(12)).model);
    expect(located(two.calls)).toBe(2);
    expect(two.calls).toHaveLength(QLOO_CALL_CAP);
    // 27 used: neither tier's pair fits.
    const none = await runAgent(scriptedModel(spending(13)).model);
    expect(located(none.calls)).toBe(0);
    expect(none.calls).toHaveLength(QLOO_CALL_CAP - 1);
  });

  it("is said on the card in one line, and only where Qloo answered", () => {
    const base: Act = {
      entityId: "act-1",
      name: "Juniper Static",
      band: "mid",
      affinity: 0.9,
      popularity: 0.85,
      anchorVenue: { entityId: LANTERN, name: "The Lantern Room" },
      reason: "The Lantern Room fans move it up 12 places.",
      sharedTags: [
        { id: "urn:tag:genre:music:dream_pop", name: "Dream Pop" },
        { id: "urn:tag:genre:music:indie_rock", name: "Indie Rock" },
      ],
    };
    const location = { town: TOWN, withSignal: 0.861, without: 0.812 };
    expect(locationLine(location)).toBe(
      `Second reading, outside the rule: with Qloo's location signal for ${TOWN}, affinity 0.86 (0.81 without).`,
    );
    render(<ActCard act={{ ...base, location }} />);
    expect(screen.getByText(locationLine(location))).toBeTruthy();
    cleanup();
    render(<ActCard act={base} />);
    expect(screen.queryByText(/location signal/)).toBeNull();
  });

  it("reads venues as before: the venue reads never carry the location signal", async () => {
    const { requests } = await runAgent(scriptedModel(PLAN).model);
    const venueReads = requests.filter(({ url }) => {
      const signal = params(url)["signal.interests.entities"] ?? "";
      return [LANTERN, FORT, HALL].some((venue) => signal.includes(venue));
    });
    expect(venueReads.length).toBeGreaterThan(0);
    for (const { url } of venueReads)
      expect(params(url)["signal.location.query"]).toBeUndefined();
  });
});
