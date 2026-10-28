import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { CardInPlace } from "./card-in-place";
import { labFirstBill, labStory, labTowns } from "./data";

/**
 * WS12 step 0, item 3: today's landing with the first act's card open and the finished card in
 * its place. `control` adds the line WS13.3's second climb will fill.
 */
export async function CardPage({ control }: { control: boolean }) {
  const [bill, towns, story] = await Promise.all([
    labFirstBill(),
    labTowns(),
    labStory(),
  ]);
  const act = bill?.acts.find((entry) => entry.entityId === story?.firstId);
  const band = act
    ? SAGEBRUSH_SOUND.feeBands.find((entry) => entry.id === act.band)
    : undefined;
  return (
    <div className="d2 d2-page d2-card-page stage-bg">
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={bill}
        towns={towns}
      />
      {bill && story && act && band && (
        <CardInPlace
          act={act}
          band={band}
          place={bill.places?.[act.entityId]}
          hue={story.hues[act.anchorVenue.entityId] ?? null}
          image={bill.images?.[act.entityId]}
          split={bill.splits?.[act.entityId]}
          control={control}
        />
      )}
    </div>
  );
}
