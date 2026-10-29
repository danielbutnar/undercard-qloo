# Undercard

This repository's history is filtered from Undercard's private development repository: the same commits, with their dates and messages, with some files and quotes removed and data from Qloo's answers redacted, as Qloo's developer guide requires.

[![gate](https://github.com/danielbutnar/undercard/actions/workflows/gate.yml/badge.svg?branch=main)](https://github.com/danielbutnar/undercard/actions/workflows/gate.yml)

An AI agent for festival talent buyers, built on Qloo. With the headliners booked, Undercard
drafts the acts below them inside the buyer's fee ranges, and shows the evidence behind each
pick: Qloo's numbers for its climb with a town venue's fans and with a music venue abroad of
similar Qloo popularity, for its popularity and for its genres, and every Qloo call that
produced them. When an act drops out, Undercard refills the slot by the same rule.

Undercard drafts a shortlist with its evidence attached; the buyer makes every call. The AI
agent plans the Qloo calls, Qloo knows the taste, and a fixed rule picks the acts.

**Live demo: https://undercard-daniel-51ed.vercel.app** (no login, no API key).

Entry for the [Qloo Agentic Hackathon](https://qloo.devpost.com/). The brief is in
[SPEC.md](SPEC.md), the event rules in [RULES.md](RULES.md) and the submission's text in
[docs/devpost-story.md](docs/devpost-story.md).

## What it does

A talent buyer has booked a festival's headliners and set a fee range for each tier of slots
below them. Undercard fills those slots with acts that climb in Qloo's ranking when the fans
of one of the town's music venues join the headliners' fans, and climb further with it than
with a music venue abroad of similar Qloo popularity; each act says why it's there. It doesn't
claim to know what a festival would book ([docs/evidence.md](docs/evidence.md), section 38):
its case is the evidence behind each pick, with every call shown.

The demo festival is Sagebrush Sound: fictional, 3,000 capacity, in Boise, Idaho, with
Khruangbin and Japanese Breakfast booked and two tiers, mid-size (4 slots) and opening (6 slots),
each with a fee range given as a range of Qloo popularity. The path a judge can follow through
it is under [Testing instructions](#testing-instructions).

Beyond the demo path, one click from the bill:

- **Same brief, other towns.** The town switcher links Austin, Denver and Nashville: the same
  headliners, capacity, crowd and fee ranges, each drafted from that town's own venues, saved
  and replayed like Boise's. **Compare with another town** sets two towns' lineups side by side.
- **Your festival** (`/your-festival`). Name a town and two headliners, and the agent runs live
  for them with Sagebrush Sound's crowd and fee ranges. It counts against the same per-IP limit
  as a fresh build, and nothing is saved. A headliner Qloo can't find, a town with too few
  music venues and the daily limit each have their own designed state. A link can fill the form
  in: `/your-festival?town=Tallinn&headliner=Khruangbin&headliner=Japanese%20Breakfast`. It never
  runs on load, because mail clients and link previews open links by themselves.
- **Check the acts you've been pitched** (`/shortlist`). A buyer picks one of the 29 checked
  towns and pastes up to 10 acts they've been pitched. Undercard finds each on Qloo (a name it can't match reads
  "not found on Qloo"), ranks them for the headliners' fans alone and again with each of the
  town's venues' fans, every act scored inside the same call, and sorts them by how far a
  venue's fans lift them, with each act's fee range and genre fit. A check makes at most 14 Qloo
  calls and is limited like a fresh build (5 a day per address, 60 for everyone). It drafts
  nothing and books nothing. The page opens on the model's own ten picks for Boise, from its
  saved Without Qloo answer, sorted from the Qloo cache.

## Testing instructions

For judges: no login and no API key. These steps are the demo path in [SPEC.md](SPEC.md),
section 3, on the live demo.

1. **Open https://undercard-daniel-51ed.vercel.app.** Sagebrush Sound opens on its saved
   draft: the booked headliners sit over 4 mid-size and 6 opening acts, each in the colour of
   the Boise venue whose fans lifted it, with its rank and its climb in Qloo's ranking (NEW when
   it entered the top 50). In the town, each venue the agent read counts the acts its fans
   lifted, or says Qloo had no fan data for it.
2. **Press Watch the AI agent build it.** The saved build replays in the town, call by call,
   each caption naming its Qloo call and result count. Under the town, the AI agent's setlist
   lists every call, and the full calls list under it gives each call's parameters. A replay is
   never limited. To run the agent live instead, press **Play it live** on the setlist (or **Run
   it live** under Watch, on a large screen); a live run is limited per IP and per day.
3. **Click an act.** Its card says why it's here: its place for the headliners' fans alone and
   with the venue's fans added, its climb with that venue and with its control, a music venue
   abroad of similar Qloo popularity, its Qloo popularity inside the tier's fee range, and two
   genres it shares with the headliners. Keep, Unavailable and Close stay in view.
4. **Press Unavailable** and give a reason: radius clause, routing or fee. Undercard refills
   the slot from the same tier by the same rule. If an act in the rankings the build already
   holds passes, it takes the slot with no new Qloo call; otherwise Undercard makes at most 5
   Qloo calls, each listed with the refill's reason. The replacement prints into the slot.
5. **Flip to Without Qloo**: the same brief answered by the AI model alone, its reason under
   each pick, checked on Qloo afterwards. Flip back and press **Export CSV** to download the
   draft; a replacement's row names the act it replaced and why.

## How it works

![How a build works: at most 28 Qloo calls a build, retries counted apart; the start; the venue loop, at least two town venues with fan data, each beside its control, a venue in another country with similar Qloo popularity; local picks and location reads after the loop; the rule's four checks, the local lift among them; refill and redraft from the rankings the build holds, then up to 5 calls; and each build's Qloo answers under its own cache prefix](docs/architecture.svg)

- **The agent plans the Qloo calls.** Claude Sonnet 5.5 works through tools that make the Qloo
  calls, plus one to finish ([src/server/agent.ts](src/server/agent.ts),
  [src/server/agent-tools.ts](src/server/agent-tools.ts)). It resolves the headliners, finds the
  town's live music venues and picks the music venues among them as anchors, gets the taste
  the headliners share, then ranks each tier's artists for the headliners alone and once more
  with each anchor venue's fans. Beside each venue the app reads its control: the music venue
  in a checked town in another country closest to it in Qloo popularity (for Boise, a venue in
  Bucharest with similar Qloo popularity), skipping one Qloo has no fan data for. The agent
  skips a venue Qloo has no fan data for and reads the next, reads at least two music venues
  with fan data before it may stop (a town with fewer says so), and writes one line on each
  choice. It runs independent calls in parallel and stops at 28 calls at most, retries included
  in every count. It may also name local acts it knows of: each is looked up on Qloo and shown
  for the buyer to check, and takes a slot only if the buyer adds it.
- **The app books the acts.** [src/lib/assemble-lineup.ts](src/lib/assemble-lineup.ts) takes
  an act when an anchor venue lifts it at least five places above the headliners-only
  ranking, and at least 5 places more than that venue's control does (its local lift); its
  popularity sits inside the tier's range, and it shares two genre tags with the headliners.
  Each tier takes its strongest-affinity acts, and a tier with too few stays open. Every
  number on a card is Qloo's.
- **A refill** ([src/server/refill.ts](src/server/refill.ts)) first takes an act that passes
  the same rule from the rankings the build already holds, with no new call; otherwise it reads
  the build's venues again beside their controls, with every act on the board excluded, in at
  most 5 calls. **Redraft the rest** ([src/server/redraft.ts](src/server/redraft.ts)) does the
  same for every slot not kept.
- **Saved builds.** A festival's first complete build is saved ([src/server/build-store.ts](src/server/build-store.ts))
  and replayed to every later visitor; the trace says when a board is a replay. A later live run
  is kept under its own id for whoever ran it (its lineup, refill and venue switch) and never
  replaces the saved build other visitors see.
- **The first screen** ([src/app/page.tsx](src/app/page.tsx)) reads the festival's saved build on
  the server and caches it for a minute, so the page is static HTML with the whole bill on
  first paint. With no saved build, or no answer from the store within 2 seconds, it falls
  back to the empty board and Build undercard. Each act's mark is read from its Why Boise line
  ([src/lib/marks.ts](src/lib/marks.ts)), so older saved builds need no new field.
- **Checks.** Unit tests in [tests/unit](tests/unit) run against a synthetic Qloo: each tool's
  query parameters, the call cap, the control rule and the local-lift bar, the refill's
  exclusions and cap, the rate limits. The demo path in
  [tests/e2e/demo-path.spec.ts](tests/e2e/demo-path.spec.ts) (all five steps, plus a
  first-paint check) runs against a deployment with `E2E_BASE_URL` (Checks, below). GitHub
  Actions runs `pnpm gate` on every push to main and on pull requests.

## Sponsor technology

Qloo does the work in every build. The agent calls the Qloo hackathon API
(`https://hackathon.api.qloo.com`, `X-Api-Key`, GET only) at most 28 times per build, and
the AI agent's setlist and the calls list under it show every call with its parameters and
result count.

| Endpoint | Why the agent calls it |
|---|---|
| `GET /search` | Resolve each booked headliner (names only in the seed) to a Qloo entity, and look up each local pick the agent names. |
| `GET /v2/tags` | Find the tag Qloo puts on live music venues. |
| `GET /v2/insights` with `filter.type=urn:entity:place` | List the festival town's places with that tag, where the agent picks music venues as anchors, and the control town's music venues. |
| `GET /v2/analysis/compare` | Find the taste tags the two headliners share, for the AI agent's plan. The genre check counts the headliners' own genre tags. |
| `GET /v2/insights` with `filter.type=urn:entity:artist` | Rank artists inside each tier's popularity range (`filter.popularity.min/max`) with the crowd's age (`signal.demographics.age`): first for the headliners alone, then for the headliners plus one anchor venue in `signal.interests.entities`, then plus that venue's control instead. |
| `GET /v2/insights` with `signal.location.query` | Qloo's location signal for the town, over the lineup's own acts (`filter.results.entities`): a second reading on each card, never the basis for booking. |
| `GET /v2/insights` with `feature.explainability=true` | For each fee range of a saved build, the headliners and that range's venues together as the signal and the range's lineup acts as `filter.results.entities`: Qloo's own split of each act's match by input, one small line on its card. Made once per saved build by `scripts/attribution-warm.ts`; the page reads it from the cache only. |

Artists have no location of their own in Qloo. Its location data for artists, tried three
ways, gave a usable local reading for at most 7 of 10 acts, short of the bar of 8
([docs/evidence.md](docs/evidence.md), section 6, 17 October 2026), so local taste enters the
booking only through the town's venues as signals. An act makes the board when an anchor venue
lifts it at least five places above the headliners-only ranking, and at least 5 places more
than that venue's control does; its "Why it's here" line and its card's climbs say by how much.
Affinity, popularity, fee range, anchor venue, both climbs and shared tags on every card come
from those responses.

The spike of 15 October 2026 ([docs/qloo-spike.md](docs/qloo-spike.md), which keeps only its
counts) checked that a venue is a real signal. Adding one Boise venue to the headliners moved
28–29 artists per tier up five or more places, and 22–23 of them share at least two genre tags
with the headliners. A second venue moved 26–31 (21–23 with shared tags). A third changed
nothing: Qloo had no fan data for it. That is why the agent checks each venue's fan data and
lift instead of trusting the venue list.

Marking an act **Unavailable** refills its slot from the same tier: first with an act that
passes the rule in the rankings the build already holds, with no call; otherwise with at most
5 more Qloo calls: artist insights for the same tier, seeded by the headliners and the act's
anchor venue (then the build's other anchors), each beside its control, with the headliners and
every act on the board in `filter.exclude.entities`. The first act that passes the same rule
takes the slot, and each call appears in the calls list with the refill's reason.

**Without Qloo: the model's picks** sends the same festival brief, fee ranges included, to the
model with no Qloo and no tools, as a contrast, not a score: each pick shows the model's own
reason, with no Boise venue behind it and no Qloo popularity to check it against a fee range.

Measured over the 29 checked towns ([docs/evidence.md](docs/evidence.md), section 31): the
model alone picked 290 acts, and Qloo found 268 of them. Of those 268, 204 sit above the fee
range, 235 share two genres with the headliners, and 10 pass all three of the rule's checks.
Those are Qloo's measures, which the model never sees, so they say how far its picks land from
Qloo's data, not which lineup a buyer would prefer. At 33 real festivals, the model alone held
11 of the acts the festivals booked and Undercard's shortlists 3 (section 38): Undercard
doesn't claim to pick what a festival would book.

Qloo responses are cached server-side in Upstash Redis until at least 2026-11-18, past the end
of judging, and never committed. A festival's first complete build is saved the same way, so
every visitor opens on it and "Watch the AI agent build it" replays its calls, marked as a
replay; a live run ("Play it live" on the setlist, or "Run it live" under Watch on a large
screen) starts a fresh build, which isn't saved for other visitors.
[docs/qloo-spike.md](docs/qloo-spike.md) records what the first live calls returned, as counts
only.

## AI usage

**Who wrote what.** This repository was built with Claude Code (Anthropic). Claude (Opus 5.5)
wrote most of it: the code, the tests, the scripts in `scripts/` and the docs, this README and
[docs/devpost-story.md](docs/devpost-story.md) included. I chose the product and its direction,
approved each design, set every test's bar before its first call, named the window for every
run that called Qloo, and decided how each result is worded. Fresh Claude subagents worked as
cold readers, as the blind tournament's judges, as research assistants who collected festival
lineups from the festivals' own pages, and as fact-checkers of the record; an outside review
was written by Claude Fable 5.1. None of them is quoted anywhere as a person's view.

**In the product.** Claude Sonnet 5.5 (`claude-sonnet-5-5`, called only from
`src/server/ai.ts`) has three jobs:

- It is the agent's planner: it decides which Qloo calls to make, which venues to read and
  when to stop, with one line on each choice. It doesn't choose acts or write numbers; the app
  books the acts from Qloo's responses by a fixed rule.
- It names the local picks: acts from the festival's town that it knows of, each looked up on
  Qloo and shown for the buyer to check, never booked on its own.
- It answers the Without Qloo baseline, from its own knowledge with no tools.

Refills and redrafts don't use the model. Once a day the smoke workflow's deep health check
also sends it a one-character prompt with max_tokens 1, to see that it answers; nothing from
the answer is kept. The festival, its presale numbers, and the acts and venues in the test
fixture are invented. The two headliners are real artists, named so the agent can look them up
on Qloo.

**Media.**

- [docs/architecture.svg](docs/architecture.svg): drawn by Claude in SVG code for Agent 2.0, in
  the app's own colours, with the app's two fonts embedded (latin subsets, SIL Open Font
  License); no image model.
- The link previews and the printable poster: drawn by the app's own code from the saved build
  with `next/og`.
- Artist photos: Qloo's own images, credited "Artist images via Qloo"; none is generated.
- The gallery images and the video's stills: screenshots of the live demo, taken after the 2.0
  deploy.
- The video: the Remotion project in `video/`, written by Claude, with the narration in
  [docs/video-script.md](docs/video-script.md), written by Claude.
- TODO (WS17, once the voiceover is made): the voiceover tool and voice, and the video's end
  card saying the voiceover is AI-generated.

**By milestone.**

- M1: Claude (Opus 5.5) wired the scaffold's tooling and wrote the festival data model, the
  fee-band mapping, the synthetic lineup fixture, the design brief and the festival screen
  with its lineup board and tests. I approved the visual direction it proposed in
  [docs/design-brief.md](docs/design-brief.md).
- M2: Claude (Opus 5.5) ran the Qloo spike and wrote the Qloo client and cache, the agent's
  tools and loop, the lift-based lineup assembly, the streaming route, the live trace panel and
  their tests.
- M3: Claude (Opus 5.5) wrote the saved-build replay, the refill, the LLM-only baseline, the
  Poster, the CSV export and their tests, and checked the screens in design screenshots,
  including the filled board at 1920x1080.
- M4b: Claude (Opus 5.5) critiqued the first screen, drafted three redesign directions with
  mockups and ran cold-reader checks on them with fresh Claude subagents; I chose the draft
  bill. Claude then wrote the server read of the saved build, the bill with each act's room
  and lift, the rooms rail, the act card on click, the Without Qloo reprint, the print-in
  motion, the synthetic test server and their tests, and checked the screens in design
  screenshots and with a fresh cold reader.
- M4c: Claude (Opus 5.5) shipped M4b, then fixed what fresh cold readers (Claude subagents)
  misread: the fee band now reads as the buyer's, the marks use "+", the card's Close sits
  inside the card, the first click comes up under the headliners on phones, and the rooms
  are named as Boise venues.
- M4d: Claude (Opus 5.5) saved the planner's lines with each build and replays them among its
  calls, sent the crowd's age to Qloo with every artist call, and moved the model-only
  baseline to high effort with the planner's token budget.
- M4e: Claude (Opus 5.5) wrote and ran the offline scripts in `scripts/` (the Treefort check
  and the agent in three more towns), wrote [docs/evidence.md](docs/evidence.md) and had a
  Claude subagent fact-check it against the sources and run outputs.
- M4f: Claude (Opus 5.5) wrote the GitHub Actions workflow that runs `pnpm gate`.
- M5, 17 October: Claude (Opus 5.5) wrote the first docs/devpost-story.md and tested its opening
  on a fresh Claude subagent, drew [docs/architecture.svg](docs/architecture.svg) by hand, built
  the Remotion project in `video/`, which captures the live demo's replay as stills, shot
  gallery stills of that day's build and ran the contradiction check across the README, SPEC.md,
  the story and the live screens. No video was rendered and no voiceover made then.
- M6a to M9d: Claude (Opus 5.5) wrote the pilot runner, the town switcher and the other towns'
  builds, Your festival with its checked towns, replays and pre-filled link, town resolution,
  the Qloo rate-limit handling, the venue labels, the running order, Keep and Redraft the rest,
  the lift climb, town against town, the method page and the accessibility and input
  hardening, with their tests; it ran each spike and the premise test on ten real festivals,
  recorded every result in [docs/evidence.md](docs/evidence.md), and had fresh Claude
  subagents act as cold readers and as the blind tournament's judges.
- The October design round: Claude (Opus 5.5) built six design directions on a dev-only lab
  page from the saved Boise build; I picked the weekly chart, and Claude built it as the whole
  product, checked by fresh Claude lay readers and reviewers.
- 21 October: Claude (Opus 5.5) merged the weekly chart into main, removed the components it
  no longer used, made Watch step through under reduced motion, offered the checked towns
  after a town Qloo can't find, and gave the phone's first act room; for M10a it built two
  ways to number each act and tested both on fresh Claude lay readers on three models, then
  shipped the climb as each act's number; for M10b it rebuilt How it works around one act
  followed through the saved build, with the evidence and the objections moved, unchanged, to
  /method/evidence.
- 21 October, later: Claude (Opus 5.5) fixed what the lay readers had tripped on and made How
  it works' steps linkable, each change checked by a fresh Claude lay reader; for M8f, five
  Claude research subagents collected 30 festivals' complete lineups from the festivals' own
  pages, Claude read seven again against their pages and ran the premise test; it turned on
  Qloo's artist images once Qloo's hackathon manager agreed, and fixed two bugs found while
  checking them (a photo that failed before the page came alive stayed broken, and the first
  screen's rows rose in again on every load).
- 21 October, evening: Claude (Opus 5.5) prepared stills and docs for an outside review, then
  gave How it works the same Qloo artist photos as the first screen, from the same cached call.
- 21 October, night: Claude (Opus 5.5) followed Daniel's plan after an outside review written
  by Claude Fable 5.1: it put small photos on a phone's rows and the image credit in, fixed a
  flaky phone test, measured With and Without Qloo across 29 towns (the app's own model-only
  baseline answered 27 of them), had three Claude research subagents check the M8f lineups
  against their pages, made the live-build caps settings with a daily smoke test, served the
  venue results with the page, wrote each act's why as one sentence, rewrote the evidence page
  from the review's draft and the record, moved the Qloo calls into src/lib/qloo/, and ran the
  two cheap tests in evidence section 33.
- 21 October, late night: Claude (Opus 5.5) stopped live runs from replacing the saved builds:
  a festival's first complete build stays the one every visitor opens on, a live run is kept for
  whoever ran it (Watch replays it from the screen, and the lineup says it isn't saved for other
  visitors), and the daily smoke test checks the first screen's saved line.
- 22 October, evening: Claude (Opus 5.5) added the deep health check to the daily smoke workflow
  (`GET /api/health/deep`, behind a bearer token: one Qloo search past the cache and a one-token
  Claude call, 3 a day), and made a planner call that fails or refuses end a live run the way a
  busy Qloo does, offering the country's checked towns instead of blaming the town.
- 22 October: Claude (Opus 5.5) moved Watch's captions into one file for the first-screen
  redesign; gave How it works' video slot a click-to-play YouTube facade that loads no player
  until it's pressed, and no slot at all until the video is published; had How it works and
  Watch say, from the saved trace only, when the agent switched venue, and, from the Qloo cache,
  when Qloo had no fan data for a venue (its ranking came back as the headliners' own); and
  labelled the agent's line in Watch as its plan, with a one-line key for anchors.
- 22 October: Claude (Opus 5.5) wrote `pnpm evidence:check`, which re-derives the site's numbers
  from the saved builds and the store; its first run found that the With and Without Qloo
  lineups share one act, in Duluth, where the record had said none, and the record, the
  evidence page and How it works were corrected. Claude also wrote and ran, in windows Daniel
  named, the premise test's two controls (evidence 34) and Qloo's own attribution of each act
  (evidence 35), wrote the protocol for the second 30-second test (evidence 36), and upgraded
  Next.js to 16.4.1 for two security advisories.
- 23 October: Claude (Opus 5.5) rebuilt the first screen from Daniel's layout brief ("Your town
  prints your poster"): the town in CSS 3D with the build's own venues, the poster with each act
  in its venue's colour and its climb, the act card's three checks, Without Qloo as one list
  tagged from the Qloo checks, and Watch flying each venue's acts into their slots; it made the
  page read its photos, the headliners' included, from the Qloo cache only.
- 23 October: Claude (Opus 5.5) wrote the link previews: the opengraph-image routes for the home
  page and each town, which draw the poster from the saved build with next/og (code, no image
  model, no Qloo call), the pages' og:title, og:description and Twitter card, and their tests.
- 23 October: Claude (Opus 5.5) wrote the buyer's shortlist (`/shortlist`): the name matching,
  the ranking calls and their climb, the 14-call cap and the daily limit, the page in the
  lineup's rows, Boise's example and scripts/shortlist-example.ts, with unit tests and a
  Playwright spec on the synthetic build; and the line on each act card giving Qloo's own split
  of its match (scripts/attribution-warm.ts), read from the cache only.
- 24 October: Claude (Opus 5.5) kept the act card's Keep, Unavailable and Close in view, put each
  act's rank beside its climb, wrote every why line as "With <venue>'s fans added to the
  headliners'", stopped Without Qloo's headline grading the model on a number it never saw, put
  popularity on the tiers' 0-100 scale, made Watch land its first act within 3 s and end on a
  reveal, folded accents before a Qloo search says "no match", and wrote sections 37 and 38 of
  [docs/evidence.md](docs/evidence.md), with the bars I set, before any of their calls.
- 28 October: Claude (Opus 5.5) built Agent 2.0: fan data first, reading until every tier is
  full within a cap of 28 Qloo calls, a control abroad for every venue and the local-lift bar
  that section 37's result set, Qloo's location signal as a second reading on the card, the
  local picks for the buyer to check, a line for every decision, retries counted wherever a call
  count shows, and refills and redrafts by the same rule. It wrote and ran the scripts for
  sections 37 and 38 and the 29 towns' re-runs, in windows I named, and reported both results as
  they came.
- 28 and 29 October: Claude (Opus 5.5) built Design 2.0 from the direction I approved: the AI
  agent's setlist of Qloo calls under the town, with Play it live; the door check, whose ticket
  takes an act's local lift, popularity and genres; How it works as four scenes made of the first
  screen's own objects, with who does what and the three stamps of what was tested; the
  printable poster; every empty and error state; and the about line at the foot of every page.
- 29 October: Claude (Opus 5.5) wrote section 38's result into docs/evidence.md as it came,
  rewrote docs/devpost-story.md and this README's testing instructions and AI usage, wrote
  the narration in docs/video-script.md, pinned `pnpm evidence:check`'s section-31 claims to
  the 1.0 builds that section measured, and redrew docs/architecture.svg for Agent 2.0.
- Kept current as each milestone lands.

## Built on

There is no starter kit. The app was generated with
[create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app) 16.4.0
(TypeScript, Tailwind CSS, ESLint, App Router, `src/`, pnpm). That commit is tagged
`starter-kit`; everything after it was written during the event.

- Runtime: [Next.js](https://nextjs.org) 16.4, [React](https://react.dev) 19.3,
  [Zod](https://zod.dev) 4 for the lineup and API schemas, the
  [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) for the
  agent's planner, and [@upstash/redis](https://github.com/upstash/redis-js) for the Qloo
  response cache.
- Styling: [Tailwind CSS](https://tailwindcss.com) 4, with Anton and Schibsted Grotesk
  from [Google Fonts](https://fonts.google.com) (SIL Open Font License) through `next/font`;
  their latin subsets are also embedded in docs/architecture.svg, so it renders without a
  network.
- Link previews: `next/og`, part of Next.js, draws each page's 1200×630 picture on the server
  from the saved build, in its bundled Geist font; no extra package.
- Tooling: TypeScript 5, ESLint 9 with `eslint-config-next`, Prettier 3,
  [Vitest](https://vitest.dev) 5 with `@vitejs/plugin-react`, jsdom and
  [Testing Library](https://testing-library.com/docs/react-testing-library/intro/), and
  [Playwright](https://playwright.dev) 1.64 for the demo path.

## Running locally

Needs Node 22 or later and pnpm.

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 to see Sagebrush Sound. With no saved build yet, the page shows the
empty board: press Build undercard. Once a build is saved, the page opens on it as the draft
bill; later live runs don't replace it.

A build needs a Qloo hackathon key and an Anthropic key; Upstash is optional (without it,
Qloo responses, saved builds and rate limits live in process memory). Copy `.env.example` to
`.env.local` and fill in your own keys; never commit `.env.local`.

`scripts/pilot.ts` drafts a bill for a buyer's own brief, offline: their town, two headliners
and band sizes. It runs the agent without saving a build and writes a one-page draft (the bill,
each act's room and lift, and the calls) to `.design/pilots/<town>.md`, which is gitignored:

```bash
node --experimental-transform-types --import ./scripts/register-ts.mjs scripts/pilot.ts --city Boise --region Idaho --headliner Khruangbin --headliner "Japanese Breakfast" --mid 4 --opener 6
```

`pnpm seed` writes the demo festival, Sagebrush Sound, with 30 days of synthetic presale
to `seed/sagebrush-sound.json`, the file the app loads. It uses a fixed random seed, so every
run writes the same bytes.

Checks:

- `pnpm gate`: typecheck, lint, every unit test and the design-ban scan. GitHub Actions runs it on every push to main and on pull requests (`.github/workflows/gate.yml`, no secrets).
- `.github/workflows/smoke.yml`: once a day, `tests/e2e/smoke.spec.ts` against production, then `node scripts/deep-health.mjs`, one `GET /api/health/deep` with the `HEALTH_TOKEN` repository secret. The run fails unless Qloo and Anthropic both answer ok, and passes with a notice when the secret isn't set or the day's 3 checks are used.
- `pnpm evidence:check`: re-derives the numbers in this README, docs/devpost-story.md, docs/evidence.md and the copy constants (claims in `scripts/evidence-claims.ts`) from production's saved builds, through replay-only requests that make no Qloo or model call, and from the store read-only, then prints one table and exits 1 on any mismatch; `--base <url>` replays another server. Section 31's claims read the 1.0 builds that section measured, by id, from `src/data/pinned-builds-2026-10-21.json`, which holds only each checked town's build id and build date, nothing read from a Qloo answer; `src/data/pinned-builds-2026-10-29.json` names, the same way, the 2.0 builds the pointer move put on show on 29 October. With those ids alone, a fresh clone can fetch each of those builds from the live app with no key (`GET /api/venue-switch?festival=<festival id>&build=<build id>`, the festival id from `checkedFestival` in `src/lib/towns.ts`), and the claims checked through replays need nothing more. Recomputing section 31's counts also needs the store's credentials (`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`), since the model's saved answers and the cached Qloo searches behind its three tests live in the store, never in this repository; without them those claims have no data. Not part of `pnpm gate`.
- `pnpm e2e`: the Playwright specs in `tests/e2e`. Run `pnpm exec playwright install chromium`
  once first. Playwright starts its own dev server on port 3100 in synthetic mode
  (`UNDERCARD_E2E_SYNTHETIC=1`): the server serves the synthetic saved build and model answer
  from `tests/e2e/synthetic-build.ts` and never calls Qloo, Claude or Upstash, and the refill
  is answered in the browser. Never set `UNDERCARD_E2E_SYNTHETIC` on Vercel.
- `E2E_BASE_URL=<url> pnpm e2e --workers=1`: the same specs against a deployment, one at a
  time, because parallel workers skew the first-screen LCP measurement. There the refill calls
  Qloo and Without Qloo calls Claude once; the first screen and the replay use the saved
  build.
- On a production build of your own: `UNDERCARD_E2E_SYNTHETIC=1 pnpm build`, then
  `UNDERCARD_E2E_SYNTHETIC=1 pnpm start -p 3200`, then
  `E2E_BASE_URL=http://localhost:3200 UNDERCARD_E2E_SYNTHETIC=1 pnpm e2e`, which adds the LCP
  check. Build and start with `UNDERCARD_E2E_SYNTHETIC=empty` instead (and pass the same value
  to `pnpm e2e`) to run the fallback spec and shoot the fallback: no saved build.
- `pnpm e2e tests/e2e/design-shots.spec.ts`: design screenshots in `.design/shots` for every
  screen of the demo path and its loading, empty and error states.
- `LIVE_UPSTASH=1 pnpm vitest run tests/unit/m4/rate-limit-upstash.test.ts`: checks the rate
  limiter against the Upstash database in `.env.local`, under its own key prefix.

## Deploying

The app runs on Vercel with no login and no key from the visitor. Link the repository in
Vercel and set these server environment variables: `QLOO_API_KEY`, `QLOO_BASE_URL`,
`ANTHROPIC_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` and, for the deep
health check, `HEALTH_TOKEN`. None of them is exposed to the browser. The judge URL is the production domain,
https://undercard-daniel-51ed.vercel.app, which always serves the latest production deploy;
Vercel puts preview deployments behind a login.

Calls that spend money or quota are limited per IP and per UTC day, with a ceiling for
everyone, and answer with a friendly message at the limit:

| Action | Per IP per day | Everyone per day |
|---|---|---|
| Fresh build (runs the agent: Qloo and Claude) | 5 | 60 |
| Refill or redraft (up to 5 Qloo calls) | 25 | 500 |
| LLM only (asks Claude) | 10 | 100 |
| Deep health check (`GET /api/health/deep` with the `HEALTH_TOKEN` bearer token: one Qloo search and a one-token Claude call) | 3 | 3 |

Replaying the saved build and serving the saved LLM-only answer are never limited. The
fresh-build numbers are the code's defaults: `LIVE_BUILDS_PER_IP_PER_DAY` and
`LIVE_BUILDS_GLOBAL_PER_DAY` override them, and production sets its own.

## License

[MIT](LICENSE)
