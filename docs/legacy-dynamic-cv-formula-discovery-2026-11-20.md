# Legacy Prestige Plus Dynamic CV Formula Discovery — 20 Nov 2026

**RESEARCH ONLY. No insurer approval. No integration into live API, UI, PDF or Production.**

## Exact source and evidence
- Internal owner-supplied AIA Legacy Prestige Plus (New) 2025 manual, CV pages 7, 8, 11, 12, 17, 18 (10/15/20 Pay × M/F). Manual publishes only policy years 1–35.
- Private user-supplied iPOS+ screenshots for male, issue age 40, 10 Pay, sum insured 10 million, attained ages 75–98 (24 cells).
- Previously protected exact-case iPOS+ evidence for female, issue age 35, 15 Pay, sum insured 10 million, attained ages 70–98 (29 cells).
- The underlying policy-year-35 hypothesis is an inference from comparisons, NOT a rule guaranteed by the insurer.

## Formula hypothesis (never generalize without proof)
For policy year > 35, source the per-1,000 CV candidate at attained age A from the original manual's **policy-year-35** factor, issue-age row `A - 34`. For the same attained age, compare **policy-year-34** factor from issue-age row `A - 33`. Only when both values are exactly equal return a research candidate. Preserve original manual cells for policy years <=35 without substitution.

Illustrative arithmetic, verified only for matching cases: `CV = FactorPer1000 × sumInsured / 1,000`. Any scaling to a different sum insured is a hypothesis until confirmed from iPOS+.

## Source-level comparison results
- Published cells held out, after premium-payment term, with issue age <=55: **5,080/5,080** policy-year-35 anchor factor matches, across six CV tables. This is **in-sample source consistency**, not validation of unprinted policy years 36+.
- Male 40 / 10 Pay / 10m screenshots ages 75–98: **24/24** policy-year-35 anchor factors match iPOS+ screenshot values.
- Female 35 / 15 Pay / 10m screenshots ages 70–98: **29/29** manual anchor matches as previously verified in protected QA.
- Same issue age 40, attained ages 75–98, source year-35/year-34 consistency counts:
  - Male 10 Pay 24 agreeing / 0 conflicting; female 10 Pay 24 / 0.
  - Male 15 Pay 22 / 2; female 15 Pay 24 / 0.
  - Male 20 Pay 16 / 8; female 20 Pay 20 / 4.
  - The disagreement is **source-level conflict**; it does not establish how iPOS+ behaves for those cases.

## Safeguards
- The new pure helper returns only `RESEARCH_CANDIDATE_NOT_APPROVED` with a per-1,000 candidate factor; **amount is always null**.
- Fail closed for issue ages >55, missing factors, mismatch between year 35 and year 34, verified-reference mismatch, wrong inputs, or policy years <=35.
- No raw AIA factors or screenshot numbers are stored in committed fixtures, API responses or PDFs.
- Regression tests use synthetic values only and leave the previously verified API, premium, RPU and PDF untouched.

## Remaining work
1. Collect iPOS+ cases for the other gender/term combinations and variations in issue age, plus a second sum insured to establish scaling.
2. Evaluate known exceptions individually; do not assume that factor agreement proves all cases.
3. Integrate only confirmed cases as exact-source values or authorized verified rules; obtain rights/compliance approval before release.
