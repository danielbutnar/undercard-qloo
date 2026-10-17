"use client";

import type { RunningSlot } from "@/lib/running-order";

const ORDINAL = [
  "First",
  "Second",
  "Third",
  "Fourth",
  "Fifth",
  "Sixth",
  "Seventh",
  "Eighth",
];
/** 1 -> "closest" reads as "1st closest"; plain ordinals for the rank. */
function ordinalOf(n: number): string {
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  return `${n}${suffix}`;
}

const PLAIN_BAND = { mid: "Mid-size acts", opener: "Opening acts" } as const;

/**
 * The running order (M8a): two stages, set by set, each saying who plays against whom and how
 * much their audiences overlap in Qloo's data. The headliners close the day.
 */
export function RunningOrderPanel({
  slots,
  headliners,
  onClose,
}: {
  slots: readonly RunningSlot[];
  headliners: readonly string[];
  onClose: () => void;
}) {
  return (
    <section
      aria-label="Running order"
      className="flex flex-col gap-2 border-2 border-rule bg-surface p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-body font-bold">Running order</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the running order"
          className="text-label text-ink underline underline-offset-2 hover:text-accent"
        >
          Close
        </button>
      </div>
      <p className="text-label text-muted">
        Two stages, opening acts first. The two acts on at the same time are the
        pair whose fans&apos; tastes are least alike in Qloo&apos;s data (how
        much fans of one act also like the other). It&apos;s a measure of taste,
        not a count of shared ticket buyers.
      </p>
      <ol className="flex flex-col divide-y divide-muted/50">
        {slots.map((slot, index) => (
          <li key={slot.main.entityId} className="flex flex-col gap-0.5 py-2">
            <p className="text-label text-muted">
              {ORDINAL[index] ?? `${index + 1}th`} set · {PLAIN_BAND[slot.band]}
            </p>
            <p className="text-label">
              <span className="font-semibold">Main stage:</span>{" "}
              {slot.main.name}
            </p>
            {slot.second ? (
              <>
                <p className="text-label">
                  <span className="font-semibold">Second stage:</span>{" "}
                  {slot.second.name}
                </p>
                <p className="text-label text-accent">
                  {slot.main.name} plays against {slot.second.name}
                  {slot.rank !== null && slot.pairs > 0
                    ? `: their fans' tastes are the ${ordinalOf(slot.rank)} closest of ${slot.pairs} pairs on this lineup`
                    : ": Qloo gave no score for this pair"}
                </p>
              </>
            ) : (
              <p className="text-label text-muted">Plays alone.</p>
            )}
          </li>
        ))}
      </ol>
      <p className="text-label">
        <span className="font-semibold">Then the headliners:</span>{" "}
        {headliners.join(" and ")}.
      </p>
    </section>
  );
}
