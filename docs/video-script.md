# Video script: Undercard

The narration for the demo video, scene by scene, following the demo path in SPEC.md, section 3, on the live demo. Nothing is rendered and no voiceover is made yet: the stills are shot from the final screens after the deploy, and the voiceover is made then, with its tool named in README.md's AI usage section.

## Length and rules

- **Length: under 2:00, aimed at about 1:50.** RULES.md states no limit; Qloo's hackathon manager suggested a couple of minutes at most (RULES.md, Unclear 2), and SPEC.md caps it at 3:00. The narration below is 276 words: about 1:44 at 160 words a minute and 1:50 at 150, before the pauses between scenes (about 6 s). If the voiceover runs past 2:00, shorten scenes 2 and 5 first, never scene 6.
- **Working product by 10 s** (SPEC.md, section 4): the first frame is the live first screen.
- **One measured number about the product**: in all 29 checked towns, a saved build fills every slot (scene 7). The setlist in scene 2 also shows the saved build's own call count on screen.
- **The voice**: an AI voiceover, said on the end card. Captions on, since judges may watch muted: each scene's narration is its caption.
- **What it must not say** (Daniel, 29 October): that Undercard picks what festivals would book, or beats asking a model directly. The case is the evidence behind each pick, inside the buyer's fee ranges, with every call shown. NOT SHOWN is read out at the same pace and weight as SHOWN.
- **No act and no venue is named** in the narration or the captions: their names are Qloo's data, and the screen shows them. The control is "a venue abroad" or "a venue in <town> with similar Qloo popularity", never "a room".
- **Every number spoken** is one the story states and `pnpm evidence:check` checks there (table at the end).

## Scenes

### 1. The draft (0:00 to 0:10)

**On screen:** the live first screen, Sagebrush Sound in Boise: the poster with the headliners over the mid-size and opening acts, each in its venue's colour with its rank and climb, and the town with its venue signs. A slow push in on the poster.

**Narration:** "You've booked the headliners. Undercard, an AI agent built on Qloo, drafts the acts below them inside your fee ranges, with the evidence behind every pick."

### 2. Watch the AI agent build it (0:10 to 0:25)

**On screen:** the cursor presses Watch the AI agent build it. The camera closes on a venue as the replay reads its fans; the caption names the Qloo call and its result count; the venue's acts fly into their slots. Then the AI agent's setlist under the town, with its call count.

**Narration:** "Watch replays it: for each fee range, Qloo ranks artists for the headliners' fans, then with one Boise venue's fans added, and with a venue abroad of similar Qloo popularity. Every call is listed."

### 3. One act's evidence (0:25 to 0:43)

**On screen:** the cursor opens the first act's card: its place for the headliners' fans alone and with the venue's fans added, its climb with the venue and with its control, its popularity inside the fee range, its two shared genres. Keep, Unavailable and Close in view.

**Narration:** "Each card carries the evidence: both climbs, popularity in the fee range, shared genres. An act books only if it climbs at least 5 places with the town's venue, and 5 more than with the venue abroad. The agent plans; a fixed rule picks."

### 4. A refill (0:43 to 0:53)

**On screen:** the cursor presses Unavailable and picks a reason (radius clause); the replacement prints into the slot.

**Narration:** "Can't book an act? Mark it unavailable and say why. The slot refills by the same rule, in at most 5 new Qloo calls."

### 5. Without Qloo, and the export (0:53 to 1:04)

**On screen:** the Without Qloo tab: the model's picks, each with its reason and its check on Qloo afterwards. Then back to the draft, and the cursor presses Export CSV.

**Narration:** "Without Qloo, the AI model alone answers the same brief, with its own reasons and no view of the town's venues. Then export the CSV."

### 6. What was tested (1:04 to 1:45)

**On screen:** How it works, What was tested: the three stamps, the camera resting on each in turn while it is read: SHOWN 244 of 290, PARTLY SHOWN 20 of 30, NOT SHOWN 3 vs 11.

**Narration:** "What was tested, said plainly. Shown: 244 of the 290 acts Undercard 1.0 booked (its bills of 21 October) climbed at least 5 places more with the town venue that put them on the bill than with a music venue abroad of similar Qloo popularity. Partly shown: 20 of 30 real festivals where the acts booked showed more lift from the town's venues than random acts of their tier; another country's venues did it at 18. Not shown: at 33 real festivals, Undercard's shortlists held 3 of the acts the festivals actually booked; the AI model alone held 11. Neither test bar was met."

### 7. End (1:45 to 1:54)

**On screen:** the poster, the live demo's address (undercard-daniel-51ed.vercel.app), "Built on Qloo" and "Narration: AI voiceover" (with the tool's name, once it is chosen).

**Narration:** "All 29 checked towns have a saved build with every slot filled. Undercard drafts. The buyer makes every call."

## The numbers spoken, and where they are checked

Each is in docs/devpost-story.md, whose claims `pnpm evidence:check` lists (scripts/evidence-claims.ts).

| Scene | Spoken | In the story | Checked against |
|---|---|---|---|
| 3 | at least 5 places with the town's venue | "it climbs at least 5 places with the town's venue" | src/lib/assemble-lineup.ts, MIN_LIFT |
| 3 | 5 more than with the venue abroad | "and at least 5 more than with the control" | not recomputable: LOCAL_LIFT_BAR, set by section 37's rule |
| 4 | at most 5 new Qloo calls | "in at most 5 Qloo calls" | src/server/refill.ts, REFILL_CALL_CAP |
| 6 | 244 of the 290, at least 5 places more | the SHOWN stamp, word for word | not recomputable: docs/evidence.md section 37, 28 October 2026 |
| 6 | 20 of 30, 18 | the PARTLY SHOWN stamp, word for word | not recomputable: sections 26 and 34, 21 and 22 October 2026 |
| 6 | 33, 3, 11 | the NOT SHOWN stamp, word for word | not recomputable: section 38, 28 October 2026 |
| 7 | all 29 checked towns, every slot filled | "In 29 of the 29 checked towns, a saved build of the same brief fills every slot" | the saved builds' replays, and src/lib/checked-towns.ts |

## Left for after the deploy

- Shoot the stills on the final screens, from the live demo, along this path.
- Make the voiceover from the narration above, name its tool in README.md's AI usage section and on the end card, and fill in the story's Built with and Video demo link fields.
- Render, then check the length (under 2:00), the frame rate, that the product shows by 10 s, and that the captions match the narration word for word.
