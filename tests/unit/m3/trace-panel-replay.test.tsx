// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TracePanel } from "@/components/trace-panel";
import { IDLE_BUILD } from "@/lib/build-state";

afterEach(cleanup);

const replayed = {
  ...IDLE_BUILD,
  status: "done" as const,
  summary: { calls: 11, ms: 1400 },
  build: { id: "build-1", createdAt: "2026-10-15T14:02:00.000Z", replayed: true },
};

describe("TracePanel with a replayed build", () => {
  it("says the board is a replay of a saved build", () => {
    render(<TracePanel state={replayed} onBuild={vi.fn()} />);
    expect(
      screen.getByText("Replayed the build saved Oct 15, 14:02 UTC: 11 Qloo calls, served from the cache."),
    ).toBeTruthy();
  });

  it("offers a fresh run of the agent", () => {
    const onBuild = vi.fn();
    render(<TracePanel state={replayed} onBuild={onBuild} />);
    fireEvent.click(screen.getByRole("button", { name: "Run the agent live instead" }));
    expect(onBuild).toHaveBeenCalledWith({ fresh: true });
  });

  it("doesn't offer a fresh run after a fresh build", () => {
    render(<TracePanel state={{ ...replayed, build: { ...replayed.build, replayed: false } }} onBuild={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Run the agent live instead" })).toBeNull();
    expect(screen.getByText("Built with 11 Qloo calls in 1.4 s.")).toBeTruthy();
  });
});
