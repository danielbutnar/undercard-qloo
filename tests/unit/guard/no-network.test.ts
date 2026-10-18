// No unit test may call Qloo, the model or any other host: tests/unit/setup.ts turns every
// unmocked fetch and socket into an error. A test that needs a response stubs fetch itself.
import net from "node:net";
import { describe, expect, it, vi } from "vitest";

describe("unit tests stay off the network", () => {
  it("refuses an unmocked fetch, to Qloo, Anthropic or anywhere", async () => {
    for (const url of [
      "https://hackathon.api.qloo.com/search?query=Khruangbin",
      "https://api.anthropic.com/v1/messages",
      "https://example.org/",
    ])
      await expect(fetch(url)).rejects.toThrow(/no network in unit tests/);
  });

  it("refuses a raw socket", () => {
    expect(() => net.connect(443, "api.anthropic.com")).toThrow(
      /no network in unit tests/,
    );
  });

  it("still lets a test stub fetch, and puts the guard back after", async () => {
    vi.stubGlobal("fetch", async () => new Response("ok"));
    expect(await (await fetch("https://hackathon.api.qloo.com/")).text()).toBe(
      "ok",
    );
    vi.unstubAllGlobals();
    await expect(fetch("https://hackathon.api.qloo.com/")).rejects.toThrow(
      /no network in unit tests/,
    );
  });
});
