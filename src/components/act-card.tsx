import type { FeeBandId } from "@/lib/fee-bands";
import { formatAffinity, formatPercentile } from "@/lib/format";
import type { Act } from "@/lib/lineup";

// Billing size follows the fee band, as on a printed bill: Mid acts set larger than Openers.
const BILLING = {
  mid: { name: "text-figure", figure: "text-band" },
  opener: { name: "text-name", figure: "text-figure" },
} satisfies Record<FeeBandId, { name: string; figure: string }>;

export function ActCard({ act }: { act: Act }) {
  const billing = BILLING[act.band];
  return (
    <article
      aria-label={act.name}
      className="flex h-full flex-col gap-3 border-2 border-rule bg-surface p-3"
    >
      <h4 className={`font-display font-extrabold uppercase ${billing.name}`}>
        {act.name}
      </h4>
      <dl className="flex flex-wrap gap-x-4 gap-y-2">
        <div className="flex flex-col-reverse">
          <dt className="text-label text-muted">Qloo affinity</dt>
          <dd className={`font-semibold text-accent ${billing.figure}`}>
            {formatAffinity(act.affinity)}
          </dd>
        </div>
        <div className="flex flex-col-reverse">
          <dt className="text-label text-muted">Popularity</dt>
          <dd className={`font-semibold text-accent ${billing.figure}`}>
            {formatPercentile(act.popularity)}
          </dd>
        </div>
      </dl>
      <p className="text-label">
        <span className="font-semibold">Why Boise: </span>
        {act.reason}
      </p>
      <ul
        aria-label="Tags shared with the headliners"
        className="mt-auto flex flex-wrap gap-2"
      >
        {act.sharedTags.map((tag) => (
          <li
            key={tag.id}
            className="rounded-sm border border-accent px-2 text-label text-accent"
          >
            {tag.name}
          </li>
        ))}
      </ul>
    </article>
  );
}
