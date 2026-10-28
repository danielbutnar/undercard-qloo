import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRunClient,
  fileRecord,
  memoryRecord,
  RunStopped,
} from "@/server/control-test-37-client";
import {
  controlFestivalFor,
  readFestivals,
  runFestival,
} from "@/server/control-test-37";
import { createMemoryCache, type QlooCache } from "@/server/qloo-cache";
import { BUILDS, TOWNS, worldFetch } from "./world";

const ranking = (input: string) => ({
  "filter.type": "urn:entity:artist",
  "signal.interests.entities": `h-1,h-2,${input}`,
  "filter.popularity.min": 0.8,
  "filter.popularity.max": 0.92,
  "filter.exclude.entities": "h-1,h-2",
  "signal.demographics.age": "25_to_29,30_to_34",
  take: 50,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function client(options: Partial<Parameters<typeof createRunClient>[0]> = {}) {
  return createRunClient({
    apiKey: "test-key",
    fetch: worldFetch().fetch,
    record: memoryRecord(),
    maxCalls: 100,
    spacingMs: 0,
    ...options,
  });
}

describe("the run's client", () => {
  it("asks Qloo's hackathon host with the key, and keeps the raw answer in its record", async () => {
    const world = worldFetch();
    const record = memoryRecord();
    const run = client({ fetch: world.fetch, record });
    const body = await run.ask("/v2/insights", ranking("v-a2"));
    expect(world.requests).toHaveLength(1);
    expect(world.requests[0].origin).toBe("https://hackathon.api.qloo.com");
    expect(world.requests[0].searchParams.get("take")).toBe("50");
    expect(record.answers()).toHaveLength(1);
    expect(record.answers()[0]).toMatchObject({
      path: "/v2/insights",
      status: 200,
      body,
    });
    expect(record.attempts()).toMatchObject([{ n: 1, status: 200 }]);
  });

  it("answers a call it has already made from its own memory, with no second request", async () => {
    const world = worldFetch();
    const run = client({ fetch: world.fetch });
    const first = await run.ask("/v2/insights", ranking("v-a2"));
    const again = await run.ask("/v2/insights", {
      ...ranking("v-a2"),
      take: "50",
    });
    expect(again).toEqual(first);
    expect(world.requests).toHaveLength(1);
    expect(run.counts()).toEqual({ attempts: 1, fetched: 1, fromMemory: 1 });
  });

  it("makes one call at a time, spaced, even when asked several at once", async () => {
    let inFlight = 0;
    let most = 0;
    const world = worldFetch();
    const fetch = (async (input: RequestInfo | URL) => {
      inFlight++;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return world.fetch(input);
    }) as typeof globalThis.fetch;
    const sleep = vi.fn(async () => {});
    const run = client({ fetch, spacingMs: 1200, sleep });
    await Promise.all(
      ["v-a1", "v-a2", "v-b2"].map((input) =>
        run.ask("/v2/insights", ranking(input)),
      ),
    );
    expect(most).toBe(1);
    expect(sleep.mock.calls).toEqual([[1200], [1200]]);
  });

  it("stops before an attempt past MAX_CALLS", async () => {
    const world = worldFetch();
    const run = client({ fetch: world.fetch, maxCalls: 2 });
    await run.ask("/v2/insights", ranking("v-a1"));
    await run.ask("/v2/insights", ranking("v-a2"));
    const third = run.ask("/v2/insights", ranking("v-b2"));
    await expect(third).rejects.toBeInstanceOf(RunStopped);
    await expect(third).rejects.toMatchObject({ reason: "max calls" });
    expect(world.requests).toHaveLength(2);
    // A call it already holds still answers.
    await run.ask("/v2/insights", ranking("v-a1"));
    expect(world.requests).toHaveLength(2);
  });

  it("stops at the first 429, with no retry, keeping the attempt and no answer for it", async () => {
    const world = worldFetch((_, n) =>
      n === 2 ? json({ error: "Too Many Requests" }, 429) : undefined,
    );
    const record = memoryRecord();
    const run = client({ fetch: world.fetch, record });
    await run.ask("/v2/insights", ranking("v-a1"));
    const second = run.ask("/v2/insights", ranking("v-a2"));
    await expect(second).rejects.toMatchObject({
      name: "RunStopped",
      reason: "rate limit",
    });
    expect(world.requests).toHaveLength(2);
    expect(record.answers()).toHaveLength(1);
    expect(record.attempts()).toMatchObject([
      { n: 1, status: 200 },
      { n: 2, status: 429, stop: "rate limit" },
    ]);
    // Stopped is stopped: nothing more goes out.
    await expect(
      run.ask("/v2/insights", ranking("v-b2")),
    ).rejects.toBeInstanceOf(RunStopped);
    expect(world.requests).toHaveLength(2);
  });

  it("stops at a quota or rate-limit answer whatever its status, and at an unsuccessful or unreadable one", async () => {
    const cases: [Response, string][] = [
      [json({ error: "Monthly quota exceeded" }, 403), "quota"],
      [json({ message: "Rate limit reached" }, 403), "rate limit"],
      [json({ error: "Server error" }, 503), "http error"],
      [json({ success: false, error: "Quota exhausted" }), "quota"],
      [json({ success: false }), "unsuccessful answer"],
      [new Response("not json", { status: 200 }), "unreadable"],
    ];
    for (const [response, reason] of cases) {
      const run = client({ fetch: worldFetch(() => response.clone()).fetch });
      await expect(
        run.ask("/v2/insights", ranking("v-a1")),
      ).rejects.toMatchObject({ reason });
    }
  });

  it("stops when Qloo gives no answer at all", async () => {
    const fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof globalThis.fetch;
    const record = memoryRecord();
    const run = client({ fetch, record });
    await expect(
      run.ask("/v2/insights", ranking("v-a1")),
    ).rejects.toMatchObject({ reason: "no answer" });
    expect(record.attempts()).toMatchObject([
      { n: 1, status: null, stop: "no answer" },
    ]);
  });

  it("resumes from its record without repeating a call", async () => {
    const record = memoryRecord();
    const first = client({ record });
    await first.ask("/v2/insights", ranking("v-a1"));
    await first.ask("/v2/insights", ranking("v-a2"));

    const world = worldFetch();
    const second = client({ fetch: world.fetch, record, resume: true });
    await second.ask("/v2/insights", ranking("v-a1"));
    await second.ask("/v2/insights", ranking("v-a2"));
    await second.ask("/v2/insights", ranking("v-b2"));
    expect(
      world.requests.map((url) =>
        url.searchParams.get("signal.interests.entities"),
      ),
    ).toEqual(["h-1,h-2,v-b2"]);
    // Attempts are numbered on from the first run's.
    expect(record.attempts().map((attempt) => attempt.n)).toEqual([1, 2, 3]);
  });

  it("without RESUME, starts from an empty memory whatever its record holds", async () => {
    const record = memoryRecord();
    await client({ record }).ask("/v2/insights", ranking("v-a1"));
    const world = worldFetch();
    await client({ fetch: world.fetch, record }).ask(
      "/v2/insights",
      ranking("v-a1"),
    );
    expect(world.requests).toHaveLength(1);
  });
});

describe("the run never touches the server's Qloo cache", () => {
  it("reads the saved builds from the store, and nothing else; writes nothing", async () => {
    const memory = createMemoryCache();
    for (const build of BUILDS) {
      await memory.set(`undercard:build:v1:id:${build.id}`, build, 3600);
      await memory.set(
        `undercard:build:v1:latest:${build.festivalId}`,
        build.id,
        3600,
      );
    }
    const get = vi.fn(async (key: string) => memory.get(key));
    const getOrThrow = vi.fn(async (key: string) => memory.get(key));
    const set = vi.fn(async () => {});
    const server: QlooCache = {
      kind: "upstash",
      get: get as QlooCache["get"],
      getOrThrow: getOrThrow as QlooCache["get"],
      set,
    };

    const festivals = await readFestivals({
      serverCache: server,
      towns: TOWNS,
      pinned: {
        festivals: BUILDS.map((build) => ({
          festivalId: build.festivalId,
          buildId: build.id,
        })),
      },
    });
    const world = worldFetch();
    const run = client({ fetch: world.fetch });
    for (const own of festivals)
      await runFestival(
        run.ask,
        own,
        controlFestivalFor(festivals, TOWNS, own),
      );

    expect(world.requests.length).toBeGreaterThan(0);
    expect(set).not.toHaveBeenCalled();
    const read = [...get.mock.calls, ...getOrThrow.mock.calls].map(
      ([key]) => key,
    );
    expect(read.length).toBeGreaterThan(0);
    expect(read.every((key) => key.startsWith("undercard:build:v1:"))).toBe(
      true,
    );
  });

  it("stops if a festival's latest build isn't the pinned one", async () => {
    const memory = createMemoryCache();
    for (const build of BUILDS) {
      await memory.set(`undercard:build:v1:id:${build.id}`, build, 3600);
      await memory.set(
        `undercard:build:v1:latest:${build.festivalId}`,
        build.id,
        3600,
      );
    }
    await expect(
      readFestivals({
        serverCache: memory,
        towns: TOWNS,
        pinned: {
          festivals: BUILDS.map((build, index) => ({
            festivalId: build.festivalId,
            buildId: index === 1 ? "another-build" : build.id,
          })),
        },
      }),
    ).rejects.toThrow(/sagebrush-sound-birch/);
  });
});

describe("fileRecord", () => {
  let dir: string | null = null;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  it("keeps answers and attempts as lines, and reads them back, past a torn last line", () => {
    dir = mkdtempSync(join(tmpdir(), "evidence-37-"));
    const out = join(dir, "evidence-37");
    const record = fileRecord(out);
    expect(record.answers()).toEqual([]);
    record.saveAnswer({
      key: "k1",
      path: "/v2/insights",
      params: { take: "50" },
      status: 200,
      at: "2026-10-28T10:00:00.000Z",
      body: { results: { entities: [] } },
    });
    record.saveAttempt({
      n: 1,
      at: "2026-10-28T10:00:00.000Z",
      key: "k1",
      status: 200,
    });
    // A run killed mid-write leaves half a line.
    writeFileSync(join(out, "answers.ndjson"), '{"key":"k2","pa', {
      flag: "a",
    });
    const again = fileRecord(out);
    expect(again.answers().map((answer) => answer.key)).toEqual(["k1"]);
    // The next answer starts on a line of its own, so it reads back.
    again.saveAnswer({
      key: "k3",
      path: "/v2/insights",
      params: {},
      status: 200,
      at: "2026-10-28T10:01:00.000Z",
      body: {},
    });
    expect(
      fileRecord(out)
        .answers()
        .map((answer) => answer.key),
    ).toEqual(["k1", "k3"]);
    expect(again.attempts()).toEqual([
      { n: 1, at: "2026-10-28T10:00:00.000Z", key: "k1", status: 200 },
    ]);
    expect(readFileSync(join(out, "attempts.ndjson"), "utf8")).toMatch(/\n$/);
  });
});
