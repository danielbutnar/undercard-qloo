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
A festival talent buyer books the undercard from acts the town's own venue crowds favour, within the buyer's fee bands, through Qloo.

## 2b. Ceiling
What a 10 is on each criterion, bounded by RULES.md, one person and 2026-10-30; anything beyond goes to the write-up's "What's next". Each criterion's "Built" line says what the app shows today toward that 10.
- Technological Implementation (ties break here first, RULES.md §6). A 10: Qloo does work nothing else in the app could, the agent's decisions are visible where judges look, and the measurement holds beyond one case. Test: someone reading only a replayed trace can say what the agent decided and why; every field in the brief appears in a call's parameters; a green CI check on the public repository. Built: five kinds of Qloo call, each with a stated reason; the replay shows the planner's lines among its calls; the crowd's age reaches every artist call; the agent filled both bands offline on every run, five in Boise and three each in Austin, Denver and Nashville, with the same ten acts on every run in Boise, Denver and Nashville (docs/evidence.md); GitHub Actions runs `pnpm gate` on every push to main; Austin, Denver and Nashville builds of the same brief replay on production, each from its own rooms.
- Design. A 10: people read the first screen in two seconds as a booker's draft festival bill built from Boise's rooms, the first click is obvious, every state is designed, one motion explains the product, it works at 390 px, and the video and gallery stills tell the story. Test: five people at two seconds each; Pass 2 of the frontend-anti-slop skill; the video skill's checks. Built: the first screen is the draft bill with each act's room and lift; a fresh model cold reader of the live 1280x800 shot names the buyer, Boise's venue crowds and "Watch the agent build it"; live LCP under 1 s; the fallback, limit and error states are designed; a town switcher one click from the bill opens the same brief in Austin, Denver and Nashville.
- Potential Impact. A 10: a real audience whose problem is documented from the buyer's side, a buyer saying it in their own words, a demo shown to work against a fair baseline, the whole decision in the demo, and the limits stated. Test: every claim in the write-up's Evidence section carries a number or a quote, and a source. Built: the buyer's problem documented from sources (docs/research/festival-sites.md); the draft, the refill and the export in the demo; a model-only contrast at high effort; the limits stated in docs/devpost-story.md; a pilot runner (scripts/pilot.ts) writes a one-page draft for any buyer's town, headliners and band sizes, ready to send to a buyer who replies; drafts for Calgary, Raleigh and Reykjavík filled both bands.
- Quality of the Idea. A 10: non-obvious and only possible with Qloo, the buyer's terms and limits understood, the obvious objection answered with a source, and a fair contrast with the model alone. Test: the write-up answers "why should a club's crowd pick a festival's acts?" with a source. Built: a town's own music venues as the taste signal, through Qloo; Unavailable takes the buyer's reason (radius clause, routing or fee), carried into the refill's trace line and the CSV; two of the three Boise rooms tested were Treefort 2026 venues (KIVI, 2026-03-23).
- Out of reach by 2026-10-30, for "What's next": a pilot with a working buyer on a real bill; real fees and avails from agents; ticket outcomes for booked acts; accounts.

## 2c. Floor
What loses the entry by default (RULES.md, Required parts), each with its check:
- The public repository: it is private today. Scan the full history for Qloo response data and secrets first; make it public, with the license visible, as M5's last step.
- The demo live until 2026-11-17 06:45 Europe/Bucharest: saved builds and caches last through 2026-11-18 and the keys stay active through judging; checked again in M5.
- "What makes it Qloo-powered" in the write-up, as the event page asks: M5.

