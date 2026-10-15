import { afterEach, describe, expect, it, vi } from "vitest";
import { streamEvents } from "@/components/stream-events";
import type { BuildEvent } from "@/lib/build-events";

afterEach(() => vi.unstubAllGlobals());

const ndjson = (events: BuildEvent[], status: number) =>
  new Response(events.map((event) => JSON.stringify(event)).join("\n") + "\n", {
    status,
    headers: { "content-type": "application/x-ndjson; charset=utf-8" },
  });

describe("streamEvents", () => {
  it("passes on a rate limit's message instead of failing", async () => {
    const limited: BuildEvent[] = [
      {
        type: "error",
        message: "You've used today's 5 fresh builds from this network.",
      },
      { type: "done", calls: 0, ms: 0 },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ndjson(limited, 429)),
    );
    const received: BuildEvent[] = [];
    await streamEvents(
      "/api/undercard",
      { fresh: true },
      new AbortController().signal,
      (event) => received.push(event),
    );
    expect(received).toEqual(limited);
  });

  it("still fails on an error that isn't a build stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Bad gateway", { status: 502 })),
    );
    await expect(
      streamEvents(
        "/api/undercard",
        {},
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow("HTTP 502");
  });
});
