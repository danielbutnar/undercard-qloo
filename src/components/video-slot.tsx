"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_VIDEO_URL, youTubeId } from "@/lib/method";

const LABEL = "Play the demo video";

/** YouTube's thumbnail and a play button; the press puts the youtube-nocookie.com player in. */
function YouTubeVideo({ id }: { id: string }) {
  const [playing, setPlaying] = useState(false);
  const [thumbnail, setThumbnail] = useState(true);
  const player = useRef<HTMLIFrameElement>(null);
  // The press takes the button away: the player it loads takes the focus.
  useEffect(() => {
    if (playing) player.current?.focus();
  }, [playing]);
  if (playing)
    return (
      <div className="video-box">
        <iframe
          ref={player}
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title="Undercard's demo video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="video-box video-facade"
    >
      {thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail, shown as it is
        <img
          src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setThumbnail(false)}
        />
      )}
      <span className="video-play">
        <span className="watch-play" aria-hidden>
          <svg viewBox="0 0 20 20">
            <path d="M4 2v16l14-8z" />
          </svg>
        </span>
        {LABEL}
      </span>
    </button>
  );
}

/** A direct video file, loaded only when played. */
function FileVideo({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
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
      {LABEL}
    </button>
  );
}

/**
 * How it works' demo video (M9c), from DEMO_VIDEO_URL: nothing at all, heading included, until
 * it's published. A YouTube link shows the video's thumbnail and a play button, and nothing of
 * the player loads until the press; any other link keeps the plain player, also loaded on play.
 */
export function VideoSlot({ url = DEMO_VIDEO_URL }: { url?: string | null }) {
  if (!url) return null;
  const id = youTubeId(url);
  return (
    <section aria-label="The demo video" className="panel how-video">
      <h2 className="panel-title">The demo video</h2>
      <div className="mt-2">
        {id ? <YouTubeVideo id={id} /> : <FileVideo url={url} />}
      </div>
    </section>
  );
}
