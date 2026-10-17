# Festival sites and the buyer's problem (research, 2026-10-17)

## How I looked

- **Festival sites.** I opened eight sites in a real browser on 2026-10-17, between about 03:40 and 04:00 Bucharest time. Tomorrowland wasn't opened: the browser asks you to approve that site first, and you weren't there to approve it.
- **Viewport.** It was set to 1280x800. At that size the page measurements are exact: text sizes, images and videos in view, running animations, and overlays such as cookie banners. The browser could only return a thumbnail of that viewport, about 340 px wide, so I used it for the overall look and made no claim that needs finer detail. I opened every lineup poster on its own and read it at full resolution.
- **Consent.** I clicked no cookie consent anywhere. Some sites may remember an earlier choice in this browser profile, so cookie overlays are undercounted.
- **Season.** It is mid-October, so most 2027 lineups aren't out yet. That shapes what the first screens show.
- **Buyer-side evidence.** Every source in the Sources list was opened in this session. Entries marked "(re-checked)" had their quote read against the live page a second time. Anything that couldn't be confirmed is in its own section.

## Eight festival sites

| Site | What a first-time visitor gets in two seconds | How the lineup is shown | What moves |
|---|---|---|---|
| Coachella (coachella.com) | Coachella 2027: advance passes sold out; join the waitlist; hotels on sale. A full-width sunset photo carries the 75 px serif headline "2027 Advance Sale Passes No Longer Available". A cookie banner covers the bottom 16%. | Not on the site in October. The past-festivals page shows one poster image per year; each one's alt text is just the year, and no artist name is in the page text. The 2026 poster is set in three day blocks, each giving both weekends' dates. Each day's headliner is in the largest type, then a second tier, then rows of shrinking names with bullets between them. No stages are shown. | Nothing on the first screen: no running animation and no video in view. A YouTube embed sits further down. |
| Glastonbury (glastonburyfestivals.co.uk) | Glastonbury and its news. The first screen has an illustrated night-sky header, the ornate logo, colour-tab navigation and three news cards, one of them about 2027 ticket information. It shows no dates and no lineup. | The Line-Up page shows the 2025 poster as an image with empty alt text, a link "Click here for a text list of acts", and a sidebar of years. The poster runs Friday, Saturday, Sunday: each day's first row is largest and the rows shrink, with bullets between names. It mentions "over one hundred stages and areas" but gives no stage for any act. | Nothing. |
| Primavera Sound Barcelona (primaverasound.com/en/barcelona) | Primavera Sound, 2-6 June 2027: here is the bill, and tickets start at €330. The first screen is the lineup itself, with a ticket row underneath. | The homepage bill is one image whose alt text is its own file URL: a colour-dot frame on the left and the whole bill in type tiers on the right. It includes a labelled closing set and a Sunday takeover line. It is grouped by tier, not by day (apart from that Sunday line), and shows no stages. | Nothing on the first screen. A muted autoplaying YouTube embed sits further down, and an audio element on the page is paused and empty. |
| Lollapalooza (lollapalooza.com) | Lollapalooza Chicago is selling merch. A promo bar and a 62 px "New Merch Drop" hero show product photos over a black-and-white skyline, with Tickets in the header. A cookie bar covers 9% of the viewport. | The "2026 LINEUP" page is one image with empty alt text, and no artist name is in the page text. Its sign-up heading reads "BE FIRST TO KNOW ABOUT KNOW ABOUT THE 2027 DATES…" on the live page. The image runs by day, Thursday to Sunday: each day's two headliners are large on the left and the rest of the day is a uniform block of names. No stages are shown. | No animation in the first viewport. Two muted autoplaying videos sit further down. |
| Roskilde (roskilde-festival.dk/en) | Roskilde 2027 tickets are on sale; a crowd is having a great time. The 64 px "RF27 tickets are on sale" sits over a full-screen video. | 18 acts are announced so far. They appear as equal square photo tiles with the name overlaid and a "NEW!" badge, with an All / Music filter. There is no billing hierarchy yet, and no days or stages. | A full-screen muted looping aftermovie, plus 10 CSS animations: an orange "Independent and non-profit" marquee, a scroll cue and an equaliser icon. |
| UNTOLD (untold.com) | UNTOLD, 5-8 August 2027 in Cluj: get a pass. The black page has a purple-to-magenta gradient pill button, an outline pill, a days/hours/minutes/seconds countdown and a cookie bar. | The artists page says "Artists are coming soon", with Full list / My Lineup / View Stages tabs and a "Live radio" control that doesn't play on load. | A full-bleed YouTube background that autoplays, muted and looping. |
| Electric Castle (electriccastle.ro) | Electric Castle, 14-18 July 2027: passes and prices. A navy hero shows a hand-painted "SAVE THE DATE" (an image with descriptive alt text) and hand-circled dates, with four pass cards priced underneath. | 2027 isn't announced. The previous-editions page gives each year a small poster image, an attendance figure, a text list of selected acts and a paragraph. | Nothing. |
| Treefort Music Fest (treefortmusicfest.com), Boise | Treefort, downtown Boise, 31 March to 4 April 2027: passes on sale. A teal duotone video plays behind the logo. A cookie modal covers 17% of the viewport. | The 2026 lineup page has an artist search and Poster / Listen / Download the app buttons. Below them is a grid of artist photos with the names as text. The lineup page names no venues. | The video, plus 4 CSS animations: a marquee and two floating elements. |
| Tomorrowland (tomorrowland.com) | Not opened. | | |

