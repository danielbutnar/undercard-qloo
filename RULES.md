# RULES: Qloo Agentic Hackathon
Source: https://qloo.devpost.com/rules, copied 2026-10-14

Lines marked [Website] quote https://qloo.devpost.com/ and lines marked [Dev guide] quote https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide, both copied 2026-10-14. Lines marked [Kit] quote https://github.com/qloo/qloo-hackathon-kit at commit 0db91b8 (2026-09-23), copied 2026-10-15. Where they differ, §11 decides: "If there is any discrepancy or inconsistency between the terms and conditions of the Official Rules and disclosures or other statements contained in any Hackathon materials, including but not limited to the Hackathon Submission form, Hackathon Website, or advertising, the terms and conditions of the Official Rules shall prevail."

## Dates
- Submission deadline: §1 "Registration and Submission Period: September 30, 2026 (9:00 am Eastern Time) – October 30, 2026 (11:45 pm Eastern Time) (“Registration & Submission Period ”)." = 2026-10-31 05:45 Europe/Bucharest
- Judging and winner announcement: §1 "Judging Period: November 2, 2026 (12:00 pm Eastern Time) – November 16, 2026 (11:45 pm Eastern Time) (“Judging Period”)." = 2026-11-02 19:00 to 2026-11-17 06:45 Europe/Bucharest. §1 "Winners Announced: On or around November 23, 2026 (3:00 pm Eastern Time)." = 2026-11-23 22:00 Europe/Bucharest
- After the deadline: §5 "Once the Submission Period has ended, you may not make any changes or alterations to your Submission, but you may continue to update the Project in your Devpost portfolio."

## Eligibility
- §3 The Hackathon IS open to: "Individuals who are at least the age of majority where they reside as of the time of entry (“Eligible Individuals”);"
- §3 The Hackathon IS NOT open to: "Individuals who are residents of, or Organizations domiciled in, a country, state, province or territory where the laws of the United States or local law prohibits participating or receiving a prize in the Hackathon (including, but not limited to, Brazil, Quebec, Russia, Crimea, Cuba, Iran, and North Korea and any other country which is comprehensively sanctioned by the U.S. Treasury’s Office of Foreign Assets Control)". Romania is not on the list.
- §3 "Any other individual or organization whose participation in the Hackathon would create, in the sole discretion of the Sponsor and/or Administrator, a real or apparent conflict of interest"
- §4 Financial or Preferential Support: "A Project must not have been developed, or derived from a Project developed, with financial or preferential support from the Sponsor or Administrator."
- §8 "THE AWARD OF A PRIZE TO A POTENTIAL WINNER IS SUBJECT TO VERIFICATION OF THE IDENTITY, QUALIFICATIONS AND ROLE OF THE POTENTIAL WINNER IN THE CREATION OF THE SUBMISSION."
- §8 "The deadline for returning the Required Forms to the Administrator is ten (10) business days after the Required Forms are sent. Failure to provide correct information on the Required Forms, or other correct information required for the delivery of a Prize, may result in delayed Prize delivery, disqualification of the Entrant, or forfeiture of a Prize."
- §8 "United States residents may be required to provide a completed form W-9 and residents of other countries may be required to provide a completed W-8BEN form."
- Student or academic requirement: Not stated.

## Required parts of a submission
- [ ] §4 "Complete and enter all of the required fields on the “Enter a Submission” page of the Hackathon Website (each a “Submission”) during the Submission Period and follow the requirements below."
- [ ] §4 "Include a Project built with the required developer tools and meets the above Project Requirements."
- [ ] §4 "Provide a link to a functional demo application"
- [ ] §4 "Provide a URL to your public code repository for judging and testing on either GitHub, GitLab or Bitbucket. The repository must contain all necessary source code, assets, and instructions required for the project to be functional. The repository must be public and open source by including an open source license file. This license should be detectable and visible at the top of the repository page (in the About section)."
- [ ] §4 "Include a text description that should explain the features and functionality of your Project."
- [ ] [Website] "Explain the key features and functionality: what the agent or workflow can do, and what makes it "Qloo-powered.""
- [ ] [Website] "Your demo must be hosted and fully published externally, such as a live website or web app, or a hosted APK / TestFlight build. Submissions that only run locally or rely on private access will not qualify."
- [ ] §4 "All Submission materials must be in English or, if not in English, the Entrant must provide an English translation of the demonstration video, text description, and testing instructions as well as all other materials submitted."
- [ ] Demo video: optional. [Website] "NOTE: Demo videos are not required."

