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
const rail = () => screen.getByRole("complementary", { name: "Qloo calls" });

// jsdom applies no CSS, so these check the classes that decide which copy shows: on phones
// the bill's own button under the headliners, from lg up the rail's.
describe("Watch how it picked these acts on a phone", () => {
  it("sits in the bill, right under the headliners, on phones only", () => {
    open();
    const button = within(bill()).getByRole("button", WATCH);
    expect(button.closest(".lg\\:hidden")).not.toBeNull();
    const headliners = within(bill()).getByRole("list", {
      name: "Booked headliners",
    });
    expect(
      headliners.compareDocumentPosition(button) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const firstBand = within(bill()).getByRole("region", { name: "Mid-size acts" });
    expect(
      button.compareDocumentPosition(firstBand) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("leaves the rail's button to wider screens", () => {
    open();
    const button = within(rail()).getByRole("button", WATCH);
    expect(button.closest(".hidden.lg\\:block")).not.toBeNull();
  });

  it("replays the saved build, like the rail's button", () => {
    const fetch = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetch);
    open();
    fireEvent.click(within(bill()).getByRole("button", WATCH));
    expect(fetch).toHaveBeenCalledWith(
      "/api/undercard",
      expect.objectContaining({ body: JSON.stringify({ fresh: false, festival: "sagebrush-sound" }) }),
    );
    expect(
      within(bill()).getByRole("button", { name: "Building…" }),
    ).toBeTruthy();
  });
});
