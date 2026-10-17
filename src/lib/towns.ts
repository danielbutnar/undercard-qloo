import { CHECKED_TOWNS, type CheckedTown } from "./checked-towns";
import type { Festival } from "./festival";
import { SAGEBRUSH_SOUND } from "./sagebrush";

/**
 * The same brief in other towns (M6d): Sagebrush Sound's headliners, capacity, crowd and fee
 * bands, with only the town changed, each under its own festival id so its saved build and
 * its replay are its own. Boise is the demo festival and the default everywhere.
 */
export interface Town {
  slug: string;
  festival: Festival;
}

function sameBriefIn(slug: string, city: string, region: string): Town {
  return {
    slug,
    festival: {
      ...SAGEBRUSH_SOUND,
      id: `${SAGEBRUSH_SOUND.id}-${slug}`,
      city,
      region,
    },
  };
}

export const TOWNS: readonly Town[] = [
  { slug: "boise", festival: SAGEBRUSH_SOUND },
  sameBriefIn("austin", "Austin", "Texas"),
  sameBriefIn("denver", "Denver", "Colorado"),
  sameBriefIn("nashville", "Nashville", "Tennessee"),
];

export function townBySlug(slug: string): Town | null {
  return TOWNS.find((town) => town.slug === slug) ?? null;
}

export function townOf(festival: Festival): Town {
  return TOWNS.find((town) => town.festival.id === festival.id) ?? TOWNS[0];
}

/** "Reykjavík" -> "reykjavik", "Kansas City" -> "kansas-city". */
function slugOf(city: string): string {
  return city
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * A checked town's festival (M6m): the same brief with the town's state or country, under its
 * own id, so its saved build replays on its own. Boise is the demo festival.
 */
export function checkedFestival(town: CheckedTown): Festival {
  if (town.city === SAGEBRUSH_SOUND.city && town.region === SAGEBRUSH_SOUND.region)
    return SAGEBRUSH_SOUND;
  return sameBriefIn(slugOf(town.city), town.city, town.region).festival;
}

/** A request's festival: none means Boise; an id that isn't one of the towns means none. */
export function festivalById(id: string | undefined): Festival | null {
  if (id === undefined) return SAGEBRUSH_SOUND;
  const town = TOWNS.find((entry) => entry.festival.id === id);
  if (town) return town.festival;
  return (
    CHECKED_TOWNS.map(checkedFestival).find((festival) => festival.id === id) ??
    null
  );
}

/** The festival a POST body names in its `festival` field. */
export function festivalFromBody(body: unknown): Festival | null {
  const value =
    body && typeof body === "object" && "festival" in body
      ? (body as { festival: unknown }).festival
      : undefined;
  if (value === undefined) return SAGEBRUSH_SOUND;
  return typeof value === "string" ? festivalById(value) : null;
}

/** Where a town's screen lives: Boise is the home page. */
export function townHref(slug: string): string {
  return slug === "boise" ? "/" : `/towns/${slug}`;
}
