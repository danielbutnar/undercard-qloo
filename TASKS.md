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

# TASKS: M6j Towns resolve to the right place

Copied from SPEC.md section 6, M6j. Closes: Technological Implementation and Potential Impact. Freeze: 2026-10-22. Done means: a spike's go or no-go; on a go, a town plus a state or country in Your festival, its link and the pilot script, the resolved place in the trace, rooms outside the town marked in pilot drafts; a re-measure written down first; free text kept only at 8 of 10.

- [x] Spike (docs/evidence.md section 11): the plain name, then "town, region" when its places miss the region, resolves Burlington, Vermont, Richmond, Virginia and Brighton, England with one extra call, and the four demo towns to today's places with none: go
- [x] src/lib/town-resolution.ts and the venue search: Qloo's geocode on each place (no call), the second ask counted against the 12, the resolved place named on the trace line (tests/unit/m6j)
- [x] Your festival, its pre-filled link (region parameter) and scripts/pilot.ts take a state or country; a pilot draft marks rooms Qloo places outside the town, by Qloo's own city
- [x] Re-measure written into docs/evidence.md section 12 before the runs; result 8 of 10 US towns, at the bar: free text stays
- [x] Outreach table: Brighton thin; Wrexham and Cluj-Napoca fill both bands now; Burlington, Vermont fills from a room in Winooski

# TASKS: M6k Checked towns first

Copied from SPEC.md section 6, M6k. Closes: Design and Potential Impact. Freeze: 2026-10-24. Done means: Your festival opens on the checked towns, each with its country, one click to run, free text below if M6j keeps it; the list in one file in src/lib; shots at 1440x810 and 390 wide pass the design checks.

- [x] src/lib/checked-towns.ts: 29 towns from docs/evidence.md (sections 3, 4, 5, 9, 12, and M6d), each with its state or province and country; names only, no Qloo data (tests/unit/m6k)
- [x] Your festival: the headliners first (the demo's, editable), then the towns as buttons, city over state and country, one click to run; free text below (M6j kept it)
- [x] e2e: a checked town runs in one click with the headliners in the form
- [x] Shots at 1440x810 (the towns above the fold, three columns) and 390 wide (two columns, no sideways scroll); the design scan passes in the gate

# TASKS: M6l Say what a room is

Copied from SPEC.md section 6, M6l. Closes: Quality of the Idea and Design. Freeze: 2026-10-24. Done means: when an anchor is a park, arena, stadium or sports ground, its card and its trace line say so; which acts are booked doesn't change.

- [x] src/lib/place-kinds.ts: M6i's rule as a label ("an outdoor festival site", "an arena", "a stadium", "a sports ground"); museums aren't named (tests/unit/m6l)
- [x] The label rides on the venue run and the act's anchor venue (optional, so saved builds parse); the venue call's trace line names it; the card says "X is an outdoor festival site, not a club."
- [x] A whole scripted build books the same acts with the label as without it
- [x] Real check, offline: Duluth's trace names Venue 34 "(an outdoor festival site)"

# TASKS: M6m Checked towns replay

Copied from SPEC.md section 6, M6m. Freeze: 2026-10-18 23:00 Bucharest. Done means: every listed town replays a full bill; an e2e clicks three without starting a live run.

- [x] The bar written first (docs/evidence.md section 13)
- [x] Every checked town has its own festival id; a replay-only request never runs the agent (tests/unit/m6m)
- [x] A checked-town button replays its saved build, marked as a replay, with the live run next to it; edited headliners run live
- [x] Per-IP build limit raised to 30 for one deploy; 25 fresh production builds, one at a time: 25 of 25 full; limit back to 5
- [x] Replay-only check: all 29 towns stream a full bill; none leaves the list
- [x] e2e: Austin, Tallinn and Wrexham replay on the live demo with no live run

# TASKS: M6n A better thin-town answer

Copied from SPEC.md section 6, M6n. Freeze: 2026-10-20. Done means: one sentence on what happened, the checked towns in the same country (or all) offered one click each; shots at 1440x810 and 390 wide.

- [x] One sentence each for a town Qloo finds no places in and a town too thin to compare rooms (tests/unit/m6n)
- [x] The checked towns in the typed region's country, or all of them, one click each (a click replays, or runs live with the judge's headliners)
- [x] Shots at 1440x810 and 390 wide; the design scan passes in the gate

