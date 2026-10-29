// @vitest-environment jsdom
// WS18 (Daniel, 29 October): the screens' name comparisons fold both sides too. A headliner
// typed without Qloo's letter still gets Qloo's photo, and the demo's headliners typed with other
// accents replay the checked town's saved build, as the folded search would find the same acts.
// Invented names and image URLs.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeadlinerList } from "@/components/chart/poster";
import { YourFestival } from "@/components/your-festival";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the poster's headliners", () => {
  it("show Qloo's photo for a headliner typed without Qloo's letter", () => {
    const photo = "https://images.qloo.com/i/synthetic-ws18.jpg";
    render(
      <HeadlinerList
        headliners={["Fjord Lights", "Kirmizi Kus"]}
        ids={
          new Map([
            ["Fjørd Lights", "e-1"],
            ["Kırmızı Kuş", "e-2"],
          ])
        }
        images={{ "e-1": photo }}
      />,
    );
    const photos = screen
      .getByRole("list", { name: "Booked headliners" })
      .querySelectorAll("img.cover-photo");
    expect([...photos].map((img) => img.getAttribute("src"))).toEqual([photo]);
  });
});

describe("Your festival's checked towns", () => {
  it("replay the saved build when the demo's headliners are typed with other accents", async () => {
    const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async (url) =>
        url.startsWith("/api/venue-switch")
          ? new Response("", { status: 404 })
          : new Response(
              JSON.stringify({ type: "done", calls: 0, ms: 0 }) + "\n",
              {
                headers: { "content-type": "application/x-ndjson" },
              },
            ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<YourFestival />);
    fireEvent.change(screen.getByLabelText("Second headliner"), {
      target: { value: "Japanese Bréakfast" },
    });
    fireEvent.click(
      within(
        screen.getByRole("list", { name: "Towns Undercard has already read" }),
      ).getByRole("button", { name: /^Tallinn, Estonia/ }),
    );
    const builds = () =>
      fetch.mock.calls.filter(([url]) => url === "/api/undercard");
    await waitFor(() => expect(builds()).toHaveLength(1));
    expect(JSON.parse(String(builds()[0][1]?.body))).toMatchObject({
      fresh: false,
      replayOnly: true,
      festival: "sagebrush-sound-tallinn",
    });
  });
});
