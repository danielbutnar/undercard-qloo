import { describe, expect, it } from "vitest";
import { presaleSeries } from "@/lib/presale";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { ticketsSold } from "@/lib/festival";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("Sagebrush Sound", () => {
  it("is the seeded festival in Boise, Idaho", () => {
    expect(SAGEBRUSH_SOUND.name).toBe("Sagebrush Sound");
    expect(SAGEBRUSH_SOUND.city).toBe("Boise");
    expect(SAGEBRUSH_SOUND.region).toBe("Idaho");
    expect(SAGEBRUSH_SOUND.capacity).toBe(3000);
    expect(SAGEBRUSH_SOUND.crowdAge).toEqual({ min: 25, max: 34 });
  });

  it("stores its two booked headliners as names only", () => {
    expect(SAGEBRUSH_SOUND.headliners).toHaveLength(2);
    for (const headliner of SAGEBRUSH_SOUND.headliners) {
      expect(typeof headliner).toBe("string");
      expect(headliner.trim()).not.toBe("");
    }
  });

  it("has the buyer's Mid and Opener fee bands", () => {
    expect(SAGEBRUSH_SOUND.feeBands).toEqual([
      {
        id: "mid",
        label: "Mid",
        minPopularity: 0.8,
        maxPopularity: 0.92,
        slots: 4,
      },
      {
        id: "opener",
        label: "Opener",
        minPopularity: 0.55,
        maxPopularity: 0.8,
        slots: 6,
      },
    ]);
  });

  it("has 30 consecutive days of presale counts within capacity", () => {
    const { presale, capacity } = SAGEBRUSH_SOUND;
    expect(presale).toHaveLength(30);
    presale.forEach((day, index) => {
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isInteger(day.sold)).toBe(true);
      expect(day.sold).toBeGreaterThanOrEqual(0);
      if (index > 0) {
        const gap = Date.parse(day.date) - Date.parse(presale[index - 1].date);
        expect(gap).toBe(DAY_MS);
      }
    });
    expect(ticketsSold(presale)).toBeGreaterThan(0);
    expect(ticketsSold(presale)).toBeLessThanOrEqual(capacity);
  });
});

describe("presaleSeries", () => {
  const options = {
    seed: 7,
    startDate: "2026-09-16",
    days: 30,
    capacity: 3000,
  };

  it("returns identical data for the same seed", () => {
    expect(presaleSeries(options)).toEqual(presaleSeries(options));
  });

  it("returns different data for a different seed", () => {
    expect(presaleSeries({ ...options, seed: 8 })).not.toEqual(
      presaleSeries(options),
    );
  });

  it("starts on the start date and runs for the requested days", () => {
    const series = presaleSeries(options);
    expect(series[0].date).toBe("2026-09-16");
    expect(series.at(-1)?.date).toBe("2026-10-15");
  });
});
