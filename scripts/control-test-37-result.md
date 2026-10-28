<!-- Section 37's result page. scripts/control-test-37.ts fills it from its run into
.design/evidence-37/result.md: counts and town names only, no act's or venue's name. The
orchestrator copies the filled text into docs/evidence.md section 37, under its dated additions. -->

**Result, {{date}} ({{startUtc}} to {{endUtc}} UTC, {{startBucharest}} to {{endBucharest}} Bucharest): {{verdict}}, {{atBar}} of the {{acts}} acts at a local lift of 5 places or more (the bar was 145); {{atFallback}} at 3 or more.{{productBarSentence}}** {{requests}} Qloo requests from scripts/control-test-37.ts, one at a time, {{requestsNote}}; the dry run planned {{planned}} before any skip. Every ranking was read in this run by the script's own client, which read nothing from the server's Qloo cache and wrote nothing to it.

| Town | Control town | Acts | Local lift ≥ 5 | Local lift ≥ 3 | Still climb ≥ 5 that day | No scored control |
|---|---|---|---|---|---|---|
{{townRows}}
| All {{towns}} | | {{acts}} | {{atBar}} | {{atFallback}} | {{stillClimb}} | {{noScoredControl}} |

| Fee range | Acts | Local lift ≥ 5 | Local lift ≥ 3 |
|---|---|---|---|
{{tierRows}}

**What it says.**
- **The bar.** {{barSentence}}
- **Controls without fan data.** Skipped for the next closest in popularity: {{controlsSkipped}} matched controls ({{roomsSkipped}} different rooms), {{controlsSkippedByWarning}} because Qloo warned the room wasn't scored and {{controlsSkippedByEqualRanking}} because, with no warning, its ranking was the headliners-only one. Venue runs that found no room with fan data in their control town: {{venueRunsWithoutControl}}, in {{controlTownsWithoutFanData}} control towns. Acts with no control: {{noScoredControl}}; they have no local lift and count as not reaching the bar.
- **The drift, a description.** On the run's day, {{stillClimb}} of the {{acts}} acts still climb at least 5 places with their town's venue, against all of them when their builds were made (17 and 18 October). It changes neither the bar nor the product's rule.
- **Also counted.** Venue runs, each matched in its own fee range: {{venueRuns}}. Town venues' popularity, each venue once: from their own town's find_venues that day {{popularityFromFindVenues}}, from /entities {{popularityFromEntities}}, from neither {{popularityFromNeither}} (their control town's rooms tried in Qloo's own order). Town venues Qloo reported not found on the run's day: {{venuesUnscoredToday}}, of the {{venuesLikeHeadliners}} whose ranking was the headliners' own.

By the outcomes written before the run: {{outcome}}
