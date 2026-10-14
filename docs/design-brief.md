# Design brief: Undercard

Pass 1 of the frontend-anti-slop skill. Status: **waiting for approval**. Nothing visual is built until this is approved.

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

- **Display:** Big Shoulders Display, weight 800, set in capitals like wood type. Festival name, headliners, band names, act names.
- **Body:** Libre Franklin, weights 400 and 600, with tabular figures for every number. Labels, the Why Boise line, tags, the trace.
- Request parameters in the trace are real code, so they sit in `<code>` in the body face, not a monospace face.
- Scale (px): 16 · 18 · 22 · 28 · 36 · 48 · 72. Body copy 18, labels and tags 16, Opener act names 22, key numbers 28 (Opener) and 36 (Mid), band names 36, festival name 48, headliners 72.

## 4. Shape

- Radius: `--radius-sm: 2px` for buttons, chips and inputs (a 44px button stays far under 22px); cards and panels are square-cut stock, 0px.
- Borders, not shadows: 2px ink rules around cards and panels, 1px muted rules between trace rows. No shadows.
- Elevation: none. The Poster is its own full screen, not a floating layer.
- Spacing scale (px): 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Page gutter 24 at 1440 wide, 16 on mobile.

## 5. Screens (1440x810, the video viewport)

There is one route, `/`, in five states, plus the Poster. `[Q]` marks Qloo output, printed in blue ink.

**Step 1: the festival loads.** The eye lands on the 72px headliners, then on the empty slots.

```text
+------------------------------------------------------------------------------------------------+
| UNDERCARD                                                   [ Qloo | LLM only ]   [ Poster ]   |  56px, 2px ink rule
+------------------------------------------------------------------------------------------------+
| SAGEBRUSH SOUND                                    48px | Presale, last 30 days                |
| Boise, Idaho · 3,000 capacity · crowd aged 25-34   18px |  /\                                  |
|                                                         | /  \__,-._,_.-,_._,-._  blue line    |
| KHRUANGBIN · JAPANESE BREAKFAST                    72px | 1,450 sold of 3,000            28px  |
| Booked headliners                                       |                                      |
+-----------------------------------------------------------------+------------------------------+
| MID   popularity 0.80-0.92 · 4 slots                     36px   | [ BUILD UNDERCARD ]  blue    |
| +- - - - - -+ +- - - - - -+ +- - - - - -+ +- - - - - -+         |------------------------------|
| | Open slot | | Open slot | | Open slot | | Open slot |  dashed | Qloo calls                   |
| +- - - - - -+ +- - - - - -+ +- - - - - -+ +- - - - - -+  muted  | The agent's calls list here  |
| OPENER   popularity 0.55-0.80 · 6 slots                         | as it makes them.            |
| +- - - -+ +- - - -+ +- - - -+ +- - - -+ +- - - -+ +- - - -+     |                              |
| | Open  | | Open  | | Open  | | Open  | | Open  | | Open  |     |                              |
| +- - - -+ +- - - -+ +- - - -+ +- - - -+ +- - - -+ +- - - -+     |                              |
+-----------------------------------------------------------------+------------------------------+
```

**Step 2: "Build undercard" streams the trace.** `[Q]` The trace is the first thing the eye lands on: it is the only blue on screen and the only thing moving, the newest row carries a 4px blue rule, and the board is still empty dashed outlines.

```text
                                                                  +------------------------------+
                                                                  | Qloo calls        4 of 12    |
                                                                  | 1 /search                 1  | <- result count 28px [Q]
                                                                  |   query=Khruangbin           |
                                                                  | 2 /search                 1  |
                                                                  |   query=Japanese Breakfast   |
                                                                  | 3 /v2/insights place      9  |
                                                                  |   filter.location.query=...  |
                                                                  || 4 /v2/insights artist    ... | <- newest row, blue rule
                                                                  ||   signal.interests...       |
                                                                  +------------------------------+
```

