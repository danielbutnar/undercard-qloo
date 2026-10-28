import type { Metadata } from "next";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { labFirstBill, labStory, labTowns } from "./_kit/data";
import { LandingBottom } from "./_kit/landing-bottom";
import { ShortTown } from "./_kit/short-town";
import "./design-2.css";

export const metadata: Metadata = { title: "Design 2.0 · the landing" };

/**
 * WS12 step 0, item 1: the landing page with Design 2.0's lower half, for Daniel's approval
 * before anything is built (dev only, src/lib/lab.ts). The first screen is today's FestivalScreen
 * unchanged, on the saved Boise build; its three panels below the fold give way to the AI agent's
 * setlist, the door check and the page's last line.
 */
export default async function Design2Landing() {
  const [bill, towns, story] = await Promise.all([
    labFirstBill(),
    labTowns(),
    labStory(),
  ]);
  return (
    <div className="d2 d2-page stage-bg">
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={bill}
        towns={towns}
      />
      {bill && story && (
        <ShortTown
          seedKey={SAGEBRUSH_SOUND.id}
          venues={story.venues}
          acts={bill.acts}
          hues={story.hues}
          noFanData={story.noFanData}
        />
      )}
      {bill && story && (
        <div className="chart-app d2-after">
          <div className="d2-main">
            <LandingBottom
              festival={SAGEBRUSH_SOUND}
              acts={bill.acts}
              places={bill.places ?? {}}
              images={bill.images}
              story={story}
            />
          </div>
        </div>
      )}
    </div>
  );
}
