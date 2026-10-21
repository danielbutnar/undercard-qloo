import type { ArtistImages } from "@/lib/artist-images";

/** Where Qloo's artist photos show, a small line saying whose images they are; none without. */
export function ImageCredit({ images }: { images?: ArtistImages | null }) {
  if (!images || Object.keys(images).length === 0) return null;
  return <p className="image-credit">Artist images via Qloo</p>;
}
