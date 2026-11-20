# Legacy Prestige Plus — STEP 1: Table B QA (2026-11-20)

## Result — PARTIAL PASS / AUTHENTICATED LIVE QA PENDING

Evidence build: Vercel Preview deployment `dpl_G3zVLXG6aiLphuMa8iXydhihrZDR`; commit `989bcaf48a28b80fe11b55b59abf108f3eb125a1`; deployment READY.

### Verified on actual encrypted Preview factors during Vercel build
- 6/6 source groups passed SHA-256 verification (10/15/20 Pay × male/female), covering 12 CV/RPU arrays.
- 72/72 exact-input calculation cases passed: ages 0, 35, 60, 75 × insured sums 10m, 15m, 20m THB × 6 term/gender groups.
- Checked policy-year/attained-age row lengths and mapping through age 98; independent expectation for each displayed amount from the verified factor, with exact rounding rules.
- Confirmed CV and RPU display logic retains known zero as zero; unavailable years remain null; all flagged uncertain second-segment RPU positions are masked rather than assigned invented benefits.
- No factor values, raw arrays, or SHA-256 digests were printed to build logs or committed.
- The automated 72-case test was added to `scripts/legacy-factor-build-qa.mjs`; the secret-backed build was automatically blocked on any failed check.

### Not yet verified
- The Vercel deployment requires deployment authentication before a request reaches the app.
- No authenticated account session was available for a real GET `/api/legacy-prestige-rpu?age=35&gender=M&sum=15000000&term=20` in the deployed environment.
- Therefore 200/401/403 from the **live** endpoint, UI switch/rerender behavior against that endpoint, and rendered Table B in the actual browser remain NOT VERIFIED.
- A 72-case private build-stage calculation verification is not equivalent to an authenticated live HTTP API/browser QA.
- STEP 2 PDF preview/export and STEP 3 main integration have not been executed as part of this checkpoint.

### Next
Obtain an authenticated QA session through an approved existing login flow on the protected Preview deployment, compare responses to the verified build-stage results, and perform Table B UI switch and auth negative cases. Do not disable security controls or merge directly from the heavily diverged PR #13.


## Authenticated live check attempt — 20 Nov 2026

- Tested URL: the READY Preview build at commit `989bcaf48a28b80fe11b55b59abf108f3eb125a1`, exact API endpoint `/api/legacy-prestige-rpu?age=35&gender=M&sum=15000000&term=20`.
- Result: Vercel access returned `401 deployment_authentication_required` at `fetch_deployment`, even after an attempted temporary deployment share-link access. The request did not reach the Supabase-authenticated API; this result does not establish API 401 or Factor 503.
- User's connected browser has Production and Vercel tabs but no Legacy Preview tab with an authorized session.
- Middleware and API code review confirms the route `/api/legacy-prestige-rpu` is subject to authenticated user role checks; API itself restricts to active admin, manager, training; selfTest is active admin/training only.
- Magic-link preview callback is scoped to the specific deployment hostname and restricted legacy return path. A real browser session is needed to verify Supabase callback/cookie behavior.
- **Decision:** Do not weaken deployment protection, bypass session checks, use a service-role token, or claim live-HTTP PASS. The next QA action requires the authorized user to open the protected Preview deployment through their authenticated browser.
