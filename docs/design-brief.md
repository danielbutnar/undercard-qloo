# Design brief: Undercard

Pass 1 of the frontend-anti-slop skill. Status: **approved on 2026-10-15**; section 5 redrawn from the approved draft-bill mockup on 2026-10-17 (M4b).

## 1. Direction

A letterpress show bill from a Western print shop: wood-type names billed by size, black and blue ink on kraft chipboard, with the printer's job ticket pinned beside the proof.

**Why this direction.** A talent buyer's finished product is the bill, and on a bill an act's fee band already shows as its type size: Mid acts print larger than Openers. That gives the board and the Poster one visual language. The second ink has a job: everything Qloo returned (affinity, popularity, the call trace) prints in blue, everything else in black, so "LLM only" visibly loses its blue.

## 2. Tokens

| Token | Hex | Use |
|---|---|---|
| page | `#CDB38A` | kraft chipboard page |
| surface | `#E4D3B2` | lighter poster stock: act cards, the trace (job ticket), inputs |
| border | `#231B14` | ink rules: 2px around cards and panels |
| text | `#1C1611` | black ink |
| muted | `#54412F` | worn ink: labels, empty slots, older trace rows |
| accent | `#1F3F8C` | blue second ink: Qloo data, the trace, the Build button |
| on-accent | `#F1E5CD` | text on blue or red fills |
| danger | `#801B12` | red stamp ink: "Unavailable", "No Qloo data", rate-limit errors |

`node scripts/design-check.mjs contrast` output:

```text
#1C1611 on #CDB38A: 8.88:1 PASS (needs 4.5:1)
#1C1611 on #E4D3B2: 12.16:1 PASS (needs 4.5:1)
#54412F on #CDB38A: 4.79:1 PASS (needs 4.5:1)
#54412F on #E4D3B2: 6.56:1 PASS (needs 4.5:1)
#1F3F8C on #CDB38A: 4.85:1 PASS (needs 4.5:1)
#1F3F8C on #E4D3B2: 6.64:1 PASS (needs 4.5:1)
#F1E5CD on #1F3F8C: 7.84:1 PASS (needs 4.5:1)
#801B12 on #CDB38A: 5.00:1 PASS (needs 4.5:1)
#801B12 on #E4D3B2: 6.84:1 PASS (needs 4.5:1)
#F1E5CD on #801B12: 8.08:1 PASS (needs 4.5:1)
#231B14 on #CDB38A: 8.41:1 PASS (needs 3:1, large text or UI)
```

## 3. Type

- **Display:** Big Shoulders, weight 800, set in capitals like wood type. Festival name, headliners, band names, act names. (Google Fonts merged Big Shoulders Display into Big Shoulders; its optical-size axis gives the display cut at these sizes.)
- **Body:** Libre Franklin, weights 400 and 600. Labels, the Why Boise line, tags, the trace. Large standalone numbers use proportional figures; tabular figures only where numbers align in a column (trace result counts), per the dataviz skill.
- Request parameters in the trace are real code, so they sit in `<code>` in the body face, not a monospace face.
- Scale (px): 16 · 18 · 22 · 28 · 36 · 48 · 72. Body copy 18, labels and tags 16, Opener act names 22, key numbers 28 (Opener) and 36 (Mid), band names 36, festival name 48, headliners 72 (36 once the board has acts, so the Qloo numbers carry the frame).

## 4. Shape

- Radius: `--radius-sm: 2px` for buttons, chips and inputs (a 44px button stays far under 22px); cards and panels are square-cut stock, 0px.
- Borders, not shadows: 2px ink rules around cards and panels, 1px muted rules between trace rows. No shadows.
- Elevation: none. The Poster is its own full screen, not a floating layer.
- Spacing scale (px): 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Page gutter 24 at 1440 wide, 16 on mobile.

## 5. Screens (1440x810, the video viewport)

Redrawn on 2026-10-17 from the approved draft-bill mockup, for M4b. Tokens and type are unchanged: every size below comes from the scale in section 3. There is one route, `/`, and it opens on the latest saved build, set as the buyer's draft bill. `[Q]` marks Qloo output, printed in blue ink. Names below are the synthetic ones the design shots use.

**Step 1: the draft bill loads.** `[Q]` The eye lands on the bill: the headliners, then the Mid acts and their blue room marks. The key sits beside the first mark, so the marks are explained where they are first seen.

