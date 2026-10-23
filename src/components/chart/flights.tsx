"use client";

import { useLayoutEffect, useRef } from "react";
import type { Act } from "@/lib/lineup";
import { Cover } from "./cover";
import { climbMark } from "./poster-words";

/** One act Watch flies from its venue in the town to its slot on the poster. */
export interface Flight {
  key: string;
  act: Act;
  /** Its venue's colour. */
  hue: number | null;
  /** Its Qloo photo, when the build carries one. */
  image?: string;
  /** Its place in its venue's run of flights: each leaves a beat after the one before. */
  order: number;
}

/** Each card leaves STAGGER_MS after the one before, rises, then flies to its slot. */
export const STAGGER_MS = 140;
export const FLIGHT_MS = 900;
/** When an act's slot stamps in: as its card arrives. */
export const landsAt = (order: number) =>
  (order * STAGGER_MS + FLIGHT_MS * 0.9) / 1000;

function FlyCard({ flight }: { flight: Flight }) {
  const card = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = card.current;
    const layer = element?.parentElement;
    if (!element || !layer || typeof element.animate !== "function") return;
    const box = layer.getBoundingClientRect();
    const sign = document.querySelector(
      `.town-sign[data-venue="${flight.act.anchorVenue.entityId}"]`,
    );
    const town = document.querySelector(".town-view");
    const slot = document.querySelector(
      `.poster-act[data-act="${flight.act.entityId}"]`,
    );
    if (!slot || !(sign ?? town)) return;
    const from = (sign ?? town)!.getBoundingClientRect();
    const to = slot.getBoundingClientRect();
    const width = element.offsetWidth || 200;
    // From the foot of the venue's sign (its roof), or the town's middle if the sign is hidden.
    const sx = from.left + from.width / 2 - box.left - width / 2;
    const sy = (sign ? from.bottom : from.top + from.height / 2) - box.top - 20;
    const tx = to.left - box.left;
    const ty = to.top - box.top + (to.height - 34) / 2;
    const flightOf = element.animate(
      [
        { transform: `translate(${sx}px, ${sy}px) scale(0.35)`, opacity: 0 },
        {
          transform: `translate(${sx}px, ${sy - 58}px) scale(1)`,
          opacity: 1,
          offset: 0.3,
        },
        {
          transform: `translate(${tx}px, ${ty}px) scale(0.85)`,
          opacity: 1,
          offset: 0.88,
        },
        { transform: `translate(${tx}px, ${ty}px) scale(0.85)`, opacity: 0 },
      ],
      {
        duration: FLIGHT_MS,
        delay: flight.order * STAGGER_MS,
        easing: "cubic-bezier(0.45, 0, 0.2, 1)",
        fill: "both",
      },
    );
    return () => flightOf?.cancel?.();
  }, [flight]);
  const mark = climbMark(flight.act);
  return (
    <div
      ref={card}
      className={`fly-card ${flight.hue !== null ? `venue-${flight.hue}` : ""}`}
    >
      <span className="fly-photo">
        <Cover
          image={flight.image}
          genres={flight.act.sharedTags.map((tag) => tag.name)}
          id={flight.act.entityId}
          name={flight.act.name}
          label={false}
          className="fly-cover"
        />
      </span>
      <span className="fly-name">{flight.act.name}</span>
      {mark && <span className="fly-climb">{mark}</span>}
    </div>
  );
}

/**
 * Watch's flights (the layout brief's play()): a card per act a venue's fans lifted, from the
 * venue in the town to the act's slot on the poster, with the Web Animations API. Decorative:
 * the caption and the poster's acts say the same in words. The screen leaves them out on a phone
 * and under reduced motion.
 */
export function FlyingActs({ flights }: { flights: readonly Flight[] }) {
  if (flights.length === 0) return null;
  return (
    <div className="fly-layer" aria-hidden="true">
      {flights.map((flight) => (
        <FlyCard key={flight.key} flight={flight} />
      ))}
    </div>
  );
}
