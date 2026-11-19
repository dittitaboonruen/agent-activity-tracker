# Legacy Prestige Plus (New) — CV/RPU Factor QA checkpoint (19 Nov 2026)

**Scope: INTERNAL QA ONLY. NOT a customer illustration or permission to distribute AIA manual data.** Do not merge this Legacy PR to production without written rights/compliance approval and product-value acceptance.

## Source of truth / evidence
- Source: user-provided `Manual_AIA+Legacy+Prestige+Plus+(New)_20250220(2).pdf`, 29 pages, SHA-256 `85e06c46ed2530e1f45f702291dd77c66601e8b487d23923c10ddc8462494332`.
- CV: 10 Pay male p7 / female p8; 15 Pay male p11 / female p12; 20 Pay male p17 / female p18.
- RPU: 10 Pay male/female p10 (left/right); 15 Pay male p15 / female p16; 20 Pay male p21 / female p22.
- Two independent native-text engines (PyMuPDF and pdfplumber/pdfminer) agreed across **22,344 source table cells** (21,948 populated primary numeric factor cells, 396 blank CV cells). No OCR, extrapolation, or guessed values were used.
- There are **854 literal zero primary-factor cells** (427 CV and 427 RPU). These must display as 0, not as an unavailable dash; the server calculation preserves `>=0` while absent year factor remains null.
- Every table has 76 issue-age rows. CV 35 columns (trailing blanks after attained age limits); RPU 9/14/19 columns for 10/15/20 Pay.
- A second numerical segment occurs in each RPU display cell; **206 cells have a nonzero second segment** (male/female: 10 Pay 10/5, 15 Pay 33/23, 20 Pay 77/58). This segment was preserved in the offline audit but is NOT represented by the current RPU server factor rows. Its contractual interpretation MUST be confirmed with AIA prior to CV/RPU sign-off.
- The branch API compares SHA-256 of `JSON.stringify` of 12 decoded primary-factor arrays against this manual-derived manifest and fails closed on mismatches; hashes only are in source control, NOT proprietary raw factors.
- The branch API also **suppresses RPU output (returns an unavailable value, not 0)** at the 206 ambiguous positions until AIA clarifies the second numeric segment. This is a QA safeguard; it is not a replacement for AIA approval.
- Verify that all configured Preview encrypted env values actually match hashes using an authenticated runtime test. Presence of env variables is not proof of a match.

## Data handling / security
- Factor values must remain in branch-scoped Preview encrypted Vercel environment variables or approved private database/service (not `public/`, browser bundle, PR attachments or ordinary Github repo files).
- Existing server route `/api/legacy-prestige-rpu` uses Supabase `getUser`, active profile, admin/manager/training role checks, `no-store`, exact-case input validation and fail-closed output.
- Do not promote Preview configuration to Production until business/compliance review permits it.
- Avoid exporting full tables in reports, error logs, test fixtures, or any artifacts.

## Audit coverage

| Pay | Gender | CV: populated + blank | RPU primary values | RPU cells with nonzero second segment |
|---|---|---:|---:|---:|
| 10 | M | 2,594 + 66 | 684 | 10 |
| 10 | F | 2,594 + 66 | 684 | 5 |
| 15 | M | 2,594 + 66 | 1,064 | 33 |
| 15 | F | 2,594 + 66 | 1,064 | 23 |
| 20 | M | 2,594 + 66 | 1,444 | 77 |
| 20 | F | 2,594 + 66 | 1,444 | 58 |

## Release gates (must all pass)

- [x] Source 12 primary numeric tables captured and cross-read cell-by-cell; 396 blanks preserved.
- [x] Restricted factors are NOT added to this branch commit; integrity hashes are committed in the protected server API.
- [x] Unsupported-case regression test updated for the actual internal-QA warning.
- [ ] **Verify 12 stored Preview arrays match SHA-256 manifest at runtime**; otherwise API should return 503, not estimates.
- [ ] Investigate the RPU second numerical segment in 206 cells with the AIA owner before using these values commercially.
- [ ] Independently match representative 10/15/20 Pay male & female CV/RPU outputs with AIA iPOS+ for required issue ages/terms/years; especially female 10/15 Pay.
- [ ] Perform authenticated/unauthorized access negative tests and production-like Preview browser/PDF QA.
- [ ] Written AIA permission / product-owner acceptance for use and distribution.
- [ ] Rebase/reconcile the heavily diverged Legacy feature branch with latest main and run cross-product regression.

**Status: SOURCE TEXT EXTRACTION PASS; STORED FACTOR PARITY NOT YET CONFIRMED; PRODUCT/COMPLIANCE APPROVAL BLOCKED. NO PRODUCTION RELEASE.**


## Table B automatic calculation / recovery — QA checkpoint (19 Nov 2026)

**User requirement:** Automatically calculate CV/RPU on input change from the previously extracted source, without manual factor uploads and without relying on the protected Preview UI.

**Verified code path:** `viewLegacyPrestige()` calls `loadLegacyTableB(age,gender,sum,term)` when the base contract is valid. The client calls `GET /api/legacy-prestige-rpu` for an exact four-part case; the server requires an authenticated, active `admin/manager/training` user, validates the factor integrity manifest, and refuses to manufacture missing values.

**Identified usability bug:** Previous failed cases were retained indefinitely in `LEGACY_TABLE_B_ERRORS`, blocking further requests after an initial 401/403/503. The client now records error age, permits a cooled-down retry, and automatically performs **one bounded delayed retry** after a transient 503/network error. Reopening Table B also triggers a fresh exact-case request after the cooldown. Permanent authorization failures remain blocked; no security rules are bypassed.

**Evidence:** Commit `26e6fab` fixes bounded automatic retry; commit `882302d` updates the regression. Isolated behavior QA simulated 503 followed by a valid 200 response for female age 35 / sum 15m / 20 Pay, returning policy-year-2 CV 105,000 and RPU 630,000, with **exactly two network attempts** and no manual click. Values in this test are fixtures, **not independent evidence of the deployed insurer factor arrays**.

**Runtime inspection:** Branch-scoped encrypted Preview factor configuration contains three named variables (male CV, male RPU, female binary). This only establishes names and scope, not values, digest integrity, or success through the protected API. Unauthenticated access to the Preview deployment remains blocked; secure authenticated live Table B calculation is **NOT VERIFIED**.

**Release gate:** Do not merge the heavily divergent PR directly into main or deploy proprietary/manual data in public assets. Keep changes isolated until factor runtime parity, authenticated integration QA, and branch reconciliation are complete.
