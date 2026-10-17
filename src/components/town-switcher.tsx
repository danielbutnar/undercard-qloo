import Link from "next/link";
import { TOWNS, townHref } from "@/lib/towns";

/**
 * The same brief, other towns: a link to each town on show, one click from the bill. The
 * headliners stay; each town's own rooms draft its undercard.
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
    <nav
      aria-label="Same brief, other towns"
      className="flex flex-col gap-1 border-2 border-rule bg-surface p-4"
    >
      <h2 className="font-display text-name font-extrabold uppercase">
        Same brief, other towns
      </h2>
      <p className="text-label text-muted">
        The same headliners and fee bands, with each town&apos;s own rooms
        drafting the undercard.
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {towns.map((town) => (
          <li key={town.slug}>
            <Link
              href={townHref(town.slug)}
              aria-current={town.slug === current ? "page" : undefined}
              className="text-body font-semibold underline underline-offset-2 hover:text-accent aria-[current=page]:text-accent aria-[current=page]:no-underline"
            >
              {town.festival.city}
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/your-festival"
        className="mt-1 self-start text-label font-semibold underline underline-offset-2 hover:text-accent"
      >
        Or draft one for your own town and headliners
      </Link>
    </nav>
  );
}
