// @vitest-environment jsdom
// WS13 item 5: a local pick. The planner names one or two acts from the town from its own
// knowledge; each must be found on Qloo by search and shows Qloo's numbers. Its own box, labelled
// as the model's local pick for the buyer to check, with "Add to the bill"; it never takes a slot
// on its own. Invented data only.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { localPickNumbers } from "@/lib/agent-words";
import { buildReducer, IDLE_BUILD, type BuildState } from "@/lib/build-state";
import { lineupCsv } from "@/lib/csv";
import { LocalPickSchema, type LocalPick } from "@/lib/local-pick";
import { LocalPickBox } from "@/components/local-pick-box";
import { AGENT_TOOLS } from "@/server/agent-tools";
import { SYSTEM_PROMPT } from "@/server/agent";
import { createBuildStore } from "@/server/build-store";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleUndercardBuild } from "@/server/undercard-build";
import {
  fakeFetch,
  HEADLINER_TAGS,
  params,
  searchEntity,
  syntheticQloo,
} from "../m2/fake-qloo";
import { readEvents } from "../m3/scripted";
import {
  LANTERN,
  LARKSPUR_FESTIVAL,
  opened,
  OPENING,
  read,
  resultOf,
  runAgent,
  scriptedModel,
  type Turn,
} from "./agent-kit";

afterEach(cleanup);

// Two invented Larkspur acts Qloo knows, one it doesn't.
const LOCALS: Record<string, unknown[]> = {
  "Larkspur Lanterns": [
    searchEntity(801, "Larkspur Lanterns", 0.62, HEADLINER_TAGS.slice(0, 2)),
  ],
  "The Gravel Saints": [
    searchEntity(802, "Gravel Saints", 0.95, HEADLINER_TAGS.slice(3, 4)),
  ],
};
const withLocals = (url: URL) =>
  url.pathname === "/search" && params(url).query in LOCALS
    ? { results: LOCALS[params(url).query] }
    : syntheticQloo(url);

const pickTurn: Turn = [
  {
    name: "local_pick",
    input: {
      picks: [
        { name: "Larkspur Lanterns", why: "A dream-pop four-piece from town." },
        { name: "Nobody From Here", why: "Plays the town's bars." },
      ],
    },
  },
];
const PLAN: Turn[] = [
  ...OPENING,
  [read("mid", LANTERN), read("opener", LANTERN)],
  pickTurn,
  [
    {
      name: "finish",
      input: {
        anchor_venue_ids: [LANTERN],
        summary: "One room filled both tiers; one local pick to check.",
        stopped_because: "every_band_full",
      },
    },
  ],
];

