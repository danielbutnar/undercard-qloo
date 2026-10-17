// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { syntheticLlmOnly } from "../../e2e/synthetic-build";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "./first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const WITH = "With Qloo: the agent's bill";
const WITHOUT = "Without Qloo: the model's picks";
const { lineup } = syntheticLlmOnly();

function open(answer: () => Promise<Response>) {
  const fetch = vi.fn(answer);
  vi.stubGlobal("fetch", fetch);
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />);
  return fetch;
}
const answered = () =>
  open(async () => Response.json({ lineup, cached: true }));
const flip = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
const modelBill = () =>
  screen.findByRole("region", { name: "Without Qloo: the model's picks" });

describe("the switch", () => {
  it("says what each side shows", () => {
    answered();
    const group = screen.getByRole("group", { name: "Which bill" });
    expect(
      within(group)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual([WITH, WITHOUT]);
    expect(
      within(group)
        .getByRole("button", { name: WITH })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
});

describe("Without Qloo", () => {
  it("reprints the bill with the model's picks under the same headliners, stamped No Qloo data", async () => {
    const fetch = answered();
    flip(WITHOUT);
    const sheet = await modelBill();
    expect(fetch).toHaveBeenCalledWith(
      "/api/llm-only",
      expect.objectContaining({ method: "POST" }),
    );
    expect(within(sheet).getByText("No Qloo data")).toBeTruthy();
    expect(
      within(sheet).getByRole("list", { name: "Booked headliners" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "Undercard draft" }),
    ).toBeNull();
  });

  it("gives each pick the model's own reason and two plain facts", async () => {
    answered();
    flip(WITHOUT);
    const sheet = await modelBill();
    const picks = within(sheet).getAllByRole("article");
    expect(picks.map((pick) => pick.getAttribute("aria-label"))).toEqual(
      lineup.picks.map((pick) => pick.name),
    );
    for (const [index, pick] of picks.entries()) {
      expect(within(pick).getByText(lineup.picks[index].note)).toBeTruthy();
      expect(
        within(pick).getByText("No Boise room · fee band not checked"),
      ).toBeTruthy();
    }
  });

  it("puts no score, tally or 0/10 anywhere", async () => {
    answered();
    flip(WITHOUT);
    await modelBill();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\d+\s*\/\s*\d+/);
    expect(text).not.toMatch(/\bscore\b/i);
  });

  it("says in the rail what the model got, in place of the rooms and the trace", async () => {
    answered();
    flip(WITHOUT);
    await modelBill();
    const note = screen.getByRole("complementary", { name: "The model alone" });
    expect(note.textContent).toMatch(/Claude Sonnet 5\.5 with no tools/);
    expect(
      screen.queryByRole("region", { name: "Boise crowds behind this bill" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Watch the agent build it" }),
    ).toBeNull();
  });

  it("flips back to the agent's bill with its marks", async () => {
    answered();
    flip(WITHOUT);
    await modelBill();
    flip(WITH);
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    expect(
      within(
        within(bill).getByRole("article", { name: "Hollow Pines" }),
      ).getByText("The Lantern Room +11"),
    ).toBeTruthy();
  });

  it("shows the model's error with a way to try again", async () => {
    const fetch = open(async () =>
      Response.json(
        { error: "The model didn't answer. Try again in a minute." },
        { status: 502 },
      ),
    );
    flip(WITHOUT);
    const sheet = await modelBill();
    await waitFor(() =>
      expect(within(sheet).getByRole("alert").textContent).toBe(
        "The model didn't answer. Try again in a minute.",
      ),
    );
    fireEvent.click(within(sheet).getByRole("button", { name: "Try again" }));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
