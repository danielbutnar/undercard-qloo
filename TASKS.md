# TASKS: M1 Scaffold, data model, festival screen and lineup board

Copied from SPEC.md section 6, M1. Done means: `pnpm gate` runs typecheck, lint and `vitest run`, and `pnpm e2e` runs Playwright from tests/e2e; `/` shows Sagebrush Sound with its two headliners, both fee bands and the presale sparkline; the board renders 10 acts from tests/fixtures/lineup.synthetic.json; mapping a popularity percentile to a fee band is unit-tested at both band edges; tests in tests/unit/m1.

- [x] Scaffold Next.js app: create-next-app (TypeScript, Tailwind CSS, ESLint, App Router, src/, pnpm) in ./.scaffold, moved to the root without overwriting CLAUDE.md, README.md, RULES.md, SPEC.md, LICENSE, .gitignore or .claude/; ./.scaffold deleted; Vitest, Playwright and Prettier added; `pnpm gate` and `pnpm e2e` wired; committed alone as "Scaffold Next.js app" and tagged `starter-kit`
- [x] Festival data model: Sagebrush Sound (Boise, Idaho; capacity 3,000; crowd aged 25–34; two headliners as names only; fee bands Mid 0.80–0.92 and Opener 0.55–0.80) with 30 days of deterministic synthetic presale counts
- [x] Fee-band mapping: a popularity percentile maps to its fee band, unit-tested at both edges of each band
- [x] Synthetic lineup fixture: tests/fixtures/lineup.synthetic.json holds 10 acts (4 Mid, 6 Opener), each with affinity, popularity, fee band, anchor venue, a "Why Boise" reason and two shared tags, validated by a schema
- [x] Design brief (frontend-anti-slop Pass 1): docs/design-bans.md, scripts/design-check.mjs and docs/design-brief.md, approved before any screen is built
- [ ] Festival screen: `/` shows Sagebrush Sound, its two headliners, both fee bands and the presale sparkline
- [ ] Lineup board: renders the 10 fixture acts grouped by fee band
- [ ] Demo path step 1 in tests/e2e
- [ ] README: Built on and Running locally
- [ ] M1 Done means holds and `pnpm gate` passes; M1 ticked in SPEC.md

## Screens (design shots pass the frontend-anti-slop questions)
- [ ] `/` at 1440x810 (video) and 390 wide (mobile)
