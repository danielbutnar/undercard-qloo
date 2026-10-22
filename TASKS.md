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

# TASKS: M9b Town against town

Copied from SPEC.md section 6, M9b. Freeze: 2026-10-23. Done means: two towns side by side from saved builds, shared and different acts marked, one click from the bill; a cold reader explains why they differ.

- [x] Bars first (docs/evidence.md section 20); spike from the saved builds: Austin is the first town with both marks (3 shared, 7 its own)
- [x] src/lib/compare.ts and /compare: Boise against any checked town, each act "On both lineups" or "Only in <town>", the venues named (tests/unit/m9b)
- [x] Compare with another town, one click from the bill; e2e on the live demo
- [x] Reader passes: the lineups differ "because the AI agent built each one from what fans of that town's own venues like"

# TASKS: M9c The method page

Copied from SPEC.md section 6, M9c. Freeze: 2026-10-24. Done means: one diagram, the evidence table with limits, a play-to-load video slot, five objections answered with links to evidence rows; a cold reader answers all five.

- [x] Reader bar and answer key written first (docs/evidence.md section 21); a factual section 22 on who decides what
- [x] /method in the bill's sheet style, no hero, no feature cards: one SVG diagram, five objections, 15-row evidence table, the limits, the video slot (tests/unit/m9c)
- [x] Every claim links to its section of docs/evidence.md on GitHub (resolves for judges once the repository is public at M5)
- [x] How it works, one click from the lineup; e2e on the live demo
- [x] Reader passes 5 of 5 from the live page alone

# TASKS: M8e Accessibility and input hardening

Copied from SPEC.md section 6, M8e. Freeze: 2026-10-25. Done means: a keyboard and screen-reader pass on every screen, with what it found fixed, and tests that a town or headliner written as instructions is treated as data.

- [x] Criteria written first (docs/evidence.md section 23)
- [x] Found and fixed: the brief put the buyer's text straight into the planner's message; now escaped JSON in one <brief> block, never to be followed (tests/unit/m8e)
- [x] Qloo gets it as one URL-encoded value; it can't add an act; the page renders it as text
- [x] tests/e2e/a11y.spec.ts on /, /towns/austin, /your-festival, /compare, /method: one h1, named controls, images and regions, a focus mark at every Tab stop, no trap; passes locally and live
- [ ] Not done: a real screen reader (NVDA or VoiceOver) pass

# TASKS: M9d Blind tournament

Copied from SPEC.md section 6, M9d. Freeze: 2026-10-25. Done means: three candidates per screen besides the current one, judged blind in both orders by four fresh persona judges on two models; a challenger wins 2 of 3 to replace; protocol written first; win rates and task accuracy, then a final check by unused judges.