### Across the eight

- **The lineup on the first screen:** 1 of 8 (Primavera Sound). The other seven lead with ticket status, a waitlist, merch, news, pass prices or a save-the-date.
- **The full bill as an image:** 4 of 8.
  - Lollapalooza: empty alt text and no text list on the page.
  - Coachella: alt text is the year only.
  - Glastonbury: empty alt text, but a text list is linked.
  - Primavera's homepage: alt text is the file URL.
  - Treefort and Roskilde keep names as text; Electric Castle's archive pairs each poster with a text list.
- **One convention, with one exception.**
  - Grouping is by day (Coachella, Glastonbury, Lollapalooza) or by tier (Primavera).
  - All four set the headliners largest. Coachella, Glastonbury and Primavera shrink the type tier by tier below them, and Coachella and Glastonbury put bullets between names.
  - The exception is the Lollapalooza admat: it sets every non-headliner in one uniform block, so its undercard has no internal hierarchy.
  - No poster shows stages.
- **Motion on the first screen.**
  - Video on 3 of 8 (Roskilde, UNTOLD, Treefort); CSS motion on 2 of 8 (Roskilde, Treefort).
  - Canvas, WebGL or 3D on none, and sound on load on none.
- **Cookie overlays on this visit.** Treefort 17%, Coachella 16%, UNTOLD about 11%, Lollapalooza 9% of the viewport. None appeared on the other four.
- **Why an act is on the bill.** None of the eight says; billing size is the only signal.

### What the big sites do well

- **They answer "when, where, can I go" first.** All eight first screens give the dates or the festival's news, and seven put a ticket, pass or waitlist action in view. That matches how ticket buyers say they choose. In the UK Festival Market Report 2022 (7,000 festival-goers), having been before (60%) outranks the whole line-up (50%) and the headliners (39%).
- **The poster is a shared visual language.** All four bills use the same form: days or tiers, with the headliners biggest.
- **There are good patterns to borrow.**
  - Primavera shows that the bill itself can be the first screen.
  - Treefort keeps every name as searchable text, with the poster as a separate view.
  - Electric Castle's archive pairs each poster with a text list and an attendance figure.
- **Restraint on sound and 3D.** None plays sound on load or uses WebGL.

### What they don't do (narrow claims only)

