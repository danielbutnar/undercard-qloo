# TASKS: M3 Refill, the LLM-only baseline, the poster and the export

Copied from SPEC.md section 6, M3. Done means: "Unavailable" refills the slot from the same fee band using filter.exclude.entities, in at most 3 Qloo calls; "LLM only" renders a lineup labeled "No Qloo data" through src/server/ai.ts; Poster renders every act grouped by band; Export CSV downloads the columns act, band, affinity, popularity, anchor_venue, reason; the cached Sagebrush build renders the full board in under 5 seconds; tests in tests/unit/m3.

Also asked for this run: Qloo responses stay cached until at least 2026-11-18, past the end of judging; the filled board's design shots are checked at 1920x1080.

- [x] Cache lifetime: Qloo responses (and saved builds) cached until at least 2026-11-18, then 7 days; cache keys bumped so older 7-day entries are replaced
- [x] Cached build: a complete build is saved server-side and replayed in under 5 seconds, marked as a replay; a fresh build runs on request
- [x] Refill: POST /api/refill finds a replacement in the same fee band with filter.exclude.entities, in at most 3 Qloo calls, streamed to the trace
- [x] Unavailable: a card's Unavailable button stamps the act and swaps in the refill
- [x] LLM only: POST /api/llm-only asks claude-sonnet-5-5 through src/server/ai.ts for the same brief without Qloo; the board shows it labeled "No Qloo data", with no affinity, fee band or local link
- [x] Poster: typesets every act grouped by band as a show bill
- [x] Export CSV: downloads act, band, affinity, popularity, anchor_venue, reason
- [x] Demo path steps 4 and 5 in tests/e2e, and the cached build's full board in under 5 seconds
- [ ] README: M3 features and AI usage
- [ ] M3 Done means holds and `pnpm gate` passes; M3 ticked in SPEC.md

## Screens (design shots pass the frontend-anti-slop questions)
- [x] Filled board at 1920x1080, 1440x810 and 390 wide
- [x] Refill (Unavailable stamp and the new card), LLM only, and Poster at 1440x810 and 390 wide