**Step 3: the board fills.** `[Q]` The eye lands on the Mid cards' 36px blue affinity numbers, the largest blue on screen. Older trace rows fade to muted ink.

```text
| MID   popularity 0.80-0.92 · 4 slots                                                  |
| +---------------------+ +---------------------+ +-------------------+ +-------------+ |
| | HOLLOW PINES   28px | | MARISOL VEY         | | THE DITCH RIDERS  | | KESTREL &   | |
| | 0.94 [Q]   91st [Q] | | 0.91        88th    | | ...               | | BLOOM       | |
| | affinity   popularity -> Mid                  |                     |             | |
| | Why Boise: shares fans with The Lantern Room  |                     |             | |
| | [Dream Pop] [Psychedelic Rock]  [Q] tags      |                     |             | |
| |               Unavailable                     |                     |             | |
| +---------------------+ +---------------------+ +-------------------+ +-------------+ |
| OPENER   popularity 0.55-0.80 · 6 slots      (narrower cards, 22px names, 28px numbers) |
| +--------+ +--------+ +--------+ +--------+ +--------+ +--------+                        |
```

**Step 4: "Unavailable" refills a slot.** The marked card gets a red "Unavailable" stamp and drops to muted ink; `[Q]` a new trace row (call 13, `filter.exclude.entities`) gets the blue rule; the replacement card prints into the same slot.

**Step 5: "LLM only", then the Poster.** In LLM only, every card prints in black ink only: affinity and popularity read "—", the Why Boise line reads "No local link", and the board header carries a red "No Qloo data" stamp. Flipping back restores the blue. The Poster fills the screen as the show bill:

```text
+------------------------------------------------------------------------------------------------+
| < Back to board                                                         [ Export CSV ]  blue   |
|                                  SAGEBRUSH SOUND                                       48px    |
|                          KHRUANGBIN · JAPANESE BREAKFAST                               72px    |
|              HOLLOW PINES · MARISOL VEY · THE DITCH RIDERS · KESTREL & BLOOM            36px    |
|  JUNIPER STATIC · OWYHEE DRIFT · SALTGRASS · TEDDY ARCANA · LOW BENCH CHOIR · CASS WREN  22px    |
|                         Boise, Idaho · 3,000 capacity                                  18px    |
+------------------------------------------------------------------------------------------------+
```

**Mobile (390 wide):** one column. App bar with the mode switch, then the festival block, the sparkline, Build undercard, the trace as a list that starts collapsed after the build, Mid cards full width and Opener cards two across.

## 6. Avoided, and what instead

| Ban | Where this kind of app usually shows it | What this design does instead |
|---|---|---|
| A1 Cream page | A warm "editorial" off-white page | Kraft chipboard `#CDB38A`, a mid-tone (lowest channel 0.54), with darker ink |
| A2 Italic accents | "Build your *perfect* lineup" headings | No italics; emphasis comes from type size and the blue ink |
| A3 01 / 02 / 03 labels | Numbered "how it works" steps | No step labels; the trace numbers calls 1, 2, 3 because the count against the 12-call cap is data |
| A4 Monospace labels | Metric labels and IDs in a mono face | Labels in Libre Franklin; only real request parameters sit in `<code>` |
| A5 Pill buttons | Rounded "Build" and "Export" buttons | 2px-radius cut-card buttons with a 2px ink rule |
| B1 Purple gradients | An "AI" gradient on the build button | Flat ink; no gradients anywhere |
| B2 Inter or Geist only | The scaffold's Geist | Big Shoulders Display with Libre Franklin |
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
- That `next/font/google` serves Big Shoulders Display under that name in Next 16.4: checked at the start of Pass 2, with Libre Franklin's tabular figures.
- Whether six Opener cards fit across 1440 next to a 400px trace column: the wireframes are estimates, and the Pass 2 screenshots decide.
- How kraft reads after video compression: checked on the M5 render.