## Required technology
- §4 "What to Create: Entrants must create a working software application that integrates the Qloo API and that either (a) functions as an agentic tool, (b) is built using an agent framework, or (c) integrates the Qloo API into an existing agent (each a “Project”)."
- §4 "Entrants will be given access to the Qloo API by filling out the Google Form here: https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide#getting-your-api-key"
- §4 "Use of the developer tools will be subject to the license agreement related thereto."
- §4 "Functionality: The Project must be capable of being successfully installed and running consistently on the platform for which it is intended and must function as depicted in the video and/or expressed in the text description."
- §4 "Platforms: A submitted Project must run on the platform for which it is intended and which is specified in the Submission Requirements."
- [Website] "If your submission would work the same without Qloo, you're building the wrong thing."
- [Dev guide] "Your key is valid only against the hackathon base URL:" https://hackathon.api.qloo.com
- [Dev guide] "Do not use /recommendations or /recs. These are legacy endpoints and are not supported for the hackathon."
- [Dev guide] "Do not store Qloo response data in a public repository — that makes the data publicly accessible outside the terms of your API key."
- [Dev guide] "Keys remain active through the end of the judging period and are deactivated after the hackathon closes."
- Cost of the Qloo API: Not stated. [Dev guide] "Keys are typically issued within a few business days."
- [Kit] docs/API_ACCESS.md: "For the event, the supported surfaces are `qloo explore`, `qloo exec`, `qloo api`, and `qloo mcp` from the public `@qloo/qloo-harness` package." The Dev guide separately documents direct REST calls to https://hackathon.api.qloo.com with the X-Api-Key header, which is what SPEC.md uses (see Unclear 7).
- [Kit] starter/mcp-client/README.md: "A browser cannot start `qloo mcp`. Serverless functions are not a supported route." This is about the kit's MCP server, so the app on Vercel doesn't use it.
- [Kit] The kit has no LICENSE file, so none of its code is copied into this repository; it is used as documentation only.

## Judging
- Stages: §6 "Stage One) The first stage will determine via pass/fail whether the ideas meet a baseline level of viability, in that the Project reasonably fits the theme and reasonably applies the required APIs/SDKs featured in the Hackathon." §6 "Stage Two) All Submissions that pass Stage One will be evaluated in Stage Two based on the following equally weighted criteria (the “Judging Criteria”):"
- Method: §6 "This process may utilize expert panels, peer review, automated AI-driven analysis, or any combination thereof to ensure efficient, fair, and objective evaluation."
- Criteria and weights (§6 "equally weighted", so 25% each):
  - Technological Implementation: 25%. "How thoroughly and skillfully does the project use Qloo? Does the code reflect genuine effort and a working, non-trivial implementation?"
  - Design: 25%. "Does the project deliver a complete, coherent product experience, not just a technical proof of concept?"
  - Potential Impact: 25%. "Does the project make a credible, specific case for solving a real problem for a real audience and does the solution actually address that problem based on what's demonstrated?"
  - Quality of the Idea: 25%. "Is this a creative, non-obvious use of Qloo and does the team demonstrate genuine understanding of the problem space they're working in?"
- Ties: §6 "if two or more Submissions are tied, the tied Submission with the highest score in the first applicable criterion listed above will be considered the higher scoring Submission."
- What judges may rely on: §4 "Judges are not required to test the Project and may choose to judge based solely on the text description, images, and video provided in the Submission."

## Video
- Length limit, language and what it must show: Length limit: Not stated. Language: §4 "the Entrant must provide an English translation of the demonstration video" if not in English. What it must show: Not stated; §4 says the Project "must function as depicted in the video and/or expressed in the text description." [Website] "NOTE: Demo videos are not required. Instead of asking for a recording, we're requiring something judges can actually use."
- AI or text-to-speech narration: Not stated.
- Third-party music or footage in the video: Not stated; the §7 warranty below applies to all submitted content.

## New work, starter kits and third-party code
- §4 "New & Existing: Projects must be either newly created by the Entrant or, if the Entrant’s Project existed prior to the Hackathon Submission Period, must have Qloo 4after the start of the Hackathon Submission Period. Entrants should explain how their Project was significantly updated during the Submission Period." ("Qloo 4after" is garbled in the source; see Unclear.)
- Starter kits: Not stated.
- §4 "An Entrant may submit a Submission that includes the use of open source software or hardware, provided the Entrant complies with applicable open source licenses and, as part of the Submission, creates software that enhances and builds upon the features and functionality included in the underlying open source product."
- §4 "Your Submission must: (a) be your (or your Team, or Organization’s) original work product; (b) be solely owned by you, your Team, your Organization with no other person or entity having any right or interest in it; and (c) not violate the intellectual property rights or other rights including but not limited to copyright, trademark, patent, contract, and/or privacy rights, of any other person or entity."
- §4 "Third Party Integrations: If a Project integrates any third-party SDK, APIs and/or data, Entrant must be authorized to use them in accordance with any terms and conditions or licensing requirements of the tool."
- §7 "By submitting an entry or accepting any prize, entrants represent and warrant that (a) submitted content is not copyrighted, protected by trade secret or otherwise subject to third party intellectual property rights or other proprietary rights, including privacy and publicity rights, unless entrant is the owner of such rights or has permission from their rightful owner to post the content; and (b) the content submitted does not contain any viruses, Trojan horses, worms, spyware or other disabling devices or harmful or malicious code."
- §4 "An Entrant may submit more than one Submission, however, each Submission must be unique and substantially different from each of the Entrant’s other Submissions, as determined by the Sponsor and Devpost in their sole discretion."

