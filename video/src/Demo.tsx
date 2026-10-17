import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { Captions, EndCard, Hook, ImageScene, StepScene } from "./scenes";
import { theme } from "./theme";
import type { Box, Manifest, Timeline } from "./types";

export type DemoProps = {
  timeline: Timeline | null;
  manifest: Manifest | null;
};

export const Demo = ({ timeline, manifest }: DemoProps) => {
  const { fps } = useVideoConfig();
  if (!timeline || !manifest)
    return <AbsoluteFill style={{ background: theme.bg }} />;
  let lastTarget: Box | null = null;
  return (
    <AbsoluteFill style={{ background: theme.bg, fontFamily: theme.bodyFont }}>
      {timeline.segments.map((segment) => {
        const from = Math.round(segment.startSec * fps);
        const durationInFrames =
          Math.round((segment.startSec + segment.durationSec) * fps) - from;
        const step =
          segment.scene === "step"
            ? manifest.steps.find((s) => s.id === segment.id)
            : undefined;
        const cursorFrom = lastTarget;
        if (step?.target) lastTarget = step.target;
        return (
          <Sequence
            key={segment.id}
            from={from}
            durationInFrames={durationInFrames}
            premountFor={fps}
          >
            {segment.scene === "hook" && (
              <Hook
                segment={segment}
                backdrop={manifest.steps[0]?.after.at(-1) ?? null}
              />
            )}
            {step && (
              <StepScene
                step={step}
                viewport={manifest.viewport}
                cursorFrom={cursorFrom}
              />
            )}
            {segment.scene === "image" && <ImageScene segment={segment} />}
            {segment.scene === "end" && (
              <EndCard timeline={timeline} segment={segment} />
            )}
            <Audio src={staticFile(segment.file)} />
            <Captions words={segment.words} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
