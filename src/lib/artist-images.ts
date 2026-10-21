/**
 * Artist images from Qloo (item 4 of Daniel's brief of 2026-10-21): built, and off. Daniel has
 * asked Qloo whether the app may show its artist image URLs (RULES.md, Unclear 5). Until Qloo
 * agrees this stays false: no image call is made and every act shows its drawn cover. Turning it
 * on also changes SPEC.md section 7's "text only" line, which is Daniel's call.
 */
export const ARTIST_IMAGES = false;

/** Each act's image URL on Qloo, by entity id: read at runtime, never stored in the repository. */
export type ArtistImages = Readonly<Record<string, string>>;

/** The only images shown: https URLs on Qloo's own image host. */
export const isQlooImage = (url: string) =>
  /^https:\/\/images\.qloo\.com\//.test(url);
