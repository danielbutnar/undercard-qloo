"use client";

import { useEffect, useRef } from "react";
import { ActCard } from "@/components/act-card";
import type { Act } from "@/lib/lineup";

/**
 * An act's card, opened from the bill: Qloo's numbers, the Why Boise line, the shared tags and
 * Unavailable. It takes focus when it opens, so on a phone it scrolls into view under the bill.
 */
export function ActCardPanel({
  act,
  unavailable,
  disabled,
  onUnavailable,
  onClose,
}: {
  act: Act;
  unavailable: boolean;
  disabled: boolean;
  onUnavailable: (act: Act) => void;
  onClose: () => void;
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
      className="flex flex-col gap-2 outline-none"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close the card"
        className="self-end text-label text-ink underline underline-offset-2 hover:text-accent"
      >
        Close
      </button>
      <ActCard
        act={act}
        unavailable={unavailable}
        disabled={disabled}
        onUnavailable={onUnavailable}
      />
    </section>
  );
}
