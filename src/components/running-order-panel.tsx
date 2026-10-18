"use client";

import { Sleeve } from "@/components/chart/sleeve";
import type { Act } from "@/lib/lineup";
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

/** One act on a stage: its sleeve, when the lineup knows its genres, and its name. */
function StageAct({
  stage,
  name,
  act,
}: {
  stage: string;
  name: string;
  act?: Act;
}) {
  return (
    <p className="stage-act">
      {act ? (
        <Sleeve
          genres={act.sharedTags.map((tag) => tag.name)}
          id={act.entityId}
          label={false}
          className="stage-sleeve"
        />
      ) : (
        <span className="sleeve stage-sleeve sleeve-blank" aria-hidden />
      )}
      <span className="stage-words">
        <span className="stage-name">{stage}:</span>{" "}
        <span className="stage-act-name">{name}</span>
      </span>
    </p>
  );
}

/**
 * The running order (M8a): two stages, set by set. Each clash says who plays against whom and
 * how close their fans' tastes are, ranked among the lineup's pairs, drawn as a meter: the
 * shorter the bar, the less alike the two crowds. The headliners close the day.
 */
export function RunningOrderPanel({
  slots,
  headliners,
  onClose,
  acts = [],
}: {
  slots: readonly RunningSlot[];
  headliners: readonly string[];
  onClose: () => void;
  /** The lineup's acts, for their sleeves. */
  acts?: readonly Act[];
}) {
  const byId = new Map(acts.map((act) => [act.entityId, act]));
  return (
    <section aria-label="Running order" className="panel order">
      <div className="order-head">
        <h2 className="panel-title">Running order</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the running order"
          className="link"
        >
          Close
        </button>
      </div>
      <p className="panel-sub">
        Two stages, opening acts first. The two acts on at the same time are the
        pair whose fans&apos; tastes are least alike in Qloo&apos;s data (how
        much fans of one act also like the other). It&apos;s a measure of taste,
        not a count of shared ticket buyers.
      </p>
      <ol className="order-sets">
        {slots.map((slot, index) => {
          const closeness =
            slot.rank !== null && slot.pairs > 1
              ? 1 - (slot.rank - 1) / (slot.pairs - 1)
              : null;
          return (
            <li key={slot.main.entityId} className="order-set">
              <p className="order-when">
                {ORDINAL[index] ?? `${index + 1}th`} set ·{" "}
                {PLAIN_BAND[slot.band]}
              </p>
              <div className="order-stages">
                <StageAct
                  stage="Main stage"
                  name={slot.main.name}
                  act={byId.get(slot.main.entityId)}
                />
                {slot.second && (
                  <StageAct
                    stage="Second stage"
                    name={slot.second.name}
                    act={byId.get(slot.second.entityId)}
                  />
                )}
              </div>
              {slot.second ? (
                <div className="order-clash">
                  {closeness !== null && (
                    <span className="order-meter" aria-hidden>
                      <span
                        style={{ width: `${Math.max(6, closeness * 100)}%` }}
                      />
                    </span>
                  )}
                  <p>
                    {slot.main.name} plays against {slot.second.name}
                    {slot.rank !== null && slot.pairs > 0
                      ? `: their fans' tastes are the ${ordinalOf(slot.rank)} closest of ${slot.pairs} pairs on this lineup`
                      : ": Qloo gave no score for this pair"}
                  </p>
                </div>
              ) : (
                <p className="order-alone">Plays alone.</p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="order-close">
        <span className="font-bold">Then the headliners:</span>{" "}
        {headliners.join(" and ")}.
      </p>
    </section>
  );
}
