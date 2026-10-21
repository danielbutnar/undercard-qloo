/**
 * Artist images from Qloo (item 4 of Daniel's brief of 2026-10-21): on since Qloo's hackathon
 * manager agreed on 21 October that the app may show them (RULES.md, Unclear 5; SPEC.md section
 * 7). Each saved build's acts get their image URLs from one cached Qloo call; false turns that
 * call off and every act shows its drawn cover.
 */
export const ARTIST_IMAGES = true;

/** Each act's image URL on Qloo, by entity id: read at runtime, never stored in the repository. */
export type ArtistImages = Readonly<Record<string, string>>;

/** The only images shown: https URLs on Qloo's own image host. */
export const isQlooImage = (url: string) =>
  /^https:\/\/images\.qloo\.com\//.test(url);

/** Rows with each act's image from `images` (by entity id), where it has one; as they are otherwise. */
export function pictured<
  T extends { key: string; act: { entityId: string } | null; image?: string },
>(rows: T[], images: ArtistImages | null | undefined): T[] {
  if (!images) return rows;
  return rows.map((row) => {
    const image = images[row.act?.entityId ?? row.key];
    return image ? { ...row, image } : row;
  });
}
