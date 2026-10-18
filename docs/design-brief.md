# Design brief: Undercard, the weekly chart

Final design round, direction 1 (branch final-chart, 2026-10-18). This replaces the brief of 2026-10-15, whose letterpress show bill is now banned as C1 in docs/design-bans.md.

## 1. Direction

A printed weekly singles chart: this week's place, last week's place and the arrow between them, the climbers and the new entries, each record's cover beside its title, and the label column naming where it came from.

Why this direction: a chart is where the music business already reads who is moving, and here every move is a town venue's crowd lifting an act, so the climb reads as booking evidence at a glance. The cover column gives every unknown name a picture without a photo: each act's sleeve is drawn from its two genre words and coloured by the venue that lifted it, which answers Daniel's C2 ("a lot of words … without pictures"). The label column becomes the venue's colour tab, so the reason is a mark on the row and its words are one tap away on the act's card.

## 2. Tokens

`@theme` in src/app/globals.css; components use these tokens only.

| Token | Hex | Use |
|---|---|---|
| page | #FF3B2A | the red page, the dominant colour |
| page-hot / page-deep | #FF6B4A / #F03222 | the stage light (top left) and the shade (bottom right) in the page's radial gradients, over a 9 px halftone |
| surface | #FFFFFF | the chart's rows, cards and panels (pure white: never cream) |
| ink / rule / on-page | #0B0B0C | all text on red, every border and hard shadow |
| muted | #4A4F57 | secondary text on white only, never on red |
| accent / on-accent | #FFD60A / #0B0B0C | the one sharp accent: Watch, Skip, new entries, kept acts, what-ifs, shared acts |
| up | #FF3B2A | the bar a counted result must reach (method page) |
| danger | #B3261E | Unavailable, errors, "No Qloo data" |
| quiet | #E9EAEC | blank sleeves, off switches |
| venue-0 … venue-5 | #1D4ED8, #22C3E6, #9BD13B, #B5175F, #0E7A50, #F2B84B | one per venue the agent read (most acts lifted first, src/lib/venue-colours.ts), with on-venue text #FFFFFF / #0B0B0C / #0B0B0C / #FFFFFF / #FFFFFF / #0B0B0C |

`node scripts/design-check.mjs contrast …` on every text pair:

```
#0b0b0c on #ff3b2a: 5.54:1 PASS (needs 4.5:1)
#0b0b0c on #ff6b4a: 6.98:1 PASS (needs 4.5:1)
#0b0b0c on #f03222: 4.86:1 PASS (needs 4.5:1)
#0b0b0c on #ffffff: 19.67:1 PASS (needs 4.5:1)
#4a4f57 on #ffffff: 8.24:1 PASS (needs 4.5:1)
#0b0b0c on #ffd60a: 13.94:1 PASS (needs 4.5:1)
#ffd60a on #0b0b0c: 13.94:1 PASS (needs 4.5:1)
#ffffff on #0b0b0c: 19.67:1 PASS (needs 4.5:1)
#b3261e on #ffffff: 6.54:1 PASS (needs 4.5:1)
#ffffff on #1d4ed8: 6.70:1 PASS (needs 4.5:1)
#0b0b0c on #22c3e6: 9.38:1 PASS (needs 4.5:1)
#0b0b0c on #9bd13b: 10.85:1 PASS (needs 4.5:1)
#ffffff on #b5175f: 6.46:1 PASS (needs 4.5:1)
#ffffff on #0e7a50: 5.36:1 PASS (needs 4.5:1)
#0b0b0c on #f2b84b: 10.99:1 PASS (needs 4.5:1)
#0b0b0c on #e9eaec: 16.34:1 PASS (needs 4.5:1)
#4a4f57 on #e9eaec: 6.85:1 PASS (needs 4.5:1)
#1d4ed8 on #ffffff: 6.70:1 PASS (needs 3:1, large text or UI)
```

The first run had #E2261A for the shade, at 4.24:1 under ink; it was lightened to #F03222 so text that lands on the bottom-right shade still passes.

## 3. Type

