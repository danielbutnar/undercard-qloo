import type { Metadata } from "next";
import { CardPage } from "../_kit/card-page";
import "../design-2.css";

export const metadata: Metadata = { title: "Design 2.0 · the act card" };

/** WS12 step 0, item 3: the finished act card, open where it opens today (dev only). */
export default function Design2Card() {
  return <CardPage control={false} />;
}
