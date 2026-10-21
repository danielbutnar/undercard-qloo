import type { Metadata } from "next";
import { Anton, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

// The weekly chart's type (docs/design-brief.md): Anton for the chart's places and names, the
// way a printed chart sets its numbers; Schibsted Grotesk, a news face, for everything read.
const display = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

const body = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Undercard",
  description:
    "An AI agent that drafts a festival's smaller acts from what fans of the town's own music venues like, through Qloo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} antialiased`}
    >
      <body className="min-h-dvh bg-page font-body text-body text-ink">
        {children}
      </body>
    </html>
  );
}
