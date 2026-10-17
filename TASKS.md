# TASKS: M4d Make the engine honest

Copied from SPEC.md section 6, M4d. Closes: Technological Implementation, Potential Impact, Quality of the Idea. Freeze: 2026-10-23. Done means: a replay shows the planner's lines; every field in the brief appears in a call's parameters or is gone from the screen; the baseline runs at high effort; `pnpm gate` and the live e2e pass.

Approved for this run: these engine changes, and one fresh build on production through "Run the agent live instead". No other fresh build on production; the store's latest pointer is not touched by hand.

- [x] The planner's lines are saved with the build (an optional field, so the Oct 15 build still parses) and replayed in order
- [x] Spike: the crowd's age reaches Qloo as signal.demographics.age (docs: 24_and_younger, 25_to_29, 30_to_34, 35_to_44, 45_to_54, 55_and_older; 25–34 is 25_to_29,30_to_34). Kept: an offline Boise run with the age filled 4 Mid and 6 Opener in 12 calls, 8 tagged places, rooms lifting 8, 2 and 0 acts (scripts/agent-offline.ts, 2026-10-17)
- [ ] The LLM-only baseline runs at high effort with max_tokens matching the planner's, and its cached answer is regenerated
- [ ] Deploy, then one fresh build on production through "Run the agent live instead"; stop if it's weaker than the Oct 15 build (a band not full, or fewer acts lifted by a room)
- [ ] Live e2e passes; SPEC.md 2b updated; M4d ticked

PREVIEW_URL: https://undercard-daniel-51ed.vercel.app (the judge URL: the project's production domain, which always serves the latest production deploy; public, no login; e2e passed against it 2026-10-15)

## Before the repository goes public
- [ ] Remove the Final scores and Weakest criterion bullets from SPEC.md section 9: all three AI judges docked them, and judges or an automated analysis may read self-scores as steering
- [ ] Decide whether a private note stays public: it's contest strategy, and the judge script can read it from claude-master-setup with --field
- [ ] Confirm the git history holds no sk-ant- key
- [ ] Replace the README's "video still to come" line
- [ ] Check that the saved build replays on the live URL. If it's gone, run one fresh build before judging starts on 2026-11-02, because replays come from the saved build in Upstash, not from `pnpm seed`
- [ ] If the organizers haven't answered about rate limits by 2026-10-27, decide whether to raise the per-IP limits for judging, keeping the shared daily caps as the cost ceiling
