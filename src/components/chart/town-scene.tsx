"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  between,
  focus,
  narrowView,
  overview,
  PLATE,
  PLATE_H,
  project,
  signPoint,
  startSpin,
  townBoxes,
  worldTransform,
  type Box,
  type Camera,
  type Viewport,
} from "@/lib/town-scene";
import { signChip } from "./poster-words";

/** A venue the build read, as the town stands it. */
export interface SceneVenue {
  entityId: string;
  name: string;
  /** Its colour on the poster; null while its fans lift no act (it stands grey). */
  hue: number | null;
  /** Acts on the poster its fans lifted, as the poster stands. */
  lifted: number;
  /** Its fans are switched off. */
  off: boolean;
  /** Watch hasn't read it yet. */
  unread: boolean;
}

/** A venue's name on its sign: Qloo's listing without a bracketed note. */
export const signName = (name: string) =>
  name.replace(/\s*\([^)]*\)/g, "").trim() || name;

type Kind = "lit" | "dark" | "unread" | "ghost" | "plain";

// A face of a building: its place on the building's footprint and how it stands up.
interface Face {
  side: "top" | "s" | "n" | "e" | "w";
  l: number;
  t: number;
  w: number;
  h: number;
  tf: string;
  door: boolean;
}

function facesOf(box: Pick<Box, "w" | "d" | "h">): Face[] {
  const { w, d, h } = box;
  return [
    { side: "top", l: 0, t: 0, w, h: d, tf: `translateZ(${h}px)`, door: false },
    { side: "s", l: 0, t: d - h, w, h, tf: "rotateX(-90deg)", door: true },
    {
      side: "n",
      l: 0,
      t: -h,
      w,
      h,
      tf: "rotateZ(180deg) rotateX(-90deg)",
      door: false,
    },
    {
      side: "e",
      l: w - d / 2,
      t: d / 2 - h,
      w: d,
      h,
      tf: "rotateZ(-90deg) rotateX(-90deg)",
      door: false,
    },
    {
      side: "w",
      l: -d / 2,
      t: d / 2 - h,
      w: d,
      h,
      tf: "rotateZ(90deg) rotateX(-90deg)",
      door: true,
    },
  ];
}

const PLATE_FACES = facesOf({ w: PLATE, d: PLATE, h: PLATE_H });

/** The town's buildings: drawn once per look, so a camera glide only moves the world. */
const Buildings = memo(function Buildings({
  boxes,
  kinds,
  hues,
  up,
}: {
  boxes: readonly Box[];
  kinds: ReadonlyMap<string, Kind>;
  hues: ReadonlyMap<string, number | null>;
  up: boolean;
}) {
  return (
    <>
      {boxes.map((box, index) => {
        const kind = box.venue ? (kinds.get(box.venue) ?? "dark") : "plain";
        const hue = box.venue ? hues.get(box.venue) : null;
        return (
          <div
            key={`${box.x},${box.y}`}
            className={`town-box town-box-${kind} ${kind === "lit" && hue != null ? `venue-${hue}` : ""}`}
            style={{
              left: box.x,
              top: box.y,
              width: box.w,
              height: box.d,
              transform: up ? "scale3d(1, 1, 1)" : "scale3d(1, 1, 0.02)",
              transitionDuration: up ? "720ms" : "260ms",
              transitionDelay: up ? `${60 + index * 26}ms` : "0ms",
            }}
          >
            {facesOf(box).map((face) => (
              <div
                key={face.side}
                className={`town-face town-face-${face.side} ${face.door && box.venue ? "town-door" : ""}`}
                style={{
                  left: face.l,
                  top: face.t,
                  width: face.w,
                  height: face.h,
                  transform: face.tf,
                }}
              />
            ))}
          </div>
        );
      })}
    </>
  );
});

const REDUCED = "(prefers-reduced-motion: reduce)";
const reducedNow = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.(REDUCED)?.matches === true;

/**
 * The town (WS9, "Your town prints your poster"): the build's venues on a small isometric town
 * in CSS 3D, each lit in its colour when its fans lifted acts onto the poster, grey when they
 * lifted none, with a sign naming it and its acts. Drag or the buttons turn it; a sign picks its
 * venue. The camera closes on `focusOn` (the venue Watch reads, or the one picked) and stands
 * back to the whole town without one. Watch's button sits over it from the screen's grid.
 */
