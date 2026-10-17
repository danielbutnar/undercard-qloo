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
- [x] Pilot towns, added 2026-10-17: Calgary, Raleigh and Reykjavík with the demo's brief, plain city names, no saved builds. All three filled both bands (20, 18 and 5 live-music places); a go for pilots, in docs/evidence.md section 4. A run that meets Qloo's rate limit (HTTP 429) is redone

# TASKS: M6b Robustness

Copied from SPEC.md section 6, M6b. Closes: Technological Implementation and Potential Impact. Freeze: 2026-10-20. Done means: from five offline runs in Boise and three each in Austin, Denver and Nashville, docs/evidence.md reports per town how often both bands filled, which rooms were tested and how many acts each lifted, and how many of the ten acts repeat between runs.

- [x] src/lib/robustness.ts counts the acts on every run's bill, the different acts, and what each pair of runs shares (tests/unit/m6b)
- [x] scripts/robustness.ts: a fresh memory cache per run, no saved build, a pause between runs, and a run that meets Qloo's rate limit is redone
- [x] Results in docs/evidence.md section 5: every run filled both bands (5 of 5, 3 of 3, 3 of 3, 3 of 3); Boise, Denver and Nashville gave the same ten acts every run, Austin 8 to 10 in common
- [x] Found: running towns in parallel, or the agent's own parallel calls, can meet Qloo's rate limit (HTTP 429); the agent then tests fewer rooms. Recorded in section 5

# TASKS: M6c Local strength (no-go)

Copied from SPEC.md section 6, M6c. Closes: Quality of the Idea, Potential Impact and Technological Implementation. Freeze: 2026-10-22. Done means: a spike's go or no-go in docs/evidence.md.

- [x] Spike (scripts/local-strength-spike.ts, 28 calls): the heatmap by map cell gives a Boise affinity rank for 7 of the 10 acts on the bill; the heatmap by locality and popularity filtered by location give none
- [x] No-go recorded in docs/evidence.md section 6: under the bar of 8 of 10, so nothing is added to the card and nothing is claimed

# TASKS: M6d The same brief in other towns

Copied from SPEC.md section 6, M6d. Closes: Technological Implementation, Potential Impact and Design. Freeze: 2026-10-24. Done means: Austin, Denver and Nashville builds of the same brief, each run fresh once on production under its own festival id and replayed like Boise; a town switcher one click deep; Boise stays the default and its latest pointer never moves; a town whose build has a band that isn't full is left out.

- [x] src/lib/towns.ts: the same brief under sagebrush-sound-austin, -denver and -nashville; every request names its festival, Boise when it doesn't, refused when it's unknown (tests/unit/m6d)
- [x] /towns/<town> pages, cached like the home page; a town shows only once it has a saved build, and only complete builds are saved, so a town with a short band never shows
- [x] Labels name the town: Why Austin, Austin venue crowds, No Austin room
- [x] Town switcher in the rail, under Watch the agent build it; e2e tests/e2e/towns.spec.ts
- [x] Fresh builds on production, once each (14:57-14:59 UTC): Austin 12 calls, Denver 11, Nashville 12, all with both bands full; Boise still serves its 12:13 UTC build
- [x] Live e2e 33 passed (LCP 268 ms); the cold reader still names the buyer, Boise's venues and Watch the agent build it

# TASKS: M6e Booking vocabulary

Copied from SPEC.md section 6, M6e. Closes: Quality of the Idea. Freeze: 2026-10-24. Done means: "Unavailable" takes a reason (radius clause, routing or fee), recorded in the refill's trace line and in the CSV.

- [x] The card asks "Why is it unavailable?" with Radius clause, Routing, Fee and Cancel; the reason goes with the refill request (tests/unit/m6e)
- [x] The refill's trace line names it: "Refill (radius clause): Mid-band artists for the headliners and …"
- [x] The CSV gains replaces and unavailable_reason; a replacement's row names the act it replaced and why
- [x] The e2e demo path picks a reason, and checks the trace line and the CSV row

# TASKS: M6f Your festival

Copied from SPEC.md section 6, M6f. Closes: Design and Potential Impact. Freeze: 2026-10-26. Done means: a spike's go or no-go in docs/evidence.md; on a go, a form one click deep runs the agent live under the per-IP limit, with designed states for a headliner not found, too few music rooms and the limit reached, each run under its own festival id and never saved as anyone's default.

