# TASKS: M4b First screen: the draft bill

Copied from SPEC.md section 6, M4b. Done means: the demo path in section 3 runs end to end; a fresh cold reader of the new 1280x800 judge shot names the buyer, Boise's venues, and "Watch the agent build it" as the first click; LCP on the first screen is under 2.5 s on a production build; every e2e spec and `pnpm gate` pass.

Decided for this run (2026-10-17): Direction 1, the draft bill, built on the branch `redesign-first-screen`; main and the live demo stay as they are until the merge is approved. The engine stays as it is: the agent, the Qloo calls, the API routes, the rate limits and the saved-build replay. No new Qloo call, no model call on page load, no new package. The build saved on Oct 15 must still parse and replay, so the lift is read from the Why Boise line. Where the mockup and a label fix disagree, the label fix wins. Build by 2026-10-24.

## Shared work
- [x] Server read: `/` reads the latest saved build through the build store's `latest()`, cached briefly so it is served as static HTML; with no saved build, or Upstash unreachable, today's empty board and "Build undercard"; never an error
- [x] Synthetic saved build for local e2e and design shots, seeded from tests/e2e/synthetic-build.ts behind a test-only environment variable that production never sets
- [ ] The trace behind "Watch the agent build it" (replays the saved build as today); "Run the agent live instead" replaces "Run the agent again", still rate-limited
- [x] Presale off the first screen; the seed and the component stay
- [ ] An act's card opens on click, reusing `ActCard` and its Unavailable button
- [ ] Label fix 1: the fee band says Qloo's popularity percentile sets it
- [ ] Label fix 2: the lift counts places gained throughout; an act from outside the headliners-only top 50 reads "new"
- [ ] Label fix 3: "Without Qloo" says what it shows
- [ ] Label fix 4: the rooms rail doesn't read as where the acts will play
- [ ] Label fix 5: a few words on what Qloo is (what people like, across music, places and more), where the marks are explained; no tagline, no claim beyond what the app does
- [ ] E2E specs: new selectors and assertions for the new demo path; the 5-second test becomes a first-paint check

## Draft bill (Direction 1)
- [ ] The bill as the board, built from `poster.tsx`: act lines with room marks; each act stays an `<article>` inside regions named Mid and Opener
- [ ] The marks explained beside the first mark on the bill, not in the rail
- [ ] Every act on the bill looks and works like a button (pointer, underline on hover and keyboard focus, accessible name); the hint says a click opens the act's card, where it can be marked unavailable; no hover-scale
- [ ] The rooms rail, from the acts' anchor venues and the build's venue runs
- [ ] The motion moment: the undercard prints in and the rooms' counts tick up on "Watch the agent build it"; the end state under reduced motion
- [ ] "Without Qloo" reprints the bill with the model's picks, each with the model's own reason and two facts (no Boise room, fee band not checked); no score, tally or 0/10
- [ ] README: What it does, How it works and AI usage match the new first screen

## Screens (ticked when their shots pass Pass 2 step 5)
- [ ] First screen: the draft bill (1440x810, 1280x800 judge, 390 mobile)
- [ ] Watching the build: trace streaming, then the bill reprinted
- [ ] An act's card open
- [ ] Refilling, then refilled
- [ ] Without Qloo: the model's picks
- [ ] Fallback: no saved build, today's empty board
- [ ] Rate-limit refusal of a live run

## Done means
- [ ] Pass 2: the scan passes, design shots updated (SCENES), the written look, the cold-reader test on the 1280x800 judge shot
- [ ] LCP on the first screen under 2.5 s on a production build
- [ ] The demo path runs end to end; every e2e spec and `pnpm gate` pass; M4b ticked in SPEC.md

PREVIEW_URL: https://undercard-daniel-51ed.vercel.app (the judge URL: the project's production domain, which always serves the latest production deploy; public, no login; e2e passed against it 2026-10-15)

## Before the repository goes public
- [ ] Remove the Final scores and Weakest criterion bullets from SPEC.md section 9: all three AI judges docked them, and judges or an automated analysis may read self-scores as steering
- [ ] Decide whether a private note stays public: it's contest strategy, and the judge script can read it from claude-master-setup with --field
- [ ] Confirm the git history holds no sk-ant- key
- [ ] Replace the README's "video still to come" line
- [ ] Check that the saved build replays on the live URL. If it's gone, run one fresh build before judging starts on 2026-11-02, because replays come from the saved build in Upstash, not from `pnpm seed`
- [ ] If the organizers haven't answered about rate limits by 2026-10-27, decide whether to raise the per-IP limits for judging, keeping the shared daily caps as the cost ceiling
