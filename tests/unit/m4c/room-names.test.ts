import { describe, expect, it } from "vitest";
import { roomShortName } from "@/lib/marks";

// Venue names come from Qloo as they are listed, punctuation included.
describe("a room's short name", () => {
  it("uses an abbreviation the name already gives in brackets", () => {
    expect(roomShortName("Copper Hall Arts Centre (CHAC)")).toBe("CHAC");
  });

  it("takes initials only from words that start with a letter or a digit", () => {
    expect(roomShortName("Kettle Factory Boise")).toBe("KFB");
    expect(roomShortName("Fort Street & Ballroom Hall")).toBe("FSBH");
    expect(roomShortName("The Lantern Music Venue (Boise)")).toBe("LMV");
  });

  it("keeps a short name whole, without a bracketed note", () => {
    expect(roomShortName("Larkspur")).toBe("Larkspur");
    expect(roomShortName("The Lantern (Boise)")).toBe("The Lantern");
  });
});
