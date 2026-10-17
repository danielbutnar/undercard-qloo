# TASKS: M4c Ship M4b, then polish

Copied from SPEC.md section 6, M4c. Closes: Design. Freeze: 2026-10-21. Done means: the live e2e passes; a fresh cold reader of the live 1280x800 shot names the buyer, Boise's venues and "Watch the agent build it", and doesn't say the agent or Qloo sets the fee bands; LCP on the live first screen is under 2.5 s.

Approved for this run: pushing redesign-first-screen and main (merged without squashing) and letting Vercel deploy production, each deploy followed by the live e2e. No Vercel environment variable changes, no new package, no fresh build on production in M4c.

- [x] Push redesign-first-screen and main; Vercel deploys production (0bfec9f, 2026-10-17)
- [x] UNDERCARD_E2E_SYNTHETIC isn't set on Vercel: the live page serves the real Oct 15 build, no synthetic names (no variable changed)
- [x] Live e2e passes with no fresh agent run against production: 30 passed; the LCP spec failed at 3,644 ms only while it ran beside three workers
- [x] LCP of the live first screen at 1280x800: 780, 696 and 688 ms, measured alone
- [x] The fee band says the buyer sets it and Qloo supplies the popularity percentile
- [x] The mark's ▲ comes from a font the page loads, or the mark uses text the fonts carry: now +, which Big Shoulders carries at full weight (it has no ▲, and its ↑ sets too small to read)
- [x] The card's Close sits inside the card
- [x] At 390 px, Watch the agent build it sits under the headliners
- [x] The display font's loading checked: latin subset, preloaded, display swap already; the one lever left (dropping the opsz axis) changes the type, so no change
- [x] If there's time: the fallback screen in the bill's design, still with Build undercard
- [x] Deploy, live e2e again, a fresh cold reader (low effort) on the live 1280x800 shot
- [x] Found by the first live cold reader and fixed: the live build's top room is listed as "Venue 418 (V418)", so the marks read "V418( +N" (da434af)
- [x] Two live cold readers said "local Boise crowds" and never venues: the rail and the key now name the rooms as Boise venues (a6250c9)

Result (2026-10-17): live e2e 31 passed, 4 skipped (the fallback spec and its 3 shots, which need the empty seed and passed against it locally); live LCP 768 ms at 1280x800; the last cold reader: "a booking desk for a concert promoter or talent buyer (here, a Boise festival called Sagebrush Sound): an agent uses Qloo taste data about the headliners' fans and local venue crowds to draft the undercard", first click "Watch the agent build it". Largest gap now: Potential Impact (no buyer's words, no check against a real bill).

PREVIEW_URL: https://undercard-daniel-51ed.vercel.app (the judge URL: the project's production domain, which always serves the latest production deploy; public, no login; e2e passed against it 2026-10-15)

## Before the repository goes public
- [ ] Remove the Final scores and Weakest criterion bullets from SPEC.md section 9: all three AI judges docked them, and judges or an automated analysis may read self-scores as steering
- [ ] Decide whether a private note stays public: it's contest strategy, and the judge script can read it from claude-master-setup with --field
- [ ] Confirm the git history holds no sk-ant- key
- [ ] Replace the README's "video still to come" line
- [ ] Check that the saved build replays on the live URL. If it's gone, run one fresh build before judging starts on 2026-11-02, because replays come from the saved build in Upstash, not from `pnpm seed`
- [ ] If the organizers haven't answered about rate limits by 2026-10-27, decide whether to raise the per-IP limits for judging, keeping the shared daily caps as the cost ceiling
