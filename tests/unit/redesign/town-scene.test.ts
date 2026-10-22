// WS9, step 3: the town scene's geometry. Venues come from the saved build (invented ids here);
// the plain buildings are drawn from the town's seed, so a town always looks the same.
import { describe, expect, it } from "vitest";
import {
  between,
  fitZoom,
  focus,
  HALF,
  MAX_VENUES,
  nearSpin,
  overview,
  project,
  sceneBounds,
  sceneSeed,
  signPoint,
  startSpin,
  townBoxes,
  worldTransform,
  type Camera,
} from "@/lib/town-scene";

const VENUES = ["venue-a", "venue-b", "venue-c"];
const LAPTOP = { w: 820, h: 560 };
const PHONE = { w: 352, h: 400 };

describe("the town's buildings", () => {
  it("draws the same town from the same key, and another from another", () => {
    expect(townBoxes(VENUES, "sagebrush-sound")).toEqual(
      townBoxes(VENUES, "sagebrush-sound"),
    );
    expect(townBoxes(VENUES, "sagebrush-sound-austin")).not.toEqual(
      townBoxes(VENUES, "sagebrush-sound"),
    );
    expect(sceneSeed("a")).not.toBe(sceneSeed("b"));
  });

  it("stands each venue once, on a block of its own, inside the plate", () => {
    const boxes = townBoxes(VENUES, "sagebrush-sound");
    const venues = boxes.filter((box) => box.venue !== null);
    expect(venues.map((box) => box.venue)).toEqual(
      expect.arrayContaining(VENUES),
    );
    expect(venues).toHaveLength(3);
    const blocks = venues.map(
      (box) =>
        `${Math.floor((box.x + 300) / 216)},${Math.floor((box.y + 300) / 216)}`,
    );
    expect(new Set(blocks).size).toBe(3);
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(-HALF);
      expect(box.y).toBeGreaterThanOrEqual(-HALF);
      expect(box.x + box.w).toBeLessThanOrEqual(HALF);
      expect(box.y + box.d).toBeLessThanOrEqual(HALF);
      expect(box.h).toBeGreaterThan(0);
    }
    // The first venue stands in front: the block nearest the viewer at the start.
    const first = venues.find((box) => box.venue === "venue-a")!;
    expect(first.y).toBeGreaterThan(100);
  });

  it("stands at most one venue per block", () => {
    const many = Array.from({ length: 12 }, (_, i) => `venue-${i}`);
    const venues = townBoxes(many, "t").filter((box) => box.venue !== null);
    expect(venues).toHaveLength(MAX_VENUES);
    expect(townBoxes([], "t").every((box) => box.venue === null)).toBe(true);
  });
});

describe("the camera", () => {
  const boxes = townBoxes(VENUES, "sagebrush-sound");

  it("projects the point it looks at onto the viewport's centre plus its offset", () => {
    const cam: Camera = {
      spin: -32,
      tilt: 58,
      zoom: 0.7,
      fx: 40,
      fy: -20,
      ox: 30,
      oy: -10,
    };
    const p = project(40, -20, 0, cam, LAPTOP);
    expect(p.x).toBeCloseTo(LAPTOP.w / 2 + 30, 6);
    expect(p.y).toBeCloseTo(LAPTOP.h / 2 - 10, 6);
    expect(p.k).toBeCloseTo(1, 6);
  });

  it("brings higher points nearer the viewer", () => {
    const cam = overview(boxes, LAPTOP);
    const low = project(0, 0, 0, cam, LAPTOP);
    const high = project(0, 0, 80, cam, LAPTOP);
    expect(high.k).toBeGreaterThan(low.k);
    expect(high.y).toBeLessThan(low.y);
  });

  it("fits the whole town in the overview, on a laptop and on a phone", () => {
    for (const vp of [LAPTOP, PHONE]) {
      const cam = overview(boxes, vp);
      const b = sceneBounds(boxes, cam, vp);
      expect(b.x0).toBeGreaterThanOrEqual(-1);
      expect(b.x1).toBeLessThanOrEqual(vp.w + 1);
      expect(b.y0).toBeGreaterThanOrEqual(0);
      expect(b.y1).toBeLessThanOrEqual(vp.h);
      expect((b.x0 + b.x1) / 2).toBeCloseTo(vp.w / 2, 0);
      expect(cam.spin).toBe(startSpin(vp));
    }
    expect(startSpin(PHONE)).not.toBe(startSpin(LAPTOP));
  });

  it("zooms in no further than the town fits", () => {
    const zoom = fitZoom(boxes, { spin: -32, tilt: 58 }, LAPTOP);
    const fitted = sceneBounds(
      boxes,
      { spin: -32, tilt: 58, zoom, fx: 0, fy: 0, ox: 0, oy: 0 },
      LAPTOP,
    );
    const over = sceneBounds(
      boxes,
      { spin: -32, tilt: 58, zoom: zoom * 1.1, fx: 0, fy: 0, ox: 0, oy: 0 },
      LAPTOP,
    );
    expect(fitted.x1 - fitted.x0).toBeLessThanOrEqual(LAPTOP.w * 0.9 + 0.5);
    expect(
      over.x1 - over.x0 > LAPTOP.w * 0.9 || over.y1 - over.y0 > LAPTOP.h * 0.74,
    ).toBe(true);
  });

  it("closes on a venue, nearer than the overview, and on none it doesn't stand", () => {
    const wide = overview(boxes, LAPTOP);
    const close = focus(boxes, "venue-b", LAPTOP, wide.spin)!;
    expect(close.zoom).toBeGreaterThan(wide.zoom);
    const venue = boxes.find((box) => box.venue === "venue-b")!;
    const at = project(...signPoint(venue), close, LAPTOP);
    expect(at.x).toBeLessThan(LAPTOP.w / 2);
    expect(focus(boxes, "nowhere", LAPTOP, wide.spin)).toBeNull();
  });

  it("glides the short way round, and ends where it was sent", () => {
    expect(nearSpin(170, -170)).toBe(190);
    expect(nearSpin(-10, 10)).toBe(10);
    const from = overview(boxes, LAPTOP);
    const to = { ...from, spin: from.spin + 45, zoom: from.zoom * 1.3 };
    expect(between(from, to, 0)).toEqual(from);
    expect(between(from, to, 1).spin).toBeCloseTo(to.spin, 9);
    expect(between(from, to, 1).zoom).toBeCloseTo(to.zoom, 9);
    const half = between(from, to, 0.5);
    expect(half.spin).toBeCloseTo(from.spin + 22.5, 6);
  });

  it("writes the world's transform for the camera", () => {
    expect(
      worldTransform({
        spin: -32,
        tilt: 58,
        zoom: 0.5,
        fx: 10,
        fy: -4,
        ox: 0,
        oy: 0,
      }),
    ).toBe(
      "scale3d(0.5000, 0.5000, 0.5000) rotateX(58.000deg) rotateZ(-32.000deg) translate3d(-10.00px, 4.00px, 0px)",
    );
  });
});
