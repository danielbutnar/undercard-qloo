/**
 * The town on the first screen (WS9, "Your town prints your poster"): a small isometric town on
 * a plate, its venues standing on their own blocks among plain buildings, drawn with CSS 3D
 * transforms. This module is the geometry only: where each building stands, how the camera
 * projects a point onto the viewport, and the camera's overview and close-up. The venues come
 * from the saved build; the plain buildings are drawn from a seed so a town always looks the same.
 */

/** The plate's side, its half and its thickness, in world units (CSS pixels at zoom 1). */
export const PLATE = 624;
export const HALF = PLATE / 2;
export const PLATE_H = 16;
/** The viewport's CSS perspective. */
export const PERSPECTIVE = 1500;

/** A building: a venue's, by its entity id, or a plain one (null). */
export interface Box {
  venue: string | null;
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
}

export interface Camera {
  /** Turn about the vertical, in degrees. */
  spin: number;
  /** Tilt from flat, in degrees. */
  tilt: number;
  zoom: number;
  /** The world point the camera looks at. */
  fx: number;
  fy: number;
  /** Where that point sits, offset from the viewport's centre, in CSS pixels. */
  ox: number;
  oy: number;
}

export interface Viewport {
  w: number;
  h: number;
}

/** A phone's viewport: the scene frames itself tighter and turns less. */
export const narrowView = (vp: Viewport) => vp.w < 560;

/** A 32-bit seed from a key (FNV-1a), so each town draws its own plain buildings. */
export function sceneSeed(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** A small seeded generator (mulberry32): numbers in [0, 1). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The town's 3 by 3 blocks, in the order venues take them: the first one, in front. */
const BLOCKS: readonly [number, number][] = [
  [0, 2],
  [2, 0],
  [1, 1],
  [2, 2],
  [0, 0],
  [1, 0],
  [2, 1],
  [0, 1],
  [1, 2],
];
/** A block's side, the road between blocks, and the first block's corner. */
const BLOCK = 168;
const STEP = 216;
const ORIGIN = -300;

/** The most venues a town stands: one per block. */
export const MAX_VENUES = BLOCKS.length;

/**
 * The town's buildings: each venue on a block of its own, in the order given (the first in front),
 * and two by two lots of plain buildings on every other block, drawn from the key's seed.
 */
export function townBoxes(venueIds: readonly string[], key: string): Box[] {
  const random = seeded(sceneSeed(key));
  const tallest = 44 + Math.floor(random() * 16);
  const venueAt = new Map<string, string>();
  venueIds.slice(0, MAX_VENUES).forEach((id, index) => {
    const [bx, by] = BLOCKS[index];
    venueAt.set(`${bx},${by}`, id);
  });
  const boxes: Box[] = [];
  for (let by = 0; by < 3; by++)
    for (let bx = 0; bx < 3; bx++) {
      const ox = ORIGIN + bx * STEP;
      const oy = ORIGIN + by * STEP;
      const venue = venueAt.get(`${bx},${by}`);
      if (venue) {
        const w = 104 + Math.floor(random() * 24);
        const d = Math.round(w * 0.82);
        const h = 62 + Math.floor(random() * 16);
        boxes.push({
          venue,
          x: ox + Math.round((BLOCK - w) / 2),
          y: oy + Math.round((BLOCK - d) / 2),
          w,
          d,
          h,
        });
        continue;
      }
      for (let ly = 0; ly < 2; ly++)
        for (let lx = 0; lx < 2; lx++) {
          if (random() < 0.22) continue;
          const w = 38 + Math.round(random() * 36);
          const d = 38 + Math.round(random() * 36);
          const h = 12 + Math.round(random() * (tallest - 12));
          boxes.push({
            venue: null,
            x: ox + 4 + lx * 82 + Math.round(random() * (78 - w)),
            y: oy + 4 + ly * 82 + Math.round(random() * (78 - d)),
            w,
            d,
            h,
          });
        }
    }
  return boxes;
}

/** Where a world point lands in the viewport, and how much nearer it sits (k > 1). */
export function project(
  X: number,
  Y: number,
  Z: number,
  cam: Camera,
  vp: Viewport,
): { x: number; y: number; k: number } {
  const r = (cam.spin * Math.PI) / 180;
  const t = (cam.tilt * Math.PI) / 180;
  const dx = X - cam.fx;
  const dy = Y - cam.fy;
  const x1 = Math.cos(r) * dx - Math.sin(r) * dy;
  const y1 = Math.sin(r) * dx + Math.cos(r) * dy;
  const y2 = Math.cos(t) * y1 - Math.sin(t) * Z;
  const z2 = Math.sin(t) * y1 + Math.cos(t) * Z;
  const px = vp.w / 2 + cam.ox + cam.zoom * x1;
  const py = vp.h / 2 + cam.oy + cam.zoom * y2;
  const k = PERSPECTIVE / (PERSPECTIVE - cam.zoom * z2);
  return {
    x: vp.w / 2 + (px - vp.w / 2) * k,
    y: vp.h / 2 + (py - vp.h / 2) * k,
    k,
  };
}

/** A venue's top centre, where its sign hangs. */
export const signPoint = (box: Box): [number, number, number] => [
  box.x + box.w / 2,
  box.y + box.d / 2,
  PLATE_H + box.h,
];

/** The town's outline on screen: the plate's corners and every building's roof. */
export function sceneBounds(boxes: readonly Box[], cam: Camera, vp: Viewport) {
  const points: [number, number, number][] = [];
  for (const [x, y] of [
    [-HALF, -HALF],
    [HALF, -HALF],
    [HALF, HALF],
    [-HALF, HALF],
  ]) {
    points.push([x, y, 0], [x, y, PLATE_H]);
  }
  for (const box of boxes) {
    const z = PLATE_H + box.h;
    points.push(
      [box.x, box.y, z],
      [box.x + box.w, box.y, z],
      [box.x, box.y + box.d, z],
      [box.x + box.w, box.y + box.d, z],
    );
  }
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [X, Y, Z] of points) {
    const p = project(X, Y, Z, cam, vp);
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y);
    y1 = Math.max(y1, p.y);
  }
  return { x0, x1, y0, y1 };
}

