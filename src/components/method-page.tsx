import Link from "next/link";
import { TopBar } from "@/components/chart/top-bar";
import type { MethodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { venueHues } from "@/lib/venue-colours";
import {
  BackstagePasses,
  DirectorsCut,
  TestedStamps,
} from "./method/directors-cut";
import { AgentChoices } from "./method/follow-one-act";
import { ImageCredit } from "./chart/image-credit";
import { WithWithoutLine } from "./chart/with-without-line";
import { VideoSlot } from "./video-slot";
import "./chart/chart.css";
import "./chart/first-screen.css";
import "./chart/backstage.css";
import "./method/directors-cut.css";

const { city } = SAGEBRUSH_SOUND;

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

        {story ? (
          <>
            <div className="chart-app fs directors-cut">
              <DirectorsCut
                festival={SAGEBRUSH_SOUND}
                story={story}
                choices={
                  <AgentChoices
                    story={story}
                    city={city}
                    hues={venueHues(story.venues, story.acts)}
                  />
                }
              />
            </div>
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

        <div className="chart-app fs directors-cut">
          <BackstagePasses
            festival={SAGEBRUSH_SOUND}
            calls={story?.calls ?? 12}
            local={Boolean(story?.act.localLift)}
          >
            <p className="dc-principle">
              Qloo decides, the model plans, the rule books.
            </p>
          </BackstagePasses>
        </div>

        <p className="how-sub">
          <Link href="/shortlist" prefetch={false} className="link">
            Check the acts you&apos;ve been pitched against a town&apos;s venue
            fans
          </Link>
        </p>

        <div className="chart-app fs directors-cut">
          <TestedStamps>
            <WithWithoutLine />
            <p className="mt-3 text-label">
              <Link href="/method/evidence" className="link">
                The evidence: every test with its result, limit and source, and
                five objections answered
              </Link>
            </p>
          </TestedStamps>
        </div>
      </main>
    </div>
  );
}
