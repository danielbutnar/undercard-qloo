import type { Metadata } from "next";
import { Big_Shoulders, Libre_Franklin } from "next/font/google";
import "./globals.css";

// Big Shoulders is the Google Fonts family that absorbed Big Shoulders Display; its optical
// size axis gives the display cut at the large sizes the bill uses.
const display = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  axes: ["opsz"],
});

const body = Libre_Franklin({
  variable: "--font-libre-franklin",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Undercard",
  description:
    "A lineup agent for festival talent buyers: two booked headliners in, a fee-banded undercard grounded in local taste out, powered by Qloo.",
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