- [x] Spike: 8 of 10 US towns filled both bands within 12 Qloo calls (Richmond tested no room, Missoula's rooms lifted nothing): a go at the bar, in docs/evidence.md section 7
- [x] src/lib/your-festival.ts: the brief (a town's name, two different headliners), its festival with its own id, and the diagnosis of a short run from its stream (tests/unit/m6f)
- [x] POST /api/undercard takes a brief: a live run under the build limit, a festival id of its own, never saved; a short run ends with an error that names why
- [x] /your-festival: the form, then the bill and trace, with no Without Qloo, refill or switcher; designed states for a headliner not found, too few rooms, open slots and the limit, each with a next step
- [x] Linked from the town switcher; e2e tests/e2e/your-festival.spec.ts answers every build in the browser, so it never runs the agent on production

# TASKS: M6g Qloo rate-limit resilience

Copied from SPEC.md section 6, M6g. Closes: Technological Implementation and Design. Freeze: 2026-10-18 23:00 Bucharest. Done means: the cap, retries and budget in the Qloo client, retries on their call's line, a designed busy state with the replay where one exists, tests with a synthetic Qloo, the live e2e, and the settings in docs/evidence.md.

- [x] src/server/qloo.ts: 2 calls in flight per client; 429 and 5xx retried up to 5 times with full-jitter backoff (0.5 s doubling to 8 s), never sooner than Retry-After; a 45-second budget per build or refill, then QlooBusy
- [x] A retry isn't a new call: the 12-call cap counts tool calls, and the trace line says "retried after 429"
- [x] QlooBusy ends the build with code qloo-busy; the trace panel offers "Watch the saved build instead"; Your festival shows "Qloo is busy right now" with the brief kept
- [x] tests/unit/m6g: same rooms, bill and call count through alternating 429s and 503s; the budget and the cap hold; Retry-After, backoff and the cap each tested. The M2 failure test now uses a 404, which isn't retried
- [x] A real offline Boise build with the new client: 20 s, 12 calls, both bands full, the same rooms
- [x] Settings and reasons in docs/evidence.md section 8

# TASKS: Step 1 Town check, second outreach wave

- [x] Venue lookup for 16 towns, plus Winooski, with plain city names, one at a time (scripts/town-check.ts); each place's geocode checked against the town
- [x] Pilots for the 12 towns with at least five places in town, one at a time: all 12 filled both bands (drafts in .design/pilots/)
- [x] Not run: Cluj-Napoca (3 places), Brighton (0), Wrexham (2 in town), Burlington, Vermont (the name reads Burlington, Ontario; Winooski returns 1)
- [x] docs/evidence.md section 9, with a correction to section 7: its Burlington row was Burlington, Ontario, so the M6f spike was 7 of 10 US towns

# TASKS: M6h A pre-filled Your festival link

Copied from SPEC.md section 6, M6h. Closes: Potential Impact. Freeze: 2026-10-20. Done means: /your-festival reads the town and two headliners from the URL and fills the form without running; an e2e opens a pre-filled link, sees the fields filled and sees no run start.

- [x] yourFestivalHref and briefFromSearch in src/lib/your-festival.ts: town and two headliner parameters, cut to the fields' lengths (tests/unit/m6h)
- [x] The page reads the query on the server and hands the form its values; a line says they came from the link; nothing runs until the visitor presses Draft my undercard
- [x] e2e tests/e2e/prefilled-link.spec.ts: the fields are filled, no request reaches /api/undercard in 2 seconds, no bill appears

# TASKS: M6i Rooms that are music rooms (no-go)

Copied from SPEC.md section 6, M6i. Closes: Quality of the Idea and Design. Freeze: 2026-10-24. Done means: a spike's go or no-go in docs/evidence.md; on a go, the rule before the planner, in the trace, and the ten-town spike still at least 8 of 10.

- [x] Spike: Qloo's place categories for 12 towns (181 places); a rule on parks, arenas, stadiums and sports grounds leaves out 9 and drops none of the 29 rooms used
- [x] Ten-town rerun with the rule, one at a time: 7 of 10 filled both bands (Duluth lost its Opener band without its festival park), under the bar of 8
- [x] No-go recorded in docs/evidence.md section 10; the rule's code was reverted before any commit and isn't shipped

# TASKS: for the 27-28 October redo (not now)

- [ ] Fix the video's capture script for the reason picker (its refill step now stops at "Why is it unavailable?")
- [ ] Story: M6b's runs per town; M6c as a stated limit ("a Boise heatmap gave a local signal for 7 of the 10 acts, so Undercard doesn't claim the town knows every act"); the town switcher and Your festival
- [ ] Gallery stills that show the town switcher and the reason picker

PREVIEW_URL: https://undercard-daniel-51ed.vercel.app (the judge URL: the project's production domain, which always serves the latest production deploy; public, no login; e2e passed against it 2026-10-15)

## Before judging starts (2026-11-02)
- [ ] Check that the saved build replays on the live URL. If it's gone, run one fresh build before 2026-11-02, because replays come from the saved build in Upstash, not from `pnpm seed`
- [ ] If the organizers haven't answered about rate limits by 2026-10-27, decide whether to raise the per-IP limits for judging, keeping the shared daily caps as the cost ceiling
