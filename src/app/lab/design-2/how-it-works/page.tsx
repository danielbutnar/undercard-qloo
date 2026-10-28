import { notFound } from "next/navigation";
import { labEnabled } from "@/lib/lab";
import type { Metadata } from "next";
import Link from "next/link";
import {
  TAGLINE_LEAD,
  TAGLINE_QLOO,
} from "@/components/chart/poster-words";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { labFirstBill, labStory } from "../_kit/data";
import {
  BackstagePasses,
  DirectorsCut,
  TestedStamps,
} from "../_kit/how-it-works";
// The landing's own styles: How it works is made of its objects (the town, the poster).
import "@/components/chart/chart.css";
import "@/components/chart/first-screen.css";
import "../design-2.css";

export const metadata: Metadata = { title: "Design 2.0 · How it works" };

/**
 * WS12 step 0, item 2: How it works as the director's cut of Watch, for Daniel's approval before
 * anything is built (dev only). Same top bar and type scale as the landing; every number comes
 * from the saved Boise build, and the act it follows is the one that leads that build.
 */
export default async function Design2HowItWorks() {
  if (!labEnabled()) notFound();
  const [bill, story] = await Promise.all([labFirstBill(), labStory()]);
  return (
    <div className="chart-app stage-bg fs d2 d2-hiw">
      <header className="topbar fs-top">
        <Link
          href="/"
          className="logo fs-word"
          aria-label="Undercard, back to Sagebrush Sound"
        >
          Undercard
        </Link>
        <p className="fs-tagline">
          {TAGLINE_LEAD} {TAGLINE_QLOO}
        </p>
        <nav aria-label="Other screens" className="nav">
          <Link href="/">Back to the lineup</Link>
          <Link href="/your-festival">Your festival</Link>
        </nav>
      </header>
      <main className="d2-hiw-main">
        <div className="d2-hiw-head">
          <h1 className="d2-hiw-title">How it works</h1>
          <p className="d2-hiw-lede">
            Watch, slowed down: one act from the saved {SAGEBRUSH_SOUND.city}{" "}
            build, from Qloo&apos;s ranking to the poster, in four scenes.
            Undercard drafts; the buyer makes every call.
          </p>
        </div>
        {bill && story ? (
          <DirectorsCut
            festival={SAGEBRUSH_SOUND}
            acts={bill.acts}
            places={bill.places ?? {}}
            images={bill.images}
            headlinerImages={bill.headlinerImages}
            headliners={bill.headliners}
            story={story}
          />
        ) : (
          <p className="d2-lede">No saved build to follow.</p>
        )}
        <BackstagePasses festival={SAGEBRUSH_SOUND} calls={bill?.calls ?? 12} />
        <TestedStamps />
      </main>
    </div>
  );
}
