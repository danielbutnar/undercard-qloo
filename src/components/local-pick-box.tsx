"use client";

import {
  LOCAL_PICK_LABEL,
  localPickIntro,
  localPickNumbers,
  localPickWhy,
  LOCAL_PICK_TITLE,
  ON_THE_BILL,
} from "@/lib/agent-words";
import type { Festival } from "@/lib/festival";
import type { LocalPick } from "@/lib/local-pick";

/**
 * The AI's local pick (WS13.5): the acts the AI agent named from its own knowledge of the town,
 * each found on Qloo with Qloo's numbers, for the buyer to check. Nothing here takes a slot
 * until the buyer presses "Add to the bill". WS12 places the box; this is its content.
 */
export function LocalPickBox({
  picks,
  festival,
  added,
  onToggle,
}: {
  picks: readonly LocalPick[];
  festival: Pick<Festival, "city" | "feeBands">;
  /** Entity ids of the picks the buyer added to the bill. */
  added: readonly string[];
  onToggle: (entityId: string) => void;
}) {
  if (picks.length === 0) return null;
  return (
    <section aria-label={LOCAL_PICK_LABEL} className="panel local-pick">
      <h3 className="panel-title">{LOCAL_PICK_TITLE}</h3>
      <p className="panel-sub">{localPickIntro(festival.city, picks.length)}</p>
      <ul className="local-pick-list">
        {picks.map((pick) => {
          const on = added.includes(pick.entityId);
          return (
            <li key={pick.entityId} className="local-pick-item">
              <p className="local-pick-name">{pick.name}</p>
              <p className="panel-sub">
                {localPickNumbers(pick, festival.feeBands)}
              </p>
              {pick.why && (
                <p className="panel-sub">{localPickWhy(pick.why)}</p>
              )}
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(pick.entityId)}
                className="tool"
              >
                Add to the bill
              </button>
              {on && <p className="panel-sub">{ON_THE_BILL}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
