import type { Festival } from "@/lib/festival";
import { formatCount } from "@/lib/format";

/**
 * The festival's facts and its booked headliners. Once the board has acts, `compact` sets the
 * headliners smaller so the board's Qloo numbers carry the frame.
 */
export function FestivalHeader({
  festival,
  compact = false,
}: {
  festival: Festival;
  compact?: boolean;
}) {
  const { name, city, region, capacity, crowdAge, headliners } = festival;
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-title font-extrabold uppercase">
          {name}
        </h1>
        <p>
          {city}, {region} · {formatCount(capacity)} capacity · crowd aged{" "}
          {crowdAge.min}–{crowdAge.max}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <p id="headliners-label" className="text-label text-muted">
          Booked headliners
        </p>
        <ul
          aria-labelledby="headliners-label"
          className={`flex flex-col font-display text-title font-extrabold uppercase lg:flex-row lg:flex-wrap lg:gap-x-6 ${compact ? "lg:text-band" : "lg:text-bill"}`}
        >
          {headliners.map((headliner) => (
            <li key={headliner}>{headliner}</li>
          ))}
        </ul>
      </div>
    </header>
  );
}