# TASKS: M6o Festivals filed as places

Copied from SPEC.md section 6, M6o. Freeze: 2026-10-21. Done means: a go or no-go in docs/evidence.md; on a go, the label.

- [x] The bar written first (docs/evidence.md section 14)
- [x] Spike: 29 towns, 33 calls; four rules label Venue 156 and no other anchor room: a go
- [x] "festival" among a place's three most frequent Qloo keywords labels it "a festival", on the card and the trace line; label only (tests/unit/m6o)
- [x] Place answers cached before the change aren't reused (new cache key)

# TASKS: M8b A bill that covers the town (no-go)

Copied from SPEC.md section 6, M8b. Freeze: 2026-10-22. Done means: an offline spike's go or no-go; on a go, applied and the saved towns rebuilt.

- [x] The bar written first (docs/evidence.md section 16)
- [x] Spike on the app's Qloo cache, 0 uncached calls, reassembly matches all four saved bills
- [x] Rooms per bill rose in 0 of 4 towns (bar 3): no-go. The rooms that lift any act are already the rooms on each bill. Not shipped; no rebuilds

# TASKS: M6q First screen for a lay reader

Copied from SPEC.md section 6, M6q. Closes: Design. Deploy by 2026-10-19 08:30 Bucharest. Done means: a plain first line and example; switch and Export CSV below the bill; plain words first, precise terms smaller; one display line; a lay cold reader before and after.

