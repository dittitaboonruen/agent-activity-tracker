# Royal Partner Insurance Calculator — Production Release & Recovery

Release date: 2026-10-20  
Status: **Approved baseline / Production deployment READY at verification**  
Application: https://agent-activity-tracker.vercel.app/agent/calculators  
Repository: dittitaboonruen/agent-activity-tracker  
Production branch: main  
**Approved application baseline commit:** `46fb2db1e4e73226ef921b68a12aa176898a9cf0`  
**Approved deployment ID:** `dpl_239CdV6GNRhEehFmdGGrAwNxBjfy`

> The baseline commit is a version identifier, not a frozen Git tag. This document is intentionally written in a later, documentation-only commit. Keep the application baseline SHA unchanged for comparisons.

## Scope and approval

The owner confirmed that all existing formulas, illustrations, wording, product benefits, brochure/QR assets, report previews and PDFs are accepted. Preserve them as the source of truth. Do not refactor or change them without a new, explicit request and impact assessment.

Seven products:
1. 20Pay Life
2. Excellent
3. 15 Pay 25
4. CI Pro Care
5. CI SuperCare
6. Annuity Fix
7. Annuity Sure

Architecture: Next.js agent portal embeds `public/illustrations/royal_partners_illustration_tool.html` in `app/agent/calculators/page.tsx` via iframe. PDF/report routines inside HTML use the existing jsPDF/html2canvas pipeline.

## Phase status

- Phase 1 — Calculator design/report fit: owner accepted.
- Phase 2 — Responsive Expansion: owner accepted.
- Phase 3 — Formulas, assets, content and report appearance: owner approved. The repository contains structural safety checks in `tests/insurance-calculator.test.cjs`; **numerical reference-data automation, physical device QA and actual PDF visual comparison were not independently run/certified by this release procedure.**
- Phase 4 — Production metadata and release runbook: documented. Production deployment corresponding to the application baseline was reported READY by Vercel.

## Release checklist

- [x] Inspect latest GitHub main commit and relevant calculator portal iframe source.
- [x] Verify Vercel reports READY for application baseline commit.
- [x] Record stable app baseline SHA/deployment ID and recovery steps.
- [x] Preserve existing calculation/PDF implementation (documentation-only release).
- [ ] Confirm authenticated portal access and workflow in a real browser after this documentation commit.
- [ ] Run `node --test tests/insurance-calculator.test.cjs` locally or in CI and retain the output. Test file presence alone is not test execution.
- [ ] Export one PDF per product and visually inspect all pages, payment banner, copy, brochure/QR, and page boundaries.
- [ ] Check Chrome desktop, iPad Safari and mobile Safari/Chrome; verify no page-level horizontal scroll.
- [ ] Capture representative approved numerical reference inputs/outputs if automated arithmetic regression is wanted later.
- [ ] Record sign-off and any support owner/contact in an internal tracker.

## Operating rules

1. Protect approved formulas/data/assets and report layout before touching UI.
2. Fetch the newest GitHub file and identify the current SHA before every change.
3. Change the smallest possible surface. CSS-only requests must not alter formula logic.
4. Review Git diff, execute appropriate checks, inspect PDF and iframe, then commit.
5. Check that the new production deployment matches the intended commit and reaches READY.
6. On failure, stop further rollout; compare against this **application baseline** before attempting a corrective patch.

## Incident and recovery procedure

**Symptom → Root cause → Fix → Test → Prevention**

1. Record error type, affected product, browser/device, time, URL, screenshots and Git SHA.
2. Inspect Vercel deployment status/build logs and GitHub diff since the approved baseline.
3. If the issue is minor, revert the faulty commit through a reviewed GitHub revert PR and let Git integration deploy the corrected branch.
4. For urgent incidents, use Vercel's authenticated deployment/rollback controls to restore the deployment of `46fb2db1e4e73226ef921b68a12aa176898a9cf0`, **after checking that no newer unrelated production data/schema changes depend on current code**.
5. Confirm the restored deployment is READY, then retest iframe, calculations and PDF on the impacted product.
6. Note: Vercel rollback may affect automatic domain assignment until the appropriate production deployment is promoted. Follow Vercel's deployment controls, not a manually invented URL.

## What not to change without approval

- Calculation tables/rates, Annuity source formulas and numeric business logic.
- Product names, brochure QR, banners, illustration assets and benefit descriptions.
- PDF generation/render pipeline, export scale, page dimensions and report template data.
- Full-screen preview or viewport iframe bridge (previously rejected).

## Sources of truth

- Application implementation at approved commit `46fb2db1e4e73226ef921b68a12aa176898a9cf0`.
- Latest GitHub `main` for new changes, while retaining the above baseline for comparisons.
- Production verification at release preparation: Vercel state READY for approved baseline deployment.
