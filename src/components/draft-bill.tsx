import type { FeeBand, FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import { formatBandRange, formatCount } from "@/lib/format";
import type { Act } from "@/lib/lineup";
import { markLabel, markText } from "@/lib/marks";

// Billing by band, as on a printed bill: headliners largest, then Mid, then Openers.
const BILLING = {
  mid: "text-band",
  opener: "text-figure",
} satisfies Record<FeeBandId, string>;

const savedAt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/** The room whose crowd lifted the act and the places it gained, in the blue Qloo ink. */
function Mark({ act, top }: { act: Act; top?: number }) {
  return (
    <p className="rounded-sm border-2 border-accent px-1.5 pt-1 pb-0.5 font-display text-name leading-none font-bold text-accent">
      <span aria-hidden>{markText(act)}</span>
      <span className="sr-only">{markLabel(act, top)}</span>
    </p>
  );
}

// Each act is a button that opens its card: a pointer, an underline on hover and on keyboard
// focus, and the act's name as its accessible name. No hover-scale (B7).
function BillAct({
  act,
  gone,
  top,
  open,
  onOpen,
}: {
  act: Act;
  gone: boolean;
  top?: number;
  open: boolean;
  onOpen?: (act: Act) => void;
}) {
  return (
    <article
      aria-label={act.name}
      className="flex flex-col items-center gap-1.5"
    >
      <h3
        className={`font-display font-extrabold uppercase ${BILLING[act.band]} ${gone ? "text-muted" : ""}`}
      >
        {onOpen ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? "act-card" : undefined}
            onClick={() => onOpen(act)}
            className="cursor-pointer uppercase decoration-2 underline-offset-4 hover:underline focus-visible:underline aria-expanded:underline"
          >
            {act.name}
          </button>
        ) : (
          act.name
        )}
      </h3>
      {gone ? (
        <p className="rounded-sm border-2 border-danger px-1.5 pt-1 pb-0.5 font-display text-name leading-none font-extrabold text-danger uppercase">
          Unavailable
        </p>
      ) : (
        <Mark act={act} top={top} />
      )}
    </article>
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
  top,
  openId,
  onOpen,
}: {
  band: FeeBand;
  acts: readonly Act[];
  unavailable: readonly string[];
  top?: number;
  openId: string | null;
  onOpen?: (act: Act) => void;
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
      className="mt-4 flex w-full flex-col items-center border-t-2 border-rule pt-2.5"
    >
      <div className="flex flex-wrap items-baseline justify-center gap-x-3">
        <h2
          id={headingId}
          className="font-display text-name font-extrabold uppercase"
        >
          {band.label}
        </h2>
        <p className="text-label text-muted">
          {band.slots} slots · fee band set by Qloo&apos;s popularity
          percentile: {formatBandRange(band)}
        </p>
      </div>
      <ol className="mt-3 flex flex-wrap items-start justify-center gap-x-7 gap-y-4">
        {slots.map((act, index) => (
          <li key={act?.entityId ?? `open-${index}`}>
            {act ? (
              <BillAct
                act={act}
                gone={unavailable.includes(act.entityId)}
                top={top}
                open={openId === act.entityId}
                onOpen={onOpen}
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
}) {
  const { city, region, capacity, crowdAge } = festival;
  return (
    <section
      aria-label="Undercard draft"
      className="relative flex flex-col items-center border-2 border-rule bg-surface px-4 pt-5 pb-4 text-center after:pointer-events-none after:absolute after:inset-1.5 after:border after:border-rule lg:px-9"
    >
      <div className="flex w-full flex-wrap-reverse items-center justify-center gap-x-6 gap-y-3 lg:justify-between">
        <p className="text-label text-muted">
          {city}, {region} · {formatCount(capacity)} capacity · crowd aged{" "}
          {crowdAge.min}–{crowdAge.max}
        </p>
        <p className="-rotate-2 rounded-sm border-2 border-danger px-2.5 pt-1 pb-0.5 font-display text-name leading-none font-extrabold text-danger uppercase">
          Undercard draft · not announced
        </p>
      </div>
      <h1 className="mt-2 font-display text-band font-extrabold uppercase">
        {festival.name}
      </h1>
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
      <p className="mt-2 text-label text-muted">
        Headliners booked.
        {onOpen &&
          " Click an act to open its card, where you can mark it unavailable."}
      </p>
      {festival.feeBands.map((band) => (
        <BandTier
          key={band.id}
          band={band}
          acts={acts}
          unavailable={unavailable}
          top={top[band.id]}
          openId={openId}
          onOpen={onOpen}
        />
      ))}
      <p className="mt-auto w-full border-t border-rule pt-2.5 text-label text-muted">
        {calls && createdAt
          ? `Drafted by the agent from ${calls} Qloo calls · saved ${savedAt.format(new Date(createdAt))} UTC`
          : "The agent is drafting the undercard."}
      </p>
    </section>
  );
}
