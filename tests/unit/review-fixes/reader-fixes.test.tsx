// @vitest-environment jsdom
// Small fixes before the outside review (Daniel's brief of 2026-10-21, item 2): what the lay
// readers tripped on. Synthetic lineup; invented places.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BandChart } from "@/components/chart/band-chart";
import { billRows, editionRows } from "@/components/chart/chart-rows";
import { FestivalScreen } from "@/components/festival-screen";
import { MIN_LIFT } from "@/lib/assemble-lineup";
import { climbAfter } from "@/lib/lift-climb";
import { markLabel } from "@/lib/marks";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { venueHues } from "@/lib/venue-colours";
import { acts, FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(cleanup);

const [mid, opener] = SAGEBRUSH_SOUND.feeBands;
const chart = (band = mid, numbers: "place" | "climb" = "climb") =>
  render(
    <BandChart
      band={band}
      rows={billRows(
        band,
        acts,
        {},
        venueHues([], acts),
        0,
        undefined,
        numbers,
      )}
      sortKey="bill"
      motion={false}
      numbers={numbers}
    />,
  );

describe("the fee range, in plain words beside each band's name", () => {
  it("says what the range is: a percentile of Qloo popularity", () => {
    chart(mid);
    expect(document.querySelector(".fee-plain")!.textContent).toBe(
      "fee range: 80th–92nd percentile of Qloo popularity",
    );
    cleanup();
    chart(opener);
    expect(document.querySelector(".fee-plain")!.textContent).toBe(
      "fee range: 55th–80th percentile of Qloo popularity",
    );
  });
});

describe("why no act is at the top", () => {
  it("is said in one line under the key", () => {
    chart(mid);
    const key = document.querySelector(".numbers-key")!;
    const why = document.querySelector(".numbers-why")!;
    expect(why.textContent).toBe(
      "The top places go to acts the headliners' fans like anywhere; the lineup is the acts the venues push up.",
    );
    expect(
      key.compareDocumentPosition(why) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("isn't on a chart of places (Watch's editions)", () => {
    chart(mid, "place");
    expect(document.querySelector(".numbers-why")).toBeNull();
  });
});

describe("the climb is Qloo's ranking, never the AI agent's", () => {
  it("is named so in the key, the rule line, the mark a screen reader hears and the card", () => {
    chart(mid);
    expect(document.querySelector(".numbers-key")!.textContent).toBe(
      "places it climbed in Qloo's ranking with its venue's fans added",
    );
    cleanup();
    expect(markLabel(acts[0])).toBe(
      "With The Lantern Room's fans added: up 11 places in Qloo's ranking",
    );
    const fresh = acts.find((act) => /into the top/.test(act.reason))!;
    expect(markLabel(fresh)).toBe(
      "With The Lantern Room's fans added: new in Qloo's ranking, from outside the headliners-only ranking",
    );
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    // The rule key went with How an act gets on (WS12 items 1 and 7); the poster's rule line
    // says the climb the rule counts is Qloo's.
    expect(document.querySelector(".poster-rule")!.textContent).toContain(
      "places it rose in Qloo's ranking with that venue's fans",
    );
    // Its bar is in the three checks under the acts (WS18 item 1).
    expect(document.querySelector(".poster-checks")!.textContent).toContain(
      `It climbs at least ${MIN_LIFT} places with a town venue's fans`,
    );
    fireEvent.click(screen.getByRole("button", { name: acts[0].name }));
    expect(
      within(screen.getByRole("region", { name: "Act card" })).getByText(
        "Its place in Qloo's ranking",
      ),
    ).toBeTruthy();
  });

  it("is never called the agent's anywhere in the app's words", () => {
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory()
          ? files(path)
          : /\.(tsx?|css)$/.test(name)
            ? [path]
            : [];
      });
    for (const file of files("src"))
      expect(readFileSync(file, "utf8")).not.toMatch(
        /agent(&apos;|')s (own )?ranking|ranking of the (AI )?agent/i,
      );
  });
});

describe("Watch's editions", () => {
  const venue = { entityId: "venue-x", name: "The Lantern Room" };
  const artist = (id: string, popularity = 0.85) => ({
    entityId: id,
    name: `Act ${id}`,
    popularity,
    affinity: 0.5,
    tags: [],
  });
  const baseline = ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"].map(
    (id) => ({
      entityId: id,
    }),
  );

  it("mark an act from outside the headliners-only top 50 NEW, not a climb from 51st", () => {
    // The venue's list puts an act the headliners' list never had in third place.
    const run = ["b1", "b2", "fresh", "b3", "b4", "b5", "b6", "b7"].map((id) =>
      artist(id),
    );
    const step = climbAfter("mid", mid, venue, baseline, run);
    expect(step.acts[2]).toMatchObject({ entityId: "fresh", fresh: true });
    const rows = editionRows(step, acts, {}, new Map([[venue.entityId, 0]]));
    expect(rows[2]).toMatchObject({
      fresh: true,
      move: null,
      was: null,
      place: 3,
    });
    render(
      <BandChart band={mid} rows={rows} sortKey="edition" motion={false} />,
    );
    const row = screen.getByText("Act fresh").closest("li")!;
    expect(row.textContent).toMatch(/new/i);
    expect(row.textContent).toMatch(/not in top 50/);
    expect(row.textContent).not.toMatch(/was 51st|\+\d/);
  });
});
