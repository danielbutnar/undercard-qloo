// @vitest-environment jsdom
// M9d: the blind tournament's winners, shipped (docs/evidence.md section 24). The first screen's
// bands are ledgers with a lift bar per act; the climb says where a lifted act came from; the
// method page sets its diagram full width over two columns.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftBill } from "@/components/draft-bill";
import { LiftClimb } from "@/components/lift-climb";
import { MethodPage } from "@/components/method-page";
import { liftOf } from "@/lib/marks";
import { wasPlace } from "@/lib/lift-climb";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { acts } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the first screen's ledger (M9d winner)", () => {
  it("sets each act as a row: its name, the venue whose fans like it, its move and a bar as long as the move", () => {
    render(
      <DraftBill
        festival={SAGEBRUSH_SOUND}
        acts={acts}
        calls={12}
        createdAt="2026-10-15T14:02:00.000Z"
        onOpen={() => {}}
      />,
    );
    const mid = screen.getByRole("region", { name: "Mid-size acts" });
    const rows = within(mid).getAllByRole("article");
    expect(rows).toHaveLength(4);
    const first = acts.find((act) => act.band === "mid")!;
    const row = within(mid).getByRole("article", { name: first.name });
    expect(within(row).getByRole("button", { name: first.name })).toBeTruthy();
    expect(
      within(row).getByText(`${first.anchorVenue.name} fans like it`),
    ).toBeTruthy();
    expect(
      within(row).getByText("places higher in Qloo's ranking"),
    ).toBeTruthy();
    const lift = liftOf(first);
    expect(lift?.kind).toBe("up");
    const bar = row.querySelector<HTMLElement>("[data-lift-bar]")!;
    expect(bar.getAttribute("aria-hidden")).toBe("true");
    expect(bar.style.width).toBe(
      `${Math.min(100, ((lift as { places: number }).places / 50) * 100)}%`,
    );
    // The words on each row do the key's job, so the bill carries no separate key.
    expect(
      screen.queryByRole("note", { name: "How to read the marks" }),
    ).toBeNull();
  });
});

describe("the climb says where a lifted act came from (M9d winner)", () => {
  it("names the place an act held before the venue's fans were added", () => {
    expect(wasPlace(1, 49)).toBe("was 50th");
    expect(wasPlace(2, 19)).toBe("was 21st");
    expect(wasPlace(3, 9)).toBe("was 12th");
    expect(wasPlace(1, 2)).toBe("was 3rd");
    expect(wasPlace(1, 1)).toBe("was 2nd");
    expect(wasPlace(1, 110)).toBe("was 111th");
  });

  it("labels each lifted act with its move, the venue and its old place", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    render(
      <LiftClimb
        steps={[
          {
            type: "climb",
            band: "mid",
            venue: { entityId: "v1", name: "The Lantern Room" },
            acts: [
              { entityId: "a1", name: "Hollow Pines", move: 11 },
              { entityId: "a2", name: "Marisol Vey", move: null },
            ],
          },
        ]}
        bands={SAGEBRUSH_SOUND.feeBands}
        live={false}
        onDone={() => {}}
      />,
    );
    expect(screen.getByText("+11, The Lantern Room (was 12th)")).toBeTruthy();
  });
});

describe("the method page's layout (M9d winner)", () => {
  it("sets the method full width, then the evidence and the objections side by side", () => {
    render(<MethodPage />);
    const method = screen.getByRole("region", { name: "The method" });
    const evidence = screen.getByRole("region", { name: "Evidence" });
    const objections = screen.getByRole("region", { name: "Five objections" });
    const columns = evidence.closest("[data-columns]");
    expect(columns).not.toBeNull();
    expect(columns!.contains(objections)).toBe(true);
    expect(columns!.contains(method)).toBe(false);
    expect(
      method.compareDocumentPosition(columns!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
