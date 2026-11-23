# Legacy Prestige Plus — Passwordless link QA (23 Nov 2026)

## Requested agent workflow
Authorized link → Legacy calculator automatically selected → input sex/age/sum/10–15–20 Pay → automatic Table A and Table B → export PDF. No Supabase Dashboard login and no typed Table B passcode.

## Implemented on QA branch
- `/api/legacy-prestige-link?grant=...` validates a server-signed, time-limited link and exchanges it for the EXISTING signed, HttpOnly 24-hour calculator cookie, then issues a 303 to `/illustrations/royal_partners_illustration_tool.html?plan=legacy`.
- Invalid and expired links return 403 without exposing internal factor data.
- The signer is an offline, authorized internal script `scripts/create-legacy-calculator-link.mjs`; it requires `LEGACY_CALCULATOR_COOKIE_SECRET` and `LEGACY_CALCULATOR_BASE_URL` in an authorized administrator's runtime. Never copy secrets to the frontend, logs, files, or a chat.
- Signed links redeem within 5 minutes. Reuse within that interval is possible: distribute only through a controlled private channel. Signed cookie lasts 24 hours after redemption. Revocation currently requires rotating the cookie secret, which invalidates all calculator sessions.
- `LEGACY_LINK_ACCESS_ENABLED=true` is scoped only to the existing legacy QA Preview branch. Production defaults to disabled. Even if enabled later, production also requires `LEGACY_SOURCE_USE_APPROVED=true` **only after actual authorization**. Do not set that variable as a substitute for approval.
- Restricted actuarial factors stay server side and the existing `/api/legacy-prestige-rpu` guard is unchanged. The legacy typed-code access endpoint remains temporarily for backward compatibility; signed-link recipients never need it.

## QA/release gates still required
1. Confirm Vercel build READY for latest commit.
2. Run real authorized HTTP link redemption with a private link; assert 303, Secure HttpOnly cookie, URL without grant, exact-case Table B 200 without Supabase session; test invalid and expired grants 403. Preview Vercel Authentication must be handled as a separate protection layer, not disabled just to pass QA.
3. Browser screenshot of 10/15/20 Pay, years 1–20 and gold ▲, Table A/B, PDF pagination, download on iPad/LINE/Safari.
4. Confirm data/manual redistribution clearance with AIA/relevant business owner; internal QA signoff alone does not grant permission for public sales usage.
5. Integrate only narrowly reviewed legacy changes into main. **Never merge diverged QA branch wholesale.**
6. Explicit production release approval, production secret/config review, smoke test and rollback plan.

## Operational note
The five-minute link is suitable for a **controlled pilot**, not an evergreen URL for all agents. A scalable permanent agent portal URL without passcodes requires an approved entitlement mechanism (such as existing agent identity via a verified first-party account or authorized LINE authentication) and a formal source-data distribution policy. Do not make raw factor API publicly callable or embed static access tokens in permanent public links.
