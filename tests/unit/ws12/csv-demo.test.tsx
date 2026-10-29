// @vitest-environment jsdom
// WS12 item 7 (WS8's item 17): a demo festival's CSV says it's the fictional demo festival in
// its file name and its first line, as its printed poster's stamp does; a judge's own festival's
// doesn't. Synthetic data: invented acts and venues, no Qloo data.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { csvFile, csvNote } from "@/components/share/print-words";
import { FestivalScreen } from "@/components/festival-screen";
import { lineupCsv } from "@/lib/csv";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { TOWNS } from "@/lib/towns";
import { acts, FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const HEADER =
  "act,band,affinity,popularity,anchor_venue,reason,replaces,unavailable_reason";

describe("the CSV of a demo festival (WS12 item 7)", () => {
  it("is named and headed as the fictional demo festival", () => {
    expect(csvFile(SAGEBRUSH_SOUND)).toBe(
      "sagebrush-sound-fictional-demo-festival-undercard.csv",
    );
    expect(csvFile(TOWNS[1].festival)).toBe(
      "sagebrush-sound-austin-fictional-demo-festival-undercard.csv",
    );
    expect(csvNote(SAGEBRUSH_SOUND)).toBe(
      "Fictional demo festival: Sagebrush Sound in Boise, Idaho, drafted by Undercard",
    );
  });

  it("keeps a judge's own festival's CSV as it was", () => {
    expect(csvFile({ id: "yours-draft-2" })).toBe(
      "yours-draft-2-undercard.csv",
    );
    expect(
      csvNote({
        id: "yours-draft-2",
        name: "Your festival",
        city: "Burlington",
        region: "Vermont",
      }),
    ).toBeNull();
  });

  it("sets the note as one cell on the first line, the header under it", () => {
    const [first, second] = lineupCsv(acts, SAGEBRUSH_SOUND.feeBands, {}, [], {
      note: csvNote(SAGEBRUSH_SOUND)!,
    }).split("\r\n");
    expect(first).toBe(
      '"Fictional demo festival: Sagebrush Sound in Boise, Idaho, drafted by Undercard"',
    );
    expect(second).toBe(HEADER);
  });

  it("downloads under that name, with that first line, from Export CSV", async () => {
    const blobs: Blob[] = [];
    const saved: string[] = [];
    Object.assign(URL, {
      createObjectURL: (blob: Blob) => {
        blobs.push(blob);
        return "blob:csv";
      },
      revokeObjectURL: () => {},
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push(this.download);
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toBe(
      "sagebrush-sound-fictional-demo-festival-undercard.csv",
    );
    const [first, second] = (await blobs[0].text()).split("\r\n");
    expect(first).toMatch(/^"Fictional demo festival: /);
    expect(second).toBe(HEADER);
  });
});
