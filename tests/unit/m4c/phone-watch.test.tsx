// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const WATCH = { name: "Watch how it picked these acts" };
const open = () =>
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />);
const bill = () => screen.getByRole("region", { name: "Undercard draft" });

// Since evidence section 25 the bill's button under the headliners is the only one, at every
// width (tests/unit/m9d/watch-under-headliners.test.tsx checks where it sits).
describe("Watch how it picked these acts in the bill", () => {
  it("replays the saved build", () => {
    const fetch = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetch);
    open();
    fireEvent.click(within(bill()).getByRole("button", WATCH));
    expect(fetch).toHaveBeenCalledWith(
      "/api/undercard",
      expect.objectContaining({
        body: JSON.stringify({ fresh: false, festival: "sagebrush-sound" }),
      }),
    );
    expect(
      within(bill()).getByRole("button", { name: "Building…" }),
    ).toBeTruthy();
  });
});
