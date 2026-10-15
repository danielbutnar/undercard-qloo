import { ActCard } from "@/components/act-card";
import type { FeeBand, FeeBandId } from "@/lib/fee-bands";
import { formatBandRange } from "@/lib/format";
import type { Act } from "@/lib/lineup";

const COLUMNS = {
  mid: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
  opener: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6",
} satisfies Record<FeeBandId, string>;

function OpenSlot() {
  return (
    <div className="flex h-full min-h-24 items-start border-2 border-dashed border-muted p-3 text-label text-muted">
      Open slot
    </div>
  );
}

/**
 * The fee bands and their slots. Acts keep the lineup's order (strongest affinity first, as
 * booked), so a refilled act lands in the slot it replaces.
 */
export function LineupBoard({
  bands,
  acts,
  unavailable = [],
  refilling = null,
  onUnavailable,
}: {
  bands: readonly FeeBand[];
  acts: readonly Act[];
  unavailable?: readonly string[];
  refilling?: string | null;
  onUnavailable?: (act: Act) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {bands.map((band) => {
        const billed = acts.filter((act) => act.band === band.id);
        const slots = Array.from(
          { length: band.slots },
          (_, index) => billed[index] ?? null,
        );
        const headingId = `band-${band.id}`;
        return (
          <section
            key={band.id}
            aria-labelledby={headingId}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-baseline gap-x-4 border-b-2 border-rule pb-1">
              <h3
                id={headingId}
                className="font-display text-band font-extrabold uppercase"
              >
                {band.label}
              </h3>
              <p className="text-label text-muted">
                {band.slots} slots · popularity {formatBandRange(band)}{" "}
                percentile
              </p>
            </div>
            <ol className={`grid gap-3 ${COLUMNS[band.id]}`}>
              {slots.map((act, index) => (
                <li key={act?.entityId ?? `open-${index}`}>
                  {act ? (
                    <ActCard
                      act={act}
                      unavailable={unavailable.includes(act.entityId)}
                      disabled={refilling !== null}
                      onUnavailable={onUnavailable}
                    />
                  ) : (
                    <OpenSlot />
                  )}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
