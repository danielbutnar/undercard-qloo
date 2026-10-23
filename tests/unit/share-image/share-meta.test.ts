// WS10, step 3: the tags a shared link shows beside the picture, in the first screen's words:
// og:title and og:description, and Twitter's large-image card. The picture itself comes from
// each page's opengraph-image route.
import { describe, expect, it } from "vitest";
import { shareMetadata } from "@/components/share/share-words";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { townBySlug } from "@/lib/towns";

describe("a shared link's tags", () => {
  it("say what the first screen says, for the festival's town", () => {
    const title =
      "You booked the headliners. Undercard drafts the rest from what fans of Boise's music venues like.";
    const description =
      "An AI agent for festival bookers, built on Qloo, a taste-data service that maps what fans of one artist, venue or film also like.";
    expect(shareMetadata(SAGEBRUSH_SOUND)).toEqual({
      openGraph: { title, description, siteName: "Undercard", type: "website" },
      twitter: { card: "summary_large_image", title, description },
    });
  });

  it("name the town's own venues in another town", () => {
    const austin = townBySlug("austin")!.festival;
    expect(shareMetadata(austin).openGraph).toMatchObject({
      title:
        "You booked the headliners. Undercard drafts the rest from what fans of Austin's music venues like.",
    });
  });

  it("leave the picture to the page's opengraph-image route", () => {
    const { openGraph, twitter } = shareMetadata(SAGEBRUSH_SOUND);
    expect(openGraph).not.toHaveProperty("images");
    expect(twitter).not.toHaveProperty("images");
  });
});
