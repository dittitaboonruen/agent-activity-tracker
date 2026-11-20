# Legacy Prestige Plus — Calculator-only access (20 Nov 2026)

## Goal
Give authorized Royal Partners calculator users access to Table B (CV/RPU) without authenticating to the separate Agent Activity Tracker Dashboard. Do **not** expose restricted raw manual factors or broaden the other dashboard APIs.

## Implemented
- `lib/insurance/legacy-prestige-plus/calculator-access.ts`: private high-entropy code checked against server-side SHA-256; time-limited signed HttpOnly, Secure, SameSite=Strict, __Host- cookie using a separate HMAC secret. No code stored in the browser or repository.
- `app/api/legacy-prestige-access/route.ts`: same-origin, JSON-only POST accepts the access code and issues only a calculator cookie. No dashboard session or role grants.
- `app/api/legacy-prestige-rpu/route.ts`: normal calculation accepts only a valid calculator cookie **or** the pre-existing Supabase authenticated role. Privileged `selfTest=1` is still restricted to active Supabase admin/training and does not recognize the calculator cookie.
- `middleware.ts`: only the exact two calculator API endpoints are skipped past dashboard middleware to let them apply their own access guards. Other routes and dashboard policies remain unchanged.
- Public calculator HTML: prompts for a calculator-specific passcode if its Table B endpoint returns 401; sends it to the same-origin access endpoint, clears input, retries exact-case Table B.
- `package.json`: Vercel Build runs separate access-security static tests before the existing encrypted-factor/72-case integrity gate.

## Secret scope
Two new encrypted Vercel **Preview only** variables on `feature/legacy-prestige-main-only-qa`:
- `LEGACY_CALCULATOR_CODE_SHA256`
- `LEGACY_CALCULATOR_COOKIE_SECRET`

Do not commit secret values or display the HMAC secret. The 24-hour access code is an internal shared QA credential; rotate or replace with per-agent access grants before a broad deployment. Adding a new Preview branch does not inherit restricted factor variables automatically, and encrypted secret values must not be copied from truncated API representations.

## Build QA evidence
Commit `1a13ccf221c12d07e38436a4c9d5cfee1e62287e` deployed READY as `dpl_8KFajgPWXS7DLeuw7o9hfc6Lbdss`.
- Calculator access static tests: **4 pass, 0 fail**.
- Factor integrity: **6/6 groups PASS**.
- Real encrypted source Table B calculation: **72/72 cases PASS**.
- Next.js build and Vercel deployment: **READY**.

## Pending / release decision
- Actual browser code-entry → cookie → CV/RPU Table B HTTP 200 and UI values is **NOT YET VERIFIED**; protected Vercel Preview requires authorized browser.
- Negative cases for no code / bad code / expired cookie / selfTest privilege should be exercised over live HTTP with test accounts before production.
- PDF, regressions on current main and source/manual redistribution permissions remain separate release gates. Production `main` has not been modified.