export function TownScene({
  seedKey,
  venues,
  selected,
  focusOn,
  onPick,
  without = false,
  dim = false,
  pulses = {},
  interactive = true,
  overlay,
  reserve = {},
  narrowHint = "Swipe to turn the town",
  wideHint = "Drag to turn the town",
}: {
  /** The town's own seed (its festival id), so its plain buildings always stand the same. */
  seedKey: string;
  /** In the order they stand: the first in front. */
  venues: readonly SceneVenue[];
  selected: string | null;
  /** The venue the camera closes on; null for the whole town. */
  focusOn: string | null;
  onPick?: (venueId: string | null) => void;
  /** Without Qloo: no venue is read, so the town stands pale under a veil. */
  without?: boolean;
  /** Watch is playing: the camera is Watch's, so the controls wait. */
  dim?: boolean;
  /** A count per venue: each bump sends a ring out from it (a read, a pick). */
  pulses?: Readonly<Record<string, number>>;
  interactive?: boolean;
  /** What sits over the town: Watch's caption, a card, Without Qloo's note. */
  overlay?: ReactNode;
  /**
   * Where things the screen sets over the town stand, in CSS pixels, so no sign hides under them:
   * a band along the top (Watch's caption), one down the right (a card) and a corner at the
   * bottom left (Watch's own button, from the screen's grid).
   */
  reserve?: { top?: number; right?: number; corner?: { w: number; h: number } };
  narrowHint?: string;
  wideHint?: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState<Viewport | null>(null);
  const [cam, setCam] = useState<Camera | null>(null);
  const [up, setUp] = useState(false);
  const camRef = useRef<Camera | null>(null);
  const frame = useRef(0);
  const drag = useRef<{
    x: number;
    y: number;
    spin: number;
    tilt: number;
    moved: boolean;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const ids = useMemo(() => venues.map((venue) => venue.entityId), [venues]);
  const idKey = ids.join(",");
  // The venues' order is fixed for a build; a new order is a new town.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the ids' joined order
  const boxes = useMemo(() => townBoxes(ids, seedKey), [idKey, seedKey]);

  const show = useCallback((next: Camera) => {
    camRef.current = next;
    setCam(next);
  }, []);

  const glide = useCallback(
    (to: Camera, ms: number) => {
      cancelAnimationFrame(frame.current);
      const from = camRef.current;
      if (!from || ms <= 0 || reducedNow()) {
        show(to);
        return;
      }
      const started = performance.now();
      const step = (now: number) => {
        const u = Math.min(1, (now - started) / ms);
        show(between(from, to, u));
        if (u < 1) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    },
    [show],
  );

  // The viewport's size, measured on the client: the server's HTML stands the town hidden.
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => {
      const w = element.clientWidth;
      const h = element.clientHeight;
      if (!w || !h) return;
      setVp((current) =>
        current && current.w === w && current.h === h ? current : { w, h },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // First sight: the town rises and the camera settles on the whole of it.
  const first = useRef(true);
  useEffect(() => {
    if (!vp) return;
    // While Watch plays on a laptop, the venue it reads stands right of its button and under its
    // caption, a little further off so the whole building shows.
    const at =
      dim && !narrowView(vp) ? { x: 0.58, y: 0.66, zoom: 1.2 } : undefined;
    const target = focusOn
      ? (focus(boxes, focusOn, vp, camRef.current?.spin ?? startSpin(vp), at) ??
        overview(boxes, vp, camRef.current?.spin))
      : overview(
          boxes,
          vp,
          first.current ? startSpin(vp) : camRef.current?.spin,
        );
    if (first.current) {
      first.current = false;
      show({ ...target, zoom: target.zoom * 0.8 });
      const rise = setTimeout(() => setUp(true), reducedNow() ? 0 : 90);
      glide(target, 1900);
      return () => clearTimeout(rise);
    }
    glide(target, focusOn ? 1000 : 900);
    // A drag or a button moves the camera between these; this answers the venue and the size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp, focusOn, boxes]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Each bump of a venue's count sends one ring out from it, gone after two beats.
  const [rings, setRings] = useState<{ venue: string; n: number }[]>([]);
  const seen = useRef<Record<string, number>>({});
  useEffect(() => {
    const fresh = Object.entries(pulses).filter(
      ([venue, n]) => (seen.current[venue] ?? 0) < n,
    );
    seen.current = { ...pulses };
    if (fresh.length === 0 || reducedNow()) return;
    setRings((current) => [
      ...current,
      ...fresh.map(([venue, n]) => ({ venue, n })),
    ]);
    const done = setTimeout(
      () =>
        setRings((current) =>
          current.filter(
            (ring) =>
              !fresh.some(([venue, n]) => ring.venue === venue && ring.n === n),
          ),
        ),
      2600,
    );
    return () => clearTimeout(done);
  }, [pulses]);

  const kinds = useMemo(() => {
    const map = new Map<string, Kind>();
    for (const venue of venues)
      map.set(
        venue.entityId,
        without
          ? "ghost"
          : venue.unread
            ? "unread"
            : venue.off || venue.hue === null || venue.lifted === 0
              ? "dark"
              : "lit",
      );
    return map;
  }, [venues, without]);
  const hues = useMemo(
    () => new Map(venues.map((venue) => [venue.entityId, venue.hue])),
    [venues],
  );

  const narrow = vp ? narrowView(vp) : false;
  const busy = dim || without || !interactive;

  function turn(by: number) {
    const now = camRef.current;
    if (!now || busy) return;
    glide({ ...now, spin: now.spin + by }, 520);
  }
  function zoom(by: number) {
    const now = camRef.current;
    if (!now || busy) return;
    glide({ ...now, zoom: Math.max(0.25, Math.min(4, now.zoom * by)) }, 520);
  }
  function whole() {
    if (!vp || busy) return;
    onPick?.(null);
    glide(overview(boxes, vp), 800);
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || busy || !camRef.current) return;
    if ((event.target as Element).closest?.("button, a, [role=dialog]")) return;
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      spin: camRef.current.spin,
      tilt: camRef.current.tilt,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || !camRef.current) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    if (!start.moved) {
      start.moved = true;
      cancelAnimationFrame(frame.current);
      setDragging(true);
    }
    show({
      ...camRef.current,
      spin: start.spin + dx * 0.4,
      tilt: Math.max(30, Math.min(74, start.tilt - dy * 0.25)),
    });
  }
  function release() {
    drag.current = null;
    setDragging(false);
  }

  const boxOf = (id: string) => boxes.find((box) => box.venue === id);
  // Where the controls stand at the bottom right, and what the screen sets over the town.
  const zones =
    vp === null
      ? []
      : [
          {
            x0: vp.w - 12 - (narrow ? 144 : 244) - 8,
            y0: vp.h - 12 - 44 - 6 - 24 - 6,
            x1: vp.w,
            y1: vp.h,
          },
          ...(reserve.top ? [{ x0: 0, y0: 0, x1: vp.w, y1: reserve.top }] : []),
          ...(reserve.right
            ? [{ x0: vp.w - reserve.right, y0: 0, x1: vp.w, y1: vp.h }]
            : []),
          ...(reserve.corner
            ? [
                {
                  x0: 0,
                  y0: vp.h - reserve.corner.h,
                  x1: reserve.corner.w,
                  y1: vp.h,
                },
              ]
            : []),
        ];
  const signs =
    cam && vp && !without
      ? venues.flatMap((venue) => {
          const box = boxOf(venue.entityId);
          if (!box) return [];
          const p = project(...signPoint(box), cam, vp);
          const outside = p.x < 0 || p.x > vp.w || p.y < 24 || p.y > vp.h + 4;
          if (outside) return [];
          // The sign's box, as it stands over its pole: name and chip, then the pole.
          const size = narrow ? 12 : 17;
          const chip = signChip({
            lifted: venue.lifted,
            off: venue.off,
            unread: venue.unread,
          });
          const w =
            signName(venue.name).length * size * 0.5 + 24 + chip.length * 7.2 + 22;
          const h = size + 11 + 6 + 14;
          const covered =
            selected !== venue.entityId &&
            zones.some(
              (zone) =>
                p.x + w / 2 > zone.x0 &&
                p.x - w / 2 < zone.x1 &&
                p.y > zone.y0 &&
                p.y - h < zone.y1,
            );
          return covered ? [] : [{ venue, x: p.x, y: p.y - 4, k: p.k }];
        })
      : [];

  return (
    <div
      ref={viewport}
      className={`town-view ${without ? "is-without" : ""} ${dragging ? "is-dragging" : ""} ${cam ? "" : "is-unmeasured"}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {cam && (
        <div
          className="town-world"
          style={{
            left: `calc(50% + ${cam.ox.toFixed(1)}px)`,
            top: `calc(50% + ${cam.oy.toFixed(1)}px)`,
            transform: worldTransform(cam),
          }}
          aria-hidden
        >
          <div className="town-plate">
            {PLATE_FACES.map((face) => (
              <div
                key={face.side}
                className={`town-face town-plate-${face.side}`}
                style={{
                  left: face.l,
                  top: face.t,
                  width: face.w,
                  height: face.h,
                  transform: face.tf,
                }}
              />
            ))}
          </div>
          <div className="town-ground">
            {rings.map((ring) => {
              const box = boxOf(ring.venue);
              const hue = hues.get(ring.venue);
              return box ? (
                <div
                  key={`${ring.venue}-${ring.n}`}
                  className={`town-ring ${hue != null ? `venue-${hue}` : ""}`}
                  style={{
                    left: box.x + box.w / 2 - 80,
                    top: box.y + box.d / 2 - 80,
                  }}
                />
              ) : null;
            })}
            {venues.map((venue) => {
              const box = boxOf(venue.entityId);
              const kind = kinds.get(venue.entityId);
              if (!box) return null;
              const shown =
                up && (kind === "lit" || kind === "dark") && !venue.off;
              return (
                <div
                  key={venue.entityId}
                  className={`town-crowd ${kind === "lit" && venue.hue !== null ? `venue-${venue.hue} is-lit` : ""} ${shown ? "is-shown" : ""}`}
                  style={{
                    left: box.x - 8,
                    top: box.y + box.d + 5,
                    width: box.w + 16,
                  }}
                />
              );
            })}
            <Buildings boxes={boxes} kinds={kinds} hues={hues} up={up} />
          </div>
        </div>
      )}
      <div className="town-veil" aria-hidden />
      <div className="town-signs">
        {signs.map(({ venue, x, y, k }) => {
          const chip = signChip({
            lifted: venue.lifted,
            off: venue.off,
            unread: venue.unread,
          });
          const name = signName(venue.name);
          return (
            <button
              key={venue.entityId}
              type="button"
              className={`town-sign ${selected === venue.entityId ? "is-picked" : ""}`}
              style={{
                left: Math.round(x),
                top: Math.round(y),
                zIndex: 100 + Math.round(k * 400),
              }}
              aria-pressed={selected === venue.entityId}
              aria-label={`${venue.name}, ${chip}. Show this venue`}
              disabled={!interactive || dim}
              onClick={() =>
                onPick?.(selected === venue.entityId ? null : venue.entityId)
              }
            >
              <span
                className={`town-sign-plate ${venue.hue !== null && !venue.off && venue.lifted > 0 && !venue.unread ? `venue-${venue.hue}` : ""} ${venue.off ? "is-off" : venue.unread ? "is-unread" : venue.lifted === 0 ? "is-none" : ""}`}
              >
                <span className="town-sign-name">{name}</span>
                <span className="town-sign-chip">{chip}</span>
              </span>
              <span className="town-sign-pole" aria-hidden />
            </button>
          );
        })}
      </div>
      {overlay}
      {/* A card open over the town takes the controls' corner, as the layout brief has it. */}
      {interactive && !without && !reserve.right && (
        <div className={`town-controls ${dim ? "is-waiting" : ""}`}>
          <p className="town-hint" aria-hidden>
            {narrow ? narrowHint : wideHint}
          </p>
          <div
            role="group"
            aria-label="Move around the town"
            className="town-buttons"
          >
            <button
              type="button"
              aria-label="Turn the town left"
              onClick={() => turn(-45)}
              disabled={dim}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M7 8 H14 A5 5 0 0 1 14 18 H9 M10 4.5 L6.5 8 L10 11.5" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Turn the town right"
              onClick={() => turn(45)}
              disabled={dim}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M17 8 H10 A5 5 0 0 0 10 18 H15 M14 4.5 L17.5 8 L14 11.5" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              className="town-zoom"
              onClick={() => zoom(1.3)}
              disabled={dim}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M12 4 V20 M4 12 H20" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              className="town-zoom"
              onClick={() => zoom(1 / 1.3)}
              disabled={dim}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M4 12 H20" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Show the whole town"
              onClick={whole}
              disabled={dim}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
