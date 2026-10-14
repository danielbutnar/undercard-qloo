import { describe, expect, it } from "vitest";
import {
  formatAffinity,
  formatBandRange,
  formatCount,
  formatPercentile,
  formatShortDate,
} from "@/lib/format";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

describe("formatPercentile", () => {
  it("writes a popularity percentile as an ordinal", () => {
    expect(formatPercentile(0.91)).toBe("91st");
    expect(formatPercentile(0.82)).toBe("82nd");
    expect(formatPercentile(0.63)).toBe("63rd");
    expect(formatPercentile(0.74)).toBe("74th");
  });

  it("uses th for 11, 12 and 13", () => {
    expect(formatPercentile(0.11)).toBe("11th");
    expect(formatPercentile(0.12)).toBe("12th");
    expect(formatPercentile(0.13)).toBe("13th");
  });

  it("rounds down, so an Opener act just under 0.80 never reads 80th", () => {
    expect(formatPercentile(0.7999)).toBe("79th");
    expect(formatPercentile(0.57)).toBe("57th");
  });
});

describe("number and date formats", () => {
  it("formats affinity to two decimals", () => {
    expect(formatAffinity(0.9)).toBe("0.90");
  });

  it("formats counts with thousands separators", () => {
    expect(formatCount(3000)).toBe("3,000");
  });

  it("formats a band's range as percentiles", () => {
    const [mid, opener] = SAGEBRUSH_SOUND.feeBands;
    expect(formatBandRange(mid)).toBe("80th–92nd");
    expect(formatBandRange(opener)).toBe("55th–80th");
  });

  it("formats an ISO date as a short UTC date", () => {
    expect(formatShortDate("2026-09-16")).toBe("Sep 16");
  });
});
