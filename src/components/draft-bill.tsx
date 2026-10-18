"use client";

import { useState, type ReactNode } from "react";
import type { FeeBand, FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import { formatBandRange, formatCount } from "@/lib/format";
import type { Act } from "@/lib/lineup";
import { liftOf, markLabel } from "@/lib/marks";

/** Each band in plain words first (M6q); the fee band's precise terms follow, smaller. */
const PLAIN_BAND = {
  mid: "Mid-size acts",
  opener: "Opening acts",
} satisfies Record<FeeBandId, string>;

/** A print run's acts start 0.12 s apart, each taking 0.38 s (src/app/globals.css). */
const PRINT_STEP_S = 0.12;

/** What prints the acts that mount now; null on first paint, which is the finished bill. */
export type Printing = "run" | "refill" | null;

const savedAt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

const badgeOf = (act: Act) => {
  const lift = liftOf(act);
  return lift?.kind === "up" ? `+${lift.places}` : lift ? "new" : "";
};

/** What the badge counts, in words beside it (M6r): never a bare +N. */
const badgeWords = (act: Act, top?: number) => {
  const lift = liftOf(act);
  if (!lift) return "";
  return lift.kind === "up"
    ? "places higher in Qloo's ranking"
    : `to Qloo's top ${top ?? lift.top}`;
};

/**
 * The venue whose fans like the act, in plain words (M6q), then the places its crowd lifted the
 * act in Qloo's ranking, in the blue Qloo ink, over a bar as long as the move (M9d's ledger:
 * 50 places fill the cell).
 */
function Mark({ act, top }: { act: Act; top?: number }) {
  const lift = liftOf(act);
  return (
    <>
      <p aria-hidden className="text-label">
        {act.anchorVenue.name} fans like it
      </p>
      <div aria-hidden className="text-label">
        {lift && (
          <p>
            <span className="rounded-sm border border-accent px-1 font-semibold text-accent">
              {badgeOf(act)}
            </span>{" "}
            {badgeWords(act, top)}
          </p>
        )}
        {lift?.kind === "up" && (
          <span
            aria-hidden
            data-lift-bar
            className="mt-1 block h-1.5 bg-accent"
            style={{ width: `${Math.min(100, (lift.places / 50) * 100)}%` }}
          />
        )}
      </div>
      <p className="sr-only">{markLabel(act, top)}</p>
    </>
  );
}

// Each act is a button that opens its card: a pointer, an underline on hover and on keyboard
// focus, and the act's name as its accessible name. No hover-scale (B7).
function BillAct({
  act,
  kept = false,
  gone,
  top,
  open,
  onOpen,
  printing,
  index,
  onPrinted,
}: {
  act: Act;
  /** The buyer keeps it (M8c). */
  kept?: boolean;
  gone: boolean;
  top?: number;
  open: boolean;
  onOpen?: (act: Act) => void;
  printing: Printing;
  /** The act's place in billing order, which sets its turn in a print run. */
  index: number;
  onPrinted?: (entityId: string) => void;
}) {
  // Decided when the act mounts: the first paint's acts never animate, a print run's acts
  // print in one at a time, and a refill's replacement prints straight into its slot.
  const [print] = useState(() =>
    printing ? { delay: printing === "run" ? index * PRINT_STEP_S : 0 } : null,
  );
  return (
    <article
      aria-label={act.name}
      className={`grid w-full grid-cols-1 items-baseline gap-x-3 gap-y-0.5 py-1.5 text-left sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)] ${print ? "motion-safe:animate-print-in" : ""}`}
      style={
        print ? { animationDelay: `${print.delay.toFixed(2)}s` } : undefined
      }
      onAnimationStart={() => onPrinted?.(act.entityId)}
    >
      <h3 className={`text-body font-bold ${gone ? "text-muted" : ""}`}>
        {onOpen ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? "act-card" : undefined}
            onClick={() => onOpen(act)}
            className="cursor-pointer decoration-2 underline-offset-4 hover:underline focus-visible:underline aria-expanded:underline"
          >
            {act.name}
          </button>
        ) : (
          act.name
        )}
        {kept && !gone && (
          <span className="ml-2 text-label font-semibold text-accent">
            Kept
          </span>
        )}
      </h3>
      {gone ? (
        <p className="justify-self-start rounded-sm border-2 border-danger px-1.5 text-label font-semibold text-danger">
          Unavailable
        </p>
      ) : (
        <Mark act={act} top={top} />
      )}
    </article>
  );
}

function OpenSlot() {
  return <p className="py-1.5 text-left text-label text-muted">Open slot</p>;
}

/**
 * One fee band's tier: its name, what sets it, and its slots in the lineup's order, as a ledger
 * of rows (M9d's winner).
 */
