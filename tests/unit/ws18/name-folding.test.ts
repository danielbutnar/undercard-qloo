// WS18 (Daniel, 29 October, 11:40 and 12:00): every name comparison folds both sides with the
// app's full fold (foldAccents, then section 18's normalise), so a name typed in plain ASCII
// finds Qloo's spelling with ø, ı, ł, ß or æ, and the other way round. The headliner search gets
// the folded retry WS13.6 asked for and the same match rule. Section 18's normalise stays the
// evidence's rule. Invented names and synthetic Qloo answers only.
import { describe, expect, it } from "vitest";
import {
  withoutFromStore,
  type PinnedBuilds,
} from "../../../scripts/evidence-check";
import type { BuildEvent, TraceCall } from "@/lib/build-events";
import type { Festival } from "@/lib/festival";
import { foundOnQloo, normalise, sameName } from "@/lib/pick-tests";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { distinctNames } from "@/lib/shortlist";
import { diagnoseRun, YourBriefSchema } from "@/lib/your-festival";
import { createToolbox } from "@/server/agent-tools";
import { createBuildStore } from "@/server/build-store";
import { handleLlmOnly } from "@/server/llm-only";
import { pickChecks } from "@/server/pick-checks";
import { createQlooClient, type QlooClient } from "@/server/qloo";
import { resolveNames } from "@/server/shortlist";
import {
  createMemoryCache,
  createQlooCache,
  SYNTHETIC_ENV,
} from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { syntheticPickQloo } from "../../e2e/synthetic-build";
import {
  fakeFetch,
  params,
  searchEntity,
  syntheticQloo,
} from "../m2/fake-qloo";

const artist = (name: string, popularity = 0.7) => ({
  entityId: `id-${name}`,
  name,
  popularity,
  affinity: null,
  tags: [],
});

describe("a name against Qloo's spelling, both folded (WS18)", () => {
  const results = [
    artist("Fjørd Lights"),
    artist("Kırmızı Kuş"),
    artist("Łąka Wiatru"),
    artist("Straßenglück"),
    artist("SKÆR"),
  ];

  it("finds a spelling with ø, ı, ł, ß or æ from the name typed in plain ASCII", () => {
    expect(foundOnQloo("Fjord Lights", results)?.name).toBe("Fjørd Lights");
    expect(foundOnQloo("Kirmizi Kus", results)?.name).toBe("Kırmızı Kuş");
    expect(foundOnQloo("Laka Wiatru", results)?.name).toBe("Łąka Wiatru");
    expect(foundOnQloo("Strassengluck", results)?.name).toBe("Straßenglück");
    expect(foundOnQloo("Skaer", results)?.name).toBe("SKÆR");
  });

  it("finds a plain-ASCII spelling from the name typed with the letter, in the same search", () => {
    const plain = [artist("Kirmizi Kuş"), artist("Fjord Lights")];
    expect(foundOnQloo("Kırmızı Kuş", plain)?.name).toBe("Kirmizi Kuş");
    expect(foundOnQloo("Fjørd Lights", plain)?.name).toBe("Fjord Lights");
  });

  it("finds a spelling whose other accent folds the same way", () => {
    expect(foundOnQloo("Fjörd Lights", results)?.name).toBe("Fjørd Lights");
  });

  it("still finds nothing for a near miss, or past the top five", () => {
    expect(foundOnQloo("Fjord Light", results)).toBeNull();
    expect(
      foundOnQloo("Sixth Act", [...results, artist("Sixth Act")]),
    ).toBeNull();
  });

  it("keeps section 18's rule where the evidence asks for it", () => {
    expect(
      foundOnQloo("Kirmizi Kus", results, undefined, normalise),
    ).toBeNull();
    expect(
      foundOnQloo("Kırmızı Kuş", [artist("Kirmizi Kuş")], undefined, normalise),
    ).toBeNull();
    expect(
      foundOnQloo("Café Lumen", [artist("Cafe Lumen")], undefined, normalise)
        ?.name,
    ).toBe("Cafe Lumen");
  });

  it("calls two names one act's when they fold the same", () => {
    expect(sameName("Fjørd Lights", "fjord lights")).toBe(true);
    expect(sameName("Straßenglück", "Strassengluck")).toBe(true);
    expect(sameName("Fjørd Lights", "Fjord Lightning")).toBe(false);
    // A name with no letter or digit is compared as typed, not as an empty fold.
    expect(sameName("!!!", "???")).toBe(false);
    expect(sameName("!!!", " !!! ")).toBe(true);
  });
});

