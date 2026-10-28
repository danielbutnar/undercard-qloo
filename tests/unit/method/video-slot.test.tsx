// @vitest-environment jsdom
// WS2 (a): How it works' video slot reads DEMO_VIDEO_URL. Unset, it renders nothing at all,
// heading included; a YouTube link shows the video's thumbnail and a play button, and only the
// press loads the youtube-nocookie.com player (M9c); a direct .mp4 keeps the plain player.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MethodPage } from "@/components/method-page";
import { VideoSlot } from "@/components/video-slot";
import { DEMO_VIDEO_URL, youTubeId } from "@/lib/method";

afterEach(cleanup);

const ID = "undercard01";

describe("a YouTube link's video id", () => {
  it("reads the usual link shapes", () => {
    for (const url of [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?v=${ID}&t=12s`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}`,
      `https://youtu.be/${ID}?si=abc`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube-nocookie.com/embed/${ID}`,
    ])
      expect(youTubeId(url), url).toBe(ID);
  });

  it("is null for anything else", () => {
    for (const url of [
      "https://example.org/demo.mp4",
      `https://vimeo.com/${ID}`,
      `https://www.youtube.com.evil.test/watch?v=${ID}`,
      "https://www.youtube.com/watch?v=short",
      "https://www.youtube.com/watch",
      `javascript:alert("${ID}")`,
      "not a link",
    ])
      expect(youTubeId(url), url).toBeNull();
  });
});

describe("the video slot", () => {
  it("renders nothing while the video isn't published, reading DEMO_VIDEO_URL", () => {
    expect(DEMO_VIDEO_URL).toBeNull();
    expect(render(<VideoSlot />).container.innerHTML).toBe("");
    cleanup();
    expect(render(<VideoSlot url={null} />).container.innerHTML).toBe("");
  });

  it("leaves How it works without a slot, heading or placeholder until then", () => {
    render(<MethodPage />);
    expect(screen.queryByRole("region", { name: "The demo video" })).toBeNull();
    expect(screen.queryByText(/demo video/i)).toBeNull();
    expect(screen.queryByText(/will play here/)).toBeNull();
    expect(document.querySelector("video, iframe")).toBeNull();
  });

  it("shows a YouTube video's thumbnail and a play button, and loads the player only when pressed", () => {
    render(<VideoSlot url={`https://www.youtube.com/watch?v=${ID}`} />);
    const slot = screen.getByRole("region", { name: "The demo video" });
    expect(
      within(slot).getByRole("heading", { name: "The demo video" }),
    ).toBeTruthy();
    const play = within(slot).getByRole("button", {
      name: "Play the demo video",
    });
    expect(play.querySelector("img")?.getAttribute("src")).toBe(
      `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`,
    );
    expect(document.querySelector("iframe, video, script")).toBeNull();

    fireEvent.click(play);
    const player = slot.querySelector("iframe")!;
    expect(player.getAttribute("src")).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0`,
    );
    expect(player.getAttribute("title")).toBe("Undercard's demo video");
    expect(player.getAttribute("allow")).toContain("autoplay");
    expect(slot.querySelector("img")).toBeNull();
    expect(
      within(slot).queryByRole("button", { name: "Play the demo video" }),
    ).toBeNull();
  });

  it("keeps the plain player for a direct .mp4, loaded only when played", () => {
    render(<VideoSlot url="https://example.org/demo.mp4" />);
    const slot = screen.getByRole("region", { name: "The demo video" });
    expect(document.querySelector("video, iframe")).toBeNull();
    fireEvent.click(
      within(slot).getByRole("button", { name: "Play the demo video" }),
    );
    expect(slot.querySelector("video")?.getAttribute("src")).toBe(
      "https://example.org/demo.mp4",
    );
    expect(slot.querySelector("iframe")).toBeNull();
  });

  it("opens How it works once the video is published, before the scenes", () => {
    render(<MethodPage videoUrl={`https://youtu.be/${ID}`} />);
    const video = screen.getByRole("region", { name: "The demo video" });
    // No saved build here: the scenes' place says so (WS12 item 2).
    const picture = screen.getByRole("region", { name: "Follow one act" });
    expect(
      video.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