## 3. Demo path
The path a judge sees in the video and can repeat on the deployed URL with seeded data:
1. Open the deployed URL: the seeded festival Sagebrush Sound (fictional; Boise, Idaho; 3,000 capacity; crowd aged 25–34) loads as the saved draft bill. Its two booked headliners sit over 4 Mid acts and 6 Opener acts, each marked with the Boise room whose crowd lifted it in Qloo's ranking and how far ("new" when it entered the top 50). A rail counts what each tested room produced. There is no login. With no saved build, the empty board and "Build undercard" load instead.
2. Press "Watch the agent build it": the trace panel streams every Qloo call the agent made (search the headliners, find Boise's anchor music venues, artist insights per anchor venue and fee band) with its parameters and result count, and the bill reprints. "Run the agent live instead" runs the agent fresh, rate-limited.
3. Open an act: its card leads with a "Why Boise" line naming the anchor venue whose fans it shares, then shows Qloo affinity, the popularity percentile inside the buyer's fee band, and two Qloo tags it shares with the headliners.
4. Mark it "Unavailable" on its card: Undercard refills that slot from the same fee band with a new Qloo call (shown in the trace), and the replacement prints into the slot with its mark.
5. Flip to "Without Qloo": the same brief without Qloo reprints the bill with the model's ten picks, each with the model's own reason, no Boise room and no fee band check. Flip back; "Export CSV" in the bar downloads the lineup.

## 4. Done means
The entry is finished when all of these are true:
- `pnpm gate` passes.
- `E2E_BASE_URL=$PREVIEW_URL pnpm e2e --workers=1` passes every step of section 3, where PREVIEW_URL is the production deployment's `.vercel.app` domain recorded in TASKS.md at M4 (Vercel puts preview URLs behind a login).
- The Qloo API does the work in step 2 of section 3 (and the refill in step 4), and the screen shows it: the trace lists every Qloo call, every act on the bill shows its room and lift, and its card shows Qloo's affinity and popularity.
- README.md has these sections: What it does, How it works, Sponsor technology, AI usage, Built on (create-next-app and the libraries in package.json; there is no starter kit).
- The deployed demo needs no login and no API key from the judge.
- The video is under the limit in section 1 and shows section 3 running on the live app.
- A cold reader shown only a screenshot of the first screen names what Undercard does and its first click, "Watch the agent build it".
- The video shows the product working by 10 s, in clean frames, with one measured number about the product, such as the Qloo calls per build or the refill time.
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
- [x] M2 Qloo client and the agent loop. Done means: docs/qloo-spike.md records result counts (never response bodies) for three live calls: /search for each headliner, music venues in Boise, and artist insights seeded by one venue; src/server/qloo.ts calls /search, /v2/tags, /v2/insights (urn:entity:place and urn:entity:artist) and Analysis Compare with the X-Api-Key header and caches responses server-side; POST /api/undercard streams trace events and returns 10 acts, each with affinity, popularity, fee band, anchor venue and two shared tags; the agent stops at 12 Qloo calls per build; with Qloo mocked, unit tests check each tool's query parameters and the call cap; tests in tests/unit/m2.
- [x] M3 Refill, the LLM-only baseline, the poster and the export. Done means: "Unavailable" refills the slot from the same fee band using filter.exclude.entities, in at most 3 Qloo calls; "LLM only" renders a lineup labeled "No Qloo data" through src/server/ai.ts; Poster renders every act grouped by band; Export CSV downloads the columns act, band, affinity, popularity, anchor_venue, reason; the cached Sagebrush build renders the full board in under 5 seconds; tests in tests/unit/m3.
- [x] M4 Deploy and seed. Done means: the preview URL is live, `pnpm seed` loads 30 days of data, and every AI route is rate-limited.
- [x] M4b First screen: the draft bill. The page opens on the latest saved build, read on the server and briefly cached, set as the buyer's draft bill with each act's Boise room and lift; the trace sits behind "Watch the agent build it", an act's card opens on click, and "Without Qloo" reprints the bill with the model's picks. The engine, the API routes, the rate limits and the replay stay as they are. Done means: the demo path in section 3 runs end to end; a fresh cold reader of the new 1280x800 judge shot names the buyer, Boise's venues, and "Watch the agent build it" as the first click; LCP on the first screen is under 2.5 s on a production build; every e2e spec and `pnpm gate` pass; tests in tests/unit/m4b.
- [x] M4c Ship M4b, then polish. Closes: Design: M4b runs only locally, and its Found list (the fee band reads as set by the agent, the ▲ falls back to another font, the card's Close sits above the card, the first click is buried at 390 px, throttled LCP). Freeze: 2026-10-21. Done means: the live e2e passes; a fresh cold reader of the live 1280x800 shot names the buyer, Boise's venues and "Watch the agent build it", and doesn't say the agent or Qloo sets the fee bands; LCP on the live first screen is under 2.5 s.
- [x] M4d Make the engine honest. Closes: Technological Implementation: the replay hides the planner's decisions and the crowd's age reaches no call; Potential Impact and Quality of the Idea: the model-only baseline runs at lower effort than the agent. Freeze: 2026-10-23. Done means: a replay shows the planner's lines; every field in the brief appears in a call's parameters or is gone from the screen; the baseline runs at high effort; `pnpm gate` and the live e2e pass.
- [x] M4e Evidence, offline. Closes: Potential Impact and Quality of the Idea: the objection is unanswered and nothing checks the method against a real bill; Technological Implementation: the measurement rests on one town. Freeze: 2026-10-23. Done means: docs/evidence.md holds each result (the sourced answer to the objection, the Treefort check, the agent in Austin, Denver and Nashville), or a recorded no-go.
- [x] M4f CI. Closes: Technological Implementation: no CI check. Freeze: 2026-10-23. Done means: a GitHub Actions run of `pnpm gate` is green on main, with a status badge in README.md.
- [x] M6a Pilot runner. Closes: Potential Impact: there is no draft a buyer can be sent. Freeze: 2026-10-19. Done means: a script takes a town, two headliners and band sizes, runs the agent offline without saving a build, and writes a one-page draft to .design/pilots/<town>.md (the bill, each act's room and lift, a summary of the calls); the Boise page has been checked.
- [x] M6b Robustness. Closes: Technological Implementation and Potential Impact: each town's result is one run. Freeze: 2026-10-20. Done means: from five offline runs in Boise and three each in Austin, Denver and Nashville, docs/evidence.md reports per town how often both bands filled, which rooms were tested and how many acts each lifted, and how many of the ten acts repeat between runs.
- [x] M6c Local strength. Closes: Quality of the Idea, Potential Impact and Technological Implementation: nothing shows that a town's crowd knows the undercard acts. Freeze: 2026-10-22. Done means: a spike's go or no-go in docs/evidence.md; on a go (a usable local signal for at least 8 of the 10 current acts, at no more than one extra call per act), each act's card shows it in plain words, the trace lists its calls and the build saves it.
- [x] M6d The same brief in other towns. Closes: Technological Implementation, Potential Impact and Design: the demo shows one town. Freeze: 2026-10-24. Done means: Austin, Denver and Nashville builds of the same brief, each run fresh once on production under its own festival id and replayed like Boise; a town switcher one click deep; Boise stays the default and its latest pointer never moves; a town whose build has a band that isn't full is left out.
- [x] M6e Booking vocabulary. Closes: Quality of the Idea: "Unavailable" carries no reason. Freeze: 2026-10-24. Done means: "Unavailable" takes a reason (radius clause, routing or fee), recorded in the refill's trace line and in the CSV.
- [ ] M6f Your festival. Closes: Design and Potential Impact: a judge can't try a town of their own. Freeze: 2026-10-26. Done means: a spike's go or no-go in docs/evidence.md (go only if at least 8 of 10 US towns of different sizes fill both bands within 12 Qloo calls, offline, with the same headliners); on a go, a form one click deep (a town and two headliners) runs the agent live under the existing per-IP limit, with designed states for a headliner not found, too few music rooms and the limit reached, each run under its own festival id and never saved as anyone's default.
- [ ] M5 Package. Done means: the video is rendered within the limit, docs/ holds the Devpost story and the architecture diagram, and the contradiction check has run.

Ladder rules for M4c onward:
- Anything that waits on people starts first.
- After each milestone, update section 2b's "Built" lines, TASKS.md and the private ceiling notes; then commit, deploy and run the live e2e with --workers=1. Scores come only from the judge panel, which runs in chat.
- For M6a onward: the tag v1-verified marks the last verified main; each new feature is spiked first, with its go or no-go in docs/evidence.md, and a no-go is dropped, not forced. The first screen stays the bill and new features sit one click deep; after every milestone a fresh low-effort cold reader of the 1280x800 judge shot must still name the buyer, Boise's venues and "Watch the agent build it". No fresh agent run on production except where M6d names it.
- No milestone starts past its freeze. Code freezes on 2026-10-26; the video, the gallery stills and the story are redone on 2026-10-27 and 28; submission is on 2026-10-29.
- Nothing is built unless it closes a gap in section 2b.

## 7. Constraints
- Allowed new dependencies: what create-next-app installs for the M1 scaffold (next, react, react-dom, typescript, tailwindcss, eslint and their type and config packages); vitest, @vitejs/plugin-react, jsdom, @testing-library/react, @playwright/test and prettier as devDependencies; zod, @upstash/redis, @upstash/ratelimit and @anthropic-ai/sdk; and inside video/ only what the motion-video-producer skill installs for M5.
- AI models allowed by RULES.md: RULES.md names none, so claude-sonnet-5-5 runs both the agent and the LLM-only baseline; every call goes through src/server/ai.ts.
- Seed data: one fictional festival (Sagebrush Sound, Boise, Idaho; capacity 3,000; crowd aged 25–34; two headliners stored as names only; fee bands Mid = popularity 0.80–0.92 and Opener = 0.55–0.80, tuned at the M2 spike) and 30 days of synthetic presale counts; never real personal data.
- Design: the frontend-anti-slop skill applies; colors and fonts come from docs/design-brief.md once its Pass 1 is approved. For M4b, section 5 of the brief is redrawn from the approved draft-bill mockup (2026-10-17); tokens and type are unchanged.
- Services: the Qloo hackathon API key, the Anthropic API, Vercel, the Upstash Redis free tier, and ElevenLabs for the M5 voiceover.
- Qloo: the key works only at https://hackathon.api.qloo.com; never call /recs or /recommendations; send GET requests with parameters in the query string; cache responses server-side only (Upstash) and never commit them.
- Local taste: the Entity Type Parameter Guide lists no location parameters for urn:entity:artist, so local taste comes from Boise's anchor venues passed in signal.interests.entities, never from a location parameter on artists. If the M2 spike finds fewer than 5 Boise music venues, switch the seeded city to whichever of Austin, Denver or Nashville returns the most.
- No artist photos, logos or entity images on the board or the poster; text only.
- Qloo transport: Next.js route handlers call the REST API directly, as the Dev guide documents. The Qloo Hackathon Kit's `qloo mcp` server can't run in serverless functions, so the app doesn't use it; the `qloo api` CLI may be used locally for the M2 spike. Copy no code from the kit (it has no license).
- docs/devpost-story.md follows the six parts of the kit's docs/SUBMISSION.md: problem statement, Qloo calls used and why, a redacted request-to-result walkthrough, screenshots, setup steps, and known limitations (what the affinities do not establish).

## 8. Non-goals
- Artist availability, real fees, agent contacts or offers: the fee bands are estimates the buyer sets.
- Ticket-sales forecasting or presale analytics beyond the seeded sparkline.
- Accounts or saved lineups.
