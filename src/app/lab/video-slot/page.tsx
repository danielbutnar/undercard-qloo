import { notFound } from "next/navigation";
import { VideoSlot } from "@/components/video-slot";
import { LAB_VIDEO_URL, labEnabled } from "@/lib/lab";
import "@/components/chart/chart.css";

/**
 * How it works' video slot with a YouTube link (WS2), for Playwright and a look before the demo
 * video is published; How it works itself shows no slot while DEMO_VIDEO_URL is unset.
 */
export default function VideoSlotLab() {
  if (!labEnabled()) notFound();
  return (
    <div className="chart-app stage-bg">
      <main className="method how">
        <VideoSlot url={LAB_VIDEO_URL} />
      </main>
    </div>
  );
}
