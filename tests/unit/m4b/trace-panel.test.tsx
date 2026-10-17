// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TracePanel } from "@/components/trace-panel";
import { firstBoard, IDLE_BUILD } from "@/lib/build-state";
import { FIRST_BILL } from "./first-bill-fixture";

afterEach(cleanup);

describe("the trace behind Watch the agent build it", () => {
  const saved = firstBoard(FIRST_BILL);

  it("replays the saved build from Watch the agent build it", () => {
    const onBuild = vi.fn();
    render(<TracePanel state={saved} savedCalls={12} onBuild={onBuild} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Watch the agent build it" }),
    );
    expect(onBuild).toHaveBeenCalledWith();
  });

  it("says what the replay shows, and keeps the trace folded until then", () => {
    render(<TracePanel state={saved} savedCalls={12} onBuild={vi.fn()} />);
    expect(
      screen.getByText(
        "Replays the saved build: 12 Qloo calls, then the bill reprints.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Qloo calls" })).toBeNull();
    expect(screen.queryByText(/of 12$/)).toBeNull();
  });

  it("offers Run the agent live instead, a fresh build", () => {
    const onBuild = vi.fn();
    render(<TracePanel state={saved} savedCalls={12} onBuild={onBuild} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Run the agent live instead" }),
    );
    expect(onBuild).toHaveBeenCalledWith({ fresh: true });
  });

  it("offers the live run again after a replay", () => {
    const onBuild = vi.fn();
    render(
      <TracePanel
        state={{
          ...saved,
          status: "done",
          summary: { calls: 12, ms: 1400 },
        }}
        onBuild={onBuild}
      />,
    );
    expect(
      screen.getByText(
        "Replayed the build saved Oct 15, 14:02 UTC: 12 Qloo calls, served from the cache.",
      ),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Run the agent live instead" }),
    );
    expect(onBuild).toHaveBeenCalledWith({ fresh: true });
    expect(
      screen.queryByRole("button", { name: "Run the agent again" }),
    ).toBeNull();
  });

  it("keeps Build undercard and the empty trace when no build is saved", () => {
    render(<TracePanel state={IDLE_BUILD} onBuild={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Build undercard" }),
    ).toBeTruthy();
    expect(screen.getByText(/^Every Qloo call the agent makes/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Run the agent live instead" }),
    ).toBeNull();
  });
});
