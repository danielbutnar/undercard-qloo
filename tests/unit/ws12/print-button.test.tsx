// @vitest-environment jsdom
// WS12 item 6: "Download the poster" beside Export CSV sends the poster on screen to
// /api/poster and downloads the PNG it draws. What prints is what the poster shows: its acts band
// by band in the poster's order, each with its place and climb, its open slots, and the venues
// whose fans lifted them; an act marked unavailable leaves its slot open. Synthetic data:
// invented acts and venues, no Qloo data.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrintRequest } from "@/components/share/print-words";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const DOWNLOAD = "Download the poster";
const PNG = () =>
  new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
    headers: { "content-type": "image/png" },
  });

/** Opens Boise's first screen; `poster` answers /api/poster. */
function open(poster: () => Promise<Response> | Response = PNG) {
  const fetch = vi.fn(async (url: string) =>
    url === "/api/poster"
      ? poster()
      : // The refill never answers here: the act stays marked unavailable.
        url === "/api/refill"
        ? new Promise<Response>(() => {})
        : new Response(null, { status: 404 }),
  );
  vi.stubGlobal("fetch", fetch);
  const saved: string[] = [];
  // jsdom has no object URLs.
  Object.assign(URL, {
    createObjectURL: () => "blob:poster",
    revokeObjectURL: () => {},
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push(this.download);
  });
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />);
  const sent = () => {
    const call = fetch.mock.calls.find(([url]) => url === "/api/poster");
    expect(call).toBeDefined();
    const init = (call as unknown as [string, RequestInit])[1];
    expect(init.method).toBe("POST");
    return JSON.parse(String(init.body)) as PrintRequest;
  };
  return { fetch, saved, sent };
}

const bandNames = (band: string) =>
  within(screen.getByRole("region", { name: band }))
    .getAllByRole("article")
    .map((article) => article.getAttribute("aria-label"));

describe("Download the poster (WS12 item 6)", () => {
  it("sends the poster on screen: its acts in the poster's order, its open slots and its venues", async () => {
    const { sent, saved } = open();
    fireEvent.click(screen.getByRole("button", { name: DOWNLOAD }));
    await waitFor(() => expect(saved).toHaveLength(1));

    const request = sent();
    expect(request.festival).toBe(SAGEBRUSH_SOUND.id);
    expect(request.bands.map((band) => band.id)).toEqual(["mid", "opener"]);
    expect(request.bands[0].acts.map((act) => act.name)).toEqual(
      bandNames("Mid-size acts"),
    );
    expect(request.bands[1].acts.map((act) => act.name)).toEqual(
      bandNames("Opening acts"),
    );
    expect(request.bands.map((band) => band.open)).toEqual([0, 0]);
    // Each act's climb, as its name on the poster marks it.
    const ditch = request.bands[0].acts.find(
      (act) => act.name === "The Ditch Riders",
    );
    expect(ditch?.climb).toEqual({ kind: "up", places: 26 });
    expect(ditch?.hue).not.toBeNull();
    // The venues whose fans lifted a printed act; Cottonwood lifted none.
    expect(request.venues.map(({ name, acts }) => [name, acts]).sort()).toEqual(
      [
        ["Fort Street Ballroom", 3],
        ["The Lantern Room", 7],
      ],
    );
    expect(saved).toEqual([
      "sagebrush-sound-fictional-demo-festival-poster.png",
    ]);
  });

  it("leaves an act marked unavailable off the print, its slot open", async () => {
    const { sent, saved } = open();
    fireEvent.click(
      within(screen.getByRole("region", { name: "Undercard draft" })).getByRole(
        "button",
        { name: "Hollow Pines" },
      ),
    );
    fireEvent.click(
      within(screen.getByRole("region", { name: "Act card" })).getByRole(
        "button",
        { name: "Unavailable" },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Fee" }));
    fireEvent.click(screen.getByRole("button", { name: DOWNLOAD }));
    await waitFor(() => expect(saved).toHaveLength(1));

    const [mid] = sent().bands;
    expect(mid.acts.map((act) => act.name)).not.toContain("Hollow Pines");
    expect(mid.acts).toHaveLength(3);
    expect(mid.open).toBe(1);
  });

  it("says it's drawing while it draws, and says so if it can't", async () => {
    let answer: (response: Response) => void = () => {};
    const { saved } = open(
      () => new Promise<Response>((resolve) => (answer = resolve)),
    );
    fireEvent.click(screen.getByRole("button", { name: DOWNLOAD }));
    const drawing = await screen.findByRole("button", {
      name: "Drawing the poster…",
    });
    expect((drawing as HTMLButtonElement).disabled).toBe(true);

    answer(new Response("busy", { status: 503 }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "The poster couldn't be drawn. Try again.",
    );
    expect(
      (screen.getByRole("button", { name: DOWNLOAD }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(saved).toEqual([]);
  });
});
