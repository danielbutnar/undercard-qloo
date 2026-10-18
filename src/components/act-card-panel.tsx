"use client";

import { useEffect, useRef } from "react";
import { ActCard } from "@/components/act-card";
import type { Act } from "@/lib/lineup";
import type { UnavailableReason } from "@/lib/unavailable";
import type { Placed } from "@/lib/venue-switch";

/**
 * An act's card, opened from the chart under its row: the climb, the Why Boise line, Qloo's
 * numbers, the shared tags, Keep and Unavailable. It takes focus when it opens, so on a phone it
 * scrolls into view.
 */
export function ActCardPanel({
  act,
  unavailable,
  disabled,
  onUnavailable,
  onClose,
  city,
  kept,
  onKeep,
  place,
  hue,
  note,
}: {
  act: Act;
  unavailable: boolean;
  disabled: boolean;
  /** Left out when a refill isn't possible, as on a judge's own brief. */
  onUnavailable?: (act: Act, reason: UnavailableReason) => void;
  onClose: () => void;
  city?: string;
  kept?: boolean;
  onKeep?: (act: Act) => void;
  place?: Placed;
  hue?: number | null;
  note?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.scrollIntoView?.({ block: "nearest" });
  }, [act.entityId]);

  return (
    <section
      id="act-card"
      ref={ref}
      tabIndex={-1}
      aria-label="Act card"
      className="card-panel outline-none"
    >
      <ActCard
        act={act}
        unavailable={unavailable}
        disabled={disabled}
        onUnavailable={onUnavailable}
        onClose={onClose}
        city={city}
        kept={kept}
        onKeep={onKeep}
        place={place}
        hue={hue}
        note={note}
      />
    </section>
  );
}
