# Legacy Prestige Plus — public Table B production release gate

## Required experience
Keep the existing production calculator URL. Anyone who can open the calculator can enter age, sex, insured amount and 10/15/20 Pay and see Table A plus **automatic** Table B results without login, code, QR, or special link. PDF previews may use the same computed values.

## Implemented in isolated QA branch
- The existing `/api/legacy-prestige-rpu` supports a separately enabled public calculation path; it is **OFF by default**. Neither the `selfTest=1` privileged endpoint nor other dashboard routes become public.
- **Both** server-only environment switches must equal `true` to activate the new path: `LEGACY_PUBLIC_TABLE_B_ENABLED` and `LEGACY_SOURCE_USE_APPROVED`. Do not configure the latter until documentary approval of the specific data and redistribution scope is in hand.
- The public response only returns calculated, validated per-case CV/RPU outputs, not raw factor arrays or environment values. However, repeated requests with many input combinations can reconstruct manual-derived factors. A bare calculator with no login or visitor restrictions **cannot** keep derived factor values confidential from an adversarial caller.
- The exact-case private iPOS+ screenshot value overlays are deliberately **excluded** from public mode. Confirm public Table B completeness with authoritative releasable source data; missing cells remain `—`, not estimates or zero.
- The historical access-code and authorized-link paths are untouched for isolated QA/administrative use. The existing Production app is untouched.

## Must pass before public production
1. Obtain explicit written approval from the owner of the source material/insurer for public, unauthenticated access to the calculated outcomes and downloading the report; confirm whether the word `internal QA` must remain and whether output can be used in sales.
2. Confirm all 10/15/20 Pay × male/female × ages and allowed sums use authorized, verified factors. Resolve RPU ambiguity for 206 positions, or continue to show `—`. No invented CV/RPU.
3. Set up enforceable **server-side** IP/edge rate limits, abuse detection and a clear privacy and access policy on the public endpoint. Browser-only limits are not security measures.
4. Deploy narrowly scoped changes to a private staging environment with production-like data. Test unauthenticated Table B calls, 400 invalid cases, 503 missing factors, authenticated-only selfTest and PDF A4/download and responsive preview.
5. Review a minimal, non-destructive integration plan. **Do not merge the QA branch wholesale into `main`**; unrelated QA changes and private data references may be present.
6. Only after signoff, configure secrets and switches on Production and run an anonymous smoke test with the existing calculator URL. Keep a rollback ready: set `LEGACY_PUBLIC_TABLE_B_ENABLED=false` and redeploy to disable public access.

## Warning
A public no-login API and secrecy of proprietary derived tables are inherently in tension. If rights do not permit public derived output, then this user experience cannot be released using that data source. No API mechanism changes that license boundary.
