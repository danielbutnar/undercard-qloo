"use client";

import { useEffect, useRef, useState } from "react";
import { Sleeve } from "./sleeve";

/**
 * An act's cover: Qloo's image of the artist when the saved build carries one (only while
 * ARTIST_IMAGES in src/lib/artist-images.ts is on), else, or when it doesn't load, its sleeve
 * drawn from its genres.
 */
export function Cover({
  image,
  genres,
  id,
  name,
  label,
  className = "",
}: {
  image?: string;
  genres: readonly string[] | null;
  id: string;
  name: string;
  /** False where the row's own label already names the act: the cover is then decorative. */
  label: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const photo = useRef<HTMLImageElement>(null);
  // The photo comes in the server's HTML, so it can fail before onError is attached.
  useEffect(() => {
    const img = photo.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, [image]);
  if (image && !failed)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Qloo's own image URL, shown as it is
      <img
        ref={photo}
        src={image}
        alt={name}
        aria-hidden={label ? undefined : true}
        className={`sleeve cover-photo ${className}`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  if (!genres)
    return <span className={`sleeve sleeve-blank ${className}`} aria-hidden />;
  return <Sleeve genres={genres} id={id} label={label} className={className} />;
}
