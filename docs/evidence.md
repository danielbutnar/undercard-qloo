# Evidence (M4e, 2026-10-17)

Counts and venue names only, like docs/qloo-spike.md: no Qloo response bodies, entity IDs, scores or act names. Every outside fact carries a source. The runs below used the scripts in `scripts/`. They call Qloo (and, for the agent, Claude) from a local machine and keep Qloo's responses in memory. The Treefort check also writes the names it matched to `.design/evidence/`, which is gitignored. Neither script saves a build or touches the production store.

## 1. Why a club's crowd: Boise's own festival books Boise's rooms

The objection: why should a small club's crowd pick acts for a 3,000-capacity festival?

**What the source says.** Treefort Music Fest, Boise's own festival, was scheduled to run downtown from 25 to 29 March 2026, with over 500 artists across dozens of venues (KIVI's pre-festival guide, 23 March 2026). Venue 227 is among the music venues the article names, and Treefort sold a venue-specific pass for the Venue 166. Treefort's lineup page lists 562 performers for 2026 (Wayback Machine capture, 17 April 2026).

Two of the three rooms the agent tested in Boise were Treefort 2026 venues: KIVI names Venue 227 among its venues, and Treefort sold a pass for the Venue 166 (Qloo's Venue 166 Boise). The third, the Venue 418, isn't named in the source, so it isn't claimed.

**Inference, not in the source:** in Boise a room's regulars are part of the audience a festival books for, not a stand-in from outside it. The source shows that Treefort 2026 used these rooms. It doesn't show that a room's crowd predicts what Treefort books. Section 2 tested that, and the check was a no-go, so nothing is claimed either way.

## 2. Check against a real Boise bill: no-go

**The question.** Does adding a Boise room's crowd to the headliners' signal pull Qloo's ranking toward acts Treefort 2026 booked?

**The method.**
- Treefort 2026's bill: 562 performer names from the festival's lineup page (Wayback Machine capture, 17 April 2026).
- For each fee band, `scripts/treefort-check.ts` asked Qloo for the top 50 artists in four lists: for the headliners alone, and for the headliners plus each room the production build tested. The calls used the same parameters a build sends: the band's popularity range and the crowd's age.
- It counted the names on Treefort's bill, matching exact names after normalising: accents and case dropped, a note in parentheses dropped, a leading "the" dropped, and everything but letters and digits removed, spaces included.
- Run 2026-10-17 12:18 UTC.

**The rule.** It's a go if, in each band, at least one room's list holds more Treefort acts than the headliners alone. Otherwise it's a no-go and nothing is claimed.

| Band | Headliners alone | + Venue 418 | + Venue 227 | + Venue 166 Boise |
|---|---|---|---|---|
| Mid (popularity 80th–92nd) | 1 of 50 | 2 of 50 | 1 of 50 | 1 of 50 |
| Opener (55th–80th) | 0 of 50 | 0 of 50 | 0 of 50 | 0 of 50 |

**Verdict: no-go.** In Mid, one room's list held one more Treefort act than the baseline; in Opener, no list held any. Nothing is claimed from this check.

**Why the counts are this small:** Treefort books many local acts ("a ton of artists from right here in the Treasure Valley", KIVI). Inference, not measured: most of its 562 names likely sit below the Opener band's popularity floor (55th percentile), and its best-known names may sit above Mid's ceiling (92nd), so few can appear in either band's top 50. Qloo's popularity for Treefort's acts wasn't measured.

## 3. Three more towns

**The method.** `scripts/agent-offline.ts` ran the agent itself, as a live build would, with only the town changed. Each run kept the same festival, headliners, crowd (25–34, sent as Qloo's 25_to_29 and 30_to_34 buckets) and fee bands. Run 2026-10-17 between 12:06 and 12:19 UTC. Boise is the same script's run, for comparison.

| Town | Tagged live-music places | Rooms tested (Mid; Opener) | Acts each room lifted | Both bands filled | Qloo calls |
|---|---|---|---|---|---|
| Boise, Idaho | 8 | Venue 418, Venue 166 Boise, Venue 227; Venue 166 Boise, Venue 418 | Venue 418 8, Venue 227 2, Venue 166 Boise 0 | yes, 4 + 6 | 12 |
| Austin, Texas | 20 (the call's cap) | Venue 420, Venue 213 Austin, Venue 62; Venue 213 Austin, Venue 420 | Venue 213 Austin 8, Venue 62 2, Venue 420 0 | yes, 4 + 6 | 12 |
| Denver, Colorado | 20 (the call's cap) | Venue 333, Venue 184; Venue 184, Venue 333 | Venue 333 5, Venue 184 5 | yes, 4 + 6 | 11 |
| Nashville, Tennessee | 20 (the call's cap) | Venue 106, Venue 331, Venue 330; Venue 106, Venue 331 | Venue 331 10, Venue 106 0, Venue 330 0 | yes, 4 + 6 | 12 |

**What it shows.** The method travels: in all three towns the agent found rooms, measured each one's lift, and filled both bands within 12 Qloo calls. In Austin and Nashville, as in Boise, most acts came from one room; in Denver the two rooms split them 5 and 5. In each town the agent also tested at least one room that lifted nothing, except in Denver.

The production build of 17 October 2026 matched Boise's row above: Venue 418 8, Venue 227 2, Venue 166 Boise 0, both bands full in 12 calls.

**On production (M6d).** The same brief ran fresh once on production for each of the three towns, under its own festival id, between 14:57 and 14:59 UTC on 17 October 2026, and each build was saved so it replays like Boise's. Austin: 12 calls, Venue 213 Austin lifted all 10 acts. Denver: 11 calls, Venue 333 5 and Venue 184 5. Nashville: 12 calls, Venue 331 lifted all 10. No call was refused, and both bands filled in each. Boise's saved build did not change.

## 4. Pilot towns (M6a)

**The question.** Before any festival replies to an offer of a free draft: can Undercard read the rooms in Calgary, Raleigh and Reykjavík?

**The method.** `scripts/pilot.ts` ran the agent offline with the demo's brief (the same two headliners, the Mid and Opener fee bands with 4 and 6 slots, a crowd aged 25–34), the plain city name as Qloo's place query, and no saved build. One run per town on 2026-10-17. A run in which Qloo refused a call with HTTP 429 was redone; the counts below are from runs with no refused calls. A town where a band doesn't fill is a no-go for pilots, and the engine isn't tuned to rescue it.

| Town | Live-music places Qloo returned | Rooms tested (Mid; Opener) | Acts each room lifted | Both bands filled | Qloo calls | Pilots |
|---|---|---|---|---|---|---|
| Boise, Idaho | 8 | Venue 418, Venue 166 Boise, Venue 227; Venue 166 Boise, Venue 418 | Venue 418 8, Venue 227 2, Venue 166 Boise 0 | yes, 4 + 6 | 12 | go |
| Calgary, Alberta | 20 (the call's cap) | Venue 312, Venue 163; both again | Studio Bell 6, Venue 163 4 | yes, 4 + 6 | 11 | go |
| Raleigh, North Carolina | 18 | Venue 369, Venue 194; both again | Venue 194 6, The Pour House 4 | yes, 4 + 6 | 11 | go |
| Reykjavík, Iceland | 5 | Venue 2, Venue 94; both again | Venue 94 6, Venue 2 4 | yes, 4 + 6 | 11 | go |

**What it shows.** All three towns are a go for pilots: the agent found rooms, measured them and filled both bands. Reykjavík has the fewest tagged places of any town tried (5). Inference, not checked: Calgary's Studio Bell is the National Music Centre's building, a museum with a stage rather than a club, and Qloo tags it as a live music venue; a buyer there should know which room drafted their bill. Runs that met Qloo's rate limit tested fewer rooms (Raleigh's first run tested one room for Mid); see section 5.

## 5. The same brief, run again (M6b)

**The method.** `scripts/robustness.ts` ran the agent offline five times for Boise and three times each for Austin, Denver and Nashville, with section 3's brief and a fresh, empty Qloo cache for every run, so no run reused another's answers. Nothing was saved. Runs finished between 14:10 and 14:35 UTC on 2026-10-17. A run in which Qloo refused a call with HTTP 429, its rate limit, was redone after a 30-second pause (see below); one Boise run was redone once.

| Town | Runs | Both bands filled | Rooms tested, and acts each lifted | Acts on every run's bill | Different acts across runs | Acts any two runs share |
|---|---|---|---|---|---|---|
| Boise, Idaho | 5 | 5 of 5 | every run: Venue 418 8, Venue 227 2, Venue 166 Boise 0 | 10 | 10 | 10 |
| Austin, Texas | 3 | 3 of 3 | runs 1 and 3: Venue 213 Austin 8, Venue 62 2, Venue 420 0; run 2: Venue 213 Austin 10, Venue 316 0, Venue 420 0 | 8 | 12 | 8 to 10 |
| Denver, Colorado | 3 | 3 of 3 | every run: Venue 141 6, Venue 184 4 | 10 | 10 | 10 |
| Nashville, Tennessee | 3 | 3 of 3 | every run: Venue 331 10, Venue 106 0, Venue 330 0 | 10 | 10 | 10 |

**What it shows.** Without refused calls, the bill barely moves between runs. Boise, Denver and Nashville gave the same ten acts every time. In Austin the planner tried Venue 316 instead of Venue 62 once, and that run shared 8 of its 10 acts with the others. Denver's single run in section 3 tested Venue 333 instead of Venue 141; the planner's choice of rooms is where a bill can change.

**Qloo's rate limit changes the bill.** In a first pass, four towns ran at the same time and Qloo refused many calls with HTTP 429. Even one town at a time, a few runs met a refused call, because the agent sends up to four calls at once. The agent then spends its 12 calls re-asking and tests fewer rooms: Boise runs with refused calls tested only the Venue 418 and Venue 166 Boise, and the Venue 418 lifted all ten acts. Those runs were redone and aren't in the table. Inference, not measured: a live build on production could meet the same limit.

## 6. Local strength from Qloo's location data: no-go (M6c)

**The question.** The open objection is whether a town's crowd knows the undercard acts. Can the hackathon API say how strongly an act's fans concentrate in Boise compared with elsewhere?

**The rule.** Go if a route gives a usable local signal for at least 8 of the 10 acts on the current Boise bill, at no more than one extra Qloo call per act.

**What was tried** (28 calls on 2026-10-17, after reading Qloo's parameter reference and heatmap guide):
- **Heatmap by map cell** (`filter.type=urn:heatmap`, seeded by one act, `filter.location.query=Boise`). Each cell carries an `affinity_rank`, which Qloo's heatmap guide describes as how well an entity "performs relative to itself across locations". That is the right question, at one call per act. Usable for 7 of the 10 acts; for 3, Qloo returned no Boise cells at all.
- **Heatmap by locality** (`output.heatmap.boundary=urn:entity:locality`). It returned the 8 places that contain or neighbour Boise, from the contiguous United States down to Meridian, with affinities spaced evenly from 1 to 0: an order within that set, not a comparison with elsewhere. Usable for none.
- **Popularity filtered by location** (`signal.location.query=Boise` on each band's artist ranking, 2 calls per band). It changes the ranking completely (none of the 50 artists in common with the list without it), but none of the 10 acts on the bill appears in either band's Boise list. Usable for none.

**Verdict: no-go.** The best route gives a Boise signal for 7 of 10 acts, under the bar of 8, so nothing is added to the card and nothing is claimed. Whether a town's crowd knows the undercard acts stays open. Counts only: the ranks themselves are Qloo data and stay in `.design/evidence/`.

## 7. Ten US towns, for "Your festival": go (M6f)

**The question.** Would a form that lets a judge pick any town work often enough to show? The rule: go only if at least 8 of 10 US towns of different sizes fill both bands within 12 Qloo calls, offline, with the same headliners.

**The method.** `scripts/robustness.ts`, one run per town, section 3's brief with only the town changed, the plain city name as Qloo's place query, no saved build. A run that met Qloo's rate limit was redone, up to three attempts. Runs finished between 15:56 and 16:09 UTC on 2026-10-17.

| Town | Both bands filled | Qloo calls | Rooms tested, and acts each lifted |
|---|---|---|---|
| Chicago, Illinois | yes | 11 | Venue 193 9, Venue 211 1 |
| Seattle, Washington | yes | 12 | Venue 226 6, Venue 30 4, Venue 385 0 |
| Minneapolis, Minnesota | yes | 12 | Venue 112 6, Venue 110 4 |
| Kansas City, Missouri | yes | 12 | Venue 384 9, Venue 167 1 |
| Richmond, Virginia | no | 7 | none tested |
| Asheville, North Carolina | yes | 12 | Venue 21 9, Venue 352 1, Venue 366 0 |
| Missoula, Montana | no | 11 | Zootown Arts Community Center 0, The Wilma 0 |
| Burlington, Vermont | yes | 10 | Venue 432 10 |
| Bozeman, Montana | yes | 10 | Venue 272 10 (the only tagged place) |
| Duluth, Minnesota | yes | 12 | Venue 34 10, Venue 280 0, Venue 113 0 |

**Verdict: go, exactly at the bar.** 8 of 10 towns filled both bands within 12 calls. In Richmond the agent stopped after 7 calls without testing a room; in Missoula both rooms it tested lifted nothing. In Minneapolis and Kansas City, even the third attempt met two refused calls, and both bands still filled.

**What it doesn't show.** Whether a "room" is a club: Duluth's bill came from Venue 34, an outdoor site, and Bozeman's from its only tagged place. One run per town; section 5 shows a bill can change when the planner picks other rooms. A live form will meet towns that fail like Richmond and Missoula, so it needs designed states for them.

## 8. Riding out Qloo's rate limit (M6g)

**Why.** Section 5 found that when Qloo answers HTTP 429, the agent spends its 12 calls re-asking and tests fewer rooms. The demo's link goes to 20 organisations on 19 October, judges may run Your festival at the same time, and every build and refill shares one Qloo key. Qloo doesn't publish the limit; its hackathon guide says only that keys have "rate and monthly quota limits".

**The settings** (`QLOO_RETRY` in src/server/qloo.ts; one client per build or refill):
- **At most 2 calls in flight.** The agent asks for up to 4 at once, and parallel bursts drew the 429s in section 5. A real offline Boise build with the cap, on 2026-10-17, took 20 seconds for its 12 calls and tested the same rooms with the same lifts as section 5's runs.
- **Retried:** 429, 500, 502, 503 and 504, up to 5 times per call. Other answers, such as 400 or 404, won't change on a retry and fail at once.
- **Backoff:** a random wait up to a ceiling that starts at 0.5 s and doubles to at most 8 s ("full jitter", so many clients don't retry in step), and never sooner than Qloo's Retry-After asks.
- **Budget:** 45 seconds from the build's start. The build's function may run 120 seconds, and a clean build's planner turns and Qloo answers take about 15 to 20 seconds (sections 3 and 5). A refill's function may run 60 seconds.
- **A retry isn't a new call.** It doesn't count against the 12; the call's own line in the trace says "retried after 429".
- **When the budget would run out,** the build ends with "Qloo is busy right now. Try again in a minute." The trace offers the saved build's replay where one exists; Your festival has its own state for it.

**Tested** (tests/unit/m6g, a synthetic Qloo): when every request fails once, alternating 429 and 503, a build tests the same rooms, books the same bill and makes the same number of calls as without the failures. When every artist call answers 429, the build ends in the busy state within the 45-second budget and the 12 calls. Retry-After, the backoff ceiling, the 2-call cap and a 400 that isn't retried each have a test.

**Not tested:** real concurrent load. No load test was run against the real key.

## What these numbers don't establish

- That the acts would sell tickets, take the slot or fit the buyer's budget. The fee bands are popularity ranges the buyer sets, not fees.
- That a town's crowd knows the undercard acts: section 6 found no usable measure of it.
- That a room's crowd predicts a festival's bookings. Section 2's check against Treefort was a no-go; its counts (0 to 2 of 50) are too small to show the signal either way.
- Stability beyond the runs in section 5: five in Boise and three in each other town, all on one day, with one pair of headliners.

## Sources

- "Treefort 2026 guide: Hundreds of artists and events taking over downtown Boise", KIVI (Idaho News 6), 23 March 2026. https://www.kivitv.com/downtown-boise/your-guide-to-treefort-2026-music-comedy-art-and-more (read 2026-10-17)
- Treefort Music Fest 2026 lineup, Wayback Machine capture of 17 April 2026. https://web.archive.org/web/20260417060044/https://treefortmusicfest.com/lineup/ (read 2026-10-17)
- Qloo's Parameter Reference: `signal.demographics.age`, `signal.location.query`, `output.heatmap.boundary`. https://docs.qloo.com/reference/parameters (read 2026-10-17)
- Qloo's hackathon developer guide, on rate and quota limits. https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide (read 2026-10-17)
- Qloo's heatmap guide, on affinity rank. https://docs.qloo.com/reference/heatmaps (read 2026-10-17)
- The runs: `scripts/agent-offline.ts`, `scripts/treefort-check.ts`, `scripts/pilot.ts`, `scripts/robustness.ts` and `scripts/local-strength-spike.ts`, 2026-10-17; their full outputs stay in `.design/evidence/`, which is gitignored.
