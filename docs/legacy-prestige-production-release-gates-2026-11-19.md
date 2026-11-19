# Legacy Prestige Plus — controlled integration and release gate (2026-11-19)

## Baseline and scope
- Base Production `main` at `ed62fc8ad5e40d8c93a417453efd8e9d794436fd`.
- Source QA PR #13: `feature/legacy-prestige-main-only-qa`, latest reviewed `ade9b6f416436a54486a86bb775196f58a0e869c`.
- The old feature branch is heavily divergent (136 commits ahead / 38 behind compared to current main); do not merge the whole branch.
- Keep existing insurance calculations, customer data, authentication, permissions and PDF systems unchanged until scoped integration is reviewed.

## Observed results
- Existing legacy branch Vercel build: READY.
- `/api/legacy-prestige-rpu?selfTest=1` exists only in the isolated Legacy branch; requires active admin/training user.
- Simulated API behavior/security cases pass. These do NOT establish that encrypted runtime factors are correct.
- Live endpoint on protected deployment cannot be queried without valid deployment and application authentication.
- Six groups / twelve primary factor arrays: authenticated runtime digest comparison remains NOT VERIFIED.
- Legacy source manual data is restricted; do not embed raw factors or factor arrays in public client files.

## Required release gates (all must be actual PASS)
1. Securely execute server-side self-test with authorized authentication and record only status `PASS` for all six groups (10/15/20 Pay × M/F). Return `503` on any mismatched/missing factor.
2. Verify live Table B values for known exact-case fixtures, and switch gender/age/sum/term to prove automatic refresh. Missing values remain unavailable, not fabricated.
3. Verify at least one actual A4 PDF contains the same CV/RPU as the live Table B response, without clipping or silent truncation.
4. Port only Legacy-specific code from the old QA branch to a current-main integration branch; run syntax/build and cross-product regression; compare current main for unrelated changes.
5. Preserve active account/role checks, private server factor storage, and non-distribution of restricted raw source data.
6. Merge only after these technical gates have verified evidence; merely authorizing a release does not mark a missing runtime test as PASS.

## Current decision
**NO-GO pending gate 1.** Production must remain untouched until secure runtime factors are verified. The branch is a controlled integration starting point, not a release candidate.
