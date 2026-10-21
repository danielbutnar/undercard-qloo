// @vitest-environment jsdom
// Found while re-checking the phone's first screen with the images on (2026-10-21): every row
// of the bill the server had already painted rose in again from 28 px below, faded out, when the
// page came alive, so a measurement in the first second could catch it low. Rows on screen at
// first paint stay put; a row that arrives later still rises in, and a row that moves glides.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFlip } from "@/components/chart/use-flip";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

const animate = vi.fn();
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  animate.mockClear();
  delete (Element.prototype as { animate?: unknown }).animate;
});

function withAnimate() {
  Object.defineProperty(Element.prototype, "animate", {
    value: animate,
    configurable: true,
    writable: true,
  });
}

function List({ ids }: { ids: string[] }) {
  const flip = useFlip<HTMLLIElement>(ids.join(), true);
  return (
    <ul>
      {ids.map((id) => (
        <li key={id} ref={flip(id)}>
          {id}
        </li>
      ))}
    </ul>
  );
}

describe("rows on screen at first paint", () => {
  it("stay put when the first screen comes alive", () => {
    withAnimate();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    expect(
      within(
        screen.getByRole("region", { name: "Undercard draft" }),
      ).getAllByRole("article"),
    ).toHaveLength(10);
    expect(animate).not.toHaveBeenCalled();
  });

  it("stay put on the hook's first pass, while a row that arrives later rises in", () => {
    withAnimate();
    const { rerender } = render(<List ids={["a", "b"]} />);
    expect(animate).not.toHaveBeenCalled();
    rerender(<List ids={["a", "b", "c"]} />);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.instances[0]).toBe(screen.getByText("c"));
  });
});
