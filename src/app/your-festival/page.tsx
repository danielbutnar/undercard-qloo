import type { Metadata } from "next";
import { YourFestival } from "@/components/your-festival";
import { briefFromSearch } from "@/lib/your-festival";

export const metadata: Metadata = {
  title: "Your festival · Undercard",
  description:
    "Name a town and two headliners; Undercard's agent drafts the undercard from that town's own music rooms through Qloo.",
};

// A pre-filled link's town and headliners come from the URL (M6h), so the page waits for them
// rather than showing an empty form first (Next.js: instant-shell-url-data).
export const instant = false;

export default async function YourFestivalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const one of [value ?? []].flat()) query.append(key, one);
  return <YourFestival linked={briefFromSearch(query.toString())} />;
}
