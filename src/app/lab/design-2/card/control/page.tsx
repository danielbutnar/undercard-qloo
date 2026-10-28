import type { Metadata } from "next";
import { CardPage } from "../../_kit/card-page";
import "../../design-2.css";

export const metadata: Metadata = {
  title: "Design 2.0 · the act card with both climbs",
};

/** WS12 step 0, item 3: the finished card with the line WS13.3's second climb fills (dev only). */
export default function Design2CardControl() {
  return <CardPage control />;
}
