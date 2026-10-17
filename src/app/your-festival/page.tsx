import type { Metadata } from "next";
import { YourFestival } from "@/components/your-festival";

export const metadata: Metadata = {
  title: "Your festival · Undercard",
  description:
    "Name a town and two headliners; Undercard's agent drafts the undercard from that town's own music rooms through Qloo.",
};

export default function YourFestivalPage() {
  return <YourFestival />;
}
