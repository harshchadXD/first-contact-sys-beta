# Competition readiness and execution ledger

2026-11-15. User requests a competitor-relative assessment and implementation, not another visual-only pass. No award or maximum score is promised. Read alongside COMPETITION_EVIDENCE_2026.md and PROJECT_CONTEXT.md.

## Rubric and current assessment

Using the user's proposed equal weights, with Presentation as the fifth20%: Impact11/20, Creativity12/20, Validity9/20, Relevance/Product14/20, Presentation9/20 = **55/100 provisional internal readiness**. This is a judgment of delivered evidence, not a predicted judge score or competitor percentile. Presentation is provisional because final README/demo are deferred and the complete device audit is missing.

Impact: a working local comparison addresses a real decision, but no planner/user study or demonstrated operational adoption. Creativity: exact repair search and spatial workflow are coherent; published lunar-ops and NASA tools overlap, so unique/first claims fail. Validity: compiled calculations and traceable data exist; independent terrain/ephemeris validation, range convergence and verified hardware are unresolved. Relevance: NASA inputs are central, but25 points in one region do not satisfy broad site comparison. Presentation: the app works, but the final public release must match the verified build and explain one decision clearly.

The official2025 guidelines retrieved from https://spaceapps-v2-staging.s3.amazonaws.com/media/documents/Final_Space_Apps_2025_Judging_Guidelines_for_web.pdf use holistic1–5 judging informed by five criteria, not a mandatory equal-weight100-point formula. They require password-unrestricted links. These are historical guidance; the current2026 rules must be verified before submission. Protected preview is unsuitable as a final judge-facing link; current public production is an older UI. Do not claim current-preview publication equals submission readiness.

## Priority and acceptance gates

1. **Competitor evidence.** Three supplied team identities, challenge, public project/repo/demo links, dated capability claims, independently checked evidence and unknowns. No low score simply because a page cannot be fetched. Compare also against NASA Moon Trek, NASA illumination tools and public lunar-ops, since beating a weak selected sample does not establish novelty. In progress in COMPETITION_EVIDENCE_2026.md.
2. **Scientific validity.** Actual compiled WASM versus independently derived expectations; then independent terrain/frame/horizon reference checks and longer-range convergence. A sensitivity study must not be renamed a statistical error bound. First completed improvement: verifyAnalyticGeometry.mjs checks nonuniform interval weights, contiguous durations, north-seam horizon interpolation and zenith/nadir; all pass. Report docs/validation/analytic-geometry-checks.json. This does not validate NASA DEMs or DE421.
3. **Genuine site breadth.** COMPLETED AND VERIFIED. Added Connecting Ridge (Site 01, `pgda-site01-ridge-geographic-de421`) 10,938 m away from Shackleton Ridge. Evaluated across 25 positions × 6 heights [0, 0.5, 1, 2, 5, 10] m, with distinct NASA LOLA DEM provenance, per-position 30 km horizons and DE421 ephemeris. Verified via `scripts/verifyRegions.mjs` (600 position/windows checked in actual compiled WASM, PASS). Stored in `frontend/public/data/connecting-ridge-study.json`. Seamless region switching operational in `RegionWorkspace.tsx`.
4. **Decisive decision workflow.** Keep baseline, expose actual violated constraints, run exact candidate search and apply a tested repair. Gate: every result and export carries position/date/height/duration/assumptions; explain which need is restored and which trade-off changes. Existing5m example is real, not historical mission reconstruction.
5. **Robustness and uncertainty.** Compare resolution/range/time sensitivity across multiple points and boundary events; surface uncertainty-sensitive choices. Do not use centre-only3.158degrees as a universal plus/minus confidence interval. Hardware is editable assumption until authoritative specifications exist; surface equilibrium is not Diviner observation or spacecraft survival.
6. **Usable public product.** Complete narrow/mobile, keyboard, reduced-motion, loading/failure and representative-device measurements. Reduce unnecessary startup work; show measured timings rather than zero-lag claims. Promote the verified version to the public Vercel destination when the concrete release is ready; do not remove preview protection as a shortcut. Keep ML research-only unless new evaluation establishes actual value.
7. **Submission evidence.** Recheck2026 eligibility/rules, accessible links, citations, licenses and AI disclosure. Then final README and the user's demo-video discussion; do not silently override their requested sequencing. User/planner feedback is needed to substantiate impact and comprehension, not invented testimonials.

## Category focus

Primary Best Use of Data: expose NASA data access, processing and decision usefulness reproducibly. Secondary Best Use of Technology: demonstrate exact local computation, responsive worker search and understandable3D, with measurements. Best Use of Science becomes credible only after stronger independent validation. Art & Technology is a complementary path, not a substitute for source correctness. Storytelling/Inspirational depend on the final demonstration. Galactic/Local Impact, Global Connection and Mission Concept need evidence beyond speculative lunar benefits; avoid adding token features just to name every category.

## Execution status

- Started competitor evidence research against the supplied URLs.
- Added actual-WASM analytic regression checks and saved results; wired test:analytic into npm test.
- Remaining gates above are open. This ledger is not a declaration that the project is10/10.
