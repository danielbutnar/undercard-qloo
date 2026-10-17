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

# TASKS: M5 Package

Copied from SPEC.md section 6, M5. Done means: the video is rendered within the limit, docs/ holds the Devpost story and the architecture diagram, and the contradiction check has run.

- [x] Judge script in f13b911 reported, nothing changed
- [x] docs/research/festival-sites.md committed; the four private docs listed in .git/info/exclude, and no committed file links to them
- [x] docs/devpost-story.md: 1,064 words; the opening tested on fresh low-effort readers. First draft: all right. After the fact-check fixes, one reader took radius clauses as a cause of dropouts; reworded, and the next reader got what, for whom, why Qloo and the stakes right
- [x] docs/architecture.svg, by hand, in the brief's tokens
- [x] video/: the skill's pipeline, capture on the live replay, the narration script
- [ ] Voiceover with ElevenLabs: waits on video/.env.local (Daniel)
- [ ] Render, frame checks, probe, video/out/upload.md
- [x] Gallery stills and captions in .design/submission/ (3:2, 2400x1600)
- [x] Contradiction check (a high-effort Claude subagent): 6 confirmed and 3 plausible findings; 8 fixed, 1 (the replay still) not a problem for the video, whose replay frames stream every call. pnpm gate, CI run 39035999543 on 07e8494 and the live e2e (31 passed, LCP 712 ms) pass

# TASKS: M6a Pilot runner

Copied from SPEC.md section 6, M6a. Closes: Potential Impact. Freeze: 2026-10-19. Done means: a script takes a town, two headliners and band sizes, runs the agent offline without saving a build, and writes a one-page draft to .design/pilots/<town>.md; the Boise page has been checked.

- [x] src/lib/pilot.ts: the brief (the demo's crowd and fee ranges, the buyer's town, headliners and slots) and the one-page draft: the brief, the bill with each act's room and lift, open slots, the rooms tested with what each lifted, and the calls in call order with the planner's lines; no entity ids or scores (tests/unit/m6a)
- [x] scripts/pilot.ts: runs the agent offline with a memory cache, saves no build, writes .design/pilots/<town>.md and prints counts only
- [x] Boise checked: 12 Qloo calls, Mid 4 of 4, Opener 6 of 6; the page reads as one page

PREVIEW_URL: https://undercard-daniel-51ed.vercel.app (the judge URL: the project's production domain, which always serves the latest production deploy; public, no login; e2e passed against it 2026-10-15)

## Before judging starts (2026-11-02)
- [ ] Check that the saved build replays on the live URL. If it's gone, run one fresh build before 2026-11-02, because replays come from the saved build in Upstash, not from `pnpm seed`
- [ ] If the organizers haven't answered about rate limits by 2026-10-27, decide whether to raise the per-IP limits for judging, keeping the shared daily caps as the cost ceiling
