# Design bans

Never ship these. When the user rejects a look, add it to C with their words and the date, plus a `scan:` regex when a pattern can catch it. scripts/design-check.mjs enforces A, B1-B8 and every C line that has a scan regex. While a rejected look is still in the live code, `` in: `path` `` after the regex limits its scan to that path; the scope comes off when the look is replaced.

## A. Opus 5.5's fallback styles, named in Anthropic's Opus 5.5 guide
- A1 Cream or off-white page background
- A2 Italic accent words in headings
- A3 Numbered "01 / 02 / 03" section labels
- A4 Monospace labels
- A5 Pill-shaped buttons

## B. The generic AI-app look (the usual replacements once A is banned)
- B1 Purple, violet or indigo gradients
- B2 Inter, Roboto, Geist or a system stack as the only typeface
- B3 Emoji as icons or labels
- B4 Sparkle or magic-wand icons standing for "AI"
- B5 Glassmorphism: translucent blurred cards
- B6 Small uppercase letter-spaced eyebrow labels over headings
- B7 Hover-scale on cards and buttons
- B8 Placeholder copy: lorem ipsum, John Doe, Acme, example.com
- B9 A centered hero with a gradient headline and twin "Get started" / "Learn more" buttons (screenshot check)
- B10 Three identical icon-topped feature cards, or four KPI cards as a dashboard's first row (screenshot check)
- B11 Neon glow accents on a near-black page (screenshot check)
- B12 Gray-on-gray text under 4.5:1 contrast (contrast check)

## C. Rejected in this project
- C1 The live look (design brief of 2026-10-15, with M9d's ledger): a letterpress show bill on kraft chipboard, Big Shoulders wood type in capitals, black and blue ink, the bill as one centred sheet of ledger rows with lift bars (2026-10-18, "well, it s really difficult to explain. There are a couple of things that stand out tho.") scan: `big[_ -]?shoulders|#cdb38a|#e4d3b2` in: `src/app/lab`
- C2 A screen carried by words: names most people don't know (towns, bands, venues) set as text, with no picture or visual to say what they are (2026-10-18, "There are a lot of words, many of with a lot of people do not know, town names, band names, etc, without pictures, visuals it is difficult to understand what it is about.") (screenshot check)
- C3 How it works told in words, with no visual aid (2026-10-18, "Also, hitting how it works, does not have any visual aid.") (screenshot check)
- C4 A screen with nothing that catches the eye (2026-10-18, "Also, I get bored really quickly, there is nothing that get s my attention.") (screenshot check)