- [x] Lay cold reader before (production shots, 2026-10-17): couldn't say in a sentence what the page does; took the headliners for "performers", not sure they were bands; first click Watch the agent build it; lost on fee band, percentiles, Qloo and the +N badges; read it as a gig poster or a boxing fight card
- [x] First line: what Undercard does, in plain words; then the example, the headliners named as bands (only the demo's are called bands) (tests/unit/m6q)
- [x] With Qloo / Without Qloo and Export CSV below the bill
- [x] "Mid-size acts" and "Opening acts" with the fee band in a smaller line; "Watch how it picked these acts"; each act says "<club> fans like it" with its +N badge; the rooms note in plain words
- [x] One display line (the headliners); stamp smaller and in sentence case; act names, band and panel headings in the body face
- [x] Deployed 2026-10-17 23:50 Bucharest; live e2e 44 passed
- [x] Lay cold reader after (production shots): said what it does "within a few seconds", that Khruangbin and Japanese Breakfast are bands, and would click Watch how it picked these acts first. Still unclear to it: Qloo explained late, "fee band", the bare +N badges, "room", "agent" and "bill"

# TASKS: M8a Running order

Copied from SPEC.md section 6, M8a. Freeze: 2026-10-21. Done means: a spike's go or no-go; on a go, a running order one click from the bill.

- [x] The bar written first (docs/evidence.md section 15)
- [x] Spike: 180 of 180 pairs scored in 10 calls per bill; pairs sharing 2+ genre tags 0.NN, none 0.NN: go
- [x] src/lib/running-order.ts: per band, the pairing whose clashes share least; bigger draw on the main stage; openers first (tests/unit/m8a)
- [x] POST /api/running-order: one call per act but the last in each band, limited to the acts after it (8 calls for 4 + 6), limited per IP and per day; calls in the trace
- [x] Running order button on the bill; the panel says, set by set, who plays against whom and how close their fans' tastes are (wording corrected in M6r: ranked within the lineup, not a ticket overlap)
- [x] e2e on the live demo: five sets, each naming its clash, at most 10 calls

# TASKS: M8c Keep and redraft

Copied from SPEC.md section 6, M8c. Freeze: 2026-10-23. Done means: kept acts stay and the rest refill in at most 3 Qloo calls; an e2e keeps three acts, redrafts and sees only the other slots change.

- [x] POST /api/redraft: every slot not kept, the same bar, the board and unavailable acts excluded, at most 3 calls across the bands (tests/unit/m8c)
- [x] Keep on the act card; Kept on the bill; Redraft the rest on the bill once an act is kept
- [x] e2e on the live demo: three kept acts stay, the other slots change, 1 to 3 redraft calls in the trace

# TASKS: M6r Plain words, round 2

Copied from SPEC.md section 6, M6r. Closes: Design, Quality of the Idea. Deploy by 2026-10-18 22:00 Bucharest. Done means: plain words first with the buyer's term once in brackets; no "fee band" and no bare "+N"; the running order ranked, not "overlap", with a booker-pairs check; two lay readers and the buyer reader pass; deployed and the live e2e passes.

- [x] "fee range" for "fee band" (none left on the page); "venue" for "room"; "lineup (the bill)" at first use; "AI agent" at first use on the first screen and Your festival (tests/unit/m6r)
- [x] Qloo explained in the first line, above the fold at 390 wide: "a taste-data service that maps what fans of one artist, venue or film also like" (Qloo's hackathon kit says "taste-powered"; its devpost page returned 403)
- [x] Every +N badge carries its words: "places higher in Qloo's ranking"; "new" reads "new to Qloo's top 50"
- [x] Running order: each clash ranked among the lineup's pairs ("the 3rd closest of 21 pairs on this lineup"), "a measure of taste, not a count of shared ticket buyers"; raw affinities in the trace line; docs note in evidence section 15
- [x] Booker-pairs check, bar and pairs fixed first (evidence section 17): 5 of 5 same-crowd pairs above every different-crowd pair: it stays in the demo path
- [x] Deployed 2026-10-18 00:40 Bucharest; live e2e 44 passed, 7 skipped (no Qloo calls); E2E_LIVE_QLOO run 3 passed
- [x] Lay readers C and D (fresh, M6q prompt plus the four terms, production shots of the final version): each says what the page does and explains fee range, a badge number, AI agent and Qloo. Still hard for them: the fee-range sentence and "percentile", "lifted" and "tested for" in the venue box, "build" and "calls", AI agent against AI model, act names that don't look clickable
- [x] Buyer cold reader: "an AI agent for music festival bookers ... based on what fans of the town's music venues already like"; first click Watch how it picked these acts

# TASKS: M8d Premise test on real festivals

Copied from SPEC.md section 6, M8d. Freeze: 2026-10-24. Done means: ten real festivals in towns Undercard reads, the measure and the bar written first, reported either way, counts only in committed files.

- [x] Ten lineups (Treefort's own page; nine from Wikipedia edition sections), names kept in .design/m8d
- [x] The measure and the bar written and committed first (docs/evidence.md section 18); one change before any result (take 50, Qloo's maximum), recorded
- [x] scripts/premise-test.ts: 287 Qloo calls, one at a time
- [x] Result: 7 of 10 festivals support it, bar 8: not supported. 7 of the 8 that could be scored favour the booked acts, by 0.001 to 0.044 affinity

# TASKS: M9a The lift, visible

Copied from SPEC.md section 6, M9a. Freeze: 2026-10-23. Done means: venues' results re-sort the band and lifted acts climb with the real move; replays watchable with a skip; CSS and Web Animations only; reduced motion shows the end state; two cold readers pass.

- [x] Bars written first (docs/evidence.md section 19)
- [x] src/lib/lift-climb.ts: a band's list for the headliners alone, then each venue's re-sort with real moves (tests/unit/m9a)
- [x] Live builds emit a climb step after each baseline and venue call; replays rebuild them from the Qloo cache through a cache-only client that never calls Qloo
- [x] Spike: all 29 saved builds rebuild their full climb, 0 Qloo calls
- [x] The climb takes the bands' place while it plays (Web Animations FLIP), 0.9 s per headliners-only list and 1.8 s per venue, Skip to the lineup; reduced motion shows the end state; the venues rail steps aside meanwhile
- [x] Live e2e passes (it sees the climb, then skips); both cold readers pass

# TASKS: for the 26-27 October redo (not now)

Moved 2026-10-18: the video and the gallery stills are re-shot on 26-27 October, after a UI freeze at the end of 25 October; 28 October is buffer. Protected windows (no deploys, no offline Qloo runs): Monday 19 October 09:00-21:00 and Tuesday 20 October 09:00-22:00 Bucharest. The live e2e makes no Qloo calls by default; the redraft, running-order and refill steps run with E2E_LIVE_QLOO=1 once after each deploy, outside those windows.

- [ ] Fix the video's capture script for the reason picker (its refill step now stops at "Why is it unavailable?")
- [ ] Story: M6b's runs per town; M6c as a stated limit ("a Boise heatmap gave a local signal for 7 of the 10 acts, so Undercard doesn't claim the town knows every act"); the town switcher and Your festival
- [ ] Gallery stills that show the town switcher and the reason picker
- [ ] Story and README: the corrected Your festival count (7 of 10 with plain names; 8 of 10 once towns resolve), how towns are resolved, and that Brighton stayed thin while Wrexham and Cluj-Napoca filled once resolved

- [ ] From M7a: the capture script handles the town buttons and the checked-town replays as well as the reason picker
- [ ] From M7a: docs/devpost-story.md with the corrected counts (free text 8 of 10; M6c 7 of 10), how towns are resolved, the checked towns, what a room is and the stated limits; keep the line for a buyer's words
- [ ] From M7a: re-shoot the gallery stills; render a silent draft of the video with captions (the voiceover follows once the ElevenLabs key is in video/.env.local)
- [ ] From M7a: a fresh high-effort check of every claim in the story, README and captions against docs/evidence.md, with what it finds fixed

- [ ] Shipped in M6m: checked-town buttons replay saved builds (marked as replays, the live run next to them); show it in the story, a still and the video
- [ ] Shipped in M6n: a typed town that can't be found or is too thin says so in one sentence and offers the checked towns in its country; one still
- [ ] Shipped in M8c: Keep on the act card and Redraft the rest on the bill; the capture script, a still and a line in the story

- [ ] Shipped in M6o: Venue 156 is labelled a festival, not a club; Cluj-Napoca's saved build predates the label, so it shows after that town's next build

- [ ] Shipped in M6q: the plain first line and the calmer bill; re-shoot every still and re-capture the video, whose narration and captions name "Watch the agent build it"

- [ ] Shipped in M8a: Running order on the bill (two stages, clashes whose fans' tastes are least alike, ranked within the lineup); the story, a still and a capture step

- [ ] Story: M8d's test on ten real festivals as a stated near miss (7 of 10, bar 8), with the lineups' partiality as its limit

- [ ] Shipped in M9a: the climb after Watch; the capture script must wait for it or press Skip, and the video should show it (it is the product's moment)

PREVIEW_URL: https://undercard-daniel-51ed.vercel.app (the judge URL: the project's production domain, which always serves the latest production deploy; public, no login; e2e passed against it 2026-10-15)

## Before judging starts (2026-11-02)
- [ ] Check that the saved build replays on the live URL. If it's gone, run one fresh build before 2026-11-02, because replays come from the saved build in Upstash, not from `pnpm seed`
- [ ] If the organizers haven't answered about rate limits by 2026-10-27, decide whether to raise the per-IP limits for judging, keeping the shared daily caps as the cost ceiling
