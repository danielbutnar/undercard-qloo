/**
 * The method page (M9c) links every claim to its row in docs/evidence.md on GitHub. The
 * repository is public from M5 on; until then the links resolve only for its owner.
 */
export const EVIDENCE_URL =
  "https://github.com/danielbutnar/undercard/blob/main/docs/evidence.md";

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

/** The demo video, once published; until then its slot says when it comes. */
export const DEMO_VIDEO_URL: string | null = null;
