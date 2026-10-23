// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TraceCall } from "@/lib/build-events";
import { IDLE_BUILD, type BuildState } from "@/lib/build-state";
import { TracePanel } from "@/components/trace-panel";

afterEach(cleanup);

const venueCall: TraceCall = {
  n: 9,
  tool: "venue_artists",
  endpoint: "/v2/insights",
  summary: "Mid-band artists for the headliners and The Lantern Room",
  params: [
    { key: "filter.type", value: "urn:entity:artist" },
    {
      key: "signal.interests.entities",
      value: "Khruangbin, Japanese Breakfast, The Lantern Room",
    },
  ],
  resultCount: 50,
  ms: 2400,
  cached: true,
};

function renderPanel(state: Partial<BuildState>, onBuild = vi.fn()) {
  render(<TracePanel state={{ ...IDLE_BUILD, ...state }} onBuild={onBuild} />);
  return onBuild;
}

describe("TracePanel", () => {
  it("starts a build from the Build undercard button", () => {
    const onBuild = renderPanel({});
    fireEvent.click(screen.getByRole("button", { name: "Build undercard" }));
    expect(onBuild).toHaveBeenCalledOnce();
  });

  it("disables the button while a build runs", () => {
    renderPanel({ status: "building" });
    expect(
      (screen.getByRole("button", { name: "Building…" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("lists each Qloo call with its endpoint, parameters and result count", () => {
    renderPanel({ status: "building", calls: [venueCall], latest: 9 });
    const list = screen.getByRole("list", { name: "Qloo calls" });
    const row = within(list).getAllByRole("listitem")[0];
    expect(
      within(row).getByText(
        /Mid-tier artists for the headliners and The Lantern Room/,
      ),
    ).toBeTruthy();
    expect(
      within(row).getByText("GET /v2/insights · 2.4 s · cached"),
    ).toBeTruthy();
    expect(
      within(row).getByText(
        "signal.interests.entities=Khruangbin, Japanese Breakfast, The Lantern Room",
      ),
    ).toBeTruthy();
    expect(within(row).getByLabelText("50 results").textContent).toBe("50");
    expect(screen.getByText("1 of 12")).toBeTruthy();
  });

  it("folds a finished build's parameters behind a per-call toggle", () => {
    renderPanel({
      status: "done",
      calls: [venueCall],
      latest: 9,
      summary: { calls: 1, ms: 2400 },
    });
    const param =
      "signal.interests.entities=Khruangbin, Japanese Breakfast, The Lantern Room";
    expect(screen.queryByText(param)).toBeNull();
    const toggle = screen.getByRole("button", { name: "Parameters" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getByText(param)).toBeTruthy();
  });

  it("summarizes a finished build", () => {
    renderPanel({
      status: "done",
      calls: [venueCall],
      summary: { calls: 11, ms: 15680 },
    });
    expect(
      screen.getByText("Built with 11 Qloo calls in 15.7 s."),
    ).toBeTruthy();
  });

  it("shows a build error", () => {
    renderPanel({
      status: "error",
      error: "Qloo isn't configured on this server.",
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "Qloo isn't configured on this server.",
    );
  });
});
