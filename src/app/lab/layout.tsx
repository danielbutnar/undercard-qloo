import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { labEnabled } from "@/lib/lab";

export const metadata: Metadata = {
  title: "Undercard lab",
  robots: { index: false, follow: false },
};

/** The design round's lab: a 404 everywhere but `next dev` on this machine (src/lib/lab.ts). */
export default function LabLayout({ children }: LayoutProps<"/lab">) {
  if (!labEnabled()) notFound();
  return children;
}
