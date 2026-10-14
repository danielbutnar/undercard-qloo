import type { Metadata } from "next";
import { notFound } from "next/navigation";
import fixture from "../../../../tests/fixtures/lineup.synthetic.json";
import { FestivalScreen } from "@/components/festival-screen";
import { LineupSchema } from "@/lib/lineup";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

export const metadata: Metadata = {
  title: "Board preview · Undercard",
  robots: { index: false },
};

// Development only: the board filled from the synthetic fixture, for design review until the
// M2 agent can fill it for real. Production builds (and Vercel previews) answer 404.
export default function BoardPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const { acts } = LineupSchema.parse(fixture);
  return (
    <FestivalScreen
      festival={SAGEBRUSH_SOUND}
      acts={acts}
      note="Synthetic preview data, development only"
    />
  );
}
