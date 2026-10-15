# TASKS: M2 Qloo client and the agent loop

Copied from SPEC.md section 6, M2. Done means: docs/qloo-spike.md records result counts (never response bodies) for three live calls: /search for each headliner, music venues in Boise, and artist insights seeded by one venue; src/server/qloo.ts calls /search, /v2/tags, /v2/insights (urn:entity:place and urn:entity:artist) and Analysis Compare with the X-Api-Key header and caches responses server-side; POST /api/undercard streams trace events and returns 10 acts, each with affinity, popularity, fee band, anchor venue and two shared tags; the agent stops at 12 Qloo calls per build; with Qloo mocked, unit tests check each tool's query parameters and the call cap; tests in tests/unit/m2.

- [x] Spike: three live calls recorded in docs/qloo-spike.md as result counts (8 Boise venues, 50 venue-seeded artists, so M2 continues)
- [x] Qloo client: src/server/qloo.ts calls /search, /v2/tags, /v2/insights (place and artist) and Analysis Compare with X-Api-Key, GET only, never /recs
- [x] Server-side cache: Qloo responses cached in Upstash Redis (memory fallback without Upstash), keyed by request, never committed
- [x] Agent tools: one tool per Qloo call, each tested for its query parameters with Qloo mocked
- [x] Call cap: the agent stops at 12 Qloo calls per build, tested
- [x] Lineup assembly: 4 Mid and 6 Opener acts, each with affinity, popularity, fee band, anchor venue (the venue that lifts it furthest above the headliners-only baseline) and two tags shared with the headliners
- [ ] Agent loop: claude-sonnet-5-5 plans the calls through src/server/ai.ts, tested with a scripted model
- [ ] POST /api/undercard streams trace events and the final 10 acts
- [ ] UI: Build undercard streams the trace into the panel and fills the board; /preview/board removed
- [ ] Demo path steps 2 and 3 in tests/e2e
- [ ] README: Sponsor technology and AI usage for M2
- [ ] M2 Done means holds and `pnpm gate` passes; M2 ticked in SPEC.md

## Screens (design shots pass the frontend-anti-slop questions)
- [ ] `/` before a build, during a build (trace streaming) and after (board filled), at 1440x810 and 390 wide
