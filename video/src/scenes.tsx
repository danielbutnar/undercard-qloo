import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { theme } from "./theme";
import type {
  Box,
  CaptureStep,
  Segment,
  Timeline,
  Viewport,
  Word,
} from "./types";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SMOOTH = Easing.bezier(0.65, 0, 0.35, 1);
const MAX_ZOOM = 1.5; // 2x stills stay sharp up to this zoom at 1920 wide

function increasing(keys: number[]): number[] {
  const out = [...keys];
  for (let i = 1; i < out.length; i++)
    out[i] = Math.max(out[i], out[i - 1] + 1);
  return out;
}

function zoomFor(box: Box | null, viewport: Viewport): number {
  if (!box) return 1;
  return Math.min(
    MAX_ZOOM,
    Math.max(
      1,
      Math.min(
        viewport.width / (box.width * 1.8),
        viewport.height / (box.height * 1.8),
      ),
    ),
  );
}

function centerOf(box: Box | null, viewport: Viewport): [number, number] {
  return box
    ? [box.x + box.width / 2, box.y + box.height / 2]
    : [viewport.width / 2, viewport.height / 2];
}

const Cursor = (props: {
  from: [number, number];
  to: [number, number];
  start: number;
  arrive: number;
  click: number | null;
  scale: number;
  zoom: number;
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [props.start, props.arrive], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.45, 0, 0.15, 1),
  });
  const x = (props.from[0] + (props.to[0] - props.from[0]) * p) * props.scale;
  const y = (props.from[1] + (props.to[1] - props.from[1]) * p) * props.scale;
  const click = props.click;
  const press =
    click === null
      ? 0
      : interpolate(frame, [click - 4, click, click + 6], [0, 1, 0], CLAMP);
  const ripple =
    click === null ? 0 : interpolate(frame, [click, click + 24], [0, 1], CLAMP);
  return (
    <>
      {click !== null && frame >= click && (
        <div
          style={{
            position: "absolute",
            left: x - 32,
            top: y - 32,
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: "3px solid rgba(255, 255, 255, 0.95)",
            boxShadow: "0 0 0 2px rgba(0, 0, 0, 0.35)",
            opacity: 1 - ripple,
            transform: `scale(${(0.35 + ripple) / props.zoom})`,
          }}
        />
      )}
      <svg
        width={30}
        height={38}
        viewBox="0 0 30 38"
        style={{
          position: "absolute",
          left: x,
          top: y,
          transformOrigin: "0 0",
          transform: `scale(${(1 - press * 0.15) / props.zoom})`,
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))",
        }}
      >
        <path
          d="M2 2 L2 30 L9.5 22.5 L14.5 34 L19.5 31.8 L14.5 20.5 L25 20.5 Z"
          fill="#0b0d0c"
          stroke="#ffffff"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
};

export const StepScene = ({
  step,
  viewport,
  cursorFrom,
}: {
  step: CaptureStep;
  viewport: Viewport;
  cursorFrom: Box | null;
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: d, width, height } = useVideoConfig();
  const k = width / viewport.width; // screenshot CSS px to output px
  const typingFrames = step.typing.length
    ? Math.round(Math.min(1.4, (d / fps) * 0.25) * fps)
    : 0;
  const tMove = Math.round(d * 0.28);
  const resultAt = tMove + Math.round(0.22 * fps) + typingFrames;
  // Camera keys: full view, on the target, hold through the action, on the result, hold, full view.
  const keys = increasing([
    0,
    tMove,
    resultAt,
    resultAt + Math.round(0.6 * fps),
    d - Math.round(0.45 * fps),
    d,
  ]);
  const tAct = keys[1] + Math.round(0.12 * fps);
  const tResult = keys[2];
  const focus = step.focus ?? step.target;
  const [tx, ty] = centerOf(step.target, viewport);
  const [fx, fy] = centerOf(focus, viewport);
  const along = (values: number[]) =>
    interpolate(frame, keys, values, { ...CLAMP, easing: SMOOTH });
  const z = along([
    1,
    zoomFor(step.target, viewport),
    zoomFor(step.target, viewport),
    zoomFor(focus, viewport),
    zoomFor(focus, viewport),
    1,
  ]);
  const cx = along([viewport.width / 2, tx, tx, fx, fx, viewport.width / 2]);
  const cy = along([viewport.height / 2, ty, ty, fy, fy, viewport.height / 2]);
  // Put the camera centre mid-frame without showing past the edges of the still.
  const x = Math.min(0, Math.max(width - width * z, width / 2 - cx * k * z));
  const y = Math.min(0, Math.max(height - height * z, height / 2 - cy * k * z));
  let still = step.before;
  if (step.typing.length && frame >= tAct) {
    still =
      step.typing[
        Math.min(
          step.typing.length - 1,
          Math.floor(
            ((frame - tAct) / Math.max(1, typingFrames)) * step.typing.length,
          ),
        )
      ];
  }
  const afterIndex = Math.min(
    step.after.length - 1,
    Math.max(
      0,
      Math.floor(
        ((frame - tResult) / Math.max(1, keys[4] - tResult)) *
          step.after.length,
      ),
    ),
  );
  const layer = {
    position: "absolute",
    left: 0,
    top: 0,
    width,
    height,
  } as const;
  return (
    <AbsoluteFill style={{ background: theme.bg, overflow: "hidden" }}>
      <div
        style={{
          ...layer,
          transformOrigin: "0 0",
          transform: `translate(${x}px, ${y}px) scale(${z})`,
        }}
      >
        <Img src={staticFile(still)} style={layer} />
        {frame >= tResult && (
          <Img
            src={staticFile(step.after[afterIndex])}
            style={{
              ...layer,
              opacity: interpolate(
                frame,
                [tResult, tResult + 8],
                [0, 1],
                CLAMP,
              ),
            }}
          />
        )}
        {step.target && (
          <Cursor
            from={
              cursorFrom
                ? centerOf(cursorFrom, viewport)
                : [viewport.width * 0.82, viewport.height * 0.86]
            }
            to={[tx, ty]}
            start={Math.round(d * 0.06)}
            arrive={keys[1]}
            click={step.action === "hover" ? null : tAct}
            scale={k}
            zoom={z}
          />
        )}
      </div>
    </AbsoluteFill>
  );
};

