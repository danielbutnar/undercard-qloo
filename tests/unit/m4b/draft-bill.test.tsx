// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DraftBill } from "@/components/draft-bill";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { acts, FIRST_BILL } from "./first-bill-fixture";

afterEach(cleanup);

const bill = (props: Partial<Parameters<typeof DraftBill>[0]> = {}) =>
  render(
    <DraftBill
      festival={SAGEBRUSH_SOUND}
      acts={acts}
      calls={12}
      createdAt="2026-10-15T14:02:00.000Z"
      {...props}
    />,
  );

describe("the draft bill", () => {
  it("sets the festival and its booked headliners under a draft stamp", () => {
    bill();
    const sheet = screen.getByRole("region", { name: "Undercard draft" });
    expect(
      within(sheet).getByRole("heading", { level: 1, name: "Sagebrush Sound" }),
    ).toBeTruthy();
    expect(
      within(sheet)
        .getByRole("list", { name: "Booked headliners" })
        .querySelectorAll("li"),
    ).toHaveLength(2);
    expect(
      within(sheet).getByText("Undercard draft · not announced"),
    ).toBeTruthy();
    expect(
      within(sheet).getByText(
        "Boise, Idaho · 3,000 capacity · crowd aged 25–34",
      ),
    ).toBeTruthy();
  });

  it("bills 4 Mid and 6 Opener acts in the lineup's order, each an article", () => {
    bill();
    const names = (band: string) =>
      within(screen.getByRole("region", { name: band }))
        .getAllByRole("article")
        .map((article) => article.getAttribute("aria-label"));
    expect(names("Mid")).toEqual(
      acts.filter((act) => act.band === "mid").map((act) => act.name),
    );
    expect(names("Opener")).toHaveLength(6);
  });

  it("says Qloo's popularity percentile sets each fee band", () => {
    bill();
    expect(
      screen.getByText(
        "4 slots · fee band set by Qloo's popularity percentile: 80th–92nd",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "6 slots · fee band set by Qloo's popularity percentile: 55th–80th",
      ),
    ).toBeTruthy();
  });

  it("marks each act with its room and the places it gained, or new", () => {
    bill({ top: { mid: 50, opener: 50 } });
    const act = (name: string) => screen.getByRole("article", { name });
    expect(
      within(act("Hollow Pines")).getByText("The Lantern Room ▲11"),
    ).toBeTruthy();
    expect(within(act("Marisol Vey")).getByText("FSB ▲7")).toBeTruthy();
    expect(
      within(act("Low Bench Choir")).getByText("The Lantern Room new"),
    ).toBeTruthy();
    // Read out in words: the ▲ and the initials stay off the accessibility tree.
    expect(
      within(act("Marisol Vey")).getByText(
        "Fort Street Ballroom's crowd: up 7 places",
      ),
    ).toBeTruthy();
    expect(
      within(act("Low Bench Choir")).getByText(
        "The Lantern Room's crowd: new, from outside the headliners-only top 50",
      ),
    ).toBeTruthy();
  });

  it("explains the marks beside the first mark, and says what Qloo is", () => {
    bill({ top: { mid: 50, opener: 50 } });
    const keys = screen.getAllByRole("note", { name: "How to read the marks" });
    expect(keys).toHaveLength(1);
    const key = keys[0];
    // Beside the first act on the bill: in the same slot of the Mid tier.
    const firstSlot = within(
      screen.getByRole("region", { name: "Mid" }),
    ).getAllByRole("listitem")[0];
    expect(firstSlot.contains(key)).toBe(true);
    expect(
      within(firstSlot).getByRole("article", { name: "Hollow Pines" }),
    ).toBeTruthy();
    expect(key.textContent).toContain("The Lantern Room ▲11");
    expect(key.textContent).toContain(
      "Qloo ranks artists for the headliners' fans; adding The Lantern Room's crowd lifts this act 11 places.",
    );
    expect(key.textContent).toContain(
      "new: not in that top 50 until a room's crowd was added.",
    );
    expect(key.textContent).toContain(
      "Qloo: data on what people like, across music, places and more.",
    );
  });

  it("keeps the key in the first slot while that act is refilled, so nothing jumps", () => {
    bill({ unavailable: [acts[0].entityId] });
    const firstSlot = within(
      screen.getByRole("region", { name: "Mid" }),
    ).getAllByRole("listitem")[0];
    expect(
      within(firstSlot).getByRole("note", { name: "How to read the marks" }),
    ).toBeTruthy();
  });

  it("says how many Qloo calls drafted it and when the build was saved", () => {
    bill();
    expect(
      screen.getByText(
        /^Drafted by the agent from 12 Qloo calls · saved Oct 15, 14:02 UTC/,
      ),
    ).toBeTruthy();
  });

  it("stamps an unavailable act and drops its mark", () => {
    bill({ unavailable: [acts[0].entityId] });
    const gone = screen.getByRole("article", { name: acts[0].name });
    expect(within(gone).getByText("Unavailable")).toBeTruthy();
    expect(within(gone).queryByText(/crowd/)).toBeNull();
  });

  it("shows open slots while a build streams and the lineup hasn't landed", () => {
    bill({ acts: [] });
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.getAllByText("Open slot")).toHaveLength(10);
  });
});

describe("the first screen with a saved build", () => {
  it("opens on the draft bill rather than the board of cards", () => {
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    expect(
      screen.getByRole("region", { name: "Undercard draft" }),
    ).toBeTruthy();
    expect(screen.queryByText("Qloo affinity")).toBeNull();
  });
});
