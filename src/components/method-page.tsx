import Link from "next/link";
import { Tri } from "@/components/chart/band-chart";
import { Quilt } from "@/components/chart/sleeve";
import { TopBar } from "@/components/chart/top-bar";
import { MIN_LIFT } from "@/lib/assemble-lineup";
import type { MethodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { venueHues } from "@/lib/venue-colours";
import { FollowOneAct } from "./method/follow-one-act";
import { TryIt } from "./method/try-it";
import { ImageCredit } from "./chart/image-credit";
import { WithWithoutLine } from "./chart/with-without-line";
import { Verdicts } from "./method-evidence";
import { VideoSlot } from "./video-slot";
import "./chart/chart.css";

const { headliners, city, feeBands } = SAGEBRUSH_SOUND;

/** The method in one picture (M10b): four small cards, read left to right. */
function Picture({ story }: { story: MethodStory | null }) {
  const hues = story ? venueHues(story.venues, story.acts) : null;
  const swatches = story
    ? story.venues.map((venue) => hues!.get(venue.entityId) ?? 0)
    : [0, 1, 2];
  const climbHue = story ? (hues!.get(story.act.anchorVenue.entityId) ?? 0) : 0;
  return (
    <section aria-label="The method in one picture" className="how-section">
      <h2 className="band-name">The method in one picture</h2>
      <figure
        role="img"
        aria-label={`How Undercard drafts a lineup: Qloo ranks the acts the headliners' fans like; the fans of one of ${city}'s music venues are added, and some acts climb; the acts that climb ${MIN_LIFT} places or more, sit in the fee range and share two genres with the headliners make your undercard.`}
        className="how-picture"
      >
        <div className="how-card">
          <span className="how-art how-art-quilts">
            <Quilt name={headliners[0]} />
            <Quilt name={headliners[1]} />
          </span>
          <p className="how-card-title">The headliners&apos; fans</p>
          <p className="how-card-line">Qloo ranks the acts they like</p>
        </div>
        <span className="how-join how-plus" aria-hidden>
          +
        </span>
        <div className="how-card">
          <span className="how-art how-art-venues">
            {swatches.map((hue, index) => (
              <i key={index} className={`how-swatch venue-${hue}`} />
            ))}
          </span>
          <p className="how-card-title">A {city} venue&apos;s fans</p>
          <p className="how-card-line">added to the headliners&apos;</p>
        </div>
        <span className="how-join how-arrow" aria-hidden />
        <div className="how-card">
          <span className={`how-art how-climb venue-${climbHue}`}>
            <Tri />
            {story?.climb ?? ""}
          </span>
          <p className="how-card-title">The acts that climb</p>
          <p className="how-card-line">
            {MIN_LIFT} places or more in Qloo&apos;s ranking, in the fee range,
            two genres shared
          </p>
        </div>
        <span className="how-join how-arrow" aria-hidden />
        <div className="how-card">
          <span className="how-art how-art-slots">
            {feeBands.map((band) => (
              <span key={band.id} className="slots">
                {Array.from({ length: band.slots }, (_, index) => (
                  <i key={index} className="on" />
                ))}
              </span>
            ))}
          </span>
          <p className="how-card-title">Your undercard</p>
          <p className="how-card-line">the strongest of them, slot by slot</p>
        </div>
      </figure>
    </section>
  );
}

/** Who does what, as three cards of one line each. */
function WhoDoesWhat({ calls }: { calls: number }) {
  return (
    <section aria-label="Who does what" className="how-section">
      <h2 className="band-name">Who does what</h2>
      <p className="how-sub">Qloo decides, the model plans, the rule books.</p>
      <ul className="who-grid how-who">
        <li className="who-card">
          <svg viewBox="0 0 64 40" className="who-icon" aria-hidden>
            <rect x="2" y="6" width="16" height="28" className="fill-ink" />
            <rect x="24" y="6" width="16" height="28" className="fill-quiet" />
            <rect x="46" y="6" width="16" height="28" className="fill-ink" />
            <path
              d="M10 2v4M32 2v4M54 2v4"
              className="stroke-ink"
              strokeWidth="3"
            />
          </svg>
          <p className="who-name">The AI agent</p>
          <p className="who-what">plans the {calls} Qloo calls</p>
        </li>
        <li className="who-card">
          <svg viewBox="0 0 64 40" className="who-icon" aria-hidden>
            <rect x="4" y="24" width="10" height="14" className="fill-ink" />
            <rect x="20" y="14" width="10" height="24" className="fill-ink" />
            <rect
              x="36"
              y="6"
              width="10"
              height="32"
              className="fill-accent stroke-ink"
              strokeWidth="2"
            />
            <rect x="52" y="18" width="10" height="20" className="fill-ink" />
          </svg>
          <p className="who-name">Qloo</p>
          <p className="who-what">knows the taste</p>
        </li>
        <li className="who-card">
          <svg viewBox="0 0 64 40" className="who-icon" aria-hidden>
            <rect
              x="4"
              y="8"
              width="56"
              height="26"
              className="fill-surface stroke-ink"
              strokeWidth="3"
            />
            <path
              d="M14 21l7 7 14-14"
              fill="none"
              className="stroke-ink"
              strokeWidth="4"
            />
          </svg>
          <p className="who-name">The app&apos;s rule</p>
          <p className="who-what">picks the acts</p>
        </li>
      </ul>
    </section>
  );
}

/**
 * How it works (M10b, docs/evidence.md section 28), in the chart's look, top to bottom: the demo
 * video, once it's published; the method in one picture; one act followed through the saved build, with the AI
 * agent's choices; a venue switch to try; who does what; what was and wasn't shown, with the
 * evidence and the five objections a click away on /method/evidence.
 */
export function MethodPage({
  story = null,
  videoUrl,
}: {
  story?: MethodStory | null;
  /** The demo video's link; the slot reads DEMO_VIDEO_URL when it's left out. */
  videoUrl?: string | null;
} = {}) {
  return (
    <div className="chart-app stage-bg">
      <TopBar method={false}>
        <Link href="/">Back to the lineup</Link>
      </TopBar>
      <main className="method how">
        <div className="method-lead">
          <h1 className="compare-title">How it works</h1>
          <p className="compare-what">
            How the AI agent drafts a festival&apos;s smaller acts from what
            fans of the town&apos;s own venues like. Undercard drafts a
            shortlist with its evidence attached; the buyer makes every call.
          </p>
        </div>

        <VideoSlot url={videoUrl} />

        <Picture story={story} />

        {story ? (
          <>
            <FollowOneAct story={story} city={city} headliners={headliners} />
            <TryIt story={story} festivalId={SAGEBRUSH_SOUND.id} />
            <ImageCredit images={story.images} />
          </>
        ) : (
          <section aria-label="Follow one act" className="how-section">
            <h2 className="band-name">Follow one act</h2>
            <p className="how-sub">
              No saved {city} build to follow yet: the lineup hasn&apos;t been
              drafted.
            </p>
          </section>
        )}

        <WhoDoesWhat calls={story?.calls ?? 12} />

        <section aria-label="What was tested" className="panel">
          <h2 className="panel-title">What was tested</h2>
          <Verdicts />
          <WithWithoutLine />
          <p className="mt-3 text-label">
            <Link href="/method/evidence" className="link">
              The evidence: every test with its result, limit and source, and
              five objections answered
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
