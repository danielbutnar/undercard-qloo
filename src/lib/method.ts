/**
 * The method page (M9c) links every claim to its row in docs/evidence.md on GitHub, in the public
 * repository (Daniel, 29 October 19:40), which judges can open.
 */
export const EVIDENCE_URL =
  "https://github.com/danielbutnar/undercard-qloo/blob/main/docs/evidence.md";

/** GitHub's anchor for a markdown heading: lower case, punctuation dropped, spaces to hyphens. */
export function evidenceAnchor(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-");
}

/** A link to one section of docs/evidence.md, by its heading's text. */
export const evidenceHref = (heading: string) =>
  `${EVIDENCE_URL}#${evidenceAnchor(heading)}`;

/**
 * The demo video, once published: a YouTube link plays in a click-to-play facade, a direct .mp4
 * in the plain player. Until it's set, How it works shows no video slot at all.
 */
export const DEMO_VIDEO_URL: string | null = null;

const VIDEO_ID = /^[\w-]{11}$/;

/** A YouTube link's video id (watch, youtu.be, embed, shorts or nocookie), else null. */
export function youTubeId(url: string): string | null {
  let link: URL;
  try {
    link = new URL(url);
  } catch {
    return null;
  }
  if (link.protocol !== "https:" && link.protocol !== "http:") return null;
  const host = link.hostname.replace(/^(www|m)\./, "");
  const path = link.pathname.split("/").filter(Boolean);
  const id =
    host === "youtu.be"
      ? path[0]
      : host === "youtube.com" || host === "youtube-nocookie.com"
        ? path[0] === "watch"
          ? link.searchParams.get("v")
          : ["embed", "shorts"].includes(path[0] ?? "")
            ? path[1]
            : null
        : null;
  return id && VIDEO_ID.test(id) ? id : null;
}
