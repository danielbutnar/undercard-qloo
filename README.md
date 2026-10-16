# Undercard

This repository's history is filtered from Undercard's private development repository: the same commits, with their dates and messages, with some files and quotes removed and data from Qloo's answers redacted, as Qloo's developer guide requires.

A lineup agent for regional festival talent buyers: enter two booked headliners and get a
fee-banded undercard grounded in your town's taste, powered by Qloo.

**Live demo: https://undercard-daniel-51ed.vercel.app** (no login, no API key).

Entry for the [Qloo Agentic Hackathon](https://qloo.devpost.com/). The brief is in
[SPEC.md](SPEC.md) and the event rules in [RULES.md](RULES.md).

## What it does

A talent buyer has booked a festival's headliners and set fee bands for the rest of the bill.
Undercard fills those slots with acts the town's own music crowd already follows, and says
why for each one.

The demo festival is Sagebrush Sound: fictional, 3,000 capacity, in Boise, Idaho, with
Khruangbin and Japanese Breakfast booked and two fee bands, Mid (4 slots) and Opener (6 slots).

1. **Build undercard**: the trace panel lists every Qloo call the agent makes, with its
   parameters and result count.
2. The board fills with 4 Mid and 6 Opener acts. Each card shows the act's Qloo affinity, its
   popularity percentile inside the band, a "Why Boise" line naming the local venue whose fans
   lift it, and two Qloo tags it shares with the headliners.
3. Mark an act **Unavailable**: the agent finds a replacement in the same fee band with a new
   Qloo call, and the new card takes the slot.
4. Flip to **LLM only** to see the same brief answered by the model alone: no affinity, no fee
   band, no local link.
5. Open **Poster** for the lineup set as a show bill, and **Export CSV** for the booking sheet.

## How it works

- **The agent plans the Qloo calls.** Claude Sonnet 5.5 works through one tool per Qloo call
  ([src/server/agent.ts](src/server/agent.ts), [src/server/agent-tools.ts](src/server/agent-tools.ts)).
  It resolves the headliners, finds the city's live music venues and picks the music rooms
  among them as anchors, gets the taste the headliners share, then asks for each band's
  artists twice: for the headliners alone, and for the headliners plus each anchor venue. It
  runs independent calls in parallel and stops at 12. In live builds it has changed course
  mid-build: when one anchor venue lifted no acts, it spent its last call on another room.
- **The app books the acts.** [src/lib/assemble-lineup.ts](src/lib/assemble-lineup.ts) takes
  an act when an anchor venue lifts it at least five places above the headliners-only
  ranking, its popularity sits inside the band, and it shares two genre tags with the
  headliners; each band takes its strongest-affinity acts. Every number on a card is Qloo's.
- **A refill** ([src/server/refill.ts](src/server/refill.ts)) reruns the venue query for that
  band with every act on the board excluded, in at most 3 calls, and applies the same bar.
- **Saved builds.** A complete build is saved ([src/server/build-store.ts](src/server/build-store.ts))
  and replayed to later visitors; the trace says when a board is a replay.
- **Checks.** Unit tests in [tests/unit](tests/unit) run against a synthetic Qloo: each tool's
  query parameters, the 12-call cap, the refill's exclusions and 3-call cap, the rate limits.
  The demo path in [tests/e2e/demo-path.spec.ts](tests/e2e/demo-path.spec.ts) (all five steps,
  plus a replayed board in under 5 seconds) passed against the live demo on 2026-10-15.

## Sponsor technology

Qloo does the work in every build. The agent calls the Qloo hackathon API
(`https://hackathon.api.qloo.com`, `X-Api-Key`, GET only) at most 12 times per build, and
the trace panel lists every call with its parameters and result count.

| Endpoint | Why the agent calls it |
|---|---|
| `GET /search` | Resolve each booked headliner (names only in the seed) to a Qloo entity. |
| `GET /v2/tags` | Find the tag Qloo puts on live music venues. |
| `GET /v2/insights` with `filter.type=urn:entity:place` | List the festival city's places with that tag; the agent picks music rooms as anchor venues. |
| `GET /v2/analysis/compare` | Find the taste tags the two headliners share; they rank the two tags each card shows. |
| `GET /v2/insights` with `filter.type=urn:entity:artist` | Rank artists inside each fee band's popularity range (`filter.popularity.min/max`), first for the headliners alone, then for the headliners plus one anchor venue in `signal.interests.entities`. |

Qloo's artist type takes no location parameter, so local taste enters only through the
city's venues as signals. An act makes the board when an anchor venue lifts it at least five
places above the headliners-only ranking; its "Why Boise" line says by how much. Affinity,
popularity percentile, fee band, anchor venue and shared tags on every card come from those
responses.

The spike ([docs/qloo-spike.md](docs/qloo-spike.md)) checked that a venue is a real signal.
Adding Venue 227 to the headliners moved N–29 artists per fee band up five or more places,
and 22–23 of them share at least two genre tags with the headliners. The Visual Arts
Collective moved N–31 (21–23 with shared tags). Venue 166 Boise changed nothing, which
is why the agent measures each venue's lift instead of trusting the venue list.

Marking an act **Unavailable** refills its slot with at most 3 more Qloo calls: artist
insights for the same fee band, seeded by the headliners and the act's anchor venue (then the
build's other anchors), with the headliners and every act on the board in
`filter.exclude.entities`. The first act that venue lifts past the same bar takes the slot,
and the call appears in the trace.

**LLM only** sends the same festival brief to the model with no Qloo and no tools, for
comparison: its picks carry no affinity, no popularity to map to a fee band and no local link.

Qloo responses are cached server-side in Upstash Redis until at least 2026-11-18, past the end
of judging, and never committed. A complete build is saved the same way, so the next visitor
gets the board replayed in about 2 seconds, marked as a replay; "Run the agent again" starts a
fresh build. [docs/qloo-spike.md](docs/qloo-spike.md) records what the first live calls
returned, as counts only.

## AI usage

- This repository is built with Claude Code (Anthropic); Claude writes most of the code.
- M1: Claude (Opus 5.5) wired the scaffold's tooling and wrote the festival data model, the
  fee-band mapping, the synthetic lineup fixture, the design brief and the festival screen
  with its lineup board and tests. I approved the visual direction it proposed in
  [docs/design-brief.md](docs/design-brief.md).
- M2: Claude (Opus 5.5) ran the Qloo spike and wrote the Qloo client and cache, the agent's
  tools and loop, the lift-based lineup assembly, the streaming route, the live trace panel and
  their tests.
- M3: Claude (Opus 5.5) wrote the saved-build replay, the refill, the LLM-only baseline, the
  Poster, the CSV export and their tests, and checked the screens in design screenshots,
  including the filled board at 1920x1080.
- In the product, Claude Sonnet 5.5 (`claude-sonnet-5-5`, called only from
  `src/server/ai.ts`) does two jobs. It is the agent's planner: it decides which Qloo calls to
  make, which venues to anchor on and when to try another, but doesn't choose acts or write
  numbers; the app books the acts from Qloo's responses. It also answers the LLM-only
  baseline, from its own knowledge with no tools; those picks are labeled "No Qloo data".
  Refills don't use the model.
- The festival, its presale numbers, and the acts and venues in the test fixture are invented.
  The two headliners are real artists, named so the agent can look them up on Qloo.
- The demo video is still to come (M5); its voiceover will be AI-generated with ElevenLabs and
  disclosed in the video.
- Kept current as each milestone lands.

## Built on

There is no starter kit. The app was generated with
[create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app) 16.4.0
(TypeScript, Tailwind CSS, ESLint, App Router, `src/`, pnpm). That commit is tagged
`starter-kit`; everything after it was written during the event.

- Runtime: [Next.js](https://nextjs.org) 16.4, [React](https://react.dev) 19.3,
  [Zod](https://zod.dev) 4 for the lineup and API schemas, the
  [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) for the
  agent's planner, and [@upstash/redis](https://github.com/upstash/redis-js) for the Qloo
  response cache.
- Styling: [Tailwind CSS](https://tailwindcss.com) 4, with Big Shoulders and Libre Franklin
  from [Google Fonts](https://fonts.google.com) (SIL Open Font License) through `next/font`.
- Tooling: TypeScript 5, ESLint 9 with `eslint-config-next`, Prettier 3,
  [Vitest](https://vitest.dev) 5 with `@vitejs/plugin-react`, jsdom and
  [Testing Library](https://testing-library.com/docs/react-testing-library/intro/), and
  [Playwright](https://playwright.dev) 1.64 for the demo path.

## Running locally

Needs Node 22 or later and pnpm.

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 to see Sagebrush Sound and press Build undercard.

A build needs a Qloo hackathon key and an Anthropic key; Upstash is optional (without it,
Qloo responses, saved builds and rate limits live in process memory). Copy `.env.example` to
`.env.local` and fill in your own keys; never commit `.env.local`.

`pnpm seed` writes the demo festival, Sagebrush Sound, with 30 days of synthetic presale
to `seed/sagebrush-sound.json`, the file the app loads. It uses a fixed random seed, so every
run writes the same bytes.

Checks:

- `pnpm gate`: typecheck, lint, every unit test and the design-ban scan.
- `pnpm e2e`: the Playwright demo path in `tests/e2e`. Run `pnpm exec playwright install chromium`
  once first. Set `E2E_BASE_URL` to test a deployed preview instead of the local dev server.
  The first build on a fresh cache runs the agent (Qloo and Claude), the refill calls Qloo,
  and LLM only calls Claude once; after that, builds replay the saved one.
- `DESIGN_LIVE=1 pnpm e2e tests/e2e/design-shots.spec.ts`: design screenshots in `.design/shots`,
  including one taken mid-way through a real build.
- `LIVE_UPSTASH=1 pnpm vitest run tests/unit/m4/rate-limit-upstash.test.ts`: checks the rate
  limiter against the Upstash database in `.env.local`, under its own key prefix.

## Deploying

The app runs on Vercel with no login and no key from the visitor. Link the repository in
Vercel and set these server environment variables: `QLOO_API_KEY`, `QLOO_BASE_URL`,
`ANTHROPIC_API_KEY`, `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. None of them is
exposed to the browser. The judge URL is the production domain,
https://undercard-daniel-51ed.vercel.app, which always serves the latest production deploy;
Vercel puts preview deployments behind a login.

Calls that spend money or quota are limited per IP and per UTC day, with a ceiling for
everyone, and answer with a friendly message at the limit:

| Action | Per IP per day | Everyone per day |
|---|---|---|
| Fresh build (runs the agent: Qloo and Claude) | 5 | 60 |
| Refill (up to 3 Qloo calls) | 25 | 500 |
| LLM only (asks Claude) | 10 | 100 |

Replaying the saved build and serving the saved LLM-only answer are never limited.

## License

[MIT](LICENSE)
