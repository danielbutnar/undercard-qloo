import type { Metadata } from "next";
import { ShortlistScreen } from "@/components/shortlist/shortlist-screen";

export const metadata: Metadata = {
  title: "Check a shortlist · Undercard",
  description:
    "Paste the acts you've been pitched; Undercard sorts them by how fans of a town's own music venues rank them on Qloo. It drafts nothing and books nothing.",
};

// The buyer's shortlist (WS4). The page itself never calls Qloo: a check runs only when the
// buyer presses the button (POST /api/shortlist).
export default function ShortlistPage() {
  return <ShortlistScreen />;
}
