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
import { syntheticRefillStream } from "../../e2e/synthetic-build";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { acts, FIRST_BILL } from "./first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const open = () =>
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />);
const bill = () => screen.getByRole("region", { name: "Undercard draft" });
const actButton = (name: string) =>
  within(bill()).getByRole("button", { name });

describe("an act on the bill", () => {
  it("is a button named by the act, with a pointer and an underline on hover and keyboard focus", () => {
    open();
    for (const act of acts) {
      const button = actButton(act.name);
      expect(button.getAttribute("aria-expanded")).toBe("false");
      expect(button.className).toMatch(/\bcursor-pointer\b/);
      expect(button.className).toMatch(/\bhover:underline\b/);
      expect(button.className).toMatch(/\bfocus-visible:underline\b/);
      expect(button.className).not.toMatch(/scale/);
    }
  });

  it("says what a click does", () => {
    open();
    expect(
      within(bill()).getByText(
        /Click an act to open its card, where you can keep it or mark it unavailable./,
      ),
    ).toBeTruthy();
  });

  it("opens its card: the Why Boise line, Qloo's numbers, the shared tags and Unavailable", () => {
    open();
    fireEvent.click(actButton("Marisol Vey"));
    const card = screen.getByRole("region", { name: "Act card" });
    const article = within(card).getByRole("article", { name: "Marisol Vey" });
    expect(
      within(article).getByText(
        /Fort Street Ballroom fans move it up 7 places/,
      ),
    ).toBeTruthy();
    expect(within(article).getByText("Qloo affinity")).toBeTruthy();
    expect(within(article).getByText("Popularity")).toBeTruthy();
    expect(
      within(article)
        .getByRole("list", { name: "Tags shared with the headliners" })
        .querySelectorAll("li"),
    ).toHaveLength(2);
    expect(
      within(article).getByRole("button", { name: "Unavailable" }),
    ).toBeTruthy();
    expect(actButton("Marisol Vey").getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(card);
  });

  it("closes its card", () => {
    open();
    fireEvent.click(actButton("Marisol Vey"));
    fireEvent.click(screen.getByRole("button", { name: "Close the card" }));
    expect(screen.queryByRole("region", { name: "Act card" })).toBeNull();
    expect(actButton("Marisol Vey").getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("is marked unavailable from its card, and the replacement takes its slot on the bill", async () => {
    const fetch = vi.fn(
      async (_url: string, init: RequestInit) =>
        new Response(
          syntheticRefillStream(JSON.parse(String(init.body)).unavailableId),
          { headers: { "content-type": "application/x-ndjson" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    open();
    fireEvent.click(actButton("Hollow Pines"));
    fireEvent.click(
      within(screen.getByRole("region", { name: "Act card" })).getByRole(
        "button",
        { name: "Unavailable" },
      ),
    );
    // M6e: the card asks why before it refills.
    fireEvent.click(screen.getByRole("button", { name: "Radius clause" }));
    expect(fetch).toHaveBeenCalledWith(
      "/api/refill",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toMatchObject({
      buildId: FIRST_BILL.build.id,
      unavailableId: acts[0].entityId,
      band: "mid",
      reason: "radius",
    });
    await waitFor(() => expect(actButton("Sego Lily")).toBeTruthy());
    const mid = within(bill()).getByRole("region", { name: "Mid" });
    expect(
      within(mid)
        .getAllByRole("article")
        .map((article) => article.getAttribute("aria-label")),
    ).toEqual([
      "Sego Lily",
      "Marisol Vey",
      "The Ditch Riders",
      "Kestrel & Bloom",
    ]);
    expect(screen.queryByRole("region", { name: "Act card" })).toBeNull();
  });
});
