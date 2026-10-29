import { printPoster } from "@/components/share/print-words";
import { printResponse } from "@/server/share-image";

// A poster's request is a few KB at most (twelve venues, ten acts); anything far bigger isn't one.
const MAX_BODY = 32_000;

/**
 * The printable poster (WS12 item 6): the poster the page shows, drawn as a print-size PNG with
 * next/og, as the link preview is. It reads nothing but the request: no build store, no Qloo, no
 * model; the server decides the festival's own words and its stamp (print-words.ts).
 */
export async function POST(request: Request): Promise<Response> {
  const text = await request.text();
  if (text.length > MAX_BODY)
    return Response.json({ error: "That's not a poster." }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const poster = printPoster(body);
  if (!poster)
    return Response.json(
      { error: "That poster isn't one of Undercard's." },
      { status: 400 },
    );
  return printResponse(poster);
}
