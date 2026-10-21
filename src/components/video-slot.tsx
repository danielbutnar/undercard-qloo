"use client";

import { useState } from "react";

/** The demo video, loaded only when played (M9c): nothing is fetched until the press. */
export function VideoSlot({ url }: { url: string | null }) {
  const [playing, setPlaying] = useState(false);
  if (!url)
    return (
      <p className="text-body text-muted">
        The demo video will play here once it&apos;s published (recorded 26–27
        October).
      </p>
    );
  if (playing)
    return (
      <video
        src={url}
        controls
        autoPlay
        className="w-full border-2 border-rule"
      >
        <track kind="captions" />
      </video>
    );
  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="self-start rounded-sm border-2 border-accent bg-accent px-4 py-2 text-body font-bold text-on-accent hover:bg-ink hover:text-accent"
    >
      Play the demo video
    </button>
  );
}