// The product's first result fills the frame, sharp, from frame 0; the headline sits in a lower third above the captions.
export const Hook = ({
  segment,
  backdrop,
}: {
  segment: Segment;
  backdrop: string | null;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = (segment.onScreen ?? segment.text).split(/\s+/).filter(Boolean);
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      {backdrop && (
        <Img
          src={staticFile(backdrop)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${interpolate(frame, [0, segment.durationSec * fps], [1, 1.04])})`,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: 96,
          bottom: 232,
          maxWidth: 1240,
          padding: "20px 32px",
          background: theme.bg,
          borderLeft: `8px solid ${theme.accent}`,
          opacity: interpolate(frame, [0.15 * fps, 0.45 * fps], [0, 1], CLAMP),
        }}
      >
        <div
          style={{
            fontFamily: theme.displayFont,
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.1,
            color: theme.text,
          }}
        >
          {words.map((word, i) => {
            const shown = spring({
              frame: frame - Math.round((0.25 + i * 0.08) * fps),
              fps,
              config: { damping: 200 },
            });
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  marginRight: "0.24em",
                  opacity: shown,
                  transform: `translateY(${(1 - shown) * 16}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const ImageScene = ({ segment }: { segment: Segment }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!segment.image) return <AbsoluteFill style={{ background: theme.bg }} />;
  return (
    <AbsoluteFill
      style={{
        background: theme.bg,
        padding: 80,
        opacity: interpolate(frame, [0, 0.5 * fps], [0, 1], CLAMP),
      }}
    >
      <Img
        src={staticFile(segment.image)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          transform: `scale(${interpolate(frame, [0, segment.durationSec * fps], [1, 1.06])})`,
        }}
      />
    </AbsoluteFill>
  );
};

export const EndCard = ({
  timeline,
  segment,
}: {
  timeline: Timeline;
  segment: Segment;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const voice = { elevenlabs: "ElevenLabs", openai: "OpenAI" }[
    timeline.provider
  ];
  return (
    <AbsoluteFill
      style={{
        background: theme.bg,
        justifyContent: "center",
        padding: "0 160px",
        opacity: spring({ frame, fps, config: { damping: 200 } }),
      }}
    >
      <div
        style={{
          fontFamily: theme.displayFont,
          fontSize: 120,
          fontWeight: 800,
          color: theme.text,
        }}
      >
        {timeline.title}
      </div>
      <div style={{ fontSize: 52, color: theme.accent, marginTop: 24 }}>
        {segment.onScreen ?? timeline.url}
      </div>
      <div style={{ fontSize: 34, color: theme.muted, marginTop: 56 }}>
        Built with {timeline.sponsor}
      </div>
      {voice && (
        <div style={{ fontSize: 26, color: theme.muted, marginTop: 16 }}>
          Narration: AI-generated voice ({voice})
        </div>
      )}
    </AbsoluteFill>
  );
};

function captionLines(words: Word[]): Word[][] {
  const lines: Word[][] = [];
  let line: Word[] = [];
  for (const word of words) {
    line.push(word);
    if (line.length >= 8 || /[.!?]$/.test(word.text)) {
      lines.push(line);
      line = [];
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

export const Captions = ({ words }: { words: Word[] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const line = captionLines(words)
    .filter((l) => t >= l[0].start - 0.15)
    .at(-1);
  if (!line || t > line[line.length - 1].end + 0.6) return null;
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 64,
      }}
    >
      <div
        style={{
          maxWidth: 1480,
          padding: "14px 28px",
          borderRadius: 2,
          background: theme.captionBg,
          fontFamily: theme.bodyFont,
          fontSize: 42,
          fontWeight: 600,
          lineHeight: 1.25,
          textAlign: "center",
        }}
      >
        {line.map((word, i) => (
          <span
            key={i}
            style={{
              color: t >= word.start ? theme.captionText : theme.captionDim,
            }}
          >{`${word.text} `}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
