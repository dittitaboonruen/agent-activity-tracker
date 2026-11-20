# Legacy Prestige Plus (New) — Attained-age CV research checkpoint (20 Nov 2026)

**RESEARCH ONLY; no Production or public calculator integration. Do not advertise these as AIA-approved CV.**

- Source: owner-supplied AIA 2025 manual, 29 pages, SHA-256 `85e06c46ed2530e1f45f702291dd77c66601e8b487d23923c10ddc8462494332`.
- Re-extracted all six CV tables from native text (10/15/20 Pay × male/female), 2,594 numeric cells per table. All six independently re-computed CV hashes match the pre-existing restricted server manifest. No raw CV factors are committed here.
- Tested post-premium attained-age overlap by pay-term/gender: **same attained age can carry differing factors** for different issue ages. An unconditional rule is unsound.
- Cross-validation by hiding existing known cells and searching the next older issue-age row succeeded for **all known testable rows with original issue age <=55** across all six tables. This establishes an observed pattern **only within the manual's published 35 policy years**, not an actuarial rule for policy year 36+.
- For original issue age 35 / attained ages 70–98, requiring every eligible donor to agree gives research-only consistency windows:
  - 10 Pay: male 70–75, female 70–78
  - 15 Pay: male 70–78, female 70–80
  - 20 Pay: male 70–77, female 70–81
- This conservative all-donors requirement conflicts at later ages due to age/term-specific factor differences; do **not** substitute a majority or first candidate in such cases.
- The owner-supplied female / issue age 35 / 15 Pay / SI 10m iPOS+ figures match the native manual's 15 Pay year-35 lookup from issue ages 36..64 at all 29 ages, **but only that exact case is externally verified by iPOS+**. This does not validate male cases or any other issue age, term or sum.
- The isolated pure helper `cv-attained-research.ts` outputs either `research_candidate_not_verified`, `conflicting_factors` or `needs_source`. It is not imported by the customer API or PDF and is deliberately not active.
- RPU remains untouched; its second numeric segment ambiguity is a separate unresolved question.

**Next release gates**: additional independent iPOS+ comparisons across male/female 10/15/20 Pay (especially post year 35), check age/term/rate differences, documented product-owner acceptance, rights review, secure runtime checks and full Browser/PDF QA before any integration.

## Automated private build verification (20 November 2026)

- Build-stage encrypted factors verified against the manual integrity fingerprints across all six CV and six RPU arrays.
- A private, encrypted iPOS+ dataset for **female / issue age 35 / 15 Pay / SI 10 million** was compared against independently published policy-year-35 manual cells at attained ages 70–98: **29/29 exact amount matches**. This checks only the one exact case and must not be generalized.
- Hold-out cross-validation of published known CV cells across six groups (only original issue age <=55 and post-premium policy years):
  - 6,048 eligible held-out cells had at least two older-age donors
  - 5,652 unanimous donor factors matched the hidden original cell
  - 396 donor groups contained conflicting values; deliberately NOT substituted
  - 0 unanimous-but-incorrect predictions among eligible held-out cells
- These values are aggregate diagnostics: **they do not establish correctness in policy years 36+**, and must never be presented as AIA approval.
- `scripts/legacy-factor-build-qa.mjs` now fails the Preview build on any of the 29 private iPOS+ to manual-donor mismatches, missing private iPOS+ configuration, or factor integrity failure. No proprietary factors or iPOS amounts are printed.
- No API, PDF, public browser bundle, or Production calculation changed.
- Next: independent insurer iPOS+ examples for the other five term/gender groups, with original issue age and sum insured verified, then rights/compliance approval before any research candidate can be integrated.