/** The largest zoom at which the whole town fits the viewport, for the camera's turn and tilt. */
export function fitZoom(
  boxes: readonly Box[],
  base: Pick<Camera, "spin" | "tilt">,
  vp: Viewport,
): number {
  const narrow = narrowView(vp);
  const room = {
    w: vp.w * (narrow ? 1 : 0.9),
    h: vp.h * (narrow ? 0.62 : 0.74),
  };
  let lo = 0.2;
  let hi = 3;
  for (let i = 0; i < 20; i++) {
    const zoom = (lo + hi) / 2;
    const b = sceneBounds(
      boxes,
      { ...base, zoom, fx: 0, fy: 0, ox: 0, oy: 0 },
      vp,
    );
    if (b.x1 - b.x0 <= room.w && b.y1 - b.y0 <= room.h) lo = zoom;
    else hi = zoom;
  }
  return lo;
}

/** The turn a camera starts at: less on a phone, so the town reads across its width. */
export const startSpin = (vp: Viewport) => (narrowView(vp) ? -14 : -32);

/** The whole town, fitted and centred a little low, under the scene's legend and controls. */
export function overview(
  boxes: readonly Box[],
  vp: Viewport,
  spin: number = startSpin(vp),
): Camera {
  const narrow = narrowView(vp);
  const base = { spin, tilt: 58 };
  const zoom = fitZoom(boxes, base, vp);
  const cam: Camera = { ...base, zoom, fx: 0, fy: 0, ox: 0, oy: 0 };
  const b = sceneBounds(boxes, cam, vp);
  return {
    ...cam,
    ox: vp.w * 0.5 - (b.x0 + b.x1) / 2,
    oy: vp.h * (narrow ? 0.47 : 0.565) - (b.y0 + b.y1) / 2,
  };
}

/**
 * Close on one venue: tilted lower and nearer, the venue left of centre on a laptop (the card
 * opens on the right) and low on a phone. Null for a venue the town doesn't stand.
 */
export function focus(
  boxes: readonly Box[],
  venueId: string,
  vp: Viewport,
  spin: number,
): Camera | null {
  const box = boxes.find((entry) => entry.venue === venueId);
  if (!box) return null;
  const narrow = narrowView(vp);
  const zoom = fitZoom(boxes, { spin, tilt: 50 }, vp) * (narrow ? 1.25 : 1.45);
  return {
    spin,
    tilt: 50,
    zoom,
    fx: box.x + box.w / 2,
    fy: box.y + box.d / 2,
    ox: narrow ? 0 : -vp.w * 0.2,
    oy: vp.h * (narrow ? 0.24 : 0.1),
  };
}

/** The turn nearest `from` that faces the same way as `to`, so a glide never spins the long way. */
export function nearSpin(from: number, to: number): number {
  return from + ((((to - from) % 360) + 540) % 360) - 180;
}

/** A glide's easing: slow in, slow out (cubic). */
export const easeInOut = (u: number) =>
  u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;

/** A camera part way from one to another, `u` from 0 to 1. */
export function between(from: Camera, to: Camera, u: number): Camera {
  const e = easeInOut(Math.max(0, Math.min(1, u)));
  const at = (a: number, b: number) => a + (b - a) * e;
  return {
    spin: at(from.spin, nearSpin(from.spin, to.spin)),
    tilt: at(from.tilt, to.tilt),
    zoom: at(from.zoom, to.zoom),
    fx: at(from.fx, to.fx),
    fy: at(from.fy, to.fy),
    ox: at(from.ox, to.ox),
    oy: at(from.oy, to.oy),
  };
}

/** The world's CSS transform for a camera (its offsets go on the world's left and top). */
export const worldTransform = (cam: Camera) => {
  const z = cam.zoom.toFixed(4);
  return `scale3d(${z}, ${z}, ${z}) rotateX(${cam.tilt.toFixed(3)}deg) rotateZ(${cam.spin.toFixed(3)}deg) translate3d(${(-cam.fx).toFixed(2)}px, ${(-cam.fy).toFixed(2)}px, 0px)`;
};