## AI use and disclosure
- Using AI tools to build the entry: Not stated.
- Disclosing AI use: Not stated.
- AI models allowed in the product: Not stated.
- §4 "An Entrant may contract with a third party for technical assistance to create the Submission provided the Submission components are solely the Entrant’s work product and the result of the Entrant’s ideas and creativity, and the Entrant owns all rights to them."
- AI in judging: §6 "automated AI-driven analysis" (quoted under Judging).

## Judge access to the demo
- §4 "Access must be provided to an Entrant’s working Project for judging and testing by providing a link to a website, functioning demo, or a test build. If Entrant’s website is private, Entrant must include login credentials in its testing instructions. The Entrant must make the Project available free of charge and without any restriction, for testing, evaluation and use by the Sponsor, Administrator and Judges until the Judging Period ends."
- [Website] "A live, working app participants can try end-to-end. This should demonstrate the core features of your project."
- The demo must stay live until 2026-11-17 06:45 Europe/Bucharest (end of the Judging Period).

## Prizes and tracks
- §8 Prizes: "$15,000 USD", Qty 1, 1st Place; "$6,000 USD", Qty 1, 2nd Place; "$4,000 USD", Qty 1, 3rd Place; Eligible Submissions for each: "All eligible submissions"
- §8 "Each Project is eligible to win one (1) prize."
- §8 "Prizes will be delivered within 60 days of the Sponsor or Devpost’s receipt of the completed Required Forms."
- §8 "Winners (and in the case of Team or Organization, all participating members) are responsible for any fees associated with receiving or using a prize, including but not limited to, wiring fees or currency exchange fees."
- §8 "The Sponsor, Devpost, and/or Prize provider reserves the right to withhold a portion of the prize amount to comply with the tax laws of the United States or other Sponsor jurisdiction, or those of a winner’s jurisdiction."
- Tracks: Not stated. All three prizes are open to every eligible submission.
- [Website] "Entrepreneur extraordinaire JASON CALACANIS -- JCal the Bestie himself -- will personally invest an additional $25,000 into his favorite entry." This is not in the Official Rules.

## Unclear (questions for the organizer)
How to ask: §11 "If at any time prior to the deadline, an Entrant or prospective Entrant believes that any term in the Official Rules is or may be ambiguous, they must submit a written request for clarification." §15 "For questions, send an email to support@devpost.com." The Hackathon Website also links "Questions? Email the hackathon manager".
1. §4 New & Existing says "must have Qloo 4after the start". What is the requirement? Does building on my own public, open-source starter kit (written before September 30) make the Project "existing", and is crediting it in the README enough?
2. §4 refers to "the demonstration video", but the website says demo videos are not required. If I include one, is there a length limit, and is a disclosed AI-generated (text-to-speech) voiceover acceptable?
3. Does §4 "free of charge and without any restriction" allow per-IP rate limits on the demo's AI routes, when judges never hit a login or a paywall?
4. Is the $25,000 Jason Calacanis investment governed by the Official Rules, and on what terms?
5. May the demo show Qloo entity images (properties.image.url) of artists, given §4 Third Party Integrations and the §7 warranty?
6. §4 Platforms points to a platform "specified in the Submission Requirements", but those name none. Does a responsive web app hosted on Vercel qualify?
7. The Qloo Hackathon Kit lists only the `qloo` harness commands as supported surfaces, while the Dev guide documents direct REST calls. Is calling https://hackathon.api.qloo.com directly from Vercel serverless functions acceptable?

Answers from Qloo's hackathon manager, 21 October 2026, as Daniel relayed them: yes to all five questions Daniel asked.
- 2: a disclosed AI voiceover is fine; the manager suggests a video of a couple of minutes at most.
- 3: per-IP limits are fine.
- 5: the app may show Qloo's artist images.
- 7: calling the REST API directly is fine.
- Asked with these, not listed above: buyers may receive drafts made with the hackathon key.
- Not covered by these answers: 1, 4 and 6.