```text
+------------------------------------------------------------------------------------------------+
| UNDERCARD  Booking desk · Sagebrush Sound    [ With Qloo: the agent's bill | Without Qloo: the model's picks ] [ Export CSV ]
+------------------------------------------------------------------------------------------------+
| +- bill sheet: surface, 2px rule, inner 1px rule ------------------------+  +- rooms ------------+
| | Boise, Idaho · 3,000 capacity · crowd aged 25–34   [UNDERCARD DRAFT ·  |  | BOISE CROWDS BEHIND |
| |                                                      NOT ANNOUNCED] red |  | THIS BILL      22px |
| |                          SAGEBRUSH SOUND                          36px  |  | Qloo listed 8 Boise |
| |               KHRUANGBIN · JAPANESE BREAKFAST                     48px  |  | live-music places;  |
| |        Headliners booked. The agent drafted the undercard below.  16px  |  | the agent tested 3. |
| | ----------------------------------------------------------------------- |  | A room is a crowd   |
| |  MID  4 slots · fee band set by Qloo's popularity percentile: 80th–92nd |  | here, not a stage.  |
| |                                                                         |  |                     |
| |     HOLLOW PINES   36px   | [The Lantern Room ▲11] Qloo ranks artists   |  | The Lantern Room  7 |
| |  [The Lantern Room ▲11]   | by how much the headliners' fans like them. |  | lifted 7 acts  48px |
| |          [Q] 22px         | Adding The Lantern Room's crowd moves this  |  | Fort Street       3 |
| |                           | act up 11 places. Qloo: data on what people |  | Ballroom (FSB)      |
| |                           | like, across music, places and more.  16px  |  | Cottonwood Social 0 |
| |   MARISOL VEY        THE DITCH RIDERS        KESTREL & BLOOM            |  | Hall: lifted none   |
| |    [FSB ▲7]       [The Lantern Room ▲26]  [The Lantern Room ▲9]         |  +---------------------+
| | ----------------------------------------------------------------------- |  [ WATCH THE AGENT     ]
| |  OPENER  6 slots · fee band set by Qloo's popularity percentile: 55th–80th  [ BUILD IT       28px ]
| |    JUNIPER STATIC    OWYHEE DRIFT    SALTGRASS    TEDDY ARCANA    28px  |  Replays the saved build:
| |         LOW BENCH CHOIR [The Lantern Room new]    CASS WREN             |  12 Qloo calls, then the
| | ----------------------------------------------------------------------- |  bill reprints.
| | Drafted by the agent from 12 Qloo calls · saved Oct 15, 14:02 UTC ·     |  Run the agent live instead
| | click an act to open its card, where you can mark it unavailable        |
| +-------------------------------------------------------------------------+
```

- **The bill** is the sheet from the Poster, now the board. Fact line 16px, red stamp 22px, festival 36px, headliners 48px on one line, band names 22px, Mid act names 36px, Opener act names 28px, all Big Shoulders 800. Each band stays a region of `<article>`s, so the tests' selectors hold.
- **The mark** under each act: the room's short name (its initials when the name has three or more words, the full name otherwise) and the places it gained, "▲11", in 22px blue Big Shoulders inside a 2px blue rule. An act that was outside the headliners-only top 50 reads "new" instead of a count. The places come from the act's Why Boise line, so the build saved on Oct 15 needs no new field.
- **The key** sits beside the first Mid act, the two on a row of their own, in 16px Libre Franklin: what the first mark means, what "new" means when an act on the bill carries it, and what Qloo is (what people like, across music, places and more). It stays in that slot while the act is refilled, so nothing jumps.
- **Each act is a button:** a pointer, an underline on hover and on keyboard focus, and the act's name as its accessible name. No hover-scale (B7).
- **The rooms rail** counts what each tested room lifted, a 48px blue number per room and a muted 0 for a room that lifted none, and says the rooms are crowds, not stages. While the trace is in use (streaming, listing calls, refilling or showing a refusal) it compacts to names and 28px counts, so the trace stays in frame at 810 tall.
- **The rail** is 336px, so "Watch the agent build it" sets on one line at 28px.
- Presale is off the first screen; the component and the seed stay.

**Step 2: "Watch the agent build it".** `[Q]` The trace panel opens in the rail under the rooms and replays the saved build's calls, the newest row with the 4px blue rule. The bill's undercard clears to dashed open slots while the calls stream. When the lineup lands, the acts print in one at a time (0.38 s each, 0.12 s apart), each with its mark, and the rooms' counts tick up with them. This is the screen's one motion moment; under `prefers-reduced-motion` the end state shows at once. Afterwards the panel reads "Replayed the build saved Oct 15, 14:02 UTC: 12 Qloo calls, served from the cache.", and "Run the agent live instead" offers a fresh, rate-limited run.

```text
+- rooms: counts tick 0 -> 7 -----+
+- trace -------------------------+
| [ WATCH THE AGENT BUILD IT ]    |
| QLOO CALLS             9 of 12  |
| 8. Mid-band artists for the  50 |
|    headliners and The Lantern…  |
|| 9. Mid-band artists for the 50 |  <- newest row, blue rule [Q]
||   headliners and FSB…          |
+---------------------------------+
```

