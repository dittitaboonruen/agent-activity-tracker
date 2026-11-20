// Private build-stage integrity gate. Never print secrets, factor values, tables or hashes.
// The source of the expected digests is the same manual-derived manifest used by the API.
import { readFileSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";
import { createHash } from "node:crypto";

const stop = (reason) => {
  console.error("[Legacy Factor Runtime] BLOCKED: " + reason);
  process.exitCode = 1;
};
const fail = (message) => { throw new Error(message); };
const decode = (value, limit) => JSON.parse(
  brotliDecompressSync(Buffer.from(value, "base64"), { maxOutputLength: limit }).toString("utf8")
);
const digest = rows => createHash("sha256").update(JSON.stringify(rows)).digest("hex");

try {
  const source = readFileSync(new URL("../app/api/legacy-prestige-rpu/route.ts", import.meta.url), "utf8");
  const expected = new Map();
  const re = /"(10|15|20):(M|F)":\{cv:"([a-f0-9]{64})",rpu:"([a-f0-9]{64})"\}/g;
  for (const match of source.matchAll(re)) {
    expected.set(match[1] + ":" + match[2], { cv: match[3], rpu: match[4] });
  }
  if (expected.size !== 6) fail("manifest_structure");

  let tables;
  const combined = process.env.LEGACY_TABLE_B_FACTORS_BR_B64;
  if (combined) {
    tables = decode(combined, 150000);
  } else {
    const cvSource = process.env.LEGACY_TABLE_B_MALE_CV_BR_B64;
    const rpuSource = process.env.LEGACY_RPU_MALE_FACTORS_BR_B64;
    const femaleSource = process.env.LEGACY_TABLE_B_FEMALE_U16_B64;
    if (!cvSource || !rpuSource || !femaleSource) fail("missing_configuration");
    const maleCv = decode(cvSource, 60000);
    const maleRpu = decode(rpuSource, 60000);
    const binary = Buffer.from(femaleSource, "base64");
    if (binary.length !== 21948) fail("female_payload_size");
    let cursor = 0;
    const take = (length) => {
      const row = [];
      for (let i = 0; i < length; i++) {
        if (cursor + 2 > binary.length) fail("female_payload_truncated");
        row.push(binary.readUInt16LE(cursor));
        cursor += 2;
      }
      return row;
    };
    tables = {};
    for (const term of [10, 15, 20]) {
      const female = {cv: [], rpu: []};
      for (const kind of ["cv", "rpu"]) {
        for (let age = 0; age <= 75; age++)
          female[kind].push(take(kind === "cv" ? Math.min(35, 99 - age) : term - 1));
      }
      const maleRows = maleRpu[String(term)];
      if (!Array.isArray(maleRows) || maleRows.length !== 76) fail("male_rpu_dimensions");
      tables[String(term)] = {
        M: {cv: maleCv[String(term)], rpu: maleRows.map((row, age) => {
          if (!Array.isArray(row) || row[0] !== age || row.length !== term)
            fail("male_rpu_dimensions");
          return row.slice(1);
        })},
        F: female
      };
    }
    if (cursor !== binary.length) fail("female_payload_overflow");    // Secure correction overlay; leaves independently verified 10/15 Pay untouched.
    const male20=process.env.LEGACY_RPU_MALE_20_CORRECTED_BR_B64;
    if(male20){
      const rows=decode(male20,30000);
      tables["20"].M.rpu=rows;
    }

  }

  let allPassed = true;
  for (const term of [10, 15, 20]) {
    for (const gender of ["M", "F"]) {
      const group = tables[String(term)]?.[gender];
      const validRows = group && ["cv", "rpu"].every(kind =>
        Array.isArray(group[kind]) && group[kind].length === 76 &&
        group[kind].every((row, age) =>
          Array.isArray(row) &&
          row.length === (kind === "cv" ? Math.min(35, 99 - age) : term - 1) &&
          row.every(value => Number.isInteger(value) &&
            value >= 0 && value <= (kind === "cv" ? 3000 : 1000))
        )
      );
      const sourceHashes = expected.get(term + ":" + gender);
      const cvMatched = Boolean(validRows && digest(group.cv) === sourceHashes?.cv);
      const rpuMatched = Boolean(validRows && digest(group.rpu) === sourceHashes?.rpu);
      const matched = cvMatched && rpuMatched;
      console.log("[Legacy Factor Runtime] " + term + " Pay / " + gender +
        ": " + (matched ? "PASS" : "BLOCKED") +
        (matched ? "" : " (CV " + (cvMatched ? "PASS" : "BLOCKED") +
          " / RPU " + (rpuMatched ? "PASS" : "BLOCKED") + ")"));
      if (!matched) allPassed = false;
    }
  }
  if (!allPassed) fail("factor_integrity_mismatch");

  // Run exact-input Table B functional QA using the same verified confidential
  // factors as the API. This runs on the Vercel build machine; no factors leave.
  const bits = new Map();
  const maskBlock = source.split("const LEGACY_RPU_UNRESOLVED_SEGMENT_BITS:")[1]
    ?.split("let factorCache:")[0] || "";
  const maskRe = /"(10|15|20):(M|F)":\{([^}]*)\}/g;
  for (const match of maskBlock.matchAll(maskRe)) {
    const entries = {};
    for (const entry of match[3].matchAll(/(\d+):(\d+)/g)) entries[Number(entry[1])] = Number(entry[2]);
    bits.set(match[1] + ":" + match[2], entries);
  }
  if (bits.size !== 6) fail("mask_manifest_structure");
  const calculate = (term, gender, age, sum) => {
    const factor = tables[String(term)][gender];
    const mask = bits.get(term + ":" + gender)?.[age] || 0;
    return Array.from({length: 99 - age}, (_, i) => {
      const value = (v) => Number.isInteger(v) && v >= 0 ? Math.round(v * sum / 1000) : null;
      return {
        age: age + i, policyYear: i + 1,
        surrender: value(factor.cv[age][i]),
        paidUp: i < term - 1 && !!(mask & (1 << i)) ? null : value(factor.rpu[age][i])
      };
    });
  };
  let cases = 0;
  let masked = 0;
  let available = 0;
  for (const term of [10, 15, 20]) for (const gender of ["M", "F"]) {
    const sources = tables[String(term)][gender];
    for (const age of [0, 35, 60, 75]) {
      const base = calculate(term, gender, age, 10000000);
      const doubled = calculate(term, gender, age, 20000000);
      const intermediate = calculate(term, gender, age, 15000000);
      if (base.length !== 99 - age || intermediate.length !== base.length ||
          doubled.length !== base.length) fail("table_b_response_length");
      for (let i = 0; i < base.length; i++) {
        const r = base[i], r2 = doubled[i], r15 = intermediate[i];
        if (r.age !== age + i || r.policyYear !== i + 1 ||
            r2.age !== r.age || r15.policyYear !== r.policyYear) fail("table_b_year_mapping");
        for (const [key, src] of [["surrender", sources.cv[age][i]],
                                  ["paidUp", sources.rpu[age][i]]]) {
          const unavailable = key === "paidUp" && i < term - 1 &&
            !!((bits.get(term + ":" + gender)?.[age] || 0) & (1 << i));
          const expected = unavailable || src === undefined ? null : Math.round(src * 10000);
          const expected15 = unavailable || src === undefined ? null : Math.round(src * 15000);
          if (r[key] !== expected || r15[key] !== expected15 ||
              r2[key] !== (expected === null ? null : expected * 2))
            fail("table_b_amount_or_mask_mismatch");
          if (unavailable) masked++;
          if (expected !== null) available++;
        }
      }
      cases += 3; // 10m, 15m, 20m; exact gender/age/term combinations
    }
    console.log("[Legacy Table B QA] " + term + " Pay / " + gender + ": PASS");
  }
  if (masked === 0 || available === 0) fail("table_b_coverage_insufficient");
  console.log("[Legacy Table B QA] PASS: " + cases +
    " exact-input cases, age/year mapping, CV/RPU scaling, missing-value masks");
  // Private, evidence-backed attained-age regression. This is NOT a generic
  // CV fill rule. Compare all 29 user-supplied iPOS+ values (one exact case)
  // against the year-35 published manual CV cells, without logging amounts.
  const iposRaw = process.env.LEGACY_QA_CV_F_35_15_10M_70_98_JSON;
  if (!iposRaw) fail("missing_exact_case_configuration");
  let ipos;
  try { ipos = JSON.parse(iposRaw); } catch { fail("invalid_exact_case_configuration"); }
  if (!Array.isArray(ipos) || ipos.length !== 29 ||
      ipos.some((v,i) => !Number.isSafeInteger(v) || v<0 || v>10000000 ||
        v%10000!==0 || (i>0 && v<ipos[i-1])))
    fail("invalid_exact_case_configuration");
  // Policy year 35 at attained age 70..98 is published on issue-age rows 36..64.
  for (let offset=0; offset<29; offset++) {
    const donorIssueAge = 36 + offset;
    const factor = tables["15"].F.cv[donorIssueAge]?.[34];
    if (!Number.isInteger(factor) || factor*10000 !== ipos[offset])
      fail("ipos_manual_lookup_mismatch");
  }
  console.log("[Legacy CV Research] PASS: 29 exact-case iPOS+ values agree with published year-35 donor cells (15 Pay/F/issue35/SI10m only)");

  // Independent private screenshot supplied by the owner: male issue40,
  // 10 Pay, SI 10m, attained age 75..98. Do not expose these exact amounts
  // in source control, browser bundles, snapshots or build diagnostics.
  const male40Raw=process.env.LEGACY_QA_CV_M_40_10_10M_75_98_JSON;
  if(!male40Raw) fail("missing_male40_exact_case_configuration");
  let male40Values;
  try { male40Values=JSON.parse(male40Raw); }
  catch { fail("invalid_male40_exact_case_configuration"); }
  if(!Array.isArray(male40Values)||male40Values.length!==24||
     male40Values.some((v,i)=>!Number.isSafeInteger(v)||v<0||v>10000000||
       v%10000!==0||(i>0&&v<male40Values[i-1]))||
     digest(male40Values)!=="5dc18a4e74b031fdd7b2974832a6fa434fd42c8f82881d4527fe91ca013307bc")
    fail("male40_exact_case_integrity_mismatch");
  // Year 36+ must NOT be taken from the source manual's published 35 years.
  if(tables["10"].M.cv[40].length!==35)
    fail("male40_manual_scope_mismatch");
  console.log("[Legacy CV Research] PASS: 24 screenshot-backed CV values integrity-checked (10 Pay/M/issue40/SI10m/ages75-98 only)");

  // Conservative cross-validation within the manual: hide a published cell,
  // then inspect other already-published rows for the SAME attained age.
  // This diagnostic does not fill the missing years and does not certify any
  // unseen CV. Aggregate statuses only; never print restricted factor values.
  let heldoutEligible=0, heldoutMatched=0, heldoutConflicted=0, heldoutDisagreed=0;
  for (const term of [10,15,20]) for (const gender of ["M","F"]) {
    const cv = tables[String(term)][gender].cv;
    for (let originalAge=0; originalAge<=55; originalAge++) {
      for (let year=term+1; year<=Math.min(35,99-originalAge); year++) {
        const attained = originalAge+year-1;
        const actual = cv[originalAge]?.[year-1];
        if (!Number.isInteger(actual)) continue;
        const donorValues=[];
        for (let donorAge=originalAge+1; donorAge<=75; donorAge++) {
          const donorYear=attained-donorAge+1;
          if (donorYear<=term || donorYear>35) continue;
          const candidate=cv[donorAge]?.[donorYear-1];
          if (Number.isInteger(candidate)) donorValues.push(candidate);
        }
        if (donorValues.length<2) continue;
        heldoutEligible++;
        if (new Set(donorValues).size!==1) heldoutConflicted++;
        else if (donorValues[0]===actual) heldoutMatched++;
        else heldoutDisagreed++;
      }
    }
  }
  if (heldoutEligible<100) fail("cv_research_coverage_insufficient");
  console.log("[Legacy CV Research] Cross-validation counts only: verified-match="+heldoutMatched+
    ", donor-conflict="+heldoutConflicted+", held-out-disagreement="+heldoutDisagreed+
    ", eligible="+heldoutEligible+" (published cells only; no extrapolation)");

  console.log("[Legacy Factor Runtime] PASS: all 6 groups / 12 factor arrays matched; no source values exported");
} catch (error) {
  // Keep errors coarse. Never include an exception's detailed payload in logs.
  stop([
    "manifest_structure","missing_configuration","female_payload_size",
    "female_payload_truncated","female_payload_overflow",
    "male_rpu_dimensions","factor_integrity_mismatch"
  ].includes(error?.message) ? error.message : "factor_decode_or_validation_failed");
}
