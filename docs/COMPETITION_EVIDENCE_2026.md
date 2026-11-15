# 2026 competitor evidence: requested Space Apps teams

**Checked:** 2026-11-15. This is a bounded public-source review, not a judging prediction. Team claims are reported as published claims; no competitor application was installed or tested.

## Scope and source access

Requested team records:

- [the-102-spectrum team page](https://www.spaceappschallenge.org/2026/find-a-team/the-102-spectrum/)
- [aeroinformagicos team page](https://www.spaceappschallenge.org/2026/find-a-team/aeroinformagicos/)
- [2026-astraforge team page](https://www.spaceappschallenge.org/2026/find-a-team/2026-astraforge/)

Direct opens of all three pages failed in the available research interface, and indexed searches for the exact names did not return their page text or a clearly attributable repository/demo. That is a **source access gap**, not evidence that the teams have no project, features, or public material. I therefore cannot responsibly describe or compare their implementations, strengths, overlap, or unknowns beyond noting that the names/pages were requested.

Search indexing did surface an official Space Apps team page named [AstraForge](https://www.spaceappschallenge.org/2026/find-a-team/astraforge2/), and a GitHub topic listing for [Dharsh08-S / AstraForge](https://github.com/topics/webgpu?l=html&o=desc&s=updated) describing a mission-design simulator with spacecraft/rocket options, 65 parameters, live physics feedback, and true-scale 3D. The identifiers do not match `2026-astraforge`; no evidence ties that result to the requested team slug. These are **unattributed leads and self-description only**, excluded from the comparison below. The indexed description was not independently tested.

## What the evidence supports

| Team | Published capability evidence found | Tested capability evidence | Comparison / unknowns |
|---|---|---|---|
| the-102-spectrum | None retrievable under the requested official page or exact-name searches. | None. | No defensible feature overlap, strength, or missing-feature conclusion. Project/demo/repository and challenge selection unknown. |
| aeroinformagicos | None retrievable under the requested official page or exact-name searches. | None. | No defensible feature overlap, strength, or missing-feature conclusion. Project/demo/repository and challenge selection unknown. |
| 2026-astraforge | None attributable to this exact slug. A different AstraForge page/repository lead exists, but identity is unverified. | None. | Do not attribute the other AstraForge project's mission-design claims here. Exact project, overlap, and feature gaps unknown. |

“None retrievable” means evidence was not available from this search route; it does **not** mean the feature is absent. A meaningful direct comparison requires readable project descriptions and preferably linked demos/repositories. No numerical ranking is justified by the evidence.

## Challenge and judging context

The official [2026 Lunar Landing Site Navigator challenge statement](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) asks for an intuitive tool that helps mission planners, educators, and the public compare landing sites and dates, visualize Sun and Earth relative to the local horizon, and assess solar-power potential and direct-to-Earth communication windows. This is the relevant benchmark if these teams selected that challenge; their selection was not verified.

The 2026 [Islamabad Local Event page](https://www.spaceappschallenge.org/2026/local-events/islamabad/) and [Faisalabad Local Event page](https://www.spaceappschallenge.org/2026/local-events/faisalabad/) state the five judging criteria as Impact, Creativity, Validity, Relevance, and Presentation. These are 2026 event pages hosted on the official platform, but local-event content may be organizer-generated; treat them as corroborating current guidance rather than a universal scoring rubric. The 2026 [official event overview](https://www.spaceappschallenge.org/2026/) confirms the event dates, submission process and global judging eligibility, but the page retrieved here did not provide criterion weights or a central detailed judging rubric. I found no verifiable 2026 weights. The official [2025 judging guidelines PDF](https://spaceapps-v2-staging.s3.amazonaws.com/media/documents/Final_Space_Apps_2025_Judging_Guidelines_for_web.pdf) describes holistic 1–5 scoring across five criteria and does not mandate equal 20% weights; that is historical guidance only and cannot establish the 2026 process. Do not pass 2025 criteria, weights, or Global Award categories off as 2026 judging guidance.

## Project comparison boundary

The current project has documented overlap with the challenge's broad problem statement: it visualizes horizon-relative Sun/Earth behavior and compares candidate position, arrival date, and observer height. Its actual engine tests a finite Shackleton grid and returns tested-candidate Pareto options. Those facts come from the local project records (`PROJECT_CONTEXT.md`, `docs/DATA_AND_METHODS.md`), not competitor evidence. They do not establish an advantage over these three teams because their project evidence could not be retrieved. Likewise, no absent feature can be assigned to them.

Existing records also constrain claims about this project: one NASA-derived Shackleton region, 25 positions and six separately baked heights; unresolved 30 km horizon convergence; illustrative energy/hardware assumptions; Earth-centre visibility rather than an RF/DSN link; exact solver controls app decisions, while the trained surrogate remains research-only. Avoid claims of global optimum, mission survival, uniqueness, comparative superiority, or likely award outcome.

## Sources and retrieval record

- Official challenge: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/
- Requested team pages: URLs listed above; direct-open attempts returned inaccessible, with no useful exact-name indexed snippets.
- Official platform 2026 event overview: https://www.spaceappschallenge.org/2026/
- 2026 local criteria corroboration: https://www.spaceappschallenge.org/2026/local-events/islamabad/ and https://www.spaceappschallenge.org/2026/local-events/faisalabad/
- Historical comparison only, 2025 official judging guidelines: https://spaceapps-v2-staging.s3.amazonaws.com/media/documents/Final_Space_Apps_2025_Judging_Guidelines_for_web.pdf
- Unmatched AstraForge lead (not attributed): https://www.spaceappschallenge.org/2026/find-a-team/astraforge2/ and https://github.com/topics/webgpu?l=html&o=desc&s=updated

No teams were contacted. No live demos or repositories were successfully tied to the three requested identifiers or tested.


## Verified public benchmark refresh (same review)

Requested team comparison remains unknown. A manual browser fallback was attempted: browser host unavailable; native Brave repeatedly detected user input before competitor navigation, so no competitor rendering was claimed. User has no additional project links; discovery remains agent-owned, not a user blocker.

The published https://github.com/RootVandal/lunar-ops README describes six-site comparison,2027-2028 hourly search, smallest-change repairs, dispersion robustness and comparisons with JPL Horizons/GSFC. It explicitly says it is NOT a hackathon submission. These are author claims, not independently executed results. Compared with those published capabilities, our one-region/30-arrival study and unresolved independent validation are behind; Rust/WASM or a repair solver alone cannot establish novelty. Do not count this project as an entered competitor.

NASA Moon Trek's own about page https://trek.nasa.gov/moon/jpl/config/textAbout.html describes3D, imagery layering, metadata, slope and lighting tools. NASA GRC catalog https://software.nasa.gov/software/LEW-20529-1 describes LOLA terrain-mask illumination/communication analysis. These establish existing functionality, not a direct benchmark of our browser performance or scientific errors. Our defensible goal is a clearer, reproducible constrained-decision experience with evidence, rather than claiming to invent lunar mapping or horizon analysis.