describe("the local_pick tool (WS13.5)", () => {
  it("is offered to the planner, which the prompt asks for one or two acts from the town", () => {
    expect(AGENT_TOOLS.map((tool) => tool.name)).toContain("local_pick");
    expect(SYSTEM_PROMPT).toMatch(/local_pick/);
    expect(SYSTEM_PROMPT).toMatch(/one or two acts from the town/);
  });

  it("searches each name on Qloo and returns Qloo's numbers for the ones it finds", async () => {
    const { toolbox, calls } = await opened(LARKSPUR_FESTIVAL, withLocals);
    const before = toolbox.callsUsed();
    const result = resultOf(
      await toolbox.run("local_pick", {
        picks: [
          { name: "Larkspur Lanterns", why: "From town." },
          { name: "Nobody From Here", why: "Also from town." },
        ],
      }),
    );
    expect(toolbox.callsUsed()).toBe(before + 2);
    expect(
      calls()
        .slice(-2)
        .map((call) => call.tool),
    ).toEqual(["local_pick", "local_pick"]);
    expect(result.picks).toEqual([
      {
        name: "Larkspur Lanterns",
        found: true,
        popularity: 0.62,
        tier: "opener",
      },
      { name: "Nobody From Here", found: false },
    ]);
    expect(toolbox.state.localPicks.map((pick) => pick.name)).toEqual([
      "Larkspur Lanterns",
    ]);
  });

  it("names one or two acts, never more", async () => {
    const { toolbox } = await opened(LARKSPUR_FESTIVAL, withLocals);
    const outcome = await toolbox.run("local_pick", {
      picks: ["a", "b", "c"].map((name) => ({ name, why: "x" })),
    });
    expect(outcome.isError).toBe(true);
  });

  it("keeps a pick's Qloo numbers: popularity, the tier it falls in or where it sits, and genres shared", async () => {
    const { toolbox } = await opened(LARKSPUR_FESTIVAL, withLocals);
    await toolbox.run("local_pick", {
      picks: [
        { name: "Larkspur Lanterns", why: "From town." },
        { name: "The Gravel Saints", why: "Loud." },
      ],
    });
    const [lanterns, saints] = toolbox.state.localPicks;
    expect(LocalPickSchema.parse(lanterns)).toMatchObject({
      entityId: "00000000-0000-4000-8000-000000000801",
      name: "Larkspur Lanterns",
      asked: "Larkspur Lanterns",
      why: "From town.",
      popularity: 0.62,
      band: "opener",
      range: "in",
    });
    expect(lanterns.sharedTags.map((tag) => tag.name)).toEqual([
      "Dream Pop",
      "Indie Rock",
    ]);
    expect(saints).toMatchObject({
      name: "Gravel Saints",
      asked: "The Gravel Saints",
      band: null,
      range: "above",
    });
  });
});

describe("a run's local pick (WS13.5)", () => {
  it("streams with the lineup and never takes a slot", async () => {
    const { result, events } = await runAgent(
      scriptedModel(PLAN).model,
      LARKSPUR_FESTIVAL,
      withLocals,
    );
    const local = events.find((event) => event.type === "local-pick");
    expect(
      local?.type === "local-pick" && local.picks.map((p) => p.name),
    ).toEqual(["Larkspur Lanterns"]);
    expect(
      result.lineup!.acts.some((act) => act.name === "Larkspur Lanterns"),
    ).toBe(false);
    expect(result.lineup!.acts).toHaveLength(10);
  });

  it("is saved with the build, and its replay brings it back", async () => {
    const cache = createMemoryCache();
    const store = createBuildStore(cache);
    const qloo = createQlooClient({
      apiKey: "k",
      cache,
      fetch: fakeFetch(withLocals).fetch,
    });
    const run = (fresh: boolean) =>
      readEvents(
        handleUndercardBuild({
          festival: LARKSPUR_FESTIVAL,
          limiter: createMemoryLimiter(),
          ip: "203.0.113.7",
          store,
          fresh,
          replayDelayMs: 0,
          qloo: () => qloo,
          model: () => scriptedModel(PLAN).model,
          cachedQloo: () => qloo,
        }),
      );
    await run(true);
    const saved = await store.latest(LARKSPUR_FESTIVAL.id);
    expect(saved?.localPicks?.map((pick) => pick.name)).toEqual([
      "Larkspur Lanterns",
    ]);
    const replay = await run(false);
    const state = replay.reduce<BuildState>(
      (board, event) => buildReducer(board, { type: "event", event }),
      { ...IDLE_BUILD, status: "building" },
    );
    expect(state.localPicks.map((pick) => pick.name)).toEqual([
      "Larkspur Lanterns",
    ]);
  });
});

const PICK: LocalPick = {
  entityId: "local-1",
  name: "Larkspur Lanterns",
  asked: "Larkspur Lanterns",
  why: "A dream-pop four-piece from town.",
  popularity: 0.62,
  band: "opener",
  range: "in",
  sharedTags: [
    { id: "urn:tag:genre:music:dream_pop", name: "Dream Pop" },
    { id: "urn:tag:genre:music:indie_rock", name: "Indie Rock" },
  ],
};