function BandTier({
  band,
  acts,
  unavailable,
  keeping,
  top,
  openId,
  onOpen,
  printing,
  order,
  onPrinted,
}: {
  band: FeeBand;
  acts: readonly Act[];
  unavailable: readonly string[];
  keeping: readonly string[];
  top?: number;
  openId: string | null;
  onOpen?: (act: Act) => void;
  printing: Printing;
  /** Billing order across the bands, by entity id. */
  order: ReadonlyMap<string, number>;
  onPrinted?: (entityId: string) => void;
}) {
  const billed = acts.filter((act) => act.band === band.id);
  const slots = Array.from(
    { length: Math.max(band.slots, billed.length) },
    (_, index) => billed[index] ?? null,
  );
  const headingId = `bill-${band.id}`;
  return (
    <section
      aria-labelledby={headingId}
      className="mt-3 flex w-full flex-col items-center border-t-2 border-rule pt-2"
    >
      <div className="flex flex-wrap items-baseline justify-center gap-x-3">
        <h2 id={headingId} className="text-body font-bold">
          {PLAIN_BAND[band.id]}
        </h2>
        <p className="text-label text-muted">
          {band.slots} slots · fee range ({band.label}): with no real fees to go
          on, how popular an act is on Qloo stands in for what it charges{" "}
          {`(${formatBandRange(band)} percentile)`}
        </p>
      </div>
      <ol className="mt-2 flex w-full flex-col">
        {slots.map((act, index) => (
          <li
            key={act?.entityId ?? `open-${index}`}
            className="border-b border-rule/50"
          >
            {act ? (
              <BillAct
                act={act}
                kept={keeping.includes(act.entityId)}
                gone={unavailable.includes(act.entityId)}
                top={top}
                open={openId === act.entityId}
                onOpen={onOpen}
                printing={printing}
                index={order.get(act.entityId) ?? 0}
                onPrinted={onPrinted}
              />
            ) : (
              <OpenSlot />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The bill's stock: lighter poster board with an ink rule and an inner hairline. */
export const SHEET =
  "relative flex flex-col items-center border-2 border-rule bg-surface px-4 pt-5 pb-4 text-center after:pointer-events-none after:absolute after:inset-1.5 after:border after:border-rule lg:px-9";

/** When a build or an answer was saved, as "Oct 15, 14:02". */
export const formatSavedAt = (iso: string) => savedAt.format(new Date(iso));

/**
 * The top of a bill: the festival's facts and a stamp, its name, the booked headliners, and a
 * line under them.
 */
export function BillHeader({
  festival,
  stamp,
  children,
}: {
  festival: Festival;
  stamp: string;
  children: ReactNode;
}) {
  const { city, region, capacity, crowdAge } = festival;
  return (
    <>
      <div className="flex w-full flex-wrap-reverse items-center justify-center gap-x-6 gap-y-3 lg:justify-between">
        <p className="text-label text-muted">
          {region ? `${city}, ${region}` : city} · {formatCount(capacity)}{" "}
          capacity · crowd aged {crowdAge.min}–{crowdAge.max}
        </p>
        <p className="-rotate-1 rounded-sm border border-danger px-2 text-label font-semibold text-danger">
          {stamp}
        </p>
      </div>
      <h1 className="mt-2 text-figure font-bold">{festival.name}</h1>
      <ul
        aria-label="Booked headliners"
        className="mt-1.5 flex flex-col items-center font-display text-title font-extrabold uppercase lg:flex-row lg:flex-wrap lg:justify-center"
      >
        {festival.headliners.map((headliner) => (
          <li
            key={headliner}
            className="lg:not-first:before:mx-4 lg:not-first:before:content-['·']"
          >
            {headliner}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-label text-muted">{children}</p>
    </>
  );
}

/**
 * The buyer's draft of the festival bill: the booked headliners over the undercard the agent
 * drafted, each act marked with the Boise room whose crowd lifted it in Qloo's ranking.
 */
export function DraftBill({
  festival,
  acts,
  calls,
  createdAt,
  top = {},
  unavailable = [],
  openId = null,
  onOpen,
  printing = null,
  onPrinted,
  action,
  drafting = false,
  keeping = [],
  redraft,
  climb,
}: {
  festival: Festival;
  acts: readonly Act[];
  /** Qloo calls the build made; unknown while a fresh build streams. */
  calls?: number;
  createdAt?: string;
  /** Per band, how many acts the headliners-only ranking listed. */
  top?: Partial<Record<FeeBandId, number>>;
  unavailable?: readonly string[];
  /** The act whose card is open. */
  openId?: string | null;
  onOpen?: (act: Act) => void;
  /** What prints acts that mount now: a replay's run, a refill, or nothing (first paint). */
  printing?: Printing;
  /** Called as each act's print-in starts, so the rooms' counts can tick up with it. */
  onPrinted?: (entityId: string) => void;
  /** Shown under the headliners at every width: Watch, the first click (evidence section 25). */
  action?: ReactNode;
  /** A build is streaming; the footer says the agent is drafting. */
  drafting?: boolean;
  /** Acts the buyer keeps (M8c), marked on the bill. */
  keeping?: readonly string[];
  /** Redraft the rest, under the bands once an act is kept (M8c). */
  redraft?: ReactNode;
  /** The lift, visible (M9a): while it plays, it takes the bands' place. */
  climb?: ReactNode;
}) {
  const billed = festival.feeBands.flatMap((band) =>
    acts.filter((act) => act.band === band.id),
  );
  const order = new Map(billed.map((act, index) => [act.entityId, index]));
  return (
    <section aria-label="Undercard draft" className={SHEET}>
      <BillHeader festival={festival} stamp="Draft, not announced">
        This is the draft lineup (the bill): the headliners are booked, and the
        AI agent picked the acts below.
        {onOpen &&
          acts.length > 0 &&
          " Click an act to see why, keep it or mark it unavailable."}
      </BillHeader>
      {action && <div className="mt-3 w-full">{action}</div>}
      {climb}
      {!climb &&
        festival.feeBands.map((band) => (
          <BandTier
            key={band.id}
            band={band}
            acts={acts}
            unavailable={unavailable}
            keeping={keeping}
            top={top[band.id]}
            openId={openId}
            onOpen={onOpen}
            printing={printing}
            order={order}
            onPrinted={onPrinted}
          />
        ))}
      {redraft && <div className="mt-3 w-full">{redraft}</div>}
      <p className="mt-auto w-full border-t border-rule pt-2.5 text-label text-muted">
        {calls && createdAt
          ? `Drafted by the AI agent from ${calls} Qloo calls · saved ${formatSavedAt(createdAt)} UTC`
          : drafting
            ? "The AI agent is drafting the undercard."
            : "No undercard drafted yet."}
      </p>
    </section>
  );
}
