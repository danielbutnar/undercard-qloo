# Hackathon entry: project rules

This repository is one hackathon entry, built on my public starter kit. Three files define the work:
- RULES.md: the event's rules, extracted before the build. It overrides everything else, including SPEC.md.
- SPEC.md: the brief, the demo path, the milestones and what "done" means for each.
- TASKS.md: the live checklist for the current milestone.

Read all three at the start of every run and again after any context compaction. If SPEC.md still contains a « mark, a field was never filled: stop and ask me to finish it.

## Stack and commands
Node 22, pnpm, TypeScript (strict), Next.js App Router, Tailwind CSS, Vitest, Playwright, deployed on Vercel.
- `pnpm install` installs dependencies.
- `pnpm dev` starts the app locally.
- `pnpm vitest run tests/unit/m1` runs one milestone's tests; use the narrowest folder or file while iterating.
- `pnpm gate` runs typecheck, lint and every unit test. The Stop hook runs it automatically and blocks the end of a run while it fails.
- `pnpm e2e` runs the Playwright demo path; set `E2E_BASE_URL` to test the deployed preview.
- `pnpm seed` writes 30 days of deterministic demo data.
- `pnpm build` checks the production build.

## Layout
- `src/app`: routes and pages.
- `src/components`: UI components; follow the design-exclusions skill.
- `src/server`: server-only code. `src/server/ai.ts` is the only module that calls an AI model; RULES.md decides which models are allowed.
- `src/lib`: shared pure functions.
- `tests/unit/m1`, `tests/unit/m2` and so on: one folder per milestone.
- `tests/e2e`: the demo path from SPEC.md, step by step.
- `seed`: the seed script, with a fixed random seed.
- `video`: the Remotion project for the demo video.
- `docs`: the Devpost story, the architecture diagram and the AI usage notes.

## How a milestone runs
1. Take the first unchecked milestone in SPEC.md and copy its tasks into TASKS.md.
2. For each task: write a failing test in that milestone's test folder, make it pass, tick the task, then commit with a message that names the task.
3. The milestone is done when its "Done means" line is true and `pnpm gate` passes. Tick it in SPEC.md and stop.

## Rules that protect the entry
- Submit only code written during the event, plus the public starter kit credited in README.md.
- Commit after every ticked task. Never squash, amend pushed commits or rewrite history: the log shows the work was done during the event.
- Use the sponsor technology named in RULES.md in the core flow, visibly, never as a bolt-on.
- Keep the "AI usage" section of README.md current: what Claude wrote, and which tools generated media, including the AI voiceover.

## Demo readiness
- The deployed demo works with no login and no API key from the judge.
- Every route that calls an AI model is rate-limited per IP and per day, and fails with a friendly message at the limit.
- API keys live only in server environment variables; client code never imports them.
- `pnpm seed` produces identical data on every run.

## Ask me before
- Deploying to production or changing Vercel environment variables.
- Changing scope or milestones in SPEC.md, or editing RULES.md.
- Adding a dependency that SPEC.md doesn't list.
