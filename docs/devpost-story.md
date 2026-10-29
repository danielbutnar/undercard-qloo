# Undercard: the Devpost submission

The text for each field of the Devpost submission, field by field. Every number below is listed in `scripts/evidence-claims.ts` and checked by `pnpm evidence:check`; a number it can't re-derive names its section of docs/evidence.md and its date. The gallery, the video's link and the public repository's link go in after the deploy.

## Project name

Undercard

## Elevator pitch

The headliners are booked. Undercard's AI agent drafts the acts below them from Qloo, inside the buyer's fee ranges, with the evidence behind each pick and every Qloo call shown.

## About the project

### Inspiration

A festival's talent buyer books the headliners first. The slots below them, the undercard, are filled later, often from acts their agents pitch. Early slots play before most of the crowd arrives (Billboard; BottleRock's talent buyer, in Napa Valley Focus), an act that drops out needs a replacement of the same size, and radius clauses keep some acts off a festival in a given window (Coachella's terms as filed in 2018, via Stereogum). The data a buyer gets is mostly market-level, and often comes from the act's own agent (The Ringer, April 2022). None of the sources I read describes a buyer's tool that reads the fans of the town's own music venues.

Qloo can read them. It ranks artists by how much the fans of a set of inputs like them, and a music venue can be among those inputs. Artists have no location of their own in Qloo: its location data for artists, tried three ways, gave a usable local reading for at most 7 of 10 acts, short of the bar of 8 (docs/evidence.md section 6, 17 October 2026). So the town comes in through its venues. Venues are where a town's live music happens: two of the three Boise venues the agent read were venues of Treefort Music Fest 2026, Boise's own festival (KIVI, 23 March 2026). That shows the venues are part of the town's festival, not that their fans predict what it books.

### What it does

Undercard drafts the undercard for a buyer who has booked the headliners. Its case is the evidence behind each pick, inside the buyer's fee ranges, with every call shown. It doesn't claim to know what a festival would book.

The demo festival, Sagebrush Sound, is fictional: Boise, Idaho, with Khruangbin and Japanese Breakfast booked and 4 mid-size and 6 opening slots. Each tier has a fee range the buyer sets, given as a range of Qloo popularity that stands in for a fee; in this demo they are Sagebrush Sound's.

- **The draft bill.** The page opens on the saved build: each act in the colour of the Boise venue whose fans lifted it, with its rank and its climb in Qloo's ranking.
- **Watch the AI agent build it.** The saved build replays in the town, call by call, and the AI agent's setlist lists every Qloo call with its result count, its parameters and the agent's line for each choice.
- **Each act's evidence.** Its card gives its place for the headliners' fans alone and with the venue's fans added, its climb with that venue and with its control, a music venue abroad of similar Qloo popularity, its Qloo popularity inside the tier's fee range, and the genres it shares with the headliners.
- **Unavailable, Keep and Redraft the rest.** Mark an act unavailable with the buyer's reason (radius clause, routing or fee), and its slot refills from the same tier by the same rule. Keep the acts worth a call, and Redraft the rest refills the others.
- **Local picks, for the buyer to check.** The agent may name acts from the town it knows of. Each is looked up on Qloo and shown with Qloo's numbers in its own box; it takes a slot only if the buyer adds it.
- **Without Qloo.** The same brief, fee ranges included, goes to the AI model alone with no tools, so it can't see the town's venues or Qloo's numbers. Its picks come with its own reasons, and Qloo's numbers are looked up afterwards: a contrast, not a score.
- **Export CSV** and **Download the poster**, and the same brief in other towns, a click away: in 29 of the 29 checked towns, the saved build of the same brief fills every slot. Your festival runs the agent live for a town and headliners of your own, with Sagebrush Sound's crowd and fee ranges.

**What makes it Qloo-powered.** Every number behind a pick is Qloo's: the rankings, both climbs, the popularity and the genres. Without Qloo there are no venue fans, no climb, no control and no fee-range check, so there is nothing to book from; the Without Qloo view shows what is left.

### What was tested

Each of these tests had its bar written into docs/evidence.md before its first call, and each result is reported as it came.

- **SHOWN: 244 of 290** (section 37, 28 October 2026). 244 of the 290 acts Undercard 1.0 booked climbed at least 5 places more with the town venue that put them on the bill than with a music venue abroad of similar Qloo popularity. By a rule written before the test, that result set Undercard 2.0's bar: a local lift of 5 places.
- **PARTLY SHOWN: 20 of 30** (sections 26 and 34, 21 and 22 October 2026). 20 of 30 real festivals where the acts booked showed more lift from the town's venues than random acts of their tier; another country's venues did it at 18.
- **NOT SHOWN: 3 vs 11** (section 38, 28 October 2026). At 33 real festivals, Undercard's shortlists held 3 of the acts the festivals actually booked; the AI model alone held 11. Neither test bar was met.

So Undercard doesn't claim to pick what festivals would book, or to beat asking a model directly. What it gives a buyer is a draft in which every pick can be checked.

### How we built it

**Who does what.** The AI agent, Claude Sonnet 5.5 working through tools that make the Qloo calls, plans the calls: which venues to read, in what order, and when to stop. Qloo knows the taste. A fixed rule in the app's code picks the acts. The buyer makes every call.

**Agent 2.0, as deployed.**
- It reads at least two music venues with fan data, each beside its control: a music venue in a checked town in another country with similar Qloo popularity (for Boise, a venue in Bucharest with similar Qloo popularity). A town with fewer such venues says so. A venue Qloo has no fan data for is skipped, and the trace says so.
- An act books only if it climbs at least 5 places with the town's venue and at least 5 more than with the control, its Qloo popularity sits inside its tier's fee range, and it shares two genres with the headliners. The strongest Qloo match fills each slot first; a tier with too few such acts stays open.
- The cap is 28 Qloo calls a build, with retries shown on each call's line and in every count.
- A refill or a redraft first takes an act that passes from the rankings the build already holds, with no new call; otherwise it reads more venues with their controls, in at most 5 Qloo calls.
- Every call is in the trace, and a saved build replays call by call.
- The local picks are for the buyer to check; they never take a slot on their own.

**Qloo calls used, and why.** All GET, at https://hackathon.api.qloo.com:
- `/search`: each booked headliner, and each local pick.
- `/v2/tags`: the tag Qloo puts on live music venues.
- `/v2/insights` with `filter.type=urn:entity:place`: the town's tagged places, and the control town's music venues.
- `/v2/analysis/compare`: the genres the headliners share, which rank the genres a card shows.
- `/v2/insights` with `filter.type=urn:entity:artist`: each tier ranked for the headliners alone, then with a venue's fans added, then with its control's, always inside the tier's popularity range and with the crowd's age.
- `/v2/insights` with `signal.location.query`: Qloo's location signal for the town, a second reading on the card, outside the rule.
- `/v2/insights` with `feature.explainability=true`: Qloo's own split of each act's match by input, a line on its card, read from the cache.

**A call, from request to result** (ids and scores redacted):

```
GET https://hackathon.api.qloo.com/v2/insights
  filter.type=urn:entity:artist
  signal.interests.entities=<headliner 1>,<headliner 2>,<a Boise venue>
  filter.popularity.min=<the tier's floor>
  filter.popularity.max=<the tier's ceiling>
  filter.exclude.entities=<headliner 1>,<headliner 2>
  signal.demographics.age=<the crowd's age buckets>
  take=50
→ 50 ranked artists
```

The same call without the venue gives the headliners-only ranking, and with the control venue in its place, the control's ranking. An act's climb is its place without the venue minus its place with it; its local lift is its climb with the venue minus its climb with the control.

The app is Next.js and TypeScript on Vercel. Qloo's answers and the saved builds are cached server-side in Upstash Redis through the end of judging and never committed. Claude Code wrote most of the code; README.md's AI usage section says what it wrote.

### Challenges we ran into

- **Venues Qloo has no fan data for.** Adding such a venue to the headliners leaves their ranking as it was, which looks like a venue that lifts nothing. Agent 2.0 reads Qloo's warning, skips the venue, reads the next music venue and says so in the trace.
- **Whose climb is it?** A venue abroad can lift the same act. That's why every venue now has its control, and why the bar came from a test written before it ran.
- **Qloo's rate limit.** The client keeps few calls in flight and retries a busy answer with backoff; a retry shows on its call's line and never counts as a new call.
- **Places that aren't music venues.** Qloo's venue tag also covers parks, arenas and restaurants. The agent gives its reason when it skips a place, and a card says when its venue isn't a club.

### Accomplishments that we're proud of

- Every act on the bill comes with its evidence, in Qloo's own numbers, and every call that produced it is in the trace.
- In 29 of the 29 checked towns, a saved build of the same brief fills every slot and replays call by call.
- The test that set Agent 2.0's bar was written before its first call, and its result decided the bar.
- Every result is reported as it came, NOT SHOWN included.

### What we learned

A town's venues move Qloo's ranking, and most of 1.0's bookings held up against a music venue abroad. On the outside yardstick, though, the AI model alone held more of the acts real festivals booked than Undercard's shortlists did. Undercard doesn't pick what a festival would book. It gives a buyer a draft whose every pick can be checked, inside the buyer's fee ranges.

### Limits

- **Popularity isn't a fee.** The fee ranges are popularity ranges the buyer sets; real fees and avails come from agents.
- **Nothing forecasts sales**, or says an act would take the slot or fit the budget.
- **Whether a town's crowd knows these acts** stays open (section 6).
- **The control test's limits.** Section 37's acts were booked for their climb with that venue, so a control lifting them less is partly built into the test. The control is matched on Qloo popularity alone, not on size or style, and every control is abroad, so a local lift can reflect the country as much as the town.
- **Not every venue is a club.** A park or an arena can still draft a bill, and its card says so (section 10).

### What's next for Undercard

A pilot with a working buyer on a real bill; real fees and avails from agents in place of popularity ranges; the buyer setting the fee ranges, capacity and crowd of their own festival; ticket outcomes for booked acts; accounts for buyers with several festivals.

## Built with

next.js, react, typescript, tailwind-css, node.js, qloo, claude, anthropic, upstash, redis, vercel, zod, vitest, playwright, github-actions

TODO (after the video): the tools that made the video, Remotion and the voiceover tool.

## Try it out

- Live demo: https://undercard-daniel-51ed.vercel.app (no login, no API key)
- Code: TODO (after the deploy), the public repository's link

## Video demo link

TODO (after the render). The narration is in docs/video-script.md.

## Image gallery

TODO (after the deploy): the images from the live site, each with a caption: the first screen, Watch, an act card with both climbs, a refill, Without Qloo, and How it works' stamps.

## Testing instructions

No login and no API key. These steps are the demo path in SPEC.md, section 3.

1. Open https://undercard-daniel-51ed.vercel.app. Sagebrush Sound opens on its saved draft: the booked headliners sit over 4 mid-size and 6 opening acts, each in the colour of the Boise venue whose fans lifted it, with its rank and its climb in Qloo's ranking (NEW when it entered the top 50). In the town, each venue the agent read counts the acts its fans lifted, or says Qloo had no fan data for it.
2. Press **Watch the AI agent build it**. The saved build replays in the town, call by call, each caption naming its Qloo call and result count. Under the town, the AI agent's setlist lists every call, and the full calls list under it gives each call's parameters. A replay is never limited. To run the agent live instead, press **Play it live** on the setlist (or **Run it live** under Watch, on a large screen); a live run is limited per IP and per day.
3. Click an act. Its card says why it's here: its place for the headliners' fans alone and with the venue's fans added, its climb with that venue and with its control, a music venue abroad of similar Qloo popularity, its Qloo popularity inside the tier's fee range, and two genres it shares with the headliners. Keep, Unavailable and Close stay in view.
4. Press **Unavailable** and give a reason: radius clause, routing or fee. Undercard refills the slot from the same tier by the same rule. If an act in the rankings the build already holds passes, it takes the slot with no new Qloo call; otherwise Undercard makes at most 5 Qloo calls, each listed with the refill's reason. The replacement prints into the slot.
5. Flip to **Without Qloo**: the same brief answered by the AI model alone, its reason under each pick, checked on Qloo afterwards. Flip back and press **Export CSV** to download the draft.
