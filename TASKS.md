# TASKS: M4 Deploy and seed

Copied from SPEC.md section 6, M4. Done means: the preview URL is live, `pnpm seed` loads 30 days of data, and every AI route is rate-limited.

Decided for this run: the judge URL (PREVIEW_URL) is the production deployment's `.vercel.app` domain, because Vercel puts preview URLs behind a login. Rate limits apply per IP and per day to fresh builds, refills and the LLM-only call; replaying the saved build is never limited. The rate limits and `pnpm seed` are pushed first; the repo is then linked to Vercel by me.

- [x] Rate limits: fresh builds, refills and LLM-only model calls limited per IP per day and by a daily ceiling for everyone, with a friendly message at the limit; replays never limited
- [x] `pnpm seed`: writes 30 days of deterministic demo data to seed/sagebrush-sound.json, which the app loads; identical on every run
- [x] Production build passes; README covers the limits, the seed and deploying
- [x] Pushed to origin; repo linked to Vercel with the server environment variables (by me)
- [x] Production URL live with no login; recorded below as PREVIEW_URL
- [x] `E2E_BASE_URL=$PREVIEW_URL pnpm e2e` passes every step of the demo path (steps 1–5 and the under-5-second cached build, 2026-10-15)
- [x] M4 Done means holds and `pnpm gate` passes; M4 ticked in SPEC.md

PREVIEW_URL: https://undercard-1ybr6c8qu-daniel-51ed.vercel.app/ (production deployment, public, no login; checked 2026-10-15)