describe("the local pick's box (WS13.5)", () => {
  it("is labelled as the AI's local pick for the buyer to check, with Qloo's numbers and the AI's reason", () => {
    render(
      <LocalPickBox
        picks={[PICK]}
        festival={LARKSPUR_FESTIVAL}
        added={[]}
        onToggle={() => {}}
      />,
    );
    const box = screen.getByRole("region", { name: "The AI's local pick" });
    expect(within(box).getByText(/for you to check/)).toBeTruthy();
    expect(within(box).getByText(/takes no slot/)).toBeTruthy();
    expect(
      within(box).getByText(localPickNumbers(PICK, LARKSPUR_FESTIVAL.feeBands)),
    ).toBeTruthy();
    expect(localPickNumbers(PICK, LARKSPUR_FESTIVAL.feeBands)).toBe(
      "Popularity 62 on Qloo, inside the opening range (55–80) · shares Dream Pop and Indie Rock with the headliners",
    );
    expect(
      within(box).getByText(/A dream-pop four-piece from town\./),
    ).toBeTruthy();
  });

  it("adds the pick to the bill only when the buyer says so", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <LocalPickBox
        picks={[PICK]}
        festival={LARKSPUR_FESTIVAL}
        added={[]}
        onToggle={onToggle}
      />,
    );
    const add = screen.getByRole("button", { name: "Add to the bill" });
    expect(add.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(add);
    expect(onToggle).toHaveBeenCalledWith(PICK.entityId);
    rerender(
      <LocalPickBox
        picks={[PICK]}
        festival={LARKSPUR_FESTIVAL}
        added={[PICK.entityId]}
        onToggle={onToggle}
      />,
    );
    expect(
      screen
        .getByRole("button", { name: "Add to the bill" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByText(/On your bill/)).toBeTruthy();
  });

  it("goes on the bill's export once added, marked as the buyer's own addition", () => {
    let state: BuildState = {
      ...IDLE_BUILD,
      localPicks: [PICK],
    };
    state = buildReducer(state, {
      type: "toggleLocal",
      entityId: PICK.entityId,
    });
    expect(state.added).toEqual([PICK.entityId]);
    const csv = lineupCsv([], LARKSPUR_FESTIVAL.feeBands, {}, [PICK]);
    expect(csv).toContain(
      "Larkspur Lanterns,Opener,,0.62,,Added by you: the AI's local pick,,",
    );
    state = buildReducer(state, {
      type: "toggleLocal",
      entityId: PICK.entityId,
    });
    expect(state.added).toEqual([]);
  });
});

describe("the local pick on the festival screen (WS13.5)", () => {
  it("shows a 2.0 build's local pick for the buyer to check, and adds it to the bill on request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    const { FestivalScreen } = await import("@/components/festival-screen");
    const { SAGEBRUSH_SOUND } = await import("@/lib/sagebrush");
    const { FIRST_BILL } = await import("../m4b/first-bill-fixture");
    render(
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={{ ...FIRST_BILL, localPicks: [PICK] }}
      />,
    );
    const box = screen.getByRole("region", { name: "The AI's local pick" });
    const add = within(box).getByRole("button", { name: "Add to the bill" });
    fireEvent.click(add);
    expect(add.getAttribute("aria-pressed")).toBe("true");
    // It never took a slot: the poster's acts are the saved lineup's.
    expect(
      screen.queryByRole("button", { name: /Larkspur Lanterns/ }),
    ).toBeNull();
    vi.unstubAllGlobals();
  });

  it("isn't there for a 1.0 build, which has none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    const { FestivalScreen } = await import("@/components/festival-screen");
    const { SAGEBRUSH_SOUND } = await import("@/lib/sagebrush");
    const { FIRST_BILL } = await import("../m4b/first-bill-fixture");
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    expect(
      screen.queryByRole("region", { name: "The AI's local pick" }),
    ).toBeNull();
    vi.unstubAllGlobals();
  });
});