describe("the headliner search (search_artist), with the same rule", () => {
  /** A toolbox for a festival with these headliners, over a synthetic Qloo with these searches. */
  function setup(
    headliners: [string, string],
    searches: Record<string, unknown[]>,
  ) {
    const fake = fakeFetch((url) =>
      url.pathname === "/search" && params(url).query in searches
        ? { results: searches[params(url).query] }
        : syntheticQloo(url),
    );
    const events: BuildEvent[] = [];
    const festival: Festival = { ...SAGEBRUSH_SOUND, headliners };
    const toolbox = createToolbox({
      festival,
      qloo: createQlooClient({
        apiKey: "test-key",
        cache: createMemoryCache(),
        fetch: fake.fetch,
      }),
      emit: (event) => events.push(event),
    });
    const queries = () =>
      fake.requests
        .filter(({ url }) => url.pathname === "/search")
        .map(({ url }) => params(url).query);
    const searchLines = () =>
      events.flatMap((event) =>
        event.type === "call" && event.call.tool === "search_artist"
          ? [event.call]
          : [],
      );
    const booked = async (name: string) =>
      JSON.parse((await toolbox.run("search_artist", { name })).content)
        .booked_headliner as string | null;
    return { toolbox, queries, searchLines, booked };
  }

  it("books Qloo's spelling with the letter for a name typed in plain ASCII, not Qloo's first result", async () => {
    const { booked, queries } = setup(["Fjord Lights", "Khruangbin"], {
      "Fjord Lights": [
        searchEntity(11, "Fjord Lightning", 0.9),
        searchEntity(12, "Fjørd Lights", 0.95),
      ],
    });
    expect(await booked("Fjord Lights")).toBe("Fjørd Lights");
    expect(queries()).toEqual(["Fjord Lights"]);
  });

  it("searches once more with the accents folded when the name's own search matches nothing", async () => {
    const { booked, queries, searchLines, toolbox } = setup(
      ["Kırmızı Kuş", "Khruangbin"],
      {
        "Kırmızı Kuş": [],
        "Kirmizi Kus": [searchEntity(13, "Kirmizi Kuş", 0.9)],
      },
    );
    expect(await booked("Kırmızı Kuş")).toBe("Kirmizi Kuş");
    expect(queries()).toEqual(["Kırmızı Kuş", "Kirmizi Kus"]);
    // The second search is a call of its own, on its own line.
    expect(searchLines().map((call) => [call.n, call.resultCount])).toEqual([
      [1, 0],
      [2, 1],
    ]);
    await booked("Khruangbin");
    expect(toolbox.state.headliners.size).toBe(2);
  });

  it("doesn't search again for a name the fold leaves as it is", async () => {
    const { booked, queries } = setup(["Nobody Atall", "Khruangbin"], {
      "Nobody Atall": [],
    });
    expect(await booked("Nobody Atall")).toBeNull();
    expect(queries()).toEqual(["Nobody Atall"]);
  });

  it("books the buyer's headliner when the planner writes its name with other accents", async () => {
    const { booked, toolbox } = setup(["Fjørd Lights", "Khruangbin"], {
      "Fjord Lights": [searchEntity(12, "Fjørd Lights", 0.95)],
    });
    expect(await booked("Fjord Lights")).toBe("Fjørd Lights");
    expect(toolbox.state.headliners.get("fjørd lights")?.name).toBe(
      "Fjørd Lights",
    );
  });

  it("still takes Qloo's first result for a name nothing matches, as before", async () => {
    const { booked } = setup(["Khruangbn", "Khruangbin"], {
      Khruangbn: [searchEntity(1, "Khruangbin", 0.99)],
    });
    expect(await booked("Khruangbn")).toBe("Khruangbin");
  });
});

describe("a headliner not found, read from the run's stream", () => {
  const call = (n: number, resultCount: number, query: string): TraceCall => ({
    n,
    tool: "search_artist",
    endpoint: "/search",
    summary: `Search for "${query}"`,
    params: [{ key: "query", value: query }],
    resultCount,
    ms: 10,
    cached: false,
  });
  const venues: TraceCall = {
    n: 4,
    tool: "find_venues",
    endpoint: "/v2/insights",
    summary: "find_venues",
    params: [],
    resultCount: 1,
    ms: 10,
    cached: false,
  };
  const stream = (...calls: TraceCall[]): BuildEvent[] =>
    calls.map((c) => ({ type: "call", call: c }));

  it("isn't a headliner the folded search found", () => {
    const events = stream(
      call(1, 0, "Kırmızı Kuş"),
      call(2, 1, "Kirmizi Kus"),
      call(3, 1, "Khruangbin"),
      venues,
    );
    expect(diagnoseRun(events, false, "Duluth")?.code).toBe("too-few-rooms");
  });

  it("is one neither search found, named as the buyer typed it", () => {
    const events = stream(call(1, 0, "Kırmızı Kuş"), call(2, 0, "Kirmizi Kus"));
    expect(diagnoseRun(events, false, "Duluth")).toEqual({
      code: "headliner-not-found",
      message:
        "Qloo found no artist called “Kırmızı Kuş”. Check the spelling, or try another headliner.",
    });
  });
});

