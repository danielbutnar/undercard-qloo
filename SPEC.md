# SPEC: Undercard

<!-- Written by the Spec forge chat for one hackathon entry, then committed at the repository root.
Every guillemet-marked field is replaced before kickoff; Claude Code stops if any guillemet mark remains.
RULES.md overrides this file. Keep the filled file under 200 lines. -->

## 1. Event
- Event: Qloo Agentic Hackathon, https://qloo.devpost.com/
- Deadline: 2026-10-31 05:45 Europe/Bucharest; submit by 2026-10-30 23:45 Europe/Bucharest
- Tracks entered: Overall prizes (1st $15,000, 2nd $6,000, 3rd $4,000, each open to "All eligible submissions"); the event has no other tracks and no student-only track
- Required sponsor technology: the Qloo API (its Insights API, the /search endpoint and the Analysis Compare endpoint at https://hackathon.api.qloo.com), in an app that "functions as an agentic tool"
- Judging criteria:
  - Technological Implementation: 25%
  - Design: 25%
  - Potential Impact: 25%
  - Quality of the Idea: 25%
- Video: no length limit stated, so we cap it at 3:00; AI voiceover not mentioned, per "NOTE: Demo videos are not required." (Hackathon Website)
- Work rule: new work only for this entry (RULES.md §4 also allows evolved projects with an explanation; we don't use that)
- Scout value: $25,000 ÷ 344 (last edition's gallery) = $72.67 per entry

## 2. Goal
A talent buyer at a regional festival enters two booked headliners and gets a fee-banded undercard grounded in local taste through Qloo, built to win Quality of the Idea.

## 3. Demo path
The path a judge sees in the video and can repeat on the deployed URL with seeded data:
1. Open the deployed URL: the seeded festival Sagebrush Sound (fictional; Boise, Idaho; 3,000 capacity; crowd aged 25–34) loads with its two booked headliners, the buyer's two fee bands (Mid, Opener) and a 30-day presale sparkline. There is no login.
2. Press "Build undercard": the trace panel streams every Qloo call the agent makes (search the headliners, find Boise's anchor music venues, artist insights per anchor venue and fee band) with its parameters and result count.
3. The board fills with 4 Mid acts and 6 Opener acts. Each card shows Qloo affinity, the popularity percentile mapped to the buyer's fee band, a "Why Boise" line naming the anchor venue whose fans it shares, and two Qloo tags it shares with the headliners.
4. Mark one act "Unavailable": the agent refills that slot from the same fee band with a new Qloo call (shown in the trace), and the new card swaps in.
5. Flip "LLM only": the same brief without Qloo shows a generic lineup with no affinity, no fee band and no local link. Flip back and open Poster, which typesets the lineup by band and offers "Export CSV".

## 4. Done means
The entry is finished when all of these are true:
- `pnpm gate` passes.
- `E2E_BASE_URL=$PREVIEW_URL pnpm e2e` passes every step of section 3, where PREVIEW_URL is the Vercel preview URL recorded in TASKS.md at M4.
- The Qloo API does the work in step 2 of section 3 (and the refill in step 4), and the screen shows it: the trace lists every Qloo call and every card shows Qloo's affinity and popularity.
- README.md has these sections: What it does, How it works, Sponsor technology, AI usage, Built on (create-next-app and the libraries in package.json; there is no starter kit).
- The deployed demo needs no login and no API key from the judge.
- The video is under the limit in section 1 and shows section 3 running on the live app.
- LICENSE (MIT) sits at the repository root, so GitHub shows it in the About section (RULES.md, Required parts).
- No Qloo response data is committed; tests use synthetic fixtures shaped like Qloo responses.

## 5. Stop only if
- A test fails for a reason you can't explain after two attempts.
- RULES.md conflicts with this SPEC.
- Finishing needs a dependency, paid service or API that section 7 doesn't list.
- An action falls on the global stop list: destructive, outside this repository, production deploy, publishing, spending money.

## 6. Milestones
One milestone per Claude Code run. Tick it when its "Done means" is true and `pnpm gate` passes.
- [x] M1 Scaffold, then the festival data model, the festival screen and the lineup board from fixtures. There is no starter kit: run create-next-app (TypeScript, Tailwind CSS, ESLint, App Router, src/ directory, pnpm) in ./.scaffold inside the repository, move its files to the root without overwriting CLAUDE.md, README.md, RULES.md, SPEC.md, LICENSE, .gitignore or .claude/, delete ./.scaffold, add Vitest, Playwright and Prettier, and commit that alone as "Scaffold Next.js app" tagged `starter-kit`. Done means: `pnpm gate` runs typecheck, lint and `vitest run`, and `pnpm e2e` runs Playwright from tests/e2e; `/` shows Sagebrush Sound with its two headliners, both fee bands and the presale sparkline; the board renders 10 acts from tests/fixtures/lineup.synthetic.json; mapping a popularity percentile to a fee band is unit-tested at both band edges; tests in tests/unit/m1.
- [ ] M2 Qloo client and the agent loop. Done means: docs/qloo-spike.md records result counts (never response bodies) for three live calls: /search for each headliner, music venues in Boise, and artist insights seeded by one venue; src/server/qloo.ts calls /search, /v2/tags, /v2/insights (urn:entity:place and urn:entity:artist) and Analysis Compare with the X-Api-Key header and caches responses server-side; POST /api/undercard streams trace events and returns 10 acts, each with affinity, popularity, fee band, anchor venue and two shared tags; the agent stops at 12 Qloo calls per build; with Qloo mocked, unit tests check each tool's query parameters and the call cap; tests in tests/unit/m2.
- [ ] M3 Refill, the LLM-only baseline, the poster and the export. Done means: "Unavailable" refills the slot from the same fee band using filter.exclude.entities, in at most 3 Qloo calls; "LLM only" renders a lineup labeled "No Qloo data" through src/server/ai.ts; Poster renders every act grouped by band; Export CSV downloads the columns act, band, affinity, popularity, anchor_venue, reason; the cached Sagebrush build renders the full board in under 5 seconds; tests in tests/unit/m3.
- [ ] M4 Deploy and seed. Done means: the preview URL is live, `pnpm seed` loads 30 days of data, and every AI route is rate-limited.
- [ ] M5 Package. Done means: the video is rendered within the limit, docs/ holds the Devpost story and the architecture diagram, and the contradiction check has run.

## 7. Constraints
- Allowed new dependencies: what create-next-app installs for the M1 scaffold (next, react, react-dom, typescript, tailwindcss, eslint and their type and config packages); vitest, @vitejs/plugin-react, jsdom, @testing-library/react, @playwright/test and prettier as devDependencies; zod, @upstash/redis, @upstash/ratelimit and @anthropic-ai/sdk; and inside video/ only what the motion-video-producer skill installs for M5.
- AI models allowed by RULES.md: RULES.md names none, so claude-sonnet-5-5 runs both the agent and the LLM-only baseline; every call goes through src/server/ai.ts.
- Seed data: one fictional festival (Sagebrush Sound, Boise, Idaho; capacity 3,000; crowd aged 25–34; two headliners stored as names only; fee bands Mid = popularity 0.80–0.92 and Opener = 0.55–0.80, tuned at the M2 spike) and 30 days of synthetic presale counts; never real personal data.
- Design: the frontend-anti-slop skill applies; colors and fonts come from docs/design-brief.md once its Pass 1 is approved.
- Services: the Qloo hackathon API key, the Anthropic API, Vercel, the Upstash Redis free tier, and ElevenLabs for the M5 voiceover.
- Qloo: the key works only at https://hackathon.api.qloo.com; never call /recs or /recommendations; send GET requests with parameters in the query string; cache responses server-side only (Upstash) and never commit them.
- Local taste: the Entity Type Parameter Guide lists no location parameters for urn:entity:artist, so local taste comes from Boise's anchor venues passed in signal.interests.entities, never from a location parameter on artists. If the M2 spike finds fewer than 5 Boise music venues, switch the seeded city to whichever of Austin, Denver or Nashville returns the most.
- No artist photos, logos or entity images on the board or the poster; text only.
- Qloo transport: Next.js route handlers call the REST API directly, as the Dev guide documents. The Qloo Hackathon Kit's `qloo mcp` server can't run in serverless functions, so the app doesn't use it; the `qloo api` CLI may be used locally for the M2 spike. Copy no code from the kit (it has no license).
- docs/devpost-story.md follows the six parts of the kit's docs/SUBMISSION.md: problem statement, Qloo calls used and why, a redacted request-to-result walkthrough, screenshots, setup steps, and known limitations (what the affinities do not establish).

## 8. Non-goals
- Artist availability, real fees, agent contacts or offers: the fee bands are estimates the buyer sets.
- Ticket-sales forecasting or presale analytics beyond the seeded sparkline.
- Accounts, saved lineups or more than one festival.

