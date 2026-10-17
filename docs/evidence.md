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

## What these numbers don't establish

- That the acts would sell tickets, take the slot or fit the buyer's budget. The fee bands are popularity ranges the buyer sets, not fees.
- That a room's crowd predicts a festival's bookings. Section 2's check against Treefort was a no-go; its counts (0 to 2 of 50) are too small to show the signal either way.
- That the towns' results are stable. Each is one run, and the planner may pick other rooms on another run.

## Sources

- "Treefort 2026 guide: Hundreds of artists and events taking over downtown Boise", KIVI (Idaho News 6), 23 March 2026. https://www.kivitv.com/downtown-boise/your-guide-to-treefort-2026-music-comedy-art-and-more (read 2026-10-17)
- Treefort Music Fest 2026 lineup, Wayback Machine capture of 17 April 2026. https://web.archive.org/web/20260417060044/https://treefortmusicfest.com/lineup/ (read 2026-10-17)
- Qloo's Parameter Reference, `signal.demographics.age`. https://docs.qloo.com/reference/parameters (read 2026-10-17)
- The runs: `scripts/agent-offline.ts` and `scripts/treefort-check.ts`, 2026-10-17; their full outputs stay in `.design/evidence/`, which is gitignored.
