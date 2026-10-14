import { describe, expect, it } from "vitest";
import { feeBandFor } from "@/lib/fee-bands";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

const bands = SAGEBRUSH_SOUND.feeBands;
const bandId = (popularity: number) =>
  feeBandFor(popularity, bands)?.id ?? null;

describe("feeBandFor", () => {
  it("maps the Mid band's edges, 0.80 and 0.92, to Mid", () => {
    expect(bandId(0.8)).toBe("mid");
    expect(bandId(0.92)).toBe("mid");
  });

  it("leaves popularity above Mid's top edge unbanded (headliner territory)", () => {
    expect(bandId(0.9201)).toBeNull();
    expect(bandId(1)).toBeNull();
  });

  it("maps the Opener band's edges, 0.55 and just under 0.80, to Opener", () => {
    expect(bandId(0.55)).toBe("opener");
    expect(bandId(0.7999)).toBe("opener");
  });

  it("gives the shared 0.80 edge to the higher band", () => {
    expect(bandId(0.8)).toBe("mid");
  });

  it("leaves popularity below Opener's bottom edge unbanded", () => {
    expect(bandId(0.5499)).toBeNull();
    expect(bandId(0)).toBeNull();
  });

  it("maps values inside each band", () => {
    expect(bandId(0.86)).toBe("mid");
    expect(bandId(0.67)).toBe("opener");
  });

  it("rejects values that are not percentiles", () => {
    expect(bandId(Number.NaN)).toBeNull();
    expect(bandId(-0.1)).toBeNull();
    expect(bandId(1.5)).toBeNull();
  });

  it("does not depend on the order the bands are listed in", () => {
    const reversed = [...bands].reverse();
    expect(feeBandFor(0.8, reversed)?.id).toBe("mid");
    expect(feeBandFor(0.55, reversed)?.id).toBe("opener");
  });
});
