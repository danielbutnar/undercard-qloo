import type { Festival } from "@/lib/festival";
import { formatCount } from "@/lib/format";
import type { Act } from "@/lib/lineup";

// Billing by band, as on a printed bill: headliners largest, then Mid, then Openers.
const TIER = {
  mid: "text-band lg:text-title",
  opener: "text-name lg:text-figure",
} as const;

/** The lineup typeset as a show bill, with the CSV export. */
export function Poster({
  festival,
  acts,
  onBack,
  onExport,
}: {
  festival: Festival;
  acts: readonly Act[];
  onBack: () => void;
  onExport: () => void;
}) {
  return (
    <section aria-label="Poster" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-label text-ink underline underline-offset-2 hover:text-accent"
        >
          Back to the board
        </button>
        <button
          type="button"
          onClick={onExport}
          className="rounded-sm border-2 border-accent bg-accent px-4 py-2 font-display text-name font-extrabold uppercase text-on-accent hover:border-ink hover:bg-ink"
        >
          Export CSV
        </button>
      </div>
      <div className="flex flex-col items-center justify-center gap-6 border-4 border-rule bg-surface px-4 py-10 text-center lg:min-h-[calc(100dvh-9rem)] lg:gap-10 lg:px-12">
        <h1 className="font-display text-title font-extrabold uppercase lg:text-bill">
          {festival.name}
        </h1>
        <ul
          aria-label="Headliners"
          className="flex flex-col items-center font-display text-title font-extrabold uppercase lg:flex-row lg:gap-x-8 lg:text-bill"
        >
          {festival.headliners.map((headliner) => (
            <li key={headliner}>{headliner}</li>
          ))}
        </ul>
        <div className="w-full border-t-2 border-rule" />
        {festival.feeBands.map((band) => (
          <ul
            key={band.id}
            aria-label={band.label}
            className={`flex flex-wrap justify-center gap-x-6 gap-y-1 font-display font-extrabold uppercase ${TIER[band.id]}`}
          >
            {acts
              .filter((act) => act.band === band.id)
              .map((act) => (
                <li key={act.entityId}>{act.name}</li>
              ))}
          </ul>
        ))}
        <div className="w-full border-t-2 border-rule" />
        <p className="text-body">
          {festival.city}, {festival.region} · {formatCount(festival.capacity)}{" "}
          capacity
        </p>
        <p className="text-label text-muted">
          Undercard booked with taste data from Qloo
        </p>
      </div>
    </section>
  );
}