- Display: **Anton** (Google Fonts, 400): the chart's places, act names, headings, the headline. A printed chart sets its numbers in a tall condensed gothic; the places run 44 px on the chart, 28 px during Watch, 34 px on the card.
- Body: **Schibsted Grotesk** (Google Fonts, variable): everything read, at 500, 600, 700 and 800. A news face, for a chart page.
- Scale: 16 (label), 18 (body), 22–26 (names), 30–34 (band and panel titles, figures), 46–64 (headline, festival, page titles).
- Not Archivo (the lab's chart), not Big Shoulders (C1), not Inter, Roboto, Geist or Space Grotesk.

## 4. Shape

- Radius 3 px everywhere (a button's radius stays far under half its height; no pills).
- Borders: 2–3 px ink. One elevation: a hard 6 px offset ink shadow on Watch, the edition banner, the card and the storyboard panels. No blur, no glass, no glow.
- Spacing: 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32.
- Motion: rows glide to new places (FLIP, Web Animations), the lineup prints in 0.12 s apart; nothing scales on hover; everything respects prefers-reduced-motion.

## 5. Screens (1440x810, the video viewport)

First screen. Qloo's output (each act's place, its old place and the climb) is the chart itself, the first thing past the headline. The wireframes use placeholder acts and illustrative numbers: no Qloo data is kept in the repository.

```
+--------------------------------------------------------------------------------------------+
| [|||] Undercard                                                 How it works  Your festival |
|                                   |                                                        |
| A festival lineup,                | Sagebrush Sound                   [Draft, not announced]|
| drafted from Boise's              | Boise, Idaho · 3,000 capacity · crowd aged 25-34        |
| own music venues.                 | [quilt] Khruangbin        | [quilt] Japanese Breakfast  |
| Undercard is an AI agent: it      | The headliners, two bands, are already booked · ...    |
| drafts the acts ... venues like.  | MID-SIZE ACTS ####  fee ▭▮ 80th-92nd [?] | OPENING ACTS ###### fee 55th-80th [?] |
| [▶ Watch how it picked these acts]| was 20th ━+12▶ 8 [sleeve] Act A  |V| was 30th ━━+20▶ 10 [sleeve] Act E |V|
| |||||||||||| Replays its 12 Qloo  |           Genre · Genre       |1|           Genre · Genre        |0|
| Qloo is a taste-data service ...  | was 14th ━+6▶  8 [sleeve] Act B  |V| ...                              |V|
| +---------------------------+     | ...                                     | was 40th ━━━━+25▶ 15 Act F         |
| | Switch a venue off        |     |                                         | ┄┄┄NEW▶ 30 Act G                  |
| | [■ Venue 1  7 acts lifted (o)] | [With Qloo|Without Qloo] [Running order] [Export CSV] [Compare with another town] |
| | [■ Venue 2  3 acts lifted (o)] | Drafted by the AI agent from 12 Qloo calls · saved <date> UTC |
+--------------------------------------------------------------------------------------------+
```

Watch, one edition (Qloo's output is the re-sorted chart and the banner's call line):

```
| Sagebrush Sound                                                                    |
| +-[venue colour]--------------------------------------------------------------+   |
| | + <venue>'s fans                                           ||||||||||||  [Skip] |   |
| | The chart re-sorts with this venue's fans added: N acts climb onto the lineup.|  |
| | Qloo call n of 12: Opener-band artists for the headliners and <venue> · count  | |
| | The AI agent: <the planner's own line, said before this call>                 |  |
| +-----------------------------------------------------------------------------+   |
| MID-SIZE ACTS                         | OPENING ACTS                               |
| 1 [ ] Act H                           | 1 [ ] Act K                                |
| 3 ━+9▶ Act J (was 12th, not booked)   | 4 ━━+20▶ [sleeve] Act E [On the lineup]   |
| 6 ━+6▶ [sleeve] Act B [On the lineup] | ...  15 ━━━━+25▶ Act F                    |
```

Act card (opens under its row): sleeve, name, "<venue> fans like it"; "<was> ━━+N▶ <now>"; Why Boise; affinity and popularity (with the popularity on Qloo's scale); two genre tags; Keep, Unavailable (radius clause, routing, fee).

What-if (a venue off): a yellow dashed line over the chart ("What if that venue's fans weren't asked? … no new Qloo call. All venues on"); the chart re-forms (acts re-attributed to the venues left on, new acts in, open slots dashed); the switch shows "4 of 10 slots filled".

Without Qloo: the same masthead; "THE MODEL'S PICKS" with a red "No Qloo data" stamp; ten picks with blank grey sleeves, no places, no climbs, no venue colours, each "No Boise venue · fee range not checked".

Compare: "Boise against Austin", the same-headliners sentence, two overlapping circles (7 · 3 · 7), two charts with sleeves, shared acts in yellow marked "On both lineups".

Method: "How it works", the method as a four-panel storyboard (the headliners' fans → + one venue's fans → the rule → the lineup) drawn with the chart's own rows, "Who decides what" as three drawn cards, the evidence with each counted result as dots against its bar, verdict marks on the objections, the limits, the video slot.

Your festival: the two headliner fields, each with a sleeve that redraws as you type; the 29 checked towns as a grid of buttons; another town by name; the live-run limits.

## 6. Avoided, and what instead

| Ban | What this kind of app would show | What this design does instead |
|---|---|---|
| A1 cream page | an off-white "paper" chart | a red page with stage light and halftone; white only for the chart's rows |
| A2 italic accent words | an italic word in the headline | weight and size jumps only (Anton against Schibsted 500) |
| A3 01/02/03 labels | numbered method steps | the storyboard's steps are numbered tiles inside one picture, not section labels |
| A4 monospace labels | mono for parameters and counts | Schibsted for parameters; Anton for numbers |
| A5 pills | pill toggles and chips | 3 px corners; the venue switch is a square rocker |
| B1 purple gradients | an indigo AI gradient | red and yellow; one mockup's periwinkle page was rejected (C6) |
| B2 default fonts | Inter | Anton + Schibsted Grotesk |
| B3/B4 emoji, sparkles | a sparkle for "AI agent" | the words "AI agent"; drawn bars and checks for the agent, Qloo and the rule |
| B5 glass | blurred cards over the gradient | opaque white panels with hard ink shadows |
| B6 eyebrows | "WEEKLY CHART" over the headline | none; band names are full-size headings |
| B7 hover-scale | rows that grow on hover | an underline on the act's name; buttons shift 2 px with their shadow |
| B9 hero with twin buttons | a centred headline and two CTAs | one yellow Watch button beside the chart |
| B10 feature cards, KPI row | "12 calls · 10 acts · 3 venues" tiles | the counts live where they belong: ticks under Watch, pips by each band, counts on the switch |
| B11 neon on near-black | a dark "music app" with glowing accents | a light-on-red chart; the brainstorm's dark teal default was rejected (C5) |
| B12 low contrast | grey text on red | muted grey only on white; every text pair above passes |
| C1 letterpress bill | kraft, wood type, a centred sheet | a chart with drawn covers on a red page |
| C2 words without pictures | names as text | a sleeve per act, colour per venue, arrows for climbs, the fee range as a scale |
| C3 how it works in words | paragraphs | a storyboard, three drawn cards, results as dots |
| C4 nothing catches the eye | a calm table | the red page, the yellow Watch, and Watch itself, which re-sorts the chart venue by venue |

## 7. Video legibility

At 1440 wide no text is under 16 px: the climb arrows' "+N", the vertical venue tabs, Watch's flags and the method's result chips are set at 16 px bold (during Watch the venue tab is colour alone, because the banner names the venue). Only the phone's stamp drops to 14 px. Key numbers: places 44 px (28 px during Watch), the card's figures 34 px, the trace's result counts 28 px.

## 8. Couldn't confirm

- Whether Qloo's terms allow showing its artist images. One Qloo call on 2026-10-18 found `properties.image.url` on images.qloo.com for 3 of 3 artists, but the app's cache drops the field and showing them would need new Qloo calls per act, so no photos are shown. Looked at: Qloo's hackathon developer guide (no mention of images) and qloo.com/legal/terms-of-use (no mention of images; the API's additional terms sit behind a client login). RULES.md question 5 is still open.
- A real screen reader pass (NVDA or VoiceOver) on the new screens: not done; the accessibility tree was checked through the unit and e2e tests only.
- Rendering in Safari and on real phones: checked in Chromium only, at 390x844, 1280x800 and 1440x810.
- Contrast over the page's gradient is checked at its token colours, not at every pixel of the blend.

## 9. The brainstorm (final round, 2026-10-18)

Eight subagents, each with its own seed, mocked up five first screens and three versions of Watch on the real Boise build; their stills were checked against the bans and the gates. The build takes the chart sheet's palette, type and arrows, the sleeves mockup's headline, layout and drawn covers, and the editions Watch with the countdown's last move (the booked acts dropping into their slots as the lineup prints back).

| Idea | Verdict |
|---|---|
| First screen 1, the chart sheet: red page, Anton numerals, arrows sized to the climb, venue tabs, "How an act gets on" as three pictures | Partly built: its palette, type, arrows and tabs won, but it led with the product's name rather than "a festival lineup", and its acts had no pictures |
| First screen 2, the climb lines: a bump chart from "headliners' fans alone" to "with a venue's fans" on deep green | Lost: the most visual climb, but at a glance it reads as an analytics chart rather than a lineup, its names were small, and its teal was the brainstorm's default (C5) |
| First screen 3, climber of the week: one giant "+30" arrow over a compact chart, yellow page | Lost: one artist's arrow reads as that artist's stats rather than a festival lineup, and no act showed on a phone's first screen |
| First screen 4, the venues' editions: the venues as big record sleeves that switch on and off, over the chart | Lost: records read as albums (artists), not venues, and its periwinkle page sits next to the banned indigo look (C6) |
| First screen 5, chart with sleeves: "A festival lineup, drafted from Boise's own music venues.", a drawn sleeve per act, the headliners as samplers | Partly built: its headline, layout and sleeves won; its small house-shaped climb badges and orange-on-brown palette lost to the chart sheet's numerals, arrows and red |
| Watch 1, each venue prints a new edition: the chart re-sorts per Qloo result in the venue's colour, new entries rise in, booked acts lock | Built: it replays the agent's real order, shows that Venue 166 lifted nothing, and ends on the lineup |
| Watch 2, the lines climb: a bump chart grows one column per venue | Lost: beautiful, but dense lines are hard to read at video size and little changes in its first 4 seconds |
| Watch 3, the chart countdown: acts revealed one by one, smallest climb to biggest, dropping into their slots | Lost: it reorders the acts instead of replaying the agent's order and hides the venue that lifted nothing; its drop-into-the-slot ending was kept |
