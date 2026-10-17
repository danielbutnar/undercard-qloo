# Undercard

## The problem

A festival's talent buyer has booked the headliners. Next comes the undercard, filled one offer at a time inside a fee budget. At a mid-tier festival that budget is the gate. Such festivals "rely on standard general admission for most of their revenue" (Axios Boston, 14 October 2026), and when sales fall short, festivals cancel: WOMAD Glasgow 2026 did, because ticket sales "did not reach the level required" (NME, 3 June 2026). Every undercard slot is a fee spent on an act the town may not come to see.

Buyers get market-level data, often from the act's own agent, to argue fees and billing (The Ringer, 15 April 2022). One promoter's data team says "an artist's guarantee does not always align with who the fans want" (Danny Wimmer Presents, FestForums, 7 October 2024). No source I found shows a buyer's toolkit saying which acts the crowds at the town's own music rooms already favour. And when an act drops out, radius clauses can keep the obvious replacement off the bill (Coachella's terms as filed in 2018, via Stereogum), so the buyer needs a fallback from the same band.

## What makes it Qloo-powered

Undercard reads a town's taste through its own music rooms. Qloo's artist type takes no location parameter, so the agent passes Boise's live-music venues to Qloo as signals beside the headliners and measures how far each room's crowd lifts each artist in Qloo's ranking, inside the buyer's fee band. An act is booked only when a room lifts it at least five places, its popularity sits in the band, and it shares two genre tags with the headliners. Without Qloo there is no room, no lift and no band check, so there is no bill.

The demo festival, Sagebrush Sound, is fictional: Boise, Idaho; 3,000 capacity; a crowd aged 25–34; two headliners booked.

- The page opens on the buyer's draft bill: the headliners over 4 Mid and 6 Opener acts, each marked with the Boise room that lifted it and by how many places.
- **Watch the agent build it** replays every Qloo call, with its parameters and result count, and the planner's own lines between them.
- An act's card shows Qloo's affinity, its popularity percentile in the band, a "Why Boise" line and two tags shared with the headliners.
- **Unavailable** refills the slot from the same band in at most three Qloo calls.
- **Without Qloo** reprints the bill with the model's own picks. The model alone runs at high effort, above the planner's medium, and still can't see Boise's rooms: each pick carries its reason, with no room and no fee-band check.

## Qloo calls used, and why

Claude Sonnet 5.5 plans the build. Every tool it has is one Qloo call, and a build stops at 12.

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

The app compares this ranking with the same call without Venue 227. An artist lifted five or more places, with two genre tags in common, becomes a Mid candidate, marked "Venue 227 +N".

## Evidence

- **A room is a real signal, but not every room.** In the first live test (15 October 2026), adding Venue 227 to the headliners moved N–29 artists per fee band up five or more places, 22–23 of them sharing two genre tags with the headliners. The Venue 418 moved N–31. Venue 166 Boise changed nothing, so the agent measures every room.
- **The current build (17 October 2026):** 12 Qloo calls; both bands full, 4 of 4 and 6 of 6. The Venue 418 lifted N acts, Venue 227 2 and Venue 166 Boise 0.
- **Three more towns, one run each.** Run offline on 17 October 2026 with only the town changed, the agent filled both bands in Austin, Denver and Nashville within 12 Qloo calls. Venue 213 Austin lifted N acts, Venue 62 2, Venue 420 0; in Denver, Venue 333 and Venue 184 5 each; in Nashville, Venue 331 10, Venue 106 and Venue 330 0.
- **Why a club's crowd.** Two of the three rooms the agent tested in Boise, Venue 227 and the Venue 166, were venues of Treefort Music Fest 2026, Boise's own festival (KIVI, 23 March 2026).

<!-- A buyer's words go here if any arrive. -->

## Screenshots

The gallery: the first screen, the replay with the planner's lines, a card, a refill, Without Qloo, and the architecture (docs/architecture.svg).

## Setup and testing

**For judges:** open https://undercard-daniel-51ed.vercel.app. There is no login and no API key.

1. The draft bill loads first. Press **Watch the agent build it**: it replays the saved build and is never limited.
2. Click an act to open its card, then mark it **Unavailable** to see a refill.
3. Flip to **Without Qloo**, then back.

**Run the agent live instead** starts a fresh build. It is limited to 5 a day per IP.

**Locally:** Node 22 and pnpm; `pnpm install`, then `pnpm dev`, with a Qloo hackathon key and an Anthropic key in `.env.local`.

## Limits

- **Popularity isn't a fee.** The fee bands are popularity ranges the buyer sets; real fees and avails come from agents.
- **Nothing forecasts sales.** Undercard doesn't claim its acts sell tickets.
- **Tested against Treefort, nothing claimed.** With a Boise room added, the best list held 2 of Treefort 2026's acts in the Mid band's top 50, against 1 for the headliners alone; the Opener lists held none. That is too small to show anything.
- **Each town is one run;** the planner may pick other rooms next time.
- **A room can lift nothing**, and Qloo's live-music tag also covers restaurants and an arena.

## What's next

A pilot with a working buyer on a real bill comes first, then real fees and avails from agents in place of popularity bands, ticket outcomes for the acts that get booked, and accounts with more than one festival.

## Sources

Citations with links: docs/research/festival-sites.md. Run counts: docs/qloo-spike.md and docs/evidence.md.
