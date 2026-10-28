// @vitest-environment jsdom
// WS13.8, Daniel's answers of 28 October: "Run it live" under Watch is hidden at WS12's short
// layout line, 760 px tall, and below 1100 px wide; wherever it's hidden, the live run stays
// reachable: any component under the festival screen (WS12's setlist "Play it live") starts it
// through useLiveRun(). Invented data only.
import { readFileSync } from "node:fs";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveRunProvider, useLiveRun } from "@/components/live-run";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("where Run it live is hidden (WS13.8)", () => {
  it("is hidden below 1100 px wide and at 760 px tall or less, WS12's short layout line", () => {
    // jsdom's import.meta.url isn't a file URL: read from the repository root, where vitest runs.
    const css = readFileSync("src/components/chart/first-screen.css", "utf8");
    const rule =
      /@media \(max-width: 1099px\), \(max-height: 760px\) \{\s*\.chart-app\.fs \.fs-live \{\s*display: none;/;
    expect(css).toMatch(rule);
    expect(css).not.toMatch(
      /\(max-height: 720px\) \{\s*\.chart-app\.fs \.fs-live/,
    );
  });
});

/** A stand-in for WS12's setlist button: it only knows the hook. */
function PlayItLive() {
  const { runLive, available } = useLiveRun();
  return (
    <button type="button" disabled={!available} onClick={runLive}>
      Play it live
    </button>
  );
}

describe("the live run, callable from outside Watch (WS13.8)", () => {
  it("starts through useLiveRun() from any component under its provider", () => {
    const runLive = vi.fn();
    render(
      <LiveRunProvider value={{ runLive, available: true }}>
        <PlayItLive />
      </LiveRunProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Play it live" }));
    expect(runLive).toHaveBeenCalledOnce();
  });

  it("is unavailable, and does nothing, with no festival screen around it", () => {
    render(<PlayItLive />);
    expect(
      (
        screen.getByRole("button", {
          name: "Play it live",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("is what the festival screen's own Run it live calls: a fresh build", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.startsWith("/api/venue-switch")
        ? new Response("{}", { status: 404 })
        : new Response("", {
            headers: { "content-type": "application/x-ndjson" },
          }),
    );
    vi.stubGlobal("fetch", fetch);
    const { FestivalScreen } = await import("@/components/festival-screen");
    const { SAGEBRUSH_SOUND } = await import("@/lib/sagebrush");
    const { FIRST_BILL } = await import("../m4b/first-bill-fixture");
    const { RUN_IT_LIVE } = await import("@/lib/agent-words");
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    fireEvent.click(screen.getByRole("button", { name: RUN_IT_LIVE }));
    await waitFor(
      () =>
        expect(
          fetch.mock.calls.find(([url]) => url === "/api/undercard"),
        ).toBeDefined(),
      { timeout: 10_000 },
    );
    const [, init] = fetch.mock.calls.find(
      ([url]) => url === "/api/undercard",
    )! as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ fresh: true });
  });
});