- Where the bill is an image with no text equivalent (Lollapalooza's 2026 page, Coachella's archive, Primavera's homepage), that content fails WCAG 2.2 success criterion 1.1.1 (Level A): "All non-text content that is presented to the user has a text alternative that serves the equivalent purpose" (W3C, re-checked).
- None explains why an act is booked, or what the bill has to do with the town.
- These are the fan's problems, not the buyer's, and none of them shows the sites failing at their own job of selling the event.

### Screenshots I'd want from you for full-resolution confirmation

The table rests on exact measurements plus thumbnails. To confirm any first-screen detail at full size, send the 1280x800 first screen of the Coachella, Glastonbury, Lollapalooza, Roskilde, UNTOLD, Electric Castle and Treefort homepages. A Tomorrowland homepage and lineup page would cover the ninth site.

## The buyer's side

### Radius clauses: documented, at big festivals, and aimed at acts high on the bill

- **Coachella.**
  - Court filings in 2018 set out the terms. Artists "are not allowed to perform at any festival in North America from Dec. 15 to May 1", and are "barred from playing any hard ticket concerts in Southern California during that same time period".
  - SXSW, Ultra Miami and New Orleans Jazz Fest were exempt (Stereogum, republishing Billboard/Amplify, 20 June 2018; re-checked).
  - The case was dismissed in 2019 and the dismissal reversed on appeal in 2020. The final outcome is unconfirmed.
- **Lollapalooza.**
  - As reported on NPR in 2010: "Lollapalooza says you can't play for a total of 9 months in the market – 6 months before and 3 months after", with the market defined "as 300 miles around Chicago".
  - The Illinois Attorney General opened an investigation (re-checked). A 2024 law-firm review says it closed in 2012 with no action (Gowling WLG, 13 March 2024; secondary source; re-checked).
- **Still a factor in 2025.** An IAG agent: "You have to sit with a map and radius clauses and figure out which way to go when the acts are high up on the bill" (Pollstar agents survey, 4 April 2025; re-checked).
- **Narrowed.**
  - The documented terms come from the largest festivals, and agents frame them around acts high on the bill.
  - A 2010 agent said promoters are usually flexible on exceptions (NPR, 2010).
  - The evidence supports "some acts can't play your festival in a given window", not "radius clauses decide undercards".

### Lineups from the same circuit: true at the top, contested below

- **Overlap at the top of the bill.**
  - Four agencies (Wasserman, CAA, WME, UTA) booked 60% of the headliners at 50 European festivals in 2023 (ROSTR with IQ; vendor data; re-checked).
  - An agent said festivals "often have to go to the same headliners" (David Viecelli in Billboard, date not shown; re-checked).
- **The circuit feeds the undercard.** A study of four large US festivals found that "bands unknown to the consumer have an increased likelihood of being hired if they are recording and touring", and that festivals bundle known and unknown acts (Hiller, *Journal of Cultural Economics*, 2016; read through the Culture.Case summary, 2017; re-checked).
- **Against "every lineup is the same".**
  - Across 12 big festivals from 2013 to 2023, "between 68% and 85% of acts were only booked at one festival", and lineups "have generally gotten more unique" (Chris Dalla Riva, *Can't Get Much Higher*, 29 February 2024; re-checked).
  - Setline's 2026 directory finds 20% of 27,458 booked artists playing more than one festival (vendor; a living report, last updated 16 October 2026; re-checked).
- **Narrowed.** The headliners and the touring pool overlap; whole undercards don't. "Booked from the same circuit" holds; "the same undercard everywhere" doesn't.

### Early slots, and crowds that don't know the acts: anecdotal

- **Early slots draw thin crowds, by the industry's own account.**
  - Billboard's article on double-weekend festivals says emerging bands play "too early in the day, like noon at Lollapalooza" and "before the audience really shows up". This is the article's own narration, not an agent's quote (re-checked).
  - BottleRock's talent buyer: "Every band wants to play as late in the day as possible because that's when there are more people there" (Napa Valley Focus interview, undated, about the 2026 lineup; re-checked).
- **Few local acts on big bills.** 8 of 142 acts at Lollapalooza 2019 were based in Chicago (Chicago Sun-Times; re-checked). Only two of the 58 acts on ACL's first 2017 poster were from Austin (Saving Country Music, an opinion site; re-checked).
- **Counterpoint.** In a Ticketmaster survey of over 4,000 festival-goers, "nearly two in three fans" say they start listening to new music after discovering an artist at a festival (Music Week, undated; vendor survey; re-checked). The article doesn't name the country, though the executives it quotes are Ticketmaster UK's. An unfamiliar undercard is part of the appeal for some.
- **Narrowed.** Buyers and agents say early slots play to fewer people. No source measures crowd size by slot, or whether a town's own crowd knows the undercard acts. That is unconfirmed.

### Mid-size festivals under pressure: strong for the UK, and mostly about costs

- **UK losses (cancelled, postponed or closed).** The Association of Independent Festivals counted 36 in 2023, "a record 78" in 2024 and 43 in 2025. By 10 June 2026, 20 independent festivals had announced a cancellation, postponement or fallow year (Pollstar, 10 June 2026; re-checked).
- **Costs more than demand.** The AIF's chief executive said the 2024 losses came "despite strong sales" (AIF, 16 January 2025; re-checked).
- **Low ticket sales as the stated reason.**
  - WOMAD Glasgow 2026: "ticket sales did not reach the level required to deliver the festival sustainably in its inaugural year" (NME, 3 June 2026; re-checked).
  - Groovin the Moo 2024: "Ticket sales have not been sufficient to deliver a regional festival of this kind" (Canberra Times/AAP; re-checked).
- **Mid-tier fragility.** Axios Boston (14 October 2026; re-checked):
  - "mid-tier festivals rely on standard general admission for most of their revenue".
  - "a headliner dropout could mean doom for a festival with unrecoverable labor, staging and vendor costs".
  - A Northeastern professor: "Boston Calling isn't a draw to people outside of the region the same way" as the largest festivals.
- **Australia.** In a Creative Australia survey of 51 festivals held in 2022-23, 35% reported a deficit (*Soundcheck*, 2024; re-checked).
- **Narrowed.** A regional festival of Sagebrush Sound's kind lives on general admission and is fragile. But most of the documented pressure is costs, and a better undercard addresses only demand.

### How buyers choose the undercard today

- **Job postings.** Talent-buyer postings stress agents, offers and budgets: "Buy profitable talent by actively reaching out to agents with booking possibilities" (AEG Live, posted 5 October 2026; re-checked). The three postings opened (AEG Live, Goldenvoice, Insomniac) name no music-data or analytics tool; AEG's asks only for Excel and "a general understanding of ticketing systems". That they don't name one isn't proof that buyers use none.
- **Agents bring the data, mostly to argue fees and billing.** A Wasserman agent sends "data on local, national, or global ticket sales, social media following and engagement". "Information on monthly streams can be a differentiator among mid-poster acts". "Tools such as Pollstar and Chartmetric can aggregate much of that data" (The Ringer, 15 April 2022; re-checked).
- **One large promoter says fees and demand don't line up.** Danny Wimmer Presents: "an artist's guarantee does not always align with who the fans want". It asks fans which artists they want on future lineups (FestForums, 7 October 2024; re-checked). This is the closest buyer-side statement of Undercard's problem. It is still about the festival's own ticket buyers, not the town's venue crowds.
- **Other festivals.**
  - Summerfest's team leans on "ticket sales history and streaming numbers, plus some intuition and luck", in the magazine's own words (Milwaukee Magazine, 11 June 2025; re-checked).
  - In Europe, "many buyers [are] now favoring domestic acts" (Wasserman agent, Pollstar, 4 April 2025; re-checked).
- **Narrowed.** Buyers use market-level data, often supplied by the act's own agent. No source shows a buyer using the taste of the crowds at the town's own music rooms. That gap is Undercard's opening, and it also means there is no evidence yet that buyers want it.

### What weakens the premise

- **Ticket buyers often choose on experience as much as on acts.** In the UK report, previous experience (60%) outranks the whole line-up (50%) and the headliners (39%). An older AIF figure (2014) put individual artists or headliners as the main reason for buying a ticket for only 8.3% of respondents (Access All Areas, 2015; re-checked).
- **Overlap below the headliners is weaker than often claimed.** See the 12-festival analysis above.
- **Destination festivals draw from far beyond the town.** The Boston Calling contrast (Axios) supports local taste for regional festivals and weakens it for Coachella-scale events.
- **The pressure is mostly costs, not demand.** See the AIF quote above.
- **Agents shape bills.** Whether undercards are mostly sold as agency packages is unconfirmed either way.

### Couldn't confirm

- Measured crowd size by time slot, or how many undercard acts a festival's own town already knows.
- The share of local and travelling attendees at any named festival. The ACL 2023 and Lollapalooza 2022 economic-impact reports opened don't give it.
- Any buyer using venue-level or local-taste data to choose undercard acts.
- That undercards are mostly sold as agency packages.
- A sector-wide cost-increase figure from a named source.
- The final outcome of Soul'd Out v. AEG after the 2020 appeal, and a primary record of the Illinois AG closing its Lollapalooza investigation.

## Boise's own festival books Boise's rooms (added 2026-10-17)

The objection: why should a small club's crowd pick acts for a 3,000-capacity festival?

**What the source says (KIVI, 23 March 2026):**
- Treefort Music Fest was scheduled to run in downtown Boise from 25 to 29 March 2026, with over 500 artists (the article is a pre-festival guide).
- Its artists were to play at dozens of downtown Boise venues. In its music section the article names the Main Stage and the Bandshell in Julia Davis Park, Treefort Music Hall, Boise Brewing, the Shine Basement and Ballroom, and Venue 227.
- Treefort sold venue-specific passes for the Main Stage, Treefort Music Hall, The Balcony and the Venue 166, among others.

**Lineup size (Treefort's own lineup page, archived 17 April 2026):** 562 performers are listed.

**Couldn't confirm:**
- That the Venue 418 was a Treefort 2026 venue. KIVI doesn't name it.
- Boise LocalWiki's Treefort page, which may list earlier editions at the Venue 418 and Venue 227, sits behind a bot check, so I didn't read it.

**Inference, not in the source:** Two of the three rooms Undercard tested, Venue 227 and the Venue 166 (which Qloo lists as Venue 166 Boise), were Treefort 2026 venues. So a room's regulars aren't a stand-in from outside the festival world: in Boise they're part of the audience a festival books for. The source shows that Treefort 2026 used these rooms. It doesn't show that a room's crowd predicts what Treefort books. The Treefort check in docs/evidence.md was a no-go on that question.

## What the evidence lets Undercard claim

| Can say | Shouldn't say |
|---|---|
| Mid-tier festivals live on general-admission sales and a dropout hurts (Axios, 2026). Undercard refills a slot from the same fee band with at most three Qloo calls; the live demo's refill took 1.1 s with the call served from cache, and uncached calls took 0.5-3.6 s each in the M2 spike. | "Festival websites are failing." |
| Buyers get market-level data, often from the act's own agent (The Ringer, 2022). No source found shows a buyer's toolkit saying which acts the crowds of the town's own rooms already favour; Undercard reads that from Qloo through Boise's venues. | "Every festival books the same undercard." |
| Radius clauses and routing keep some acts off a festival in a given window: Coachella's contracts, as filed in 2018, kept its acts off other North American festivals, three exempted, from 15 December to 1 May. The buyer needs a fallback in the same band. | "Local crowds don't know the undercard acts" (there is no data either way). |
| A promoter's own data team says fees and fan demand don't line up (Danny Wimmer Presents, 2024). | "Undercard sells more tickets" (no evidence, and presale forecasting is a non-goal in SPEC.md section 8). |

## Sources
- "Treefort 2026 guide: Hundreds of artists and events taking over downtown Boise", KIVI (Idaho News 6), 23 March 2026. https://www.kivitv.com/downtown-boise/your-guide-to-treefort-2026-music-comedy-art-and-more (read 2026-10-17)
- Treefort Music Fest 2026 lineup, Wayback Machine capture of 17 April 2026. https://web.archive.org/web/20260417060044/https://treefortmusicfest.com/lineup/ (read 2026-10-17)

Festival sites (opened 2026-10-17):

- Coachella, homepage and past festivals. https://www.coachella.com/ ; https://www.coachella.com/past-festivals ; 2026 poster image: https://aegwebprod.blob.core.windows.net/content/content_images/640/VsUNZFoo56bbdvYfz9X7yURvgQA52T1Kf1xMPyi8.jpg
- Glastonbury Festival, homepage and line-up. https://www.glastonburyfestivals.co.uk/ ; https://www.glastonburyfestivals.co.uk/line-up/ ; 2025 poster: https://www.glastonburyfestivals.co.uk/wp-content/uploads/2025/03/Glastonbury_poster_25.jpg
- Primavera Sound Barcelona, homepage and its lineup image. https://www.primaverasound.com/en/barcelona ; https://assets-img.primaverasound.com/2000x0/psweb/na86z2udintehh099sww_1791387976005.jpg
- Lollapalooza, homepage and lineup. https://www.lollapalooza.com/ ; https://www.lollapalooza.com/lineup ; admat: https://cdn.prod.website-files.com/67c1632e86f99390b0516b6d/6a677c24393d3f79e3177118_LOL26_Admat-ByDay-07.24-WEB.webp
- Roskilde Festival, homepage and line-up. https://www.roskilde-festival.dk/en ; https://www.roskilde-festival.dk/en/line-up
- UNTOLD, homepage and artists. https://untold.com/ro ; https://untold.com/ro/artists
- Electric Castle, homepage and previous editions. https://electriccastle.ro/ ; https://electriccastle.ro/previous-editions
- Treefort Music Fest, homepage and lineup. https://treefortmusicfest.com/ ; https://treefortmusicfest.com/lineup/

Standards and platform rules:

- W3C, "Understanding Success Criterion 1.1.1: Non-text Content", WCAG 2.2. https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html (re-checked)
- Chrome for Developers, "Autoplay policy in Chrome". https://developer.chrome.com/blog/autoplay (re-checked)
- web.dev, "Largest Contentful Paint (LCP)". https://web.dev/articles/lcp (re-checked)
- Bundlephobia, package size of three@0.170.0 and @react-three/fiber@8.17.10 (the React 18 line; the React 19 line, v9, wasn't measured). https://bundlephobia.com/api/size?package=three@0.170.0 ; https://bundlephobia.com/api/size?package=@react-three/fiber@8.17.10 (three re-checked)

Buyer-side evidence:

- "Coachella's Radius Clause Details Exposed In Legal Fight With Oregon Festival", Stereogum (Billboard/Amplify), 20 June 2018. https://stereogum.com/2002754/coachellas-radius-clause-details-exposed-in-legal-fight-with-oregon-festival/news (re-checked)
- "Soul'd Out Festival's Lawsuit Against Coachella Has Been Dismissed", Willamette Week, 13 March 2019 (date from the URL). https://www.wweek.com/music/2019/03/13/sould-out-festivals-lawsuit-against-coachella-has-been-dismissed/ (re-checked)
- "Coachella Radius Clause Dismissal Reversed by U.S. Ninth Circuit Court of Appeals", mxdwn, 13 May 2020. https://music.mxdwn.com/2020/05/13/news/coachella-radius-clause-dismissal-reversed-by-u-s-ninth-circuit-court-of-appeals/amp/ (re-checked)
- "Lollapalooza Undergoing Investigation By Illinois Attorney General", NPR The Record, 2010 (date from the URL). https://www.npr.org/sections/therecord/2010/08/04/128982880/lollapalooza-undergoing-investigation-by-illinois-attorneygeneral (re-checked)
- "Circling radius clauses in performance agreements", Gowling WLG, 13 March 2024. https://gowlingwlg.com/en/insights-resources/articles/2024/circling-radius-clauses-in-performance-agreements (re-checked)
- "Festivus For The Rest Of Us: Festival Agents On The 2025 Season (Survey)", Pollstar, Sarah Pittman, 4 April 2025. https://news.pollstar.com/2025/04/04/music-agents-survey-festival-season-2025/ (re-checked)
- "Who Booked Europe's Summer Festivals?", ROSTR with IQ Magazine, 2023. https://hq.rostr.cc/reports/who-booked-europes-festivals-2023 (re-checked)
- "Top Booking Agents On Double-Weekend Festivals: 'It's Bad' For Young Bands", Billboard, undated. https://www.billboard.com/?p=6320109 (re-checked)
- "How commercial music festivals balance their budgets", Culture.Case (King's College London), 23 February 2017, summarising Hiller, "The importance of quality: How music festivals achieved commercial success", *Journal of Cultural Economics* 40(3), 2016. https://culturecase.kdl.kcl.ac.uk/research/2017/02/how-commercial-music-festivals-balance-their-budgets?format=pdf (re-checked)
- "Don't Believe the Headlines. Music Festivals Aren't All the Same.", Chris Dalla Riva, *Can't Get Much Higher*, 29 February 2024. https://cantgetmuchhigher.com/p/dont-believe-the-hype-music-festivals (re-checked)
- Setline, festival season 2026 insights (living report, as of 16 October 2026). https://setlineapp.com/insights/festival-season-2026 (re-checked)
- "Weekender Encore: Blood, Sweat, Tears and Passion – Creating the BottleRock Lineup", Napa Valley Focus, undated. https://napavalleyfocus.substack.com/p/weekender-encore-blood-sweat-tears (re-checked)
- Chicago Sun-Times on Lollapalooza 2019's Chicago acts, via PressReader, 1 August 2019 (date from the URL). https://www.pressreader.com/usa/chicago-sun-times/20190801/281509342798257 (re-checked)
- "Only 3.44% of the Artists Playing Austin City Limits Fest (ACL Fest) Are From Austin", Saving Country Music, 4 May 2017. https://savingcountrymusic.com/only-3-44-of-the-artists-playing-austin-city-limits-fest-acl-fest-are-from-austin/ (re-checked)
- "Ticketmaster report reveals festival boost for new artists", Music Week, undated. https://prod.musicweek.com/live/read/ticketmaster-report-reveals-festival-boost-for-new-artists/077617 (re-checked)
- "20 Independent UK Festivals Canceled, Postponed, Closed In 2026", Pollstar, Gideon Gottfried, 10 June 2026. https://news.pollstar.com/2026/06/10/20-independent-uk-festivals-canceled-postponed-closed-in-2026/ (re-checked)
- "2025 loses its first festival", Association of Independent Festivals, 16 January 2025. https://www.aiforg.com/blog-database/2025-loses-its-first-festival (re-checked)
- "WOMAD Glasgow 2026 cancelled over low ticket sales", NME, Liberty Dunworth, 3 June 2026. https://www.nme.com/news/music/womad-glasgow-2026-cancelled-over-low-ticket-sales-after-year-off-3948981 (re-checked)
- "Groovin the Moo forced to cancel 2024 regional tour", The Canberra Times (AAP), 14 February 2024. https://www.canberratimes.com.au/story/8521815/groovin-the-moo-forced-to-cancel-2024-regional-tour/ (re-checked)
- "Boston Calling's future in doubt as organizers remain silent", Axios Boston, Mike Deehan, 14 October 2026. https://www.axios.com/local/boston/2026/10/14/will-boston-calling-return-2027 (re-checked)
- Creative Australia, *Soundcheck: Insights into Australia's music festival sector*, 2024. https://artsnorthernrivers.com.au/wp-content/uploads/2024/04/CA_302847_Music-Festivals-Report.pdf (re-checked)
- AEG Live, Talent Buyer job posting, posted 5 October 2026. https://www.entertainmentcareers.net/aeg-live/talent-buyer/job/533421/ (re-checked)
- Goldenvoice, Talent Buyer job posting. https://www.entertainmentcareers.net/goldenvoice/talent-buyer/job/523683/
- Insomniac, Talent Buyer job posting (removed 12 August 2024). https://www.entertainmentcareers.net/livenation/talent-buyer/job/440911/
- "Size Matters: Inside the Politics of Festival Posters", The Ringer, Ben Lindbergh, 15 April 2022. https://www.theringer.com/music/2022/4/15/23026326/festival-font-size-coachella-poster-joyner-lucas (re-checked)
- "FestTalks: The Art of Data in the Festival Industry with Lise Brende of Danny Wimmer Presents", FestForums, Charlotte Ege, 7 October 2024. https://festforums.com/blogs/festtalks-the-art-of-data-in-the-festival-industry-with-lise-brende-of-danny-wimmer-presents (re-checked)
- "Q&A: Scott Ziel on the Art of the Summerfest Lineup", Milwaukee Magazine, 11 June 2025. https://www.milwaukeemag.com/scott-ziel-on-the-art-of-the-summerfest-lineup (re-checked)
- UK Festival Market Report 2022 (UKFA). https://www.festivalinsights.com/wp-content/uploads/UKFA_MarketReport_2022.pdf (re-checked)
- "Festival character trumps headline acts says AIF research", Access All Areas, 27 April 2015. https://accessaa.co.uk/festival-character-trumps-headline-acts-says-aif-research/ (re-checked)
- Lollapalooza 2022 economic impact study, AngelouEconomics. https://angeloueconomics.com/wp-content/uploads/2023/04/AE-Lollapalooza-2022-EIS.pdf
- ACL Music Festival 2023 economic impact report. https://austinparks.org/wp-content/uploads/2024/03/ACL-2023-Econ-Impact.pdf
