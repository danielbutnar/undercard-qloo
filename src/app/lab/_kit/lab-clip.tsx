"use client";

import { useEffect, useState } from "react";

/**
 * A direction's build clip, played from just before the first climb step to the end of the build
 * (scripts/lab-capture.mjs writes the timing next to the clip). It loops within that range.
 */
export function LabClip({ slug, label }: { slug: string; label: string }) {
  const [range, setRange] = useState<{ start: number; end: number } | null>(
    null,
  );
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/lab/shots/${slug}-build.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((timing) => {
        if (!alive) return;
        if (timing) setRange(timing);
        else setMissing(true);
      })
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
    };
  }, [slug]);

  if (missing)
    return (
      <p className="missing">
        No clip yet: run node scripts/lab-capture.mjs {slug}
      </p>
    );
  if (!range) return <div className="clipWait" aria-hidden />;
  return (
    <video
      className="clip"
      src={`/lab/shots/${slug}-build.webm#t=${range.start},${range.end}`}
      poster={`/lab/shots/${slug}-1440.png`}
      aria-label={label}
      controls
      muted
      playsInline
      preload="metadata"
      onPlay={(event) => {
        const video = event.currentTarget;
        if (video.currentTime < range.start || video.currentTime >= range.end)
          video.currentTime = range.start;
      }}
      onTimeUpdate={(event) => {
        const video = event.currentTarget;
        if (video.currentTime >= range.end) video.currentTime = range.start;
      }}
    />
  );
}
