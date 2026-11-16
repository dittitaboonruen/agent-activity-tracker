# Legacy Prestige Plus (New) — male Table B factor contract (internal QA)

Only applies to AIA Legacy Prestige Plus (New). It does **not** change calculations for any other product.

## Why a table lookup is required

The supplied AIA agent manual labels the CV, RPU and ETI tables as examples with factor values per THB 1,000 of insured coverage:
- Male 10-pay: PDF pages 7 (CV), 9 (ETI), 10 (RPU).
- Male 15-pay: PDF pages 11 (CV), 13 (ETI), 15 (RPU).
- Male 20-pay: PDF pages 17 (CV), 19 (ETI), 21 (RPU).

Select by issue gender, payment term, issue age, and policy year. Monetary columns use `factor * sumAssured / 1000` (rounded to whole baht). ETI coverage duration uses the directly tabulated years and days; **do not** multiply those by insured sum. A blank factor is not zero and must remain unavailable.

**Important:** these are *sample* tables and may not specify all policy years, case variations or contract-specific values. Do not interpolate, extrapolate, apply a different gender's factors, or show missing numbers as official AIA values.

## Local-only import protocol (never check data into Git)

The Legacy test page accepts a local JSON file selected explicitly by the operator. The browser reads that file **in-memory only** without network upload, localStorage or cookies. Clear the tab to remove the data.

Example below is **synthetic TEST DATA**, not an AIA rate. Never use it for customer quotations.

```json
{
  "plan": "AIA_LEGACY_PRESTIGE_PLUS_NEW",
  "usage": "authorized-internal-qa",
  "rows": [
    {
      "gender": "M",
      "premiumTerm": 20,
      "issueAge": 35,
      "policyYear": 2,
      "cvPer1000": 17.2,
      "rpuPer1000": 40,
      "rpuImmediatePer1000": null,
      "etiYears": 6,
      "etiDays": 156,
      "etiMaturityPer1000": null,
      "etiImmediatePer1000": null
    }
  ]
}
```

One source row per unique (gender, premiumTerm, issueAge, policyYear). Only male factor imports are accepted in this phase, so existing female results remain unchanged. The upload file must be under 3 MB and contain 1–18,000 rows. Values are validated and loaded atomically; a malformed file cannot overwrite the prior validated data.

## QA / production gates

1. Confirm written authorization for the source values and their use in an internal calculator. **Do not** copy the proprietary agent manual's tables into a publicly served JavaScript file, Git history, or generated client PDF.
2. Double-check age/term/year transcription independently, including CV/RPU/ETI nulls, against AIA iPOS+ for each required case.
3. Run `npm run test:legacy`, plus browser 10/15/20-pay scenarios and simultaneous separate browser sessions.
4. Complete QA for male and female Table A/B and PDF; ensure 12 other product formulas remain unchanged.
5. Keep PR draft and do not release until compliance and complete required data validation are approved.
