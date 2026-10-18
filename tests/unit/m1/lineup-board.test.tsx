// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import fixture from "../../fixtures/lineup.synthetic.json";
import { ActCardPanel } from "@/components/act-card-panel";
import { BandChart } from "@/components/chart/band-chart";
import { billRows } from "@/components/chart/chart-rows";
import { type Act, LineupSchema } from "@/lib/lineup";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

afterEach(cleanup);

const { acts } = LineupSchema.parse(fixture);
const bands = SAGEBRUSH_SOUND.feeBands;

/**
 * The fee bands as the first screen lays them out: a chart per band with its acts, an open slot
 * for each one nothing fills, and an act's card opening under its row.
 */
function Board({ lineup }: { lineup: readonly Act[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div>
      {bands.map((band) => {
        const open = Math.max(
          0,
          band.slots - lineup.filter((act) => act.band === band.id).length,
        );
        return (
          <BandChart
            key={band.id}
            band={band}
            rows={billRows(band, lineup, {}, new Map(), open)}
            sortKey="bill"
            motion={false}
            openId={openId}
            onOpen={(act) =>
              setOpenId((current) =>
                current === act.entityId ? null : act.entityId,
              )
            }
          >
            {(act) => (
              <ActCardPanel
                act={act}
                unavailable={false}
                disabled={false}
                onClose={() => setOpenId(null)}
              />
            )}
          </BandChart>
        );
      })}
    </div>
  );
}

describe("The band charts with the synthetic lineup", () => {
  it("renders all 10 acts", () => {
    render(<Board lineup={acts} />);
    expect(screen.getAllByRole("article")).toHaveLength(10);
  });

  it("puts 4 acts under Mid-size acts and 6 under Opening acts", () => {
    render(<Board lineup={acts} />);
    const mid = screen.getByRole("region", { name: "Mid-size acts" });
    const opener = screen.getByRole("region", { name: "Opening acts" });
    expect(within(mid).getAllByRole("article")).toHaveLength(4);
    expect(within(opener).getAllByRole("article")).toHaveLength(6);
  });

  it("shows each act's Qloo affinity, popularity percentile, Why Boise line and two tags on its card", () => {
    render(<Board lineup={acts} />);
    fireEvent.click(screen.getByRole("button", { name: "Hollow Pines" }));
    const card = within(
      screen.getByRole("region", { name: "Act card" }),
    ).getByRole("article", { name: "Hollow Pines" });
    expect(within(card).getByText("0.94")).toBeTruthy();
    expect(within(card).getByText("91st")).toBeTruthy();
    expect(within(card).getByText("Why Boise:")).toBeTruthy();
    expect(
      within(card).getByText("The Lantern Room fans move it up 11 places."),
    ).toBeTruthy();
    const tags = within(card).getByRole("list", { name: /tags shared/i });
    expect(
      within(tags)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Dream Pop", "Psychedelic Rock"]);
  });

  it("names each band with its fee range and slot count, and explains the range on request", () => {
    render(<Board lineup={acts} />);
    const mid = within(screen.getByRole("region", { name: "Mid-size acts" }));
    const opener = within(screen.getByRole("region", { name: "Opening acts" }));
    expect(mid.getByRole("img", { name: "4 of 4 slots filled" })).toBeTruthy();
    expect(mid.getByText("80th–92nd")).toBeTruthy();
    expect(
      opener.getByRole("img", { name: "6 of 6 slots filled" }),
    ).toBeTruthy();
    expect(opener.getByText("55th–80th")).toBeTruthy();
    // The sentence behind the range waits for the "?".
    expect(screen.queryByText(/slots · fee range/)).toBeNull();
    fireEvent.click(
      mid.getByRole("button", {
        name: "What the fee range for mid-size acts means",
      }),
    );
    fireEvent.click(
      opener.getByRole("button", {
        name: "What the fee range for opening acts means",
      }),
    );
    expect(
      screen.getByText(
        /^4 slots · fee range \(Mid\):.*\(80th–92nd percentile\)$/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /^6 slots · fee range \(Opener\):.*\(55th–80th percentile\)$/,
      ),
    ).toBeTruthy();
  });
});

describe("The band charts before a build", () => {
  it("shows every slot open", () => {
    render(<Board lineup={[]} />);
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.getAllByText("Open slot")).toHaveLength(10);
    expect(
      screen.getByRole("img", { name: "0 of 4 slots filled" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "0 of 6 slots filled" }),
    ).toBeTruthy();
  });
});
