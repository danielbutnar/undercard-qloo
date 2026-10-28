"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SplitLine } from "@/lib/attribution-line";
import type { FeeBand } from "@/lib/fee-bands";
import type { Act } from "@/lib/lineup";
import type { Placed } from "@/lib/venue-switch";
import { Card2 } from "./card-2";

/**
 * Step 0's way to show the finished card where it really opens: it opens the act's card on
 * today's landing (over the town on a laptop, inline on a phone), hides that card and puts the
 * new one in its place, in the same panel, so the panel's pinned head and actions apply to it.
 */
export function CardInPlace({
  act,
  band,
  place,
  hue,
  image,
  split,
  control = false,
}: {
  act: Act;
  band: FeeBand;
  place?: Placed;
  hue: number | null;
  image?: string;
  split?: SplitLine;
  control?: boolean;
}) {
  const [slot, setSlot] = useState<Element | null>(null);
  // Dev's StrictMode runs the effect twice: a second click would close the card again.
  const clicked = useRef(false);

  useEffect(() => {
    const place = () => {
      const old = document.getElementById("act-card");
      if (!old?.parentElement) return false;
      document.body.classList.add("d2-card-mode");
      setSlot(old.parentElement);
      return true;
    };
    const observer = new MutationObserver(() => {
      if (place()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    queueMicrotask(() => {
      if (place()) observer.disconnect();
    });
    if (!clicked.current) {
      clicked.current = true;
      document
        .querySelector<HTMLButtonElement>(
          `.fs-poster [data-act="${act.entityId}"] button`,
        )
        ?.click();
    }
    return () => {
      observer.disconnect();
      document.body.classList.remove("d2-card-mode");
    };
  }, [act.entityId]);

  if (!slot) return null;
  return createPortal(
    <section aria-label="Act card" className="card-panel d2-card-panel">
      <Card2
        act={act}
        band={band}
        place={place}
        hue={hue}
        image={image}
        split={split}
        control={control}
        onClose={() => {}}
      />
    </section>,
    slot,
  );
}
