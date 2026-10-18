import type { Metadata } from "next";
import { MethodPage } from "@/components/method-page";

export const metadata: Metadata = { title: "How Undercard works" };

// The method page (M9c): static, one click from the lineup.
export default function Method() {
  return <MethodPage />;
}
