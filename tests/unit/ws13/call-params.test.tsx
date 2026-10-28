// @vitest-environment jsdom
// WS13 item 9: the full Qloo calls list shows each call's parameters in plain words and in raw
// form (signals, filters, popularity range), never response data. Invented names only.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { TraceCall } from "@/lib/build-events";
import { paramWords } from "@/lib/call-words";
import { CallRow } from "@/components/trace-panel";

afterEach(cleanup);

const p = (key: string, value: string) => ({ key, value });
const HEADLINERS = "Khruangbin, Japanese Breakfast";

describe("a call's parameters in plain words (WS13.9)", () => {
  it("says a venue read's signals, filters and popularity range", () => {
    expect(
      paramWords([
        p("filter.type", "urn:entity:artist"),
        p("signal.interests.entities", `${HEADLINERS}, The Lantern Room`),
        p("filter.popularity.min", "0.8"),
        p("filter.popularity.max", "0.92"),
        p("filter.exclude.entities", HEADLINERS),
        p("signal.demographics.age", "25_to_29,30_to_34"),
        p("take", "50"),
      ]),
    ).toEqual([
      "Ranks artists",
      `Signal: fans of ${HEADLINERS}, The Lantern Room`,
      "Popularity 80 to 92 on Qloo's 0–100 scale",
      `Leaves out: ${HEADLINERS}`,
      "Crowd's age: 25 to 34",
      "Top 50",
    ]);
  });

  it("says a venue search's town and tag, a name search and a tag search", () => {
    expect(
      paramWords([
        p("filter.type", "urn:entity:place"),
        p("filter.location.query", "Boise"),
        p("filter.tags", "urn:tag:genre:place:live_music_venue"),
        p("take", "20"),
      ]),
    ).toEqual([
      "Lists places",
      "In: Boise",
      "Tagged: live music venue",
      "Top 20",
    ]);
    expect(
      paramWords([
        p("query", "Khruangbin"),
        p("types", "urn:entity:artist"),
        p("take", "5"),
      ]),
    ).toEqual(['Name: "Khruangbin"', "Among: artists", "Top 5"]);
    expect(
      paramWords([
        p("filter.query", "live music venue"),
        p("filter.parents.types", "urn:entity:place"),
        p("take", "10"),
      ]),
    ).toEqual(['Tags matching "live music venue"', "For: places", "Top 10"]);
  });

  it("says a comparison, a location signal, a set of acts and Qloo's split", () => {
    expect(
      paramWords([
        p("a.signal.interests.entities", "Khruangbin"),
        p("b.signal.interests.entities", "Japanese Breakfast"),
        p("take", "25"),
      ]),
    ).toEqual([
      "Compares fans of Khruangbin",
      "with fans of Japanese Breakfast",
      "Top 25",
    ]);
    expect(
      paramWords([
        p("filter.type", "urn:entity:artist"),
        p("signal.interests.entities", HEADLINERS),
        p("signal.location.query", "Boise, Idaho"),
        p("filter.results.entities", "Hollow Pines, Juniper Static"),
        p("feature.explainability", "true"),
        p("take", "2"),
      ]),
    ).toEqual([
      "Ranks artists",
      `Signal: fans of ${HEADLINERS}`,
      "Location signal: Boise, Idaho",
      "Only these acts: Hollow Pines, Juniper Static",
      "With Qloo's split of each act's match",
      "Top 2",
    ]);
  });

  it("keeps a parameter it doesn't know as it came", () => {
    expect(paramWords([p("bias.trends", "high")])).toEqual([
      "bias.trends: high",
    ]);
  });
});

const call: TraceCall = {
  n: 9,
  tool: "venue_artists",
  endpoint: "/v2/insights",
  summary: "Mid-band artists for the headliners and The Lantern Room",
  params: [
    p("filter.type", "urn:entity:artist"),
    p("signal.interests.entities", `${HEADLINERS}, The Lantern Room`),
    p("filter.popularity.min", "0.8"),
    p("filter.popularity.max", "0.92"),
  ],
  resultCount: 50,
  ms: 2400,
  cached: true,
};

describe("the full Qloo calls list (WS13.9)", () => {
  it("shows each call's parameters in plain words and in raw form", () => {
    render(
      <ol>
        <CallRow call={call} highlighted={false} />
      </ol>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Parameters" }));
    const plain = screen.getByRole("list", { name: "In plain words" });
    expect(
      within(plain)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Ranks artists",
      `Signal: fans of ${HEADLINERS}, The Lantern Room`,
      "Popularity 80 to 92 on Qloo's 0–100 scale",
    ]);
    const raw = screen.getByRole("list", { name: "As sent to Qloo" });
    expect(within(raw).getByText("filter.popularity.max=0.92")).toBeTruthy();
  });

  it("shows the call's count and time, never what Qloo answered", () => {
    render(
      <ol>
        <CallRow call={call} highlighted />
      </ol>,
    );
    const row = document.querySelector(".trace-call") as HTMLElement;
    expect(row.textContent).not.toMatch(/affinity|Act \d/);
    expect(within(row).getByLabelText("50 results")).toBeTruthy();
  });
});
