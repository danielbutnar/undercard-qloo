# Undercard

This repository's history is filtered from Undercard's private development repository: the same commits, with their dates and messages, with some files and quotes removed and data from Qloo's answers redacted, as Qloo's developer guide requires.

A lineup agent for regional festival talent buyers: enter two booked headliners and get a
fee-banded undercard grounded in your town's taste, powered by Qloo.

Entry for the [Qloo Agentic Hackathon](https://qloo.devpost.com/). The brief is in
[SPEC.md](SPEC.md) and the event rules in [RULES.md](RULES.md).

## What it does

To be written in M5.

## How it works

To be written in M5.

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
responses. Responses are cached server-side in Upstash Redis for 7 days and never committed;
[docs/qloo-spike.md](docs/qloo-spike.md) records what the first live calls returned, as
counts only.

## AI usage

- This repository is built with Claude Code (Anthropic); Claude writes most of the code.
- M1: Claude (Opus 5.5) wired the scaffold's tooling and wrote the festival data model, the
  fee-band mapping, the synthetic lineup fixture, the design brief and the festival screen
  with its lineup board and tests. I approved the visual direction it proposed in
  [docs/design-brief.md](docs/design-brief.md).
- M2: Claude (Opus 5.5) ran the Qloo spike and wrote the Qloo client and cache, the agent's
  tools and loop, the lift-based lineup assembly, the streaming route, the live trace panel and
  their tests.
- In the product, Claude Sonnet 5.5 (`claude-sonnet-5-5`, called only from
  `src/server/ai.ts`) is the agent's planner: it decides which Qloo calls to make, which venues
  to anchor on and when to try another. It doesn't choose acts or write numbers; the app books
  the acts from Qloo's responses.
- The festival, its presale numbers, and the acts and venues in the test fixture are invented.
  The two headliners are real artists, named so the agent can look them up on Qloo.
- The demo video's voiceover is AI-generated with ElevenLabs and is disclosed in the video.
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
Qloo responses are cached in process memory). Copy `.env.example` to `.env.local` and
fill in your own keys; never commit `.env.local`.

Checks:

- `pnpm gate`: typecheck, lint, every unit test and the design-ban scan.
- `pnpm e2e`: the Playwright demo path in `tests/e2e`. Run `pnpm exec playwright install chromium`
  once first. Set `E2E_BASE_URL` to test a deployed preview instead of the local dev server.
  Steps 2 and 3 run a real build, so they call Qloo and Claude with your keys.
- `DESIGN_LIVE=1 pnpm e2e tests/e2e/design-shots.spec.ts`: design screenshots in `.design/shots`,
  including one taken mid-way through a real build.

## License

[MIT](LICENSE)
