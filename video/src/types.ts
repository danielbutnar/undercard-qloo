export type Box = { x: number; y: number; width: number; height: number };
export type Viewport = { width: number; height: number };
export type Word = { text: string; start: number; end: number };
export type Segment = {
  id: string;
  scene: "hook" | "step" | "image" | "end";
  text: string;
  onScreen?: string;
  image?: string;
  file: string;
  startSec: number;
  audioSec: number;
  durationSec: number;
  words: Word[];
};
export type Timeline = { provider: string; title: string; sponsor: string; url: string; targetSeconds: number; totalSec: number; segments: Segment[] };
export type CaptureStep = { id: string; action: string; before: string; typing: string[]; after: string[]; target: Box | null; focus: Box | null };
export type Manifest = { viewport: Viewport; steps: CaptureStep[] };
