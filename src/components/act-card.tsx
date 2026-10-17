"use client";

import { useState } from "react";
import type { FeeBandId } from "@/lib/fee-bands";
import { formatAffinity, formatPercentile } from "@/lib/format";
import type { Act } from "@/lib/lineup";
import {
  UNAVAILABLE_REASON_IDS,
  UNAVAILABLE_REASONS,
  type UnavailableReason,
} from "@/lib/unavailable";

// Billing size follows the fee band, as on a printed bill: Mid acts set larger than Openers.
const BILLING = {
  mid: { name: "text-figure", figure: "text-band" },
  opener: { name: "text-name", figure: "text-figure" },
} satisfies Record<FeeBandId, { name: string; figure: string }>;

export function ActCard({
  act,
  unavailable = false,
  disabled = false,
  onUnavailable,
  onClose,
  city = "Boise",
}: {
  act: Act;
  /** Stamped and printed in worn ink while its slot is refilled, or when no refill was found. */
  unavailable?: boolean;
  disabled?: boolean;
  /** Called with the reason the buyer picks: a radius clause, routing or the fee. */
  onUnavailable?: (act: Act, reason: UnavailableReason) => void;
  /** Shown as Close beside the name when the card is opened from the bill. */
  onClose?: () => void;
  /** The festival's town, which names the Why line. */
  city?: string;
}) {
  const [asking, setAsking] = useState(false);
  const billing = BILLING[act.band];
  const ink = unavailable ? "text-muted" : "text-accent";
  return (
    <article
      aria-label={act.name}
      className={`flex h-full flex-col gap-3 border-2 bg-surface p-3 ${unavailable ? "border-muted" : "border-rule"}`}
    >
      {unavailable && (
        <p className="self-start rounded-sm border-2 border-danger px-2 font-display text-name font-extrabold uppercase text-danger">
          Unavailable
        </p>
      )}
      <div className="flex items-start justify-between gap-3">
        <h4
          className={`font-display font-extrabold uppercase ${billing.name} ${unavailable ? "text-muted" : ""}`}
        >
          {act.name}
        </h4>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the card"
            className="shrink-0 text-label text-ink underline underline-offset-2 hover:text-accent"
          >
            Close
          </button>
        )}
      </div>
      <dl className="flex flex-wrap gap-x-4 gap-y-2">
        <div className="flex flex-col-reverse">
          <dt className="text-label text-muted">Qloo affinity</dt>
          <dd className={`font-semibold ${ink} ${billing.figure}`}>
            {formatAffinity(act.affinity)}
          </dd>
        </div>
        <div className="flex flex-col-reverse">
          <dt className="text-label text-muted">Popularity</dt>
          <dd className={`font-semibold ${ink} ${billing.figure}`}>
            {formatPercentile(act.popularity)}
          </dd>
        </div>
      </dl>
      <p className={`text-label ${unavailable ? "text-muted" : ""}`}>
        <span className="font-semibold">Why {city}: </span>
        {act.reason}
      </p>
      <ul
        aria-label="Tags shared with the headliners"
        className="mt-auto flex flex-wrap gap-2"
      >
        {act.sharedTags.map((tag) => (
          <li
            key={tag.id}
            className={`rounded-sm border px-2 text-label ${unavailable ? "border-muted text-muted" : "border-accent text-accent"}`}
          >
            {tag.name}
          </li>
        ))}
      </ul>
      {onUnavailable && !unavailable && !asking && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAsking(true)}
          className="self-start text-label text-muted underline underline-offset-2 hover:text-danger disabled:cursor-not-allowed disabled:no-underline"
        >
          Unavailable
        </button>
      )}
      {onUnavailable && !unavailable && asking && (
        <div
          role="group"
          aria-labelledby={`why-${act.entityId}`}
          className="flex flex-wrap items-center gap-2"
        >
          <p id={`why-${act.entityId}`} className="w-full text-label font-semibold">
            Why is it unavailable?
          </p>
          {UNAVAILABLE_REASON_IDS.map((reason) => (
            <button
              key={reason}
              type="button"
              disabled={disabled}
              onClick={() => {
                setAsking(false);
                onUnavailable(act, reason);
              }}
              className="rounded-sm border-2 border-danger px-2 text-label text-danger hover:bg-danger hover:text-on-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {UNAVAILABLE_REASONS[reason].replace(/^./, (first) =>
                first.toUpperCase(),
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAsking(false)}
            className="text-label text-muted underline underline-offset-2 hover:text-ink"
          >
            Cancel
          </button>
        </div>
      )}
    </article>
  );
}
