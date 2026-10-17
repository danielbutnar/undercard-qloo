"use client";

import { useState, type ReactNode } from "react";
import type { FeeBand, FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import { formatBandRange, formatCount } from "@/lib/format";
import type { Act } from "@/lib/lineup";
import { liftOf, markKey, markLabel } from "@/lib/marks";

// Billing by band, as on a printed bill: headliners largest, then Mid, then Openers. The
// headliners are the page's one display line (M6q); the acts are set in the body face.
const BILLING = {
  mid: "text-figure",
  opener: "text-name",
} satisfies Record<FeeBandId, string>;

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
 * The club whose fans like the act, in plain words (M6q), then the places its crowd lifted the
 * act in Qloo's ranking, in the blue Qloo ink.
 */
function Mark({ act, top }: { act: Act; top?: number }) {
  const lift = liftOf(act);
  return (
    <div className="flex flex-col items-center text-label">
      <p aria-hidden>{act.anchorVenue.name} fans like it</p>
      {lift && (
        <p aria-hidden>
          <span className="rounded-sm border border-accent px-1 font-semibold text-accent">
            {badgeOf(act)}
          </span>{" "}
          {badgeWords(act, top)}
        </p>
      )}
      <p className="sr-only">{markLabel(act, top)}</p>
    </div>
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
      className={`flex flex-col items-center gap-1.5 ${print ? "motion-safe:animate-print-in" : ""}`}
      style={
        print ? { animationDelay: `${print.delay.toFixed(2)}s` } : undefined
      }
      onAnimationStart={() => onPrinted?.(act.entityId)}
    >
      <h3
        className={`font-bold ${BILLING[act.band]} ${gone ? "text-muted" : ""}`}
      >
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
      </h3>
      {gone ? (
        <p className="rounded-sm border-2 border-danger px-1.5 text-label font-semibold text-danger">
          Unavailable
        </p>
      ) : (
        <Mark act={act} top={top} />
      )}
      {kept && !gone && (
        <p className="text-label font-semibold text-accent">Kept</p>
      )}
    </article>
  );
}

/** The key to the marks, set beside the first one: what it means and what Qloo is. */
function MarkKey({ example, lines }: { example: string; lines: string[] }) {
  const [first, ...rest] = lines;
  return (
    <div
      role="note"
      aria-label="How to read the marks"
      className="flex max-w-lg flex-col gap-1 border-l-2 border-rule pl-3 text-left text-label"
    >
      <p>
        <span
          aria-hidden
          className="mr-1.5 inline-block rounded-sm border border-accent px-1 font-semibold text-accent"
        >
          {example}
        </span>
        {first}
      </p>
      {rest.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

function OpenSlot() {
  return (
    <p className="border-2 border-dashed border-muted px-6 py-2 text-label text-muted">
      Open slot
    </p>
  );
}

/** One fee band's tier: its name, what sets it, and its slots in the lineup's order. */
function BandTier({
  band,
  acts,
  unavailable,
  keeping,
  top,
  openId,
  onOpen,
  keyed,
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
  /** The act whose mark carries the key, and the key. */
  keyed?: { act: Act; example: string; lines: string[] };
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
          {band.slots} slots · fee range ({band.label}): acts at Qloo&apos;s{" "}
          {formatBandRange(band)} popularity percentile, standing in for their
          fee
        </p>
      </div>
      <ol className="mt-2.5 flex flex-wrap items-start justify-center gap-x-7 gap-y-3">
        {slots.map((act, index) => (
          <li
            key={act?.entityId ?? `open-${index}`}
            className={
              act && act === keyed?.act
                ? "flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-3"
                : undefined
            }
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
            {act && act === keyed?.act && (
              <MarkKey example={keyed.example} lines={keyed.lines} />
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
  phoneAction,
  drafting = false,
  keeping = [],
  redraft,
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
  /** Shown under the headliners on phones only, where the rail sits below the whole bill. */
  phoneAction?: ReactNode;
  /** A build is streaming; the footer says the agent is drafting. */
  drafting?: boolean;
  /** Acts the buyer keeps (M8c), marked on the bill. */
  keeping?: readonly string[];
  /** Redraft the rest, under the bands once an act is kept (M8c). */
  redraft?: ReactNode;
}) {
  const billed = festival.feeBands.flatMap((band) =>
    acts.filter((act) => act.band === band.id),
  );
  const order = new Map(billed.map((act, index) => [act.entityId, index]));
  // The key sits beside the first mark on the bill, in billing order.
  // It stays there while that act is refilled, so nothing on the bill jumps.
  const firstMarked = billed.find((act) => liftOf(act));
  const keyed = firstMarked && {
    act: firstMarked,
    ...markKey(firstMarked, {
      acts,
      top: top[firstMarked.band],
      city: festival.city,
    }),
    // The key's example is the mark's blue badge, as the bill now shows it (M6q).
    example: badgeOf(firstMarked),
  };
  return (
    <section aria-label="Undercard draft" className={SHEET}>
      <BillHeader festival={festival} stamp="Draft, not announced">
        This is the draft lineup (the bill): the headliners are booked, and the
        AI agent picked the acts below.
        {onOpen &&
          acts.length > 0 &&
          " Click an act to see why, keep it or mark it unavailable."}
      </BillHeader>
      {phoneAction && (
        <div className="mt-3 w-full lg:hidden">{phoneAction}</div>
      )}
      {festival.feeBands.map((band) => (
        <BandTier
          key={band.id}
          band={band}
          acts={acts}
          unavailable={unavailable}
          keeping={keeping}
          top={top[band.id]}
          openId={openId}
          onOpen={onOpen}
          keyed={keyed?.act.band === band.id ? keyed : undefined}
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
