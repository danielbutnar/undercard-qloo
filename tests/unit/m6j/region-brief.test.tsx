// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YourFestival } from "@/components/your-festival";
import { pilotDraft, pilotFestival } from "@/lib/pilot";
import {
  briefFromSearch,
  YourBriefSchema,
  yourFestival,
  yourFestivalHref,
} from "@/lib/your-festival";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("a brief names its town's state or country", () => {
  it("needs one, and the festival carries it", () => {
    const brief = {
      city: "Burlington",
      region: "Vermont",
      headliners: ["A", "B"],
    };
    expect(YourBriefSchema.safeParse(brief).success).toBe(true);
    expect(YourBriefSchema.safeParse({ ...brief, region: "" }).success).toBe(
      false,
    );
    expect(yourFestival(YourBriefSchema.parse(brief), "yours-1").region).toBe(
      "Vermont",
    );
  });

  it("travels in a pre-filled link", () => {
    const href = yourFestivalHref({
      city: "Burlington",
      region: "Vermont",
      headliners: ["A", "B"],
    });
    expect(href).toBe(
      "/your-festival?town=Burlington&region=Vermont&headliner=A&headliner=B",
    );
    expect(briefFromSearch(href.split("?")[1])).toEqual({
      city: "Burlington",
      region: "Vermont",
      first: "A",
      second: "B",
    });
  });

  it("is a field on the form, and goes with the run", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ type: "done", calls: 0, ms: 0 }) + "\n", {
          headers: { "content-type": "application/x-ndjson" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    render(<YourFestival />);
    fireEvent.change(screen.getByLabelText("Town"), {
      target: { value: "Burlington" },
    });
    fireEvent.change(screen.getByLabelText("State or country"), {
      target: { value: "Vermont" },
    });
    fireEvent.change(screen.getByLabelText("First headliner"), {
      target: { value: "Khruangbin" },
    });
    fireEvent.change(screen.getByLabelText("Second headliner"), {
      target: { value: "Japanese Breakfast" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Draft my undercard" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).brief).toEqual({
      city: "Burlington",
      region: "Vermont",
      headliners: ["Khruangbin", "Japanese Breakfast"],
    });
    expect(screen.getByText(/^Burlington, Vermont ·/)).toBeTruthy();
  });
});

describe("a pilot draft", () => {
  it("marks a room Qloo doesn't place in the town", () => {
    const festival = pilotFestival({
      city: "Richmond",
      region: "Virginia",
      headliners: ["A", "B"],
      slots: { mid: 1, opener: 1 },
    });
    const page = pilotDraft({
      festival,
      ranAt: "2026-10-18T09:00:00.000Z",
      acts: [],
      roomsTested: {
        mid: ["The National", "Out East Hall", "South Side Room"],
        opener: ["Mystery Room"],
      },
      roomsWhere: {
        "The National": { name: "Richmond", admin1: "Virginia" },
        "Out East Hall": { name: "Henrico County", admin1: "Virginia" },
        "South Side Room": {
          city: "Richmond",
          name: "Manchester",
          admin1: "Virginia",
        },
      },
      log: [],
    });
    expect(page).toContain("| The National | Mid | 0 |");
    expect(page).toContain(
      "| Out East Hall (outside Richmond: Henrico County) | Mid | 0 |",
    );
    expect(page).toContain(
      "| Mystery Room (Qloo doesn't say where it is) | Opener | 0 |",
    );
    expect(page).toContain("| South Side Room | Mid | 0 |");
  });
});