describe("the other places the app compares act names", () => {
  it("the pitch check keeps section 18's rule until Daniel's yes: folding it moves Boise's example", async () => {
    expect(
      distinctNames(["Fjørd Lights", "Fjord Lights", "fjord lights"]),
    ).toEqual({
      names: ["Fjørd Lights", "Fjord Lights"],
      repeats: [{ name: "fjord lights", sameAs: "Fjord Lights" }],
    });
    const qloo = {
      search: async () => ({
        data: [artist("Fjørd Lights")],
        call: {
          path: "/search",
          params: [],
          resultCount: 1,
          ms: 1,
          cached: true,
        },
      }),
    } as unknown as QlooClient;
    const { acts } = await resolveNames({
      names: ["Fjord Lights"],
      budget: {
        run: async (jobs) => Promise.all(jobs.map((job) => job(qloo))),
      } as Parameters<typeof resolveNames>[0]["budget"],
      headlinerIds: new Set(),
    });
    expect(acts[0].status).toBe("not-found");
  });

  it("Your festival takes two different headliners, not one act in two spellings", () => {
    const ok = (a: string, b: string) =>
      YourBriefSchema.safeParse({
        city: "Boise",
        region: "Idaho",
        headliners: [a, b],
      }).success;
    expect(ok("Fjørd Lights", "Fjord Lights")).toBe(false);
    expect(ok("Fjørd Lights", "Kırmızı Kuş")).toBe(true);
  });

  it("the model's picks leave out a headliner it spelled another way", async () => {
    const festival: Festival = {
      ...SAGEBRUSH_SOUND,
      id: "ws18-fold",
      headliners: ["Fjørd Lights", "Khruangbin"],
    };
    const response = await handleLlmOnly({
      festival,
      model: () => ({
        suggest: async () => [
          { name: "Fjord Lights", note: "An invented reason." },
          { name: "Moth Radio", note: "An invented reason." },
        ],
      }),
      cache: createMemoryCache(),
      limiter: createMemoryLimiter(),
      ip: "ws18",
    });
    const { lineup } = (await response.json()) as {
      lineup: { picks: { name: string }[] };
    };
    expect(lineup.picks.map((pick) => pick.name)).toEqual(["Moth Radio"]);
  });
});

describe("the evidence keeps section 18's rule; the site's checks take the fold", () => {
  it("counts a pick Qloo spells with a kept letter as section 31 counted it, while its card finds it", async () => {
    // The synthetic store: Boise's build, its model answer and its picks' searches.
    const cache = createQlooCache({ [SYNTHETIC_ENV]: "1" });
    const key = "undercard:llm-only:v2:sagebrush-sound";
    const answer = (await cache.get<{
      festivalId: string;
      createdAt: string;
      picks: { name: string; note: string }[];
    }>(key))!;
    // One pick typed in plain ASCII, which Qloo spells with a letter section 18 keeps whole: its
    // search answers the act the synthetic "Velvet Coyote" finds, as "Velvet Køyote".
    const renamed = {
      ...answer,
      picks: answer.picks.map((pick) =>
        pick.name === "Velvet Coyote"
          ? { ...pick, name: "Velvet Koyote" }
          : pick,
      ),
    };
    await cache.set(key, renamed, 3600);
    const plain = syntheticPickQloo(
      new URL(
        `https://synthetic.test/search?query=${encodeURIComponent("Velvet Coyote")}`,
      ),
    ) as { results: { name: string }[] };
    const seeding = createQlooClient({
      apiKey: "synthetic",
      cache,
      fetch: fakeFetch(() => ({
        results: plain.results.map((raw) => ({
          ...raw,
          name: "Velvet Køyote",
        })),
      })).fetch,
    });
    await seeding.search({ query: "Velvet Koyote" });

    const build = (await createBuildStore(cache).latest(SAGEBRUSH_SOUND.id))!;
    const pinned: PinnedBuilds = {
      source: "the store's own build",
      ids: new Map([[SAGEBRUSH_SOUND.id, build.id]]),
    };
    const without = await withoutFromStore(cache, pinned);
    // Section 31's rule: the renamed pick is one fewer found than the synthetic answer's 8.
    expect(without.towns[0].counts.found).toBe(7);
    const checks = await pickChecks({
      answer: renamed,
      build,
      festival: SAGEBRUSH_SOUND,
      cache,
    });
    expect(checks.find((check) => check.name === "Velvet Koyote")?.status).toBe(
      "found",
    );
  });
});