- [x] Protocol in docs/evidence.md section 24 before the first round
- [x] Round 1: first screen no winner; build view no winner; method page two columns wins 3 of 3
- [x] Round 2: first screen ledger + lift bars wins 3 of 3; build view "(was Nth)" wins 3 of 3; method page diagram full width over two columns wins 3 of 3
- [x] Final check by 12 unused judges (Haiku, Sonnet, Opus): each winner beats the original (2-0 with 2 ties, 4-0, 4-0)
- [x] Winners shipped (1749870); candidates kept in 6f2e26a, then removed; the bill's separate key goes, the rows say it
- [x] Cold reader of the new first screen passes (what, for whom, Watch first, the venue's fans as the reason)
- [x] Deployed (6bfbc85) and the live e2e passes: 56 passed, 7 skipped, then the 3 Qloo steps with E2E_LIVE_QLOO=1

# TASKS: run of 2026-10-18 afternoon (before the Monday window)

- [x] <brief> against the live model on every path: a fresh production build through Your festival (Portland, 12 calls, both ranges full, trace normal), the model-only answer on a checked town (fresh, read the brief), and pilot.ts (Asheville, 4 of 4 and 6 of 6)
- [x] Cluj-Napoca's live replay: one build (09:52 UTC), 10 acts all from Venue 156, the rail and trace agree, the card and trace say "a festival"; no rebuild needed
- [x] SPEC: the button's current label in section 3 and the live rules; the redo is 26-27 October
- [x] M8d overlap: attempts equal requests for all ten festivals (287), so no call was retried for a 429 or 5xx; recorded in evidence section 18
- [x] Unit tests: none needs 20 s (slowest 3.5 s; two suites at once all pass at 5 s); unit tests now run offline (tests/unit/setup.ts), and the live Upstash check moved to tests/live
- [x] Watch under the headliners at every width, first sentence split: bar written first (evidence 25), 24 of 24 first clicks; cold reader passes
- [x] Method page: shown, partly shown, not shown; the evidence in two groups, every row and limit kept
- [x] Deployed (3998e5a) and the live e2e passes: 56 passed, 7 skipped, LCP 260 ms; the 3 Qloo steps passed on Sunday UTC
- [x] M8f in SPEC; its bar in evidence section 26 before any run

# TASKS: M8f Premise test, round 2 (from Wednesday 21 October)

- [x] List 30 festivals in towns with a saved build, none of M8d's ten, each with its own site's complete lineup, in .design/m8f/ before any Qloo call (2026-10-21: 30 in 27 towns, found by five research subagents, seven re-read against their pages; three left out before the call; the list's SHA-256 and the order of each page in evidence section 26)
- [x] Run outside the protected windows, one call at a time; report either way in evidence section 26: 2026-10-21, 16:39-17:07 Bucharest, 1,164 Qloo calls with no retry; 20 of 30 support, the bar exactly
- [x] Put the result on the method page next to the 7 of 10: /method/evidence's premise table, with the verdict line and the limits updated (tests/unit/m8f)

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

- [ ] Shipped in M9b: /compare, Boise against Austin by default; a still and a line in the story

- [ ] Shipped in M9c: /method; set DEMO_VIDEO_URL in src/lib/method.ts once the video is published; link the method page from the story

- [ ] Shipped 2026-10-18: Watch under the headliners at every width and the first sentence in two; the method page's shown / partly shown / not shown lines and two evidence groups. Re-shoot the first-screen and method stills, and any caption that quotes the old first sentence

- [ ] Shipped in M9d: the ledger bill with lift bars, "(was Nth)" on the climb, the method page in two columns; re-shoot every still and the capture of the bill and the climb, and drop the key's line from any caption

PREVIEW_URL: https://undercard-daniel-51ed.vercel.app (the judge URL: the project's production domain, which always serves the latest production deploy; public, no login; e2e passed against it 2026-10-15)

## Before judging starts (2026-11-02)
- [ ] Check that the saved build replays on the live URL. If it's gone, run one fresh build before 2026-11-02, because replays come from the saved build in Upstash, not from `pnpm seed`
- [ ] If the organizers haven't answered about rate limits by 2026-10-27, decide whether to raise the per-IP limits for judging, keeping the shared daily caps as the cost ceiling

# TASKS: Design round (branch design-round, worktree .claude/worktrees/design-round)

Daniel's brief of 2026-10-18: he doesn't like the live design. This round he judges taste, real people judge clarity, and AI readers are only a pass/fail check that the page is understood. Not up for redesign: the first sentence, M6r's plain words, the venue-and-climb reason on every act, the method page's evidence and limits, and Watch as the first click. CLAUDE.md, RULES.md and the frontend-anti-slop skill still apply; SPEC.md section 7 still rules out artist photos. Merge main in before step 6; never rebase. Main keeps its own TASKS.md sections; this one lives only on design-round until the merge.

Dates (Bucharest): no production deploys Monday 19 October 09:00-21:00 or Tuesday 20 October 09:00-22:00, and no live-Qloo e2e on either day. Step 3 by Tuesday evening; on production by Thursday 22 October; if it isn't on production by Friday 23 October 22:00, stop and polish the current design. UI freeze at the end of Sunday 25 October; video and stills 26-27 October.

Daniel's inputs: his words on the live design are C1-C4 in docs/design-bans.md; references only if none of the six lands. He approved the six directions below; the set-time clash grid is left out because the saved build has no running order, so its set times would be invented.

- [x] 1. The live look in docs/design-bans.md as C1, scan regex scoped to src/app/lab until step 6 replaces the look; his three points as C2-C4 screenshot checks; scripts/design-check.mjs takes the `in:` scope (tests/unit/design-round)
- [x] 2. Six directions behind a local-only /lab on the saved Boise build, no Qloo data committed: each with its first screen at 1440x810 and 390 wide, a 10-15 s clip of the agent building the lineup, and one sentence on why it suits a talent buyer; all six on one local page
  - [x] /lab answers only under `next dev`, never on Vercel; stills and clips live in .design/lab (git-ignored) and are served only in dev
  - [x] Capture script (scripts/lab-capture.mjs): the two stills and the clip per direction, from the real replay (no Qloo or Claude calls); locally the replay waits about 4 s on Upstash before its first step, so each clip starts 1.2 s before it and ends 1.4 s after the bill is back (10-15 s)
  - [x] The weekly chart
  - [x] The mixing desk
  - [x] The split-flap board
  - [x] The club marquees
  - [x] The booker's magnet board
  - [x] The rock family tree
  - [x] /lab shows all six: stills, clips, sentences, a link to each live screen, and the live design for comparison
- [ ] 3. Stop: Daniel picks one or two and says why (by Tuesday evening)
- [ ] 4. Two or three variants of the pick; gate, not judge: a fresh AI lay reader (the M6q prompt) says what the page does and for whom and names Watch as the first click; a variant that fails is fixed or dropped
- [ ] 5. The finalist on a Vercel preview URL (not production, saved builds only); three people on their phones; fix what they trip on. Before any deploy made from this machine: `pnpm build`, then `node scripts/trace-check.mjs` must report that no route carries .design or other project files (checked 2026-10-18 on 97a721a plus the lab-shots split: clean; a local production server answered 404 on every /lab route)
- [ ] 6. Merge main in; build it into the app with loading, empty and error states, motion that respects prefers-reduced-motion, and the method page's diagram in the same direction; C1's scan widened to all of src; the e2e and `pnpm gate` pass

# TASKS: Final design round, direction 1: the weekly chart (branch final-chart, worktree .claude/worktrees/final-chart)

Daniel's brief of 2026-10-18 (Sunday): one of three sessions, each building a direction as the whole product; he picks one from the three preview URLs. Dev server on port 3103 only. Deliver by Wednesday 21 October 12:00 Bucharest. No Qloo calls and no live runs Monday 09:00-21:00 and Tuesday 09:00-22:00; never deploy to production; read saved builds, never rebuild or overwrite them; no Qloo response data in the repo.

- [x] Worktree .claude/worktrees/final-chart on branch final-chart from design-round; branch pushed, its preview builds at https://undercard-git-final-chart-daniel-51ed.vercel.app (public, but the Preview environment has no Upstash or Qloo settings: it shows the empty board; asked Daniel)
- [x] One Qloo call (Sunday): /search returned 3 artists, each with properties.image.url on images.qloo.com; the app's Qloo cache drops the field, so showing images would need new Qloo calls per act: not shown
- [x] Brainstorm: five first-screen ideas and three Watch ideas, each its own subagent; stills checked against the bans and gates; the strongest built, the rest in docs/design-brief.md with one line on why each lost: all eight mocked up on the real Boise build; built the chart sheet's palette, type and arrows with the sleeves mockup's headline, layout and drawn covers, and the editions Watch with the countdown's drop-into-slot ending (docs/design-brief.md section 9); the dark teal default and a periwinkle page added to design-bans as C5 and C6
- [x] The venue switch: the lineup re-forms from the saved build by the rule in src/lib/assemble-lineup.ts with only the venues left on, no Qloo or model calls, open slots stay open; unit test on made-up data (tests/unit/final-chart)
- [x] One-off check against the 29 saved builds: with every venue on, the recomputed lineup equals the saved one (results not committed): 29 of 29 equal act for act, 0 Qloo fetches (2026-10-18)
- [x] Preview deployments never save a build (a fresh run there can't move a saved build's pointer)
- [x] The first screen in the chart direction (two seconds: a festival lineup drafted from a town's own venues; Watch is the first click; venue as a colour or mark with the words one tap away; at least one act on a phone's first screen): squint test passed (a fresh reader of the third-size shot: an AI agent that drafts a festival's acts from what fans of a town's own venues like; first click the yellow Watch button)
- [x] Watch: one orchestrated reveal under 20 s, something changes every 1-2 s, Skip always there; reduced motion shows the end state: an edition of the chart per Qloo result, in the venue's colour; Boise plays in about 13 s; Skip in the banner throughout
- [x] The act card (why, Keep, Unavailable with its reason, the refill), Redraft the rest, Running order
- [x] Compare with another town; With and Without Qloo; Export CSV; town pages
- [x] Your festival: the 29 checked towns, free-text towns, the thin-town message, Run the agent live
- [x] The method page told with visuals (C3): a four-panel storyboard, who decides what as three cards, counted results as dots against their bars, verdict marks
- [x] Loading, empty and error states designed; prefers-reduced-motion respected; 390 wide and 1280x800 without sideways scroll: shot in .design/shots by tests/e2e/design-shots.spec.ts; 390, 1280 and 1440 without sideways scroll on every screen
- [x] Gates: squint test, lay reader (M6q prompt) at 1440 and 390, design scan, pnpm gate, e2e against the preview with no live-Qloo tests (run against production instead, at Daniel's request)
  - [x] Squint test (2026-10-18): a fresh reader of the third-size 1440x810 shot: "an AI agent that drafts a festival's opening acts from what fans of a town's own venues like, for festival organizers"; first click the yellow Watch button
  - [x] Lay reader (2026-10-18, 1440 and 390 shots): what it does and for whom ("drafts the support bands … using what fans of Boise's own venues like … aimed at festival organizers"), one act's reason in its own words (its old and new place in Qloo's ranking and the venue whose fans lifted it), first click Watch; it found the fee range bars and the slot squares unclear, so both are now labelled in words
  - [x] Design scan and pnpm gate pass (479 unit tests at 1669345); e2e locally on the synthetic server: 61 passed, 5 skipped (live-Qloo steps and empty-server scenes), rerun after every review's fixes
  - [x] e2e against the deployment with data (2026-10-21): the Preview environment has no variables, so at Daniel's request the 1669345 preview was promoted to undercard's Production, the one environment that has them (deployment 9D4YHrpwQ on https://undercard-delta.vercel.app; Instant Rollback returns main's 700e852, deployment undercard-qazgk7jzq). Against it, with no live-Qloo tests: 31 passed, 4 skipped, and 4 failed on network errors on this machine's connection (reset, timed out, network changed) that passed when run again (Your festival 5 of 5, the refilling shots 2 of 2)
- [x] Merge main in (never rebase): main hasn't moved since the branch took it in (checked 2026-10-21 08:52); the branch is on its preview URL and, promoted, on production
- [x] A fresh subagent reviews the diff against main for merge-blocking problems; none left
  - [x] First review (fresh Opus subagent, 2026-10-18): four blocking problems, all fixed in 770e87c: Qloo-derived act names and places in docs/design-brief.md and TASKS.md (the earlier commits 4988e25 and a450aff still held them; rewritten with Daniel's OK on 2026-10-21, see the next section); the venue switch could show another build's data after a live run; checked-town replays labelled as live runs; the phone's scroll to Watch ignored reduced motion
  - [x] Second review (fresh Opus subagent, 2026-10-18): one blocking problem, the method page's result pictures never drew (a scripted edit had dropped the escapes in their patterns), fixed in eeb2722 with a test that counts them; its one minor note, an open Running order staying under the re-formed chart while a venue is off, fixed in e30ba49
  - [x] Third review (fresh Opus subagent, 2026-10-18): one blocking problem, during a live run each venue's edition in Watch said no act climbed onto the lineup, because a live run sends its lineup last; fixed in 0838c7f (until the lineup is in, the banner counts the climbs its own edition shows), with tests for both orders; its minor notes fixed in 16a38a5 (the README's font credit, the demo video button's hover colour)
  - [x] Fourth review (fresh Opus subagent, 2026-10-18): two blocking problems, both fixed in bd6a1a2 with tests: Without Qloo credited the AI agent and its Qloo calls and kept the venue switch beside the model's picks (it now shows only the model's note beside them); on a judge's own run, Watch promised a replay but ran the agent live again, spending a live run and dropping the draft (it now replays the run the screen holds), and the line under Watch could give a wrong count (it now counts only while the screen shows the saved build); from its minor notes, the venue switch asks once more when a just-finished build isn't saved yet, and the keep-or-unavailable hint hides while a venue is off
  - [x] Fifth review (2026-10-21): two blocking problems in bd6a1a2's Watch on a judge's screen: a run that ended in an error offered a replay that did nothing, and a run that failed without a code left nothing to press; fixed in 1d5160c (a finished run replays from memory, any other offers "Run the agent again")
  - [x] Sixth review (2026-10-21, of 1d5160c): at the day's live-run limit the lead promised a run (already fixed in 55ecb91), and after a refused re-run over a lineup the trace offered "Replay the saved build", which ran a judge's brief live and dropped the draft; fixed in 1669345 (the replay only where a saved build exists, the refusal's code kept)
  - [x] Seventh review (2026-10-21, of 1d5160c, 55ecb91 and 1669345): nothing blocks the merge
- [x] Deliver: the preview URL, stills of every screen at 1440x810 and 390 wide, a 30-second recording of the demo path, docs/design-brief.md, what I'd still improve (2026-10-21: production https://undercard-delta.vercel.app, the preview https://undercard-git-final-chart-daniel-51ed.vercel.app)
  - [x] Stills of every screen at 1440x810 and 390 wide (11 screens), the designed states, the brainstorm stills and a 30-second recording of the demo path in .design/final-chart (git-ignored); after the fourth review's fixes (2026-10-21) the Without Qloo and what-if stills were retaken and the recording made again

# TASKS: Daniel's brief of 2026-10-21 (Wednesday): main up to date, M10a, M10b, artist images

Done means every item below is finished and deployed, with `pnpm gate`, the design scan and the e2e passing, by Saturday 24 October 22:00 Bucharest. The UI freezes at the end of Sunday 25 October. Item 4 only if items 1-3 are done by Friday 23 October. A push to main deploys production: push only when the gates pass. No Qloo-derived numbers in committed files: bars and answer keys that need a real act's places keep them in .design/ (git-ignored).

1. Main up to date
- [x] 4988e25 and a450aff shown to Daniel: docs/design-brief.md's mockups held five real acts' Qloo places and climbs, and TASKS.md a lay reader's quote of one; 770e87c had already replaced both at the tip; no other commit on any branch matched. Daniel's OK: final-chart rewritten from 4988e25 on to carry 770e87c's placeholders (27 commits, messages, authors and dates kept byte for byte, the tip's tree identical; 4988e25 is now de49058 and a450aff e5aecef)
- [ ] The rewritten final-chart force-pushed to origin: the permission check here refused it, so it waits on Daniel
- [x] final-chart merged into main with a merge commit (8aef8af); work continues on main
- [x] Daniel's call, found after the merge (decided 2026-10-21: they stay as they are): two earlier final-chart commits, now on main and origin/main, hold the saved build's places without act names: 9c85f16 (the old storyboard's "An artist" row with one act's climb and place, and its lineup panel's places with their genres, at the tip until 9cc253b) and 0c89c27 (a chart.css comment with one act's places, at the tip until 406261f). My first report missed them: I took the unnamed rows for placeholders. The tip is clean (406261f); scrubbing the history means rewriting main and force-pushing it
- [x] The unused old components and their two tests deleted: the old bill, rooms rail, lineup board, festival header and lift climb, with tests/unit/m4b/draft-bill.test.tsx and m4c/labels.test.tsx; the one check of the live screen in the first moved to m4b/first-screen.test.tsx
- [x] Watch steps through its editions without animation when reduced motion is on: the same pace and Skip, no glide, no print-in (tests/unit/m9a/climb-screen.test.tsx)
- [x] After "Qloo couldn't find this town" or "too few venues", the checked towns instead of "Run the agent again": the notice takes the run button's place in the lead and comes into view (tests/unit/final-chart/thin-town-lead.test.tsx, tests/e2e/your-festival.spec.ts)
- [x] On a 390x844 phone, the first act shows on the first screen: on the saved Boise build its whole row ends at 648 px at 390 wide (it was 840), inside the about 664 px Safari shows on a 390x844 iPhone with its bars in view (an estimate, not checked on a device); sizes and gaps only, below 768 px (tests/e2e/phone-first-screen.spec.ts)
- [x] Gate (468 unit tests), design scan, build and local e2e (63 passed, 5 skipped) pass; main pushed at c8ae7b2 (2026-10-21), production served it within a minute; the live e2e passes (61 passed, 7 skipped), then the three live-Qloo steps (9 passed)

2. M10a The numbers beside each act
- [x] M10a and M10b in SPEC.md section 6
- [x] The bar in docs/evidence.md section 27 before building (the key, being Qloo-derived, in .design/m10a)
- [x] Variant a: the climb as the hero (a big climb where the place was, a small ladder from the old place to the new one, the venue tab, NEW for acts from outside the top 50); rows by climb, a new entry by the least it can have climbed (tests/unit/m10a)
- [x] Variant b: the lineup slot as the row number, with the climb, the ladder and the venue as the evidence line; rows in the lineup's order (tests/unit/m10a); both behind the chart's numbers setting, today's place still the default, and shot from dev-only /lab/numbers-a and -b on the saved build
- [x] Three fresh AI lay readers per variant, shown only the shots at 390 and 1440: (b) 3 of 3; (a) 2 of 3 (evidence section 27; answers in .design/m10a)
- [x] A one-line key per section only if a variant fails without it: added to (a) after its first round ("places it climbed with its venue's fans added"); three new readers, 3 of 3
- [x] Ship the variant that passes (a if both pass): both passed, (a) shipped with its key (4b8827c); (b) and the lab pages removed; the synthetic baseline now gives real places
- [x] Gate, design scan, e2e; deployed; the live e2e passes: gate 475 tests and the scan, local e2e 63 passed, 5 skipped; pushed at 65fc0cc, live within a minute; live e2e 61 passed, 7 skipped

3. M10b How it works
- [x] The bar in docs/evidence.md section 28 before building (33fad96)
- [x] One picture: the headliners' fans and a venue's fans, the acts that climb, your undercard, as four small cards
- [x] One act through the real Boise build, step by step, with the first screen's rows and badges; the agent's choices (the venues it read, the one that moved nothing): the first mid-size act on the saved lineup, read when the page is served (src/lib/method-story.ts); its row climbs a rung chart, then the rule's checks, then the lineup
- [x] Try it: one venue switch (the saved build's own venue results, no Qloo call)
- [x] Who does what: three cards, one line each
- [x] Shown, partly shown, not shown stays; the evidence tables and the five objections move to /method/evidence, linked, with no result or wording changed (moved word for word, with the limits the last objection points to)
- [x] A slot at the top for the demo video
- [x] Gate: a fresh AI lay reader at 390 and 1440 explains how one act ends up on the lineup and names the AI agent, Qloo and the rule correctly: reader 1 left out the genres, the page changed, reader 2 passed (evidence section 28)
- [x] Gate, design scan, e2e; deployed; the live e2e passes: gate 489 tests and the scan, local e2e 66 passed, 5 skipped; pushed at f87d49f, live within two minutes; live e2e 64 passed, 7 skipped, then the live-Qloo steps 9 passed

4. Artist images, built but off (only if items 1-3 are done by Friday 23 October)
- [x] The cheapest way to show Qloo's image URL on each act's row and card at runtime, behind one setting that is off, falling back to the drawn covers; no image and no Qloo response data in the repo: ARTIST_IMAGES in src/lib/artist-images.ts (false); while on, one Qloo GET /entities call per saved build, cached server-side, https images on images.qloo.com only; rows and the card fall back to the drawn sleeve with no image or when one fails to load (tests/unit/artist-images). One live call (2026-10-21) confirmed the hackathon key answers /entities with an image URL for all 10 Boise acts; not seen in a browser with the setting on (the switch stays off)
- [x] Deployed with the setting off (406261f, 2026-10-21 14:22 Bucharest): gate 497 tests and the scan, local e2e 66 passed, 5 skipped; live e2e 64 passed, 7 skipped; the live-Qloo steps 9 passed
- [ ] Turn it on only when Daniel says Qloo agreed (then SPEC.md section 7's text-only line changes too)

# TASKS: Daniel's brief of 2026-10-21 (second): small fixes before the outside review, then evidence

Done means items 1-3 are deployed with `pnpm gate`, the design scan and the e2e passing, and items 4-5 are reported, by Friday 23 October 22:00 Bucharest.

1. Old commits in pull requests
- [x] Reported, nothing changed: the repository has never had a pull request (gh pr list --state all: none), GitHub links none to 4988e25 or a450aff, origin/final-chart is gone (404) and no remote branch holds either commit; GitHub still serves both by their full hashes until it collects them

2. What the readers tripped on (questions and keys in docs/evidence.md section 29, before the readers)
- [x] On a phone, the fee range in plain words under each band's name ("fee range: 80th-92nd percentile of Qloo popularity"); the first act's row on the saved Boise build still ends at 659 px at 390x844 (the stamp beside the festival's name, smaller headliner cards, tighter gaps; no words change)
- [x] Why no act is at the top, one line under the key; the first wording failed its reader, the second passed
- [x] The climb is Qloo's ranking wherever it's described: the key, the rule key, the mark a screen reader hears, the card, Watch's banner, How it works' card and check; a test keeps "the agent's ranking" out of src
- [x] Watch's editions mark an act new to the top 50 NEW, not a climb from 51st
- [x] A fresh lay reader per change, on the screen it touches: all four pass (evidence section 29)

3. The walkthrough's steps, linkable
- [x] /method?step=N opens on that step, in view; each step tab is its link and the address follows the reader
- [x] Stills of all four steps at 1440 and 390 in .design/stills/method/ (git-ignored)
- [x] Gate, design scan, e2e; deployed; the live e2e passes: gate 507 tests and the scan, local e2e 68 passed, 5 skipped; pushed at 873e487, live at 15:13 Bucharest; live e2e 66 passed, 7 skipped (the phone row checked on the deployment), the live-Qloo steps 9 passed

4. With and Without Qloo as a number
- [x] Stopped before spending, as the brief says: the saved builds hold only the Qloo lineup. The model's picks are cached separately for 2 of the 29 festivals (20 picks), each a name and a note with no Qloo data. The comparison would cost 27 model calls (one per festival without a cached answer) and up to 290 Qloo searches (one per pick, none cached), then no more calls for the climb (read from the builds' cached venue lists). Waiting on Daniel

5. M8f, the second premise test
- [x] In SPEC.md since 2026-10-18, with its bar (at least 20 of 30) in docs/evidence.md section 26, written before any run
- [x] 30 festivals in the 29 towns, none of M8d's ten, each with its own site's complete lineup, listed in .design/m8f/ before any Qloo call (2026-10-21: 30 in 27 towns, found by five research subagents, seven re-read against their pages; three left out before the call; the list's SHA-256 and the order of each page in evidence section 26)
- [x] The run, one call at a time; the result either way in evidence section 26: supported at the bar with no margin, 20 of 30 (20 of the 22 that could be scored); 1,164 calls, none retried
- [x] On the evidence page next to the 7 of 10, which stays

A. Artist images on (Daniel's message of 2026-10-21: Qloo's hackathon manager agreed), deployed with the others by Friday 23 October 22:00
- [x] ARTIST_IMAGES on and SPEC.md section 7's text-only line replaced (Daniel approved both); Watch's editions show the lineup acts' pictures too, the drawn cover for the rest (tests/unit/artist-images)
- [x] On screen at 1440 and 390, Watch included, on a local production build reading the saved builds: at 1440 all 10 lineup rows show their photo from images.qloo.com, as does the act card; Watch's editions show the lineup acts' photos and the drawn cover for the rest; at 390 the act card shows the photo, and the rows show no cover, drawn or photo, as before (hidden below 560 px). Nothing stored: the URLs are read at runtime and cached server-side; no image or image URL in the repository. Found and fixed: a photo that failed before the page came alive stayed broken (its error came before React's handler); now the drawn cover replaces it (tests/unit/artist-images/cover-hydration.test.tsx), checked with images.qloo.com blocked: 10 of 10 rows drawn
- [x] Load time, images on against off, local production builds on real data: the largest paint is the lead line in every run either way; 7 cold runs each, median LCP 392 / 428 ms at 1280x800, 480 / 532 at 1440x810, 496 / 368 at 390x844; the LCP e2e 288-360 ms off, 384-540 on, all under its 2.5 s bar; an interleaved A/B on one build, images allowed against blocked, 15 runs each: 424 / 408 ms at 1280, 500 / 456 at 1440. The photos cost 16-44 ms of LCP at desktop sizes, inside the runs' own spread (288-704 ms); none on a phone, whose rows don't fetch them
- [x] The first act's row at 390x844 still ends above 664 px with the images on: 659 px, as before (a phone's rows carry no cover)
- [x] A fresh lay reader on the first screen and one act card: does the picture help them say what the act is? (bar in evidence section 30 first). Fail by the bar: a music act, yes, and the picture read as her photo, but it helps "only a little" (recognising her, matching row to card) while the genre words say what she is; it also found that a phone's rows show no pictures and the photo has no caption. To Daniel with the shots (.design/images-on/); the images stay on
- [x] Section 29's four readers again, on the page with images (A before the final reader checks): all four pass again (evidence section 29; answers in .design/review-fixes/images-on-answers.md)
- [x] Found while re-checking the phone row live: the bill's rows, already painted by the server, rose in again from 28 px below when the page came alive (the chart's FLIP hook, since the weekly chart), so the 664 px check caught the row low in 4 of 6 live runs. The hook now leaves rows on screen at its first pass in place; later rows still rise in and moved rows glide (tests/unit/review-fixes/first-paint-motion.test.tsx); on a local production build the row holds at 659 px from load, and the phone check passed 10 of 10
- [x] Gate, design scan, e2e; deployed; the live e2e passes: gate 515 tests and the scan, local e2e 68 passed, 5 skipped; pushed at 39c6f0d, live at 18:00 Bucharest; live e2e 66 passed, 7 skipped (LCP 748 ms), the phone check 10 of 10 on production, the live-Qloo steps 9 passed

B. The manager's answers in RULES.md
- [x] Recorded with the date in RULES.md's Unclear section (Daniel approved the edit): 2, 3, 5 and 7 answered, and the question on buyers' drafts; 1, 4 and 6 not covered

# TASKS: Daniel's decisions of 2026-10-21 (third brief)

Done means items 1-4 are deployed with `pnpm gate`, the design scan and the e2e passing, and items 5-7 are reported, by Friday 23 October 22:00 Bucharest.

1. Images stay on
- [x] Section 30: its bar asked the wrong question (a photo says who the act is and catches the eye; the genre words say what it is); the miss stays on record, not re-scored
- [x] On a phone, a small photo on each chart row, if the first act's row still ends above 664 px at 390x844 (else card only, and say so): a 36 px cover on every row below 560 px (the lineup, Watch's editions, How it works), the drawn cover where there's no photo; the first act's row still ends at 658.6 px, its name on one line. A row with a long genre pair now wraps to a second genre line (the third on the Boise build)
- [x] Alt text on every photo: "Photo of <act name>" (rows keep it hidden from screen readers, since the row's own label names the act; the card's photo is read)
- [x] A small "Artist images via Qloo" credit where the photos appear, and on /method: under the lineup (and during Watch) when its acts have photos, none on Without Qloo; on How it works under Try it; 16 px at 1440, 13 px on a phone (tests/unit/artist-images/credit.test.tsx, tests/e2e/artist-images.spec.ts)

2. Starter kit
- [x] CLAUDE.md's two lines: already say there is no starter kit, matching the README, since 6fadeaf (2026-10-17); the first version (f13b911) said "built on my public starter kit". No edit needed
- [x] RULES.md's Unclear section: 1 moot (no starter kit), 4 not pursued, 6 answered by the site asking for a live web app (Daniel approved)

3. The flaky e2e
- [x] "on a phone, a town Qloo can't find offers the checked towns" passes 20 of 20 runs: the cause was a race on a busy phone. A run starts by gliding down to the chart; the notice in the lead mounted before the glide had moved, stayed put, and the glide carried it off the top. Reproduced at 4-6x CPU slowdown with the answer 0-150 ms into the run (4 of 6 failed at 6x). Now the notice brings itself into view at once on a phone, which stops the glide, and checks again once the page stops moving. The test passed 20 of 20; three new timed tests at 4x slowdown passed 12 of 12 (and 12 of 12 at 6x)

4. Main's old commits
- [x] 9c85f16 and 0c89c27 stay as they are (Daniel's decision, 2026-10-21): no rewrite of main, no force-push

5. With and Without Qloo as a number (approved: up to 27 model calls and 290 Qloo searches)
- [x] Bar and method in docs/evidence.md before any call (section 31, 32439d6)
- [x] The run, 18:40-18:46 Bucharest: 27 model calls and 110 Qloo searches (the rest were cached), no retry; all 29 builds' lists from the cache. 10 of the model's 290 picks pass all three tests (the bar was 145 or fewer); the Qloo lineup's 290 of 290 by its rule
- [x] The counts in plain words on the evidence page (a row beside the premise tests) and in the README (Sponsor technology)

6. M8f lineups checked
- [x] The 23 lineups not yet checked, against their source pages, with no Qloo calls; any wrong list re-scored by the bar written before, both counts reported: three research subagents re-read them; 21 match (only spellings the normalising treats as one, and a "W/" billing written "with"), 2 couldn't be read (popfest Wien down, HTTP 522; Soenda HTTP 403). With the 7 read before the run, 28 of 30 confirmed, none wrong, nothing re-scored: 20 of 30 stands (evidence section 26). Two fingerprints recomputed from the files matched the subagents'
- [x] The evidence page says "20 of 30, the bar set beforehand; 20 of the 22 that could be scored"; the "Partly shown" summary stays (the row keeps its bar mark through an explicit bar of 20, and its limit says 28 of 30 lineups re-checked)

7. The pull-request check from the first brief
- [x] Reported, checked again on 2026-10-21: the repository has never had a pull request (gh pr list --state all: none); GitHub lists no pull request for 4988e25 or a450aff; none of the 8 branches on GitHub contains either (compare: each is behind or diverged), and final-chart is gone (404); GitHub still serves both commits by their full hashes until it collects them

# TASKS: Daniel's message of 2026-10-21 (evening): the same photo wherever an act appears

- [x] /method: "Follow one act" (every step, the lineup included) and Try it show the act's Qloo photo, as the first screen does, from the same cached call (tests/unit/artist-images/method-covers.test.tsx)
- [x] Gate (519 tests) and design scan, build; checked on a local production build on the saved Boise build: Act 84's photo on every walkthrough step and Try it is the first screen's; committed, not pushed (a push to main deploys production): deploy waits on Daniel
- [ ] Your festival (checked-town replays and live runs) and Watch's non-lineup acts: Daniel's call, since photos there need Qloo calls the saved Boise lineup doesn't

# TASKS: the plan after the outside review (.design/review/plan.md, Daniel's decision, 2026-10-21)

UI items 1-8 live by Friday 23 October 22:00 Bucharest (else Saturday 24 October 22:00); items 9-11 by Saturday 22:00. Where plan.md and the review differ, plan.md wins. Before building anything the review recommends, check it isn't already there.

Corrections kept throughout: a private reply is kept out of the public record; the first tester's words go public only once Daniel confirms she agreed (until then: "The first person to see an early design couldn't tell what it was for."); no outreach after submission, no repo or site change after Thursday 29 October except fixes; "27 of 40" and a chance line only if sections 18 and 26 measured the same thing.

1. The location claim
- [x] Check docs/evidence.md section 6 is the location-signal test; replace every "Qloo takes no location for artists" (pages, README, docs, video notes) with the plan's sentence, shortened where tight, never back to the old claim. Section 6 isn't quite that test: it tried three routes, and its 7 of 10 came from Qloo's heatmap; the location signal on the artist ranking (signal.location.query) was usable for none of the 10. So the sentence is worded from section 6: "Artists have no location of their own in Qloo. Its location data for artists, tried three ways, gave a usable local reading for at most 7 of 10 acts, short of the bar of 8 (evidence 6), so Undercard reads a town's taste through the fans of its venues." Replaced in the README, the evidence page's "Why venues?", the Devpost story and a code comment; evidence section 21's key keeps its 18 October wording with a dated correction under it; SPEC.md section 7's line is accurate as written (it says the parameter guide lists no location parameters for artists) and stays; the video project has none
2. Judging-window resilience (prompt A)
- [x] Caps as environment variables with today's values as defaults, tested at the boundaries and with bad values: LIVE_BUILDS_PER_IP_PER_DAY (5) and LIVE_BUILDS_GLOBAL_PER_DAY (60), read where the limiter is built on each request (src/server/rate-limit.ts limitsFrom, src/server/deps.ts); replays are never counted (tests/unit/judging-window/caps.test.ts)
- [x] Busy and over-cap states land on the nearest checked town's replay, one Playwright test each: on Your festival, a run ended by a busy Qloo, the per-IP cap or the global cap says so in one sentence (the server's own) and offers the checked towns in the same country to replay; with none there, Sagebrush Sound's replay (tests/e2e/judging-window.spec.ts, red 4 of 6, then green). Already there before: both caps' sentences and the Boise link on a capped run
- [x] A daily smoke test (GitHub Actions cron) against production, no live Qloo build, failure alerts the owner: .github/workflows/smoke.yml runs tests/e2e/smoke.spec.ts daily at 06:17 UTC and on demand (Boise's ten acts, Watch's last call within 30 s, Your festival's 29 towns, Austin's replay, the evidence page's three lines); a failure emails whoever last changed the schedule (GitHub's default for scheduled runs) and opens an issue. The spec passed 5 of 5 against production
- [x] The production function timeout against the 45 s retry budget; recommended judging-window cap values with reasons (Daniel sets them in Vercel): the build route sets maxDuration 120 s (src/app/api/undercard/route.ts), which covers the 45 s budget; Vercel accepts 120 s on this plan (every deploy succeeds; a value over the plan's limit fails the deploy), read from the deploys, not the dashboard. Recommended for 2-16 November: LIVE_BUILDS_PER_IP_PER_DAY=10 (judges at one office may share an IP) and LIVE_BUILDS_GLOBAL_PER_DAY=100 (at most 1,200 Qloo calls a day against an unpublished quota)
3. The agent's reason in Watch (T4)
- [x] One line per venue choice from the saved trace; a fixed line on what the agent decides if the reasons aren't saved; never invented. Already there on a laptop: Watch's banner shows the agent's own latest line ("The AI agent: Venue 166 lifted nothing; try Venue 227 for both bands"), but a phone hid it, and 10 of the 29 saved builds hold no planner line at all (17 hold one, 2 hold two). Now a phone shows the line too, and a step with no saved line says "The AI agent chose which venues to read, and in what order; Qloo's numbers and the rule pick the acts." (tests/unit/review-plan/agent-line.test.tsx; tests/e2e/phone-first-screen.spec.ts on real builds)
4. Venue results server-rendered for saved builds (D2)
- [x] First paint and a plain fetch show the results, not a loading line: the home page and each town's page work the venue switch out on the server from the Qloo cache with the first bill (src/server/venue-switch.ts withVenueSwitch, the route's own code), and the browser no longer asks for it; a live run still does (tests/unit/review-plan/venue-switch-ssr.test.tsx; tests/e2e/first-paint-venues.spec.ts, red then green on / and /towns/austin). How it works' Try it still loads its own copy after first paint
5. One sentence of "why" per act when expanded (D3)
- [x] Prompt D's shape, from the saved build's numbers only: the card's Why line now reads "Fans of <venue> rank <act> <place now>; fans of the headliners alone rank them <place before>. That climb of <n> is why <act> is here.", a new entry "... don't rank them in their top 50. That climb into the top 50 ...", the card's own three numbers (src/components/chart/why.ts); a build without its places keeps its own line (tests/unit/review-plan/why-sentence.test.tsx). Before, the card had a shorter why ("Venue 227 fans move it up N places.")
6. A "Listen" link per act (D6)
- [x] Skipped: 0 of Boise's 10 acts. The app caches only each act's image URL from /entities (src/server/qloo.ts parses nothing else), so no Spotify id or other streaming page is in the cache; getting them would take a new /entities call per build, which the plan rules out. Qloo does return Spotify ids for many artists (the M6c spike's raw answers in .design/evidence carry them), but none of Boise's 10 acts is in those files
7. Positioning (I1, Q2)
- [x] "Undercard drafts a shortlist with its evidence attached; the buyer makes every call" and "Qloo decides, the model plans, the rule books" on the home page (replacing words, not adding), How it works and the README. Home: the lead now reads "Undercard is an AI agent: it drafts a shortlist with its evidence attached; the buyer makes every call." (it was "...it drafts the acts that play before the headliners from what fans of the town's own venues like.", 5 words fewer; the opening "Undercard is an AI agent" stays, from M6r's readers), and "How an act gets on" ends "Qloo decides, the model plans, the rule books." in place of "Qloo supplies the numbers; the AI agent picks which venues to read." How it works: the sentence in the lead, the principle under Who does what. README: both under the opening paragraph (tests/unit/review-plan/positioning.test.tsx)
8. The With and Without number, the review's measures (section 9b.1)
- [x] The bar in docs/evidence.md before counting (results already seen marked exploratory): section 31, the review's bar (Qloo changes at least 7 of 10 acts in at least 24 of 29 towns, and twice as many distinct acts with Qloo); measure (ii) marked partly exploratory, since the section 31 run's 110 distinct searches for 290 picks were already seen
- [x] The count; one line under the toggle and on How it works, saying only what the bar allows: the bar isn't met. Qloo changes all 10 acts in all 29 towns (no town's lineups share an act), but Qloo's lineups hold 85 distinct acts to the model's 110, not twice as many; 3 acts appear in half the model's lineups or more (scripts/with-without-measures.ts, no model or Qloo call). The line says only what the record does: "Across 29 towns, the model alone and Qloo share no act, and 10 of the model's 290 picks pass the tests every Qloo act passes." (src/components/chart/with-without-line.tsx, from src/data/with-without-qloo.json; tests/unit/with-without-qloo/toggle-line.test.tsx, tests/e2e/with-without.spec.ts)
9. Two cheap tests (prompt C, bars from section 9b.3 first)
- [x] Stability across days for evidence 5's four towns: bar met (evidence section 33): all four filled both groups; Boise, Austin and Nashville gave their saved ten acts, Denver 7 of 10; 47 Qloo calls, nothing written to Redis, the saved builds unchanged
- [x] Boise with a second pair of headliners of similar popularity, chosen and recorded before any run: Alvvays and Big Thief, by the rule written first; both groups filled and 6 of 10 acts differ from the Khruangbin and Japanese Breakfast draft, the bar exactly (evidence section 33); 12 + 4 Qloo calls
10. The evidence page copy (section 9c) with corrections 2, 3 and 6
- [x] Every number from docs/evidence.md; stop and ask on any conflict; visible placeholders where results are still coming: /method/evidence now reads in section 9c's order (In fifteen seconds and its terms, the two tables, what the no-gos taught, what real people said, the five objections, the limits, still to come), with corrections 2 and 3 (a private reply is kept out of the public record; no tester quote) and 6 (27 of 40 and the chance line, since sections 18 and 26 measured the same thing, worded as lift, their metric). Where the review's copy differed from the record, the record's words are used: lift, not climb, for the premise tests; the 8 unscored festivals as those with fewer than two acts in the fee ranges, not "the 8 smallest"; the first round's bar was written first too; 28 of 30 lineups checked, not 7; a second day and a second pair of headliners (section 33); the location sentence from section 6. The two finished placeholders (section 31's number, the lineup re-check) are filled; the testers' stays, visible (tests/e2e/evidence-copy.spec.ts)
11. Qloo calls in one named module (prompt E, first part only)
- [x] src/lib/qloo/, one file per endpoint, its own commit, tests unchanged and green: core.ts (the cached, retried GET, types, errors), search.ts, entities.ts, tags.ts, insights.ts (places, artists, audience), compare.ts, client.ts and index.ts; src/server/qloo.ts re-exports it, so no import or test changed; 545 unit tests green, typecheck and lint clean
Also
- [x] The bar for the test with real people (section 9b.2) in docs/evidence.md before Friday: section 32 (the review's 3 of 4 or 4 of 5, extended to all 3 of 3 at the same strictness; quotes only with each person's permission)

Deployed: 0b7ec59 at 22:07 Bucharest on 2026-10-21 (UI items 1-8 first live at 218e397, 21:36). Gate 545 tests and the design scan, local e2e 80 passed, 14 skipped; live e2e 87 passed, 7 skipped (LCP 368 ms), the live-Qloo steps 9 passed.

# TASKS: Daniel's brief of 2026-10-21 (night): live runs stop replacing the saved builds

Done means: tests (a) to (d) pass, `pnpm gate` and the e2e suite pass, the smoke workflow checks the saved line, no text promises the old behaviour, and production still serves the 17 October Boise build. One commit per numbered step; no Qloo response data in the repo; no change to the saved builds or the Qloo cache; no layout change; no new dependency. The production deploy waits on Daniel's yes. Before any change, production served Boise's build saved Oct 17, 12:13 UTC, 10 acts (names kept outside the repo for the check after the deploy).

- [x] 1. Failing tests first, in tests/unit/pin-builds/: (a) a complete live run for a festival with a saved build is saved under its own id and latest() still returns the old build; (b) a festival with no saved build still gets its first build as latest; (c) the live run's own id still serves its saved record and its venue switch; (d) a judge's own brief still saves nothing. Before the change 4 of 8 fail: (a)'s three (the run moves latest, the first screen and How it works follow it, and so on for all 29 festivals) and (c)'s last check (a visitor with no build id gets the run's venue switch); (b), (d) and (c)'s by-id checks pass, as guards
- [x] 2. The smallest change in src/server/build-store.ts: save() sets latest only when the festival has no saved build it can read; no environment variable. Tests (a) to (d) pass; all 553 unit tests pass
- [x] 3. The client: after a live run the screen shows that run's lineup, and a reload shows the saved build again; whatever assumed the run became latest fixed, with a test (b64216c). The venue switch hook and How it works needed nothing: the switch asks for the run by its own id, and How it works reads the festival's latest, the saved build. Watch did: after a live run it asked the server for the festival's latest build, which would now replay the saved build over the visitor's lineup. It now replays the run the screen holds, as a judge's own run already did, and the line under it counts the run's calls (tests/unit/pin-builds/live-run-screen.test.tsx: red, then green)
- [x] 4. The daily smoke workflow asserts that the first screen still shows "saved Oct 17, 12:13 UTC": a sixth test in tests/e2e/smoke.spec.ts, which .github/workflows/smoke.yml runs (skipped only against a local synthetic build, dated 15 October); it passed against production before the deploy. Step 3's tick rides in this commit: its edit failed a transient check when b64216c was made
- [x] 5. Every sentence that promises the old behaviour changed (README.md, UI and method-page text); where a live run finishes, it says it isn't saved for other visitors. README: Saved builds, the first screen, the cache paragraph ("so the next visitor opens on it"), Running locally, and a line in AI usage. UI: the line under a live run's lineup read "saved <time> UTC"; it now reads "run live <time> UTC, not saved for other visitors" (a judge's own run too, which was never saved), and an empty board's first build, which every later visitor does open on, still reads "saved" (tests/unit/pin-builds/live-run-screen.test.tsx: red, then green). How it works and Your festival had no such sentence. Left for Daniel, outside the folders this brief may change: src/app/page.tsx's comment "A fresh build shows up within that minute."
- [x] 6. docs/evidence.md section 13: a short dated paragraph. Read first from each town's replay on production (replay-only, free, nothing written): 28 of the 29 saved builds are of 17 October (Boise 12:13 UTC; Austin, Denver, Nashville 14:57-14:59; 24 checked towns 19:59-20:17); Cluj-Napoca's is a live run of 18 October, 09:52 UTC, which had already replaced its 17 October build. The paragraph says so; nothing was rebuilt or restored
- [x] `pnpm gate` (with the design scan) and the local e2e pass; then stop for Daniel's yes to deploy: gate 556 unit tests, typecheck, lint and the design scan; local e2e 80 passed, 15 skipped (the new smoke test runs only against a deployment); `pnpm build` passes. The new smoke check passed against production before the deploy
Daniel's answers (2026-10-21, night): yes to the deploy, after the items below, each its own commit, test-first where it's code; the comment in src/app/page.tsx changes in this deploy; Cluj-Napoca's build stays as it is.
- [x] a. save() fails closed: a read of the current latest build that throws or times out leaves latest alone; only a clean "there is none" may set it; with a test. Found first: production's Upstash cache reads a Redis error as a miss, so an outage looked exactly like "there is none". The store now reads its pointer through getOrThrow (Upstash only; memory caches never fail), within 2 seconds, and sets latest only when that read finds no pointer or one to a build no longer stored; a stored build that doesn't parse also leaves it alone. The run stays under its own id and the save doesn't fail (tests/unit/pin-builds/fail-closed.test.ts: 4 of 5 red, then green; 561 unit tests pass)
- [x] b. Evidence section 13's paragraph, and any README line on the 17 October builds: 28 of the 29 are; Cluj-Napoca's is a live run of 18 October, 09:52 UTC, which evidence 31 measured, kept as it is. The paragraph now says so and names 0654713; no README line dates the saved builds
- [x] c. The act list for the first-screen comparison outside git; each of the 29 festivals' current latest build id recorded in .design/, from replay-only requests, so a pointer can be put back if one slips. The act list lives in this session's scratchpad, outside the repository, and isn't tracked. The 29 ids are in .design/pinned-builds/latest-pointers-2026-10-21.json (git-ignored), read again just before the deploy: none had moved since the first read; 28 of 17 October and Cluj-Napoca's of 18 October. .design/pinned-builds/README.md says how to put a pointer back (not tried)
- [x] d. src/app/page.tsx's comment: "A festival's first saved build shows up within that minute; a later live run never replaces it."
- [x] Push main (production deploys); the first screen against the list, with no live build; `pnpm e2e --workers=1` against production, without E2E_LIVE_QLOO. Before the push, gate (561 unit tests and the design scan), build and local e2e (80 passed, 15 skipped) passed again. Pushed e098874 at 21:02 UTC on 2026-10-21; Vercel finished at 21:03:12 UTC, and production's scripts carry the new live-run line. First screen: 10 acts, the same in the same order, "saved Oct 17, 12:13 UTC", no live build run. Production e2e 88 passed, 7 skipped (the 3 live-Qloo steps and the 4 empty-server scenes), the new smoke check among the passes. CI gate run 39675508685 green. All 29 latest pointers unchanged against the record after the deploy and again after the e2e (21:07 UTC)

# TASKS: Daniel's brief of 2026-10-22: words that claim more than the evidence, before Thursday's test with real people

Done means: the seven items are committed and green; the rendered first screen, act card, Watch, Without Qloo view and evidence page, checked in Playwright (not by grepping source), no longer show "fans like it", "Why Boise", a venue's "crowd", "No Boise venue" or "too thin to build on"; production shows the new words. Copy and small UI only: the chart, the act row layout, the rule, the saved builds and the why sentence stay. One commit per item, test-first; no Qloo response data in the repo (tests use invented names); no layout change beyond item 5; no new dependency. The production deploy waits on Daniel's yes.

- [x] 1. Act card: the badge reads "Climbs with <venue>'s fans added" and the label "Why it's here:" (labels only; no data field or saved text changes). 60d5672; the card's town prop, used only by the old label, is gone. tests/e2e/old-claims.spec.ts reads the five screens' rendered text, screen-reader text included, for every retired string
- [x] 2. Each lineup row's accessible text: "With <venue>'s fans added: up N places in Qloo's ranking", and the same for new entries. 472cf19; a line whose lift can't be read says "With <venue>'s fans added"
- [x] 3. First screen: "Undercard drafted the rest of the lineup (the bill) from Qloo's numbers"; the footer "Drafted from 12 Qloo calls the AI agent planned", its saved date kept; How it works' Who does what still agrees. f7f743f; an empty board's "will draft" changed with it; Who does what needed nothing. be5c715 wraps the test lines items 1-3 lengthened
- [x] 4. Without Qloo cards: "Picked without Qloo: no venue data, no fee check". 58e98d6
- [x] 5. No empty grey boxes on Watch's ranking rows or the Without Qloo cards: the drawn cover or no box, whichever needs no layout change. 9227413: the drawn cover, since the model's cards' grid would shift with no box; 44x44 and the text at 68 px, as before. Before it, production's Watch showed 11 grey boxes
- [x] 6. Evidence page: the testers' placeholder kept once (the copy at the foot removed); no result repeats its go or no-go badge; the location bullet reworded; "too thin to build on" gone; the first line says only tests with a bar had it written first. 1826201: the Still to come panel removed whole (it held only the copy); the chip comes from the row and a screen reader hears its word once; "too thin to build on" also gone from a code comment; the first line as Daniel chose it then, replaced in the second batch (item 4)
- [x] 7. Scope: the fee range term ("the festival sets; in the demo, Sagebrush Sound's"); the local-acts limit. 351185f; "It stands in for a fee because no fee data exists." kept as its own sentence
- [x] `pnpm gate` and the synthetic e2e suite pass; then stop for Daniel's yes to deploy. On 351185f, with the other session's a27757f and e0f769d: gate (561 unit tests and the design scan), synthetic e2e 85 passed, 16 skipped, and the build; on a local build reading the saved builds, 7 of 7 (the retired words but Without Qloo, and the image specs, Watch's editions among them)
- [x] Deploy; `pnpm e2e --workers=1` against production. Pushed e098874..351185f at 08:16:31 UTC on 2026-10-22 (16 commits; the 7 not from this brief change no app code); production served the new first-screen line at 08:17:21 UTC. Production e2e, without E2E_LIVE_QLOO: 94 passed, 7 skipped (the 3 live-Qloo steps and the 4 empty-server scenes), the retired words absent on all five screens, Watch's real editions included; LCP 580 ms

# TASKS: Daniel's second batch of 2026-10-22, after the deploy (deployed with 4eea27c, see the last lines)

Test-first, one commit each. docs/design-brief.md stays as it is: design history, not shown in the app.

- [x] 1. Compare and How it works' Try it say Undercard drafted, to match item 3 of the first batch. c8de738
- [x] 2. The evidence page's first limit: "popularity ranges the festival sets". dfb920c
- [x] 3. The local-acts line in the record's words: "Treefort books many, and evidence 2 infers that most of its acts sit below the opening range's popularity floor, so Undercard drafts the touring slots and leaves local ones to the buyer". b10fd05
- [x] 4. The evidence page's first line names each cited section with no bar written before its run: "evidence 1, 5 and 8 have none, and evidence 22 describes the code", each linked (c9da04d, Daniel's choice). All 21 cited sections checked: 11-19, 26 and 31-33 say their bar was written first; 6, 7 and 10 had theirs in SPEC.md before their runs; evidence 2's script applied its rule as it ran (its git-ignored output holds the verdict), which corrects the first batch's "whose bar the record doesn't date"
- [x] 5. The card's badge on a 375 px phone uses the row tab's label ("Climbs with V418's fans added"), below 560 px; the full name stays at 560 px and up and in the climb and Why lines. e4d36aa. At 375 px on the saved Boise build, V418's 8 acts take two lines and Venue 227's 2 take three, since its tab label is its name; so do Venue 213 Austin, Venue 333, Venue 184, Venue 331 and Venue 106. Left to Daniel
- [x] 6. Once the other session was done: this file ticked, and SPEC.md section 3 step 3 says "Why it's here" (Daniel's OK for that one line)
- [x] Gate (562 unit tests and the design scan) and synthetic e2e (86 passed, 16 skipped) on e4d36aa, and the build; on a local build reading the saved builds, 12 of 12 (the phone checks, the evidence page, the retired words, demo steps 1-3)
- [x] Daniel's yes (Venue 227's badge stays as it is): pushed 351185f..4eea27c at 08:44:43 UTC; production served it at 08:45:24 UTC
- [x] The production e2e once with E2E_LIVE_QLOO=1 and --workers=1: 98 passed, 4 skipped (the 4 empty-server scenes), 08:46-08:51 UTC; refill, redraft and running order passed after the card changes. Qloo calls, read from the run's Playwright traces: 28 through the live routes (refill 1, redraft 3, running order 8 in its test and 8 in each of its two design shots), every one answered from the server's Qloo cache, so none went to Qloo, with no retry and no error. The redraft's response body wasn't kept in its trace, so its 3 calls were read from the page's own trace panel ("3 more calls", each marked cached). Pages and replays read the cache by design; a miss on the server wouldn't show in the browser, so that part isn't counted
- [x] The 29 latest pointers against .design/pinned-builds/latest-pointers-2026-10-21.json, replay-only: 29 of 29 before the push (08:44 UTC) and after the run (08:51 UTC)
- [x] No deploys from here until Daniel says his test with real people is over (recorded in Claude's project memory too); this tick is committed, not pushed

# TASKS: Daniel's brief of 2026-10-22 (prompt-4): the three checks on the Without Qloo cards

Done means: the pickTests change, the loader, the card line and the toggle line are committed and green; a cache-only run of scripts/with-without-qloo.ts still prints section 31's totals; `pnpm gate` and the e2e suite pass after merging main; after Daniel's yes, main is fast-forwarded and pushed, and production shows the checks with no Qloo call from this path. Test-first, one commit per numbered step; no new Qloo or model call on this path; no Qloo response data in the repo (invented names and numbers in tests); no layout change beyond one text line per card; the With Qloo view and the saved builds don't change; no new dependency. Built on branch prompt-4 in .claude/worktrees/prompt-4, made from main at 32dab6a; nothing merges into main or is pushed until Daniel says his test with real people is over.

- [x] Boise first: its saved answer's 10 picks all have their search in the production cache, and its saved build (17 October, 12:13 UTC) rebuilds its 5 venue lists from it, read through a cache-only client whose fetch throws: 0 fetches
- [x] 1. pickTests says whether a pick sits above or below the fee range; a pick's match on Qloo (search's top five, after section 18's normalising) moves from the script to src/lib/pick-tests.ts; the script's cache-only run (DRY=1) prints section 31's totals. pickTests gains `range` ("in", "above" or "below"), the rest unchanged; foundOnQloo is the script's old match (tests/unit/without-qloo-checks/pick-tests.test.ts: 4 red, then green; the two exact-match tests in tests/unit/with-without-qloo name the new field). DRY=1 on 2026-10-22: 29 of 29 builds rebuilt, 0 model calls, 0 Qloo fetches; 290 picks, 268 found, 59 in the fee range, 204 above, 5 below, 235 two genres, 11 climb, 10 all three, as in section 31. The 5 below are real popularities, none missing
- [x] 2. A server loader: each pick's checks for a saved model answer and its saved build, through a cache-only client whose fetch throws; "not checked" where a pick's search or the build's lists aren't cached. src/server/pick-checks.ts (pickChecks, and savedPickChecks against the festival's latest saved build); POST /api/llm-only adds `checks` to the answer and serves the answer without them if they fail; the shape is PickCheckSchema in src/lib/llm-only.ts (tests/unit/without-qloo-checks/loader.test.ts on the synthetic Qloo: red, then green; no fetch, no cache write, no model). Read-only over the production cache for all 29 towns: section 31's totals again (268 found, 22 not found, 0 not checked; 59 in, 204 above, 5 below; 235 two genres; 11 climb; 10 all three), 0 cache writes
- [x] 3. Each Without Qloo card's line, size first, in place of "Picked without Qloo: no venue data, no fee check"; the line under the toggle. pickCheckLine in src/components/chart/words.ts writes "Picked without Qloo; on Qloo: popularity 96th, above the mid-size range · 2 genres shared · no climb with Boise's venues" (a climb reads "a climb with one of Boise's venues"), "...; not found on Qloo" or "...; not checked on Qloo", in the card's own small line (p.pick-none), so each card keeps a name, the model's note and one small line. The percentile rounds down, as an act card's does; one just over the top edge reads one past it (0.9201 is 93rd), never the edge itself. The queued per-check line wasn't on main (checked at 32dab6a), so the toggle's line is the brief's, from src/data/without-qloo-checks.json (section 31's counts as the DRY run printed them); it shows on both sides of the toggle, since the line sits under it, and How it works keeps its own. tests/unit/without-qloo-checks/card-line.test.tsx red, then green; the old card text's tests and the two e2e specs updated
- [x] 4. Playwright on the synthetic build: every Without Qloo card shows its line, the toggle line renders, a pick missing from the cache reads "not checked". tests/e2e/without-qloo-checks.spec.ts; the synthetic server now seeds the Qloo answers its checks read (invented, in tests/e2e/synthetic-build.ts: the build's venue lists and every pick's search but Night Orchard's), cached by a client whose fetch answers from that data, never the network (src/server/synthetic-seed.ts; tests/unit/without-qloo-checks/synthetic-seed.test.ts red, then green). The spec's first run couldn't start its server (an undercard-dev preview I hadn't started held the folder's one `next dev`; stopped with Daniel's OK), so its red is the unit test's: before the seed, all 10 picks read "not checked". Then 3 passed, with tests/e2e/with-without.spec.ts. Fit, on the synthetic build, nothing in the CSS changed: at 1440x810 a found pick's line wraps to 3 lines in its 386 px column (card 167 px; "not found" and "not checked" 1 line, 121 px); at 390x844, 4 lines (cards 190-214 px; the short ones 2 lines, 144 px); no card or element overflows
- [x] Merge main; `pnpm gate` and the e2e suite; stop for Daniel's yes. Main was still at 32dab6a, so the merge was already up to date. On 4afe47b: gate (582 unit tests in 125 files, typecheck, lint, the design scan), synthetic e2e 88 passed and 16 skipped, and `pnpm build`. The build needed this worktree's .next/cache/turbopack seeded from the main folder's: from an empty cache, Turbopack fails on the lab page's Work Sans font ("next/font/google queries have exactly one entry"), so a build without its cache fails as things stand. Waiting on Daniel's yes
- [x] After Daniel's yes (his test with real people over, the main folder idle): main fast-forwarded to prompt-4 (7ecdaae) from the main folder and pushed 4eea27c..7ecdaae at 14:04:17 UTC; production served the new toggle line at 14:05:12 UTC. Without Qloo on production, ten check lines each, none "not checked": Boise 9 found and 1 not found (7 above the fee range, 2 in it, 0 below; 8 two genres; 1 climb); Austin 9 and 1 (7, 2, 0; 7; 0); Hamburg, through Your festival's checked-town replay since only Boise, Austin, Denver and Nashville have town pages, 8 and 2 (4, 3, 1; 7; 0); each as the cache-only run had it before the push. The 29 latest pointers matched the 2026-10-21 record before the push (14:03 UTC) and after the checks (14:08 UTC). Production e2e (--workers=1, no live Qloo): 96 passed, 8 skipped
- [ ] No Qloo call in the logs: not read yet. The Vercel CLI isn't installed, the built-in browser isn't signed in to Vercel, and the app logs nothing on this path; waiting on Daniel
