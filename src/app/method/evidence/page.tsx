import type { Metadata } from "next";
import { MethodEvidencePage } from "@/components/method-evidence";

export const metadata: Metadata = { title: "The evidence · Undercard" };

// The evidence and the five objections (M10b moved them here from How it works): static.
export default function MethodEvidence() {
  return <MethodEvidencePage />;
}
