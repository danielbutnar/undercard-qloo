import { Composition, staticFile } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { Demo } from "./Demo";
import type { DemoProps } from "./Demo";
import type { Manifest, Timeline } from "./types";

const FPS = 60;

async function loadJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(staticFile(path), { signal });
  if (!response.ok)
    throw new Error(
      `Missing video/public/${path}: run the ${path.startsWith("vo/") ? "voiceover" : "capture"} script first.`,
    );
  return (await response.json()) as T;
}

const calculateMetadata: CalculateMetadataFunction<DemoProps> = async ({
  props,
  abortSignal,
}) => {
  const [timeline, manifest] = await Promise.all([
    loadJson<Timeline>("vo/timeline.json", abortSignal),
    loadJson<Manifest>("capture/manifest.json", abortSignal),
  ]);
  const missing = timeline.segments
    .filter(
      (s) =>
        s.scene === "step" && !manifest.steps.some((step) => step.id === s.id),
    )
    .map((s) => s.id);
  if (missing.length)
    throw new Error(
      `No capture for step segments: ${missing.join(", ")}. Add them to scripts/steps.ts and run capture.`,
    );
  return {
    durationInFrames: Math.ceil(timeline.totalSec * FPS),
    props: { ...props, timeline, manifest },
  };
};

export const RemotionRoot = () => (
  <Composition
    id="Demo"
    component={Demo}
    fps={FPS}
    width={1920}
    height={1080}
    durationInFrames={FPS}
    defaultProps={{ timeline: null, manifest: null }}
    calculateMetadata={calculateMetadata}
  />
);
