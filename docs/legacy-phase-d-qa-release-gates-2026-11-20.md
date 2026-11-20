# AIA Legacy Prestige Plus (New) — Phase D QA report (20 Nov 2026)

## Scope
**Internal QA branch only**: `feature/legacy-prestige-main-only-qa`. Production unchanged. Not an AIA-approved sales quotation; insurer source data remain restricted.

## Completed checks

1. **Input changes and isolation:** simulated browser loader switched male/female, issue ages 40/41, insured amounts 10m/15m/20m, and 10/15/20-year premium terms. Verified 6 distinct exact-case API requests, age-to-policy-year mapping, caching isolation, no reuse of previous case.
2. **Access/error:** simulated 401 and 503 fail closed without fabricated results or cross-case fallback. Separate hardened calculator-code flow and Supabase backend controls remain active.
3. **CV/RPU source integrity:** all 6 groups × CV and RPU = 12 encrypted arrays match audited SHA fingerprints. RPU ambiguous positions remain masked; no factor arrays exposed to client.
4. **Published-factor behavior:** 72 exact-input Table B cases check ages, policy years, amounts at 10m/15m/20m and missing-value masks.
5. **iPOS+ evidence:** female issue35/15 Pay/10m age70–98 (29 points), male issue40/10 Pay/10m age75–98 (24 points) exactly match their previously captured private references and published year35 donor factors; no implied approval for other case combinations.
6. **Dynamic CV research:** audit across all six groups: 11,480 two-donor agreeing research candidates, 784 contradictory sources, 216 unsupported-cohort cases. Research candidates are **NOT** exported as surrender amounts or inserted in PDF.
7. **PDF report data path:** evaluated real `buildLegacyReportHTML` with synthetic verified server rows, requiring exactly three pages; checked exact age/term/sum mapping, CV/RPU figures, missing dashes and no previous-case data after changing inputs. Current PDF-generator guards use the exact case key and require Table B data.
8. **Original regression suite:** all six legacy regression modules included in mandatory QA build (premium rates, brochure examples, female and male Table B, secure loading, retry and concurrency); retired stale assertions updated to current UI behavior without relaxing financial/permission protections.
9. **Automated tests:** mandatory first suite **19/19 passed** and original Legacy suite **29/29 passed**. Secure factor/build integrity gate also passed.
10. **Change isolation:** diff against prior verified QA commit `36fa7e1` changes only test files and package build script, no calculation API, UI or PDF production modules.

## Coverage and remaining limitations

**Automated Phase D checks PASS.** This is *not* certification of the entire product. The following remain independently BLOCKED:

- Generic cash surrender values for unprinted policy years 36+ for different issue ages, sexes, payment terms, or insured amounts are **not externally verified**. Require multiple independent iPOS+ exports; cannot assume attained-age year-35 donor rule is universally correct.
- Research factor conflicts (784 candidate positions) require source confirmation rather than majority-vote or interpolation; unresolved RPU second segment affects 206 source cells.
- Browser-real-device visual QA and physical PDF raster/print layout were **not executed** in this automated stage. The report HTML generation and content data path were tested, but rendering parity requires authorized browser-based inspection.
- Insurance company data rights, sales use authorization, compliance review and product-owner approval are outstanding. **Do not merge into `main` or promote to Production.**

## Release controls

1. No unverified research result may populate `surrender` or `paidUp`; missing values show `—`.
2. Exact-case private screenshot overlays apply only when gender, issue age, payment term and sum assured all match.
3. No calculator code, raw internal insurer factor, or screenshot dataset may be committed to GitHub.
4. Production release remains blocked until source verification, browser/PDF acceptance and rights clearance.

## Next user-provided evidence (for full product completeness)

Obtain iPOS+ CV for matched insured age/term/sum grid across remaining male/female 10/15/20 Pay combinations, **plus an independent issue age and sum assured** to test the generalization and scaling rules. Then perform targeted correction and rerun all 48 automatic tests and 72 amount scenarios. Also obtain documented AIA commercial use permission before any release.
