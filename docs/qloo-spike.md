# Qloo spike (M2)

Run on 2026-10-15 against `https://hackathon.api.qloo.com` with `X-Api-Key`, all GET requests with parameters in the query string. This file records request parameters and result counts only; no response bodies, entity IDs or Qloo scores are stored here (RULES.md: Qloo response data stays out of the repository). Reproduce with `node scripts/qloo-spike.mjs`, which prints counts only.

## The three calls

| # | Call | Parameters | HTTP | Results |
|---|---|---|---|---|
| 1a | `/search`, headliner 1 | `query=Khruangbin`, `types=urn:entity:artist`, `take=10` | 200 | 3; the top result is the headliner |
| 1b | `/search`, headliner 2 | `query=Japanese Breakfast`, `types=urn:entity:artist`, `take=10` | 200 | 10; the top result is the headliner |
| 2 | `/v2/insights`, music venues in Boise | `filter.type=urn:entity:place`, `filter.location.query=Boise`, `filter.tags=urn:tag:genre:place:live_music_venue`, `take=50` | 200 | 8 |
| 3 | `/v2/insights`, artists seeded by one venue (Venue 227) | `filter.type=urn:entity:artist`, `signal.interests.entities=<Venue 227>`, `take=50` | 200 | 50 (17 in the Mid band, 18 in the Opener band) |

Thresholds: SPEC.md section 7 switches city below 5 Boise venues (8 found, so Boise stays); this run stops below 10 venue-seeded artists (50 found, so M2 continues).

## What else the spike found

- **The venue tag.** `/v2/tags?filter.query=music venue` and `filter.query=live music` with `filter.parents.types=urn:entity:place` both return 10 tags; `urn:tag:genre:place:live_music_venue` and `urn:tag:category:place:live_music_venue` give the same 8 Boise places. With `filter.location.radius=25000` the count rises to 10.
- **The locality.** `filter.location.query=Boise, Idaho` returns 0 places; `Boise` returns 8.
- **Not every venue tagged for live music is a music room.** The 8 include restaurants, a coffee shop, a theater and an arena alongside dedicated music venues, so the agent picks its anchor venues rather than taking all of them.
- **A venue alone is a weak signal.** Call 3's 50 artists are mostly unrelated to the headliners (largely Russian-language pop and US country). Used alone, a venue can't drive the lineup.
- **A venue added to the headliners is a real local signal.** Artist insights seeded by both headliners, per fee band (`filter.popularity.min/max`), return 50 artists in each band. Adding Venue 227 to the signal re-ranks that list: in each band 28–29 artists move up five or more places, and 22–23 of those share at least two genre tags with the headliners. The Venue 418 gives 26–31 and 21–23. Adding Venue 166 Boise leaves the ranking unchanged, so some venues carry no signal.
- **Fee bands.** Both bands (Mid 0.80–0.92, Opener 0.55–0.80) return the full 50 candidates, so the bands in SPEC.md section 7 stay as they are.
- **Analysis Compare.** `GET /v2/analysis/compare` with `a.signal.interests.entities` and `b.signal.interests.entities` returns `results.tags` (tags in common, each with a score), `results.a` and `results.b`. Headliner against headliner gives 25 tags in common; headliners against a venue give 0, so venue overlap comes from Insights, not Compare.
- **Tag IDs differ by endpoint.** `/search` returns tags as `{tag_id, name, type, value}` with IDs like `urn:tag:genre:…`; Insights returns `{id, name, type}` with IDs like `urn:tag:genre:music:…` and `urn:tag:subgenre:qloo:…`. Shared tags are matched by normalized name.
- **Latency.** Single calls took 0.5–3.6 s.

## What the agent does with it

1. `/search` each headliner (2 calls).
2. `/v2/tags` for the live-music-venue tag (1 call).
3. `/v2/insights` for Boise places with that tag (1 call); the agent picks music rooms as anchor venues.
4. Analysis Compare, headliner against headliner, for the tags they share (1 call); these rank which shared tags a card shows.
5. `/v2/insights` for artists seeded by the headliners, once per fee band, as the baseline (2 calls).
6. `/v2/insights` for artists seeded by the headliners plus one anchor venue, per venue and fee band (2 venues × 2 bands = 4 calls).

That is 11 calls, under the cap of 12. An act's anchor venue is the venue that lifts it furthest above the baseline, and its "Why Boise" line says by how many places. An act no venue lifts doesn't make the board.
