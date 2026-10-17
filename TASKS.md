# TASKS: M4d Make the engine honest

Copied from SPEC.md section 6, M4d. Closes: Technological Implementation, Potential Impact, Quality of the Idea. Freeze: 2026-10-23. Done means: a replay shows the planner's lines; every field in the brief appears in a call's parameters or is gone from the screen; the baseline runs at high effort; `pnpm gate` and the live e2e pass.

Approved for this run: these engine changes, and one fresh build on production through "Run the agent live instead". No other fresh build on production; the store's latest pointer is not touched by hand.

- [x] The planner's lines are saved with the build (an optional field, so the Oct 15 build still parses) and replayed in order
- [x] Spike: the crowd's age reaches Qloo as signal.demographics.age (docs: 24_and_younger, 25_to_29, 30_to_34, 35_to_44, 45_to_54, 55_and_older; 25–34 is 25_to_29,30_to_34). Kept: an offline Boise run with the age filled 4 Mid and 6 Opener in 12 calls, 8 tagged places, rooms lifting 8, 2 and 0 acts (scripts/agent-offline.ts, 2026-10-17)
- [x] The LLM-only baseline runs at high effort with max_tokens matching the planner's, and its cached answer is regenerated
- [x] Deploy, then one fresh build on production through "Run the agent live instead" (2026-10-17 12:13 UTC): 12 Qloo calls in 15.2 s; Mid 4 of 4, Opener 6 of 6; Venue 418 lifted N acts, Venue 227 2, Venue 166 Boise 0 (Oct 15: 9, 1, 0); the age on all 7 artist calls; 2 planner lines. Not weaker by the rule as read here: both bands full and all 10 acts lifted by a room, now spread over two rooms. The model-only answer was regenerated at high effort (10 picks)
- [x] Live e2e passes (31 passed, LCP 640 ms, the replay shows the planner's lines); SPEC.md 2b updated; M4d ticked. Brief fields: city, crowd age, headliners and fee bands reach Qloo calls; the 3,000 capacity reaches Qloo only through the buyer's fee bands (popularity ranges), and the festival's name and region reach the planner's brief but no call

# TASKS: M4e Evidence, offline

Copied from SPEC.md section 6, M4e. Closes: Potential Impact, Quality of the Idea, Technological Implementation. Freeze: 2026-10-23. Done means: docs/evidence.md holds each result, or a recorded no-go.

- [x] The objection, from sources: KIVI's pre-festival guide (23 March 2026) says Treefort 2026 was to put over 500 artists into dozens of downtown Boise venues, naming Venue 227, and sold a Venue 166 pass; added to docs/research/festival-sites.md with the inference marked. The Venue 418 isn't confirmed as a Treefort venue
- [x] Check against Treefort 2026's bill (562 names, Wayback capture of 17 April 2026): no-go. Mid 1 / 2 / 1 / 1 of 50 (headliners alone / + V418 / + Venue 227 / + Venue 166); Opener 0 in every list. Nothing claimed
- [x] Three more towns: the agent filled both bands in Austin, Denver and Nashville; per-town rooms and lifts in docs/evidence.md
- [x] Buyer message drafted, kept out of git (96 words, the live link, two questions); not sent
- [x] docs/evidence.md holds each result, fact-checked against the sources and the run outputs

# TASKS: M4f CI

Copied from SPEC.md section 6, M4f. Closes: Technological Implementation: no CI check. Freeze: 2026-10-23. Done means: a GitHub Actions run of `pnpm gate` is green on main, with a status badge in README.md.

- [x] .github/workflows/gate.yml runs `pnpm gate` on every push to main and on pull requests, on Node 22 with pnpm, read-only and with no secrets
- [x] README.md shows the workflow's status badge
- [x] The check runs green on main: run 39032906157 on 69c4ee4 (2026-10-17), after the merge; that push deployed production and the live e2e passed (31 passed, LCP 628 ms). The badge and the check show publicly only once the repository is public (M5). Largest gap now: Potential Impact, no buyer's words

PREVIEW_URL: https://undercard-daniel-51ed.vercel.app (the judge URL: the project's production domain, which always serves the latest production deploy; public, no login; e2e passed against it 2026-10-15)

## Before the repository goes public
- [ ] Remove the Final scores and Weakest criterion bullets from SPEC.md section 9: all three AI judges docked them, and judges or an automated analysis may read self-scores as steering
- [ ] Decide whether a private note stays public: it's contest strategy, and the judge script can read it from claude-master-setup with --field
- [ ] Confirm the git history holds no sk-ant- key
- [ ] Replace the README's "video still to come" line
- [ ] Check that the saved build replays on the live URL. If it's gone, run one fresh build before judging starts on 2026-11-02, because replays come from the saved build in Upstash, not from `pnpm seed`
- [ ] If the organizers haven't answered about rate limits by 2026-10-27, decide whether to raise the per-IP limits for judging, keeping the shared daily caps as the cost ceiling
