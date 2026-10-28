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
import { firstBoard, IDLE_BUILD } from "@/lib/build-state";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { acts, FIRST_BILL } from "./first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const draft = () => screen.getByRole("region", { name: "Undercard draft" });

describe("the first screen", () => {
  it("opens on the saved bill: every act is on screen before any click", () => {
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    expect(within(screen.getByRole("region", { name: "Undercard draft" })).getAllByRole("article")).toHaveLength(10);
    expect(screen.queryByText("Open slot")).toBeNull();
    // The draft, not the board of cards: Qloo's figures wait on an act's card.
    expect(draft()).toBeTruthy();
    expect(screen.queryByText("Qloo affinity")).toBeNull();
  });

  // Watch and Build undercard sit in the lead beside the chart, not inside the draft.
  it("falls back to the bill with open slots and Build undercard when no build is saved", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={null} />);
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.getAllByText("Open slot")).toHaveLength(10);
    expect(
      screen.getByRole("button", { name: "Build undercard" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Watch the AI agent build it" }),
    ).toBeNull();
  });

  it("leaves presale off the first screen, with or without a saved bill", () => {
    for (const firstBill of [FIRST_BILL, null]) {
      render(
        <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={firstBill} />,
      );
      expect(screen.queryByRole("img", { name: /Presale/ })).toBeNull();
      expect(screen.queryByText(/sold of/)).toBeNull();
      cleanup();
    }
  });

  it("puts Export CSV below the bill once there's a lineup, and none on the empty board (M6q)", () => {
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    expect(
      within(screen.getByRole("banner")).queryByRole("button", {
        name: "Export CSV",
      }),
    ).toBeNull();
    // In the tools row under the bands, still inside the draft.
    const exportCsv = within(draft()).getByRole("button", {
      name: "Export CSV",
    });
    const opening = within(draft()).getByRole("region", {
      name: "Opening acts",
    });
    expect(
      opening.compareDocumentPosition(exportCsv) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    cleanup();
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={null} />);
    expect(screen.queryByRole("button", { name: "Export CSV" })).toBeNull();
  });

  it("keeps the draft on screen, its bands waiting for the first ranking, while a replay waits for its first event", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        // The venue switch reads the saved build's results on mount; the replay never answers.
        url.startsWith("/api/venue-switch")
          ? Promise.resolve(new Response(null, { status: 404 }))
          : new Promise<Response>(() => {}),
      ),
    );
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Watch the AI agent build it" }),
    );
    expect(draft()).toBeTruthy();
    // Watch is playing, with its caption up, and no act waits under it. WS9: Watch's own button
    // turns into Skip while it plays.
    expect(
      screen.getByRole("button", { name: "Skip to the lineup" }),
    ).toHaveProperty("disabled", false);
    expect(
      within(draft()).getByText("Replaying the AI agent's build"),
    ).toBeTruthy();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    // Both bands stay on the chart, each saying what it waits for.
    for (const band of ["Mid-size acts", "Opening acts"])
      expect(
        within(within(draft()).getByRole("region", { name: band })).getByText(
          "Waiting for this tier's first ranking…",
        ),
      ).toBeTruthy();
  });

  it("starts the board from the saved build, so a refill can name it", () => {
    expect(firstBoard(null)).toEqual(IDLE_BUILD);
    expect(firstBoard(FIRST_BILL)).toEqual({
      ...IDLE_BUILD,
      acts,
      build: { ...FIRST_BILL.build, replayed: true },
    });
  });
});
