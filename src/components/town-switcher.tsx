import Link from "next/link";
import { TOWNS, townHref } from "@/lib/towns";

/**
 * The same brief, other towns: a link to each town on show, one click from the chart. The
 * headliners stay; each town's own venues draft its undercard.
 */
export function TownSwitcher({
  current,
  onShow,
}: {
  current: string;
  onShow: readonly string[];
}) {
  const towns = TOWNS.filter((town) => onShow.includes(town.slug));
  if (towns.length < 2) return null;
  return (
    <nav aria-label="Same brief, other towns" className="panel">
      <h2 className="panel-title">Same brief, other towns</h2>
      <p className="panel-sub">
        The same headliners and fee ranges, with each town&apos;s own venues
        drafting the undercard.
      </p>
      <ul className="town-links">
        {towns.map((town) => (
          <li key={town.slug}>
            <Link
              href={townHref(town.slug)}
              aria-current={town.slug === current ? "page" : undefined}
              className="town-link"
            >
              {town.festival.city}
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/your-festival" className="link mt-3 inline-block text-label">
        Or draft one for your own town and headliners
      </Link>
    </nav>
  );
}