**Step 3: open an act.** A click on an act opens its card at the top of the rail, in place of the rooms: the existing act card with the name, Qloo affinity and popularity `[Q]` (36px on a Mid card, 28px on an Opener card), the Why Boise line, two shared tags and "Unavailable". "Close" brings the rooms back. On a phone the card opens under the bill and takes focus.

**Step 4: "Unavailable".** The card and the act on the bill take the red "Unavailable" stamp and muted ink. `[Q]` The refill call joins the trace with the blue rule, and the replacement prints into the same slot with its mark; the card closes.

**Step 5: "Without Qloo: the model's picks".** The sheet reprints with the model's ten picks under the same headliners, in black ink only, three across at 1400px and wider, two below. A red "No Qloo data" stamp replaces the draft stamp. Each pick shows its name (28px), the model's own reason (16px), and two plain facts: "No Boise room · fee band not checked". There is no score or tally. The rail says what the model got (the same brief, no tools) in place of the rooms and the trace. "With Qloo: the agent's bill" brings back the blue, and "Export CSV" in the bar downloads the agent's bill.

**No saved build, or the store can't be reached.** Today's empty board loads instead, never an error: the festival block with the 72px headliners, ten dashed "Open slot" boxes in Mid and Opener, and the trace panel with "Build undercard". Once a build starts, the screen becomes the bill.

**1280x800 (a judge's laptop):** the same layout; the bill fills the left column and the rail stays 336px.

**Mobile (390 wide):** one column. The bar wraps (the wordmark, then the switch and Export CSV), then the bill with its acts centred and the key under the first act, then the rooms, the Watch button and the trace. An opened card sits under the bill and takes focus.

## 6. Avoided, and what instead

| Ban | Where this kind of app usually shows it | What this design does instead |
|---|---|---|
| A1 Cream page | A warm "editorial" off-white page | Kraft chipboard `#CDB38A`, a mid-tone (lowest channel 0.54), with darker ink |
| A2 Italic accents | "Build your *perfect* lineup" headings | No italics; emphasis comes from type size and the blue ink |
| A3 01 / 02 / 03 labels | Numbered "how it works" steps | No step labels; the trace numbers calls 1, 2, 3 because the count against the 12-call cap is data |
| A4 Monospace labels | Metric labels and IDs in a mono face | Labels in Libre Franklin; only real request parameters sit in `<code>` |
| A5 Pill buttons | Rounded "Build" and "Export" buttons | 2px-radius cut-card buttons with a 2px ink rule |
| B1 Purple gradients | An "AI" gradient on the build button | Flat ink; no gradients anywhere |
| B2 Inter or Geist only | The scaffold's Geist | Big Shoulders with Libre Franklin |
| B3 Emoji | A ticket or music-note emoji per card | Text labels only; no icons needed |
| B4 Sparkles for AI | A sparkle on "Build undercard" | The agent shows itself through its Qloo calls in the trace |
| B5 Glass cards | Blurred cards over a photo | Opaque stock with ink rules; no photos (SPEC.md section 7) |
| B6 Eyebrow labels | "HEADLINERS" in small spaced caps | Band names are 36px display words; small labels are sentence case at 16px with no tracking |
| B7 Hover scale | Cards that grow on hover | Hover reverses the ink: a button fills blue, a card's rule thickens to 4px |
| B8 Placeholder copy | "Artist Name", "Venue" | A named fictional festival and named synthetic acts and venues |
| B9 Centered hero | A landing page before the tool | The app opens on the working board; no landing page |
| B10 KPI cards | Capacity, age, sold and days as four tiles | One typeset line of facts and one sparkline with one number |
| B11 Neon on black | A "nightlife" dark theme | A light kraft page with dark ink |
| B12 Low contrast | Muted gray labels | Every pair above passes; muted ink is 0.NN:1 on the page |

Checked against the lists: kraft with two inks is neither pure white with black buttons nor a dark page with neon accents.

## 7. Video legibility

- No text under 16px at 1440 wide; trace parameters are 16px too.
- Key numbers: affinity and popularity 36px on Mid cards and 28px on Opener cards; tickets sold 28px; trace result counts 28px.

## 8. Couldn't confirm

- Qloo brand guidelines: RULES.md links none, and I did not search for them. The blue ink is this product's color, not Qloo's.
- Resolved in Pass 2: `next/font/google` serves the family as Big Shoulders (Big Shoulders Display no longer exists there). next/font warns it has no fallback metrics for it; harmless.
- Resolved in Pass 2: six Opener cards fit across 1440 beside a 360px trace column, but at 810 tall their Why Boise lines and tags fall below the fold on the filled board; the names and Qloo numbers stay in frame.
- How kraft reads after video compression: checked on the M5 render.
