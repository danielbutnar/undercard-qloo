# Undercard

Undercard is a booking desk for festival talent buyers. With the headliners booked, it drafts the undercard, the acts in the slots below them, inside the fee bands the buyer sets. It books an act because a music venue in the festival's own town lifts it: adding that room's crowd to the headliners' fans moves the act up Qloo's ranking, and the bill names the room and by how many places. When an act drops out, Undercard refills the slot from the same band. It needs Qloo because Qloo is where a room's crowd can be read: Qloo ranks artists by taste but takes no location for them, so the agent adds local venues to the headliners as signals, one at a time, and keeps the acts each one lifts.

The stakes sit in those slots. Early slots play to thin crowds: emerging bands go on "before the audience really shows up" (Billboard), and BottleRock's talent buyer says every band wants to play late "because that's when there are more people there" (Napa Valley Focus). When an act drops out, a radius clause can keep the obvious replacement off the bill (Coachella's terms as filed in 2018, via Stereogum). And mid-tier festivals "rely on standard general admission for most of their revenue" (Axios Boston, 14 October 2026).

## The problem

Buyers get market-level data, often from the act's own agent, to argue fees and billing (The Ringer, 15 April 2022). One promoter's data team says "an artist's guarantee does not always align with who the fans want" (Danny Wimmer Presents, FestForums, 7 October 2024). No source I found shows a buyer's toolkit saying which acts the crowds at the town's own music venues already favour.

## What makes it Qloo-powered

Qloo is the only source of the lift. An act is booked only when a room lifts it at least five places in Qloo's ranking, its Qloo popularity sits in the band, and it shares two genre tags with the headliners. Without Qloo there is no room, no lift and no band check, so there is no bill.

The demo festival, Sagebrush Sound, is fictional: Boise, Idaho; 3,000 capacity; a crowd aged 25–34; two headliners booked.

- The page opens on the draft bill: the headliners over 4 Mid and 6 Opener acts, each with its room's mark.
- **Watch the agent build it** replays every Qloo call, with its parameters and result count, and the planner's own lines between them.
- An act's card shows Qloo's affinity, its popularity percentile in the band, a "Why Boise" line and two tags shared with the headliners.
- **Unavailable** refills the slot from the same band in at most three Qloo calls.
- **Without Qloo** reprints the bill with the model's own picks. The model alone runs at high effort, above the planner's medium, and still can't see Boise's rooms: each pick carries its reason, with no room and no fee-band check.

## Qloo calls used, and why

Claude Sonnet 5.5 plans the build. Every tool is one Qloo call, and a build stops at 12.

- `GET /search` resolves each booked headliner.
- `GET /v2/tags` finds Qloo's live-music-venue tag.
- `GET /v2/insights` for places lists the city's tagged places; the planner picks the music rooms as anchors.
- `GET /v2/analysis/compare` finds the taste tags the headliners share, which rank the tags a card shows.
- `GET /v2/insights` for artists ranks each fee band twice: for the headliners alone, then with each anchor room added, always with the crowd's age.

## One call, request to result

```
GET https://hackathon.api.qloo.com/v2/insights
  filter.type=urn:entity:artist
  signal.interests.entities=<headliner 1>,<headliner 2>,<Venue 227>
  filter.popularity.min=0.80  filter.popularity.max=0.92
  filter.exclude.entities=<headliner 1>,<headliner 2>
  signal.demographics.age=25_to_29,30_to_34
  take=50
→ 50 ranked artists (IDs and scores redacted)
```

Against the same call without Venue 227, an artist lifted five or more places, with two genre tags in common, becomes a Mid candidate.

## Evidence

- **A room is a real signal, but not every room.** In the first live test (15 October 2026), adding Venue 227 to the headliners moved N–29 artists per fee band up five or more places, 22–23 of them sharing two genre tags with the headliners. The Venue 418 moved N–31. Venue 166 Boise changed nothing, so the agent measures every room.
- **The current build (17 October 2026):** 12 Qloo calls; both bands full, 4 of 4 and 6 of 6. The Venue 418 lifted N acts, Venue 227 2 and Venue 166 Boise 0.
- **Three more towns, one run each.** Run offline on 17 October 2026 with only the town changed, the agent filled both bands in Austin, Denver and Nashville within 12 Qloo calls. Venue 213 Austin lifted N acts, Venue 62 2, Venue 420 0; in Denver, Venue 333 and Venue 184 5 each; in Nashville, Venue 331 10, Venue 106 and Venue 330 0.
- **Why a club's crowd.** Venue 227 and the Venue 166, two of the three rooms tested in Boise, were venues of Treefort Music Fest 2026, Boise's own festival (KIVI, 23 March 2026).

<!-- A buyer's words go here if any arrive. -->

## Screenshots

The gallery: first screen, replay with the planner's lines, card, refill, Without Qloo, and architecture (docs/architecture.svg).

## Setup and testing

**For judges:** open https://undercard-daniel-51ed.vercel.app. There is no login and no API key.

1. The draft bill loads first. Press **Watch the agent build it**: it replays the saved build and is never limited.
2. Click an act to open its card, then mark it **Unavailable** to see a refill.
3. Flip to **Without Qloo**, then back.

**Run the agent live instead** starts a fresh build. It is limited to 5 a day per IP.

**Locally:** `pnpm install` and `pnpm dev` on Node 22, with Qloo and Anthropic keys in `.env.local`.

## Limits

- **Popularity isn't a fee.** The fee bands are popularity ranges the buyer sets; real fees and avails come from agents.
- **Nothing forecasts sales.** Undercard doesn't claim its acts sell tickets.
- **Tested against Treefort, nothing claimed.** With a Boise room added, the best list held 2 of Treefort 2026's acts in the Mid band's top 50, against 1 for the headliners alone; the Opener lists held none. That is too small to show anything.
- **Each town is one run;** another run may pick other rooms.

## What's next

First a pilot with a working buyer on a real bill; then real fees and avails from agents in place of popularity bands, ticket outcomes for booked acts, and accounts with more than one festival.

## Sources

Citations with links: docs/research/festival-sites.md. Run counts: docs/qloo-spike.md and docs/evidence.md.
