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
import { TownSwitcher } from "@/components/town-switcher";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { festivalById, festivalFromBody, TOWNS, townBySlug } from "@/lib/towns";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the towns", () => {
  it("keep Boise as the demo festival, and give each other town the same brief under its own id", () => {
    expect(TOWNS.map((town) => town.slug)).toEqual([
      "boise",
      "austin",
      "denver",
      "nashville",
    ]);
    expect(TOWNS[0].festival).toBe(SAGEBRUSH_SOUND);
    const ids = new Set(TOWNS.map((town) => town.festival.id));
    expect(ids.size).toBe(4);
    for (const { festival } of TOWNS.slice(1)) {
      expect(festival.id).not.toBe(SAGEBRUSH_SOUND.id);
      expect(festival.headliners).toEqual(SAGEBRUSH_SOUND.headliners);
      expect(festival.capacity).toBe(SAGEBRUSH_SOUND.capacity);
      expect(festival.crowdAge).toEqual(SAGEBRUSH_SOUND.crowdAge);
      expect(festival.feeBands).toEqual(SAGEBRUSH_SOUND.feeBands);
    }
    expect(townBySlug("austin")?.festival.city).toBe("Austin");
    expect(townBySlug("paris")).toBeNull();
  });

  it("resolve a request's festival: none means Boise, an unknown id means nothing", () => {
    expect(festivalById(undefined)).toBe(SAGEBRUSH_SOUND);
    expect(festivalById("sagebrush-sound-denver")?.city).toBe("Denver");
    expect(festivalById("not-a-festival")).toBeNull();
    expect(festivalFromBody({ fresh: true })).toBe(SAGEBRUSH_SOUND);
    expect(
      festivalFromBody({ festival: "sagebrush-sound-nashville" })?.city,
    ).toBe("Nashville");
    expect(festivalFromBody({ festival: 7 })).toBeNull();
    expect(festivalFromBody(null)).toBe(SAGEBRUSH_SOUND);
  });
});

describe("the town switcher", () => {
  it("links the same brief in each town on show, one click away, and marks the town on screen", () => {
    render(
      <TownSwitcher current="boise" onShow={["boise", "austin", "denver"]} />,
    );
    const nav = screen.getByRole("navigation", {
      name: "Same brief, other towns",
    });
    const links = within(within(nav).getByRole("list")).getAllByRole("link");
    // M6f: one more link, to a town of your own.
    expect(
      within(nav)
        .getByRole("link", {
          name: "Or draft one for your own town and headliners",
        })
        .getAttribute("href"),
    ).toBe("/your-festival");
    expect(
      links.map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Boise", "/"],
      ["Austin", "/towns/austin"],
      ["Denver", "/towns/denver"],
    ]);
    expect(
      within(nav)
        .getByRole("link", { name: "Boise" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("stays out of the way when only Boise is on show", () => {
    const { container } = render(
      <TownSwitcher current="boise" onShow={["boise"]} />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("a town's screen", () => {
  const austin = townBySlug("austin")!.festival;

  it("names the town wherever the bill named Boise", () => {
    render(<FestivalScreen festival={austin} firstBill={{ ...FIRST_BILL }} />);
    expect(
      screen.getByRole("heading", {
        name: "Austin venue crowds behind this bill",
      }),
    ).toBeTruthy();
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    fireEvent.click(within(bill).getByRole("button", { name: "Hollow Pines" }));
    const card = screen.getByRole("region", { name: "Act card" });
    expect(within(card).getByText("Why Austin:")).toBeTruthy();
    expect(screen.queryByText(/Boise/)).toBeNull();
  });

  it("asks for its own festival's build", () => {
    const fetch = vi.fn(
      async () =>
        new Response("", {
          headers: { "content-type": "application/x-ndjson" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    render(<FestivalScreen festival={austin} firstBill={FIRST_BILL} />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Watch the agent build it" })[0],
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/undercard",
      expect.objectContaining({ method: "POST" }),
    );
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ festival: austin.id });
  });
});
