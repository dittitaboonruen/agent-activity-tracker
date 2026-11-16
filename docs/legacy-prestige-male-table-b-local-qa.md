# Legacy Prestige Plus (New) — male Table B factor contract (internal QA)

Only applies to AIA Legacy Prestige Plus (New). It does **not** change calculations for any other product.

## Why a table lookup is required

The supplied AIA agent manual labels the CV, RPU and ETI tables as examples with factor values per THB 1,000 of insured coverage:
- Male 10-pay: PDF pages 7 (CV), 9 (ETI), 10 (RPU).
- Male 15-pay: PDF pages 11 (CV), 13 (ETI), 15 (RPU).
- Male 20-pay: PDF pages 17 (CV), 19 (ETI), 21 (RPU).

Select by issue gender, payment term, issue age, and policy year. Monetary columns use `factor * sumAssured / 1000` (rounded to whole baht). ETI coverage duration uses the directly tabulated years and days; **do not** multiply those by insured sum. A blank factor is not zero and must remain unavailable.

**Important:** these are *sample* tables and may not specify all policy years, case variations or contract-specific values. Do not interpolate, extrapolate, apply a different gender's factors, or show missing numbers as official AIA values.

## Automatic user workflow

User selects gender, issue age, sum assured and payment term; the calculator automatically looks up Table B using the exact matching source values. No manual uploads, demo data, or extra steps.

**Current source coverage:** The public brochure includes certain exact male examples, not every issue-age/payment-term/year combination. The insurer's example manual is subject to restrictions. Until authorized and independently validated factors are available, unknown CV/RPU/ETI cells must display an unavailable dash rather than invented amounts.

**Implementation gate for full automatic coverage:** supply a licensed, approved source of all required male Table B factors through a restricted internal server-side dataset and authenticated endpoint. Public JavaScript bundles, public static assets, and browser-provided factor files must not be the storage layer. Verify every source row against approved illustrations. Existing female figures and all other insurance plan formulas remain unchanged.

## QA / production gates

1. Confirm written authorization for the source values and their use in an internal calculator. **Do not** copy the proprietary agent manual's tables into a publicly served JavaScript file, Git history, or generated client PDF.
2. Double-check age/term/year transcription independently, including CV/RPU/ETI nulls, against AIA iPOS+ for each required case.
3. Run `npm run test:legacy`, plus browser 10/15/20-pay scenarios and simultaneous separate browser sessions.
4. Complete QA for male and female Table A/B and PDF; ensure 12 other product formulas remain unchanged.
5. Keep PR draft and do not release until compliance and complete required data validation are approved.
