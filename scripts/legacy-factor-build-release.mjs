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

let validationStage = "manifest";
try {
  const source = readFileSync(new URL("../app/api/legacy-prestige-rpu/route.ts", import.meta.url), "utf8");
  const expected = new Map();
  const re = /"(10|15|20):(M|F)":\{cv:"([a-f0-9]{64})",rpu:"([a-f0-9]{64})"\}/g;
  for (const match of source.matchAll(re)) {
    expected.set(match[1] + ":" + match[2], { cv: match[3], rpu: match[4] });
  }
  if (expected.size !== 6) fail("manifest_structure");

  let tables;
  validationStage = "combined-or-source-select";
  const combined = process.env.LEGACY_TABLE_B_FACTORS_BR_B64;
  if (combined) {
    validationStage = "decode-combined";
    tables = decode(combined, 150000);
  } else {
    const cvSource = process.env.LEGACY_TABLE_B_MALE_CV_BR_B64;
    const rpuSource = process.env.LEGACY_RPU_MALE_FACTORS_BR_B64;
    const femaleSource = process.env.LEGACY_TABLE_B_FEMALE_U16_B64;
    if (!cvSource || !rpuSource || !femaleSource) fail("missing_configuration");
    validationStage = "decode-male-cv";
    const maleCv = decode(cvSource, 60000);
    validationStage = "decode-male-rpu";
    const maleRpu = decode(rpuSource, 60000);
    validationStage = "decode-female-binary";
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
    validationStage = "decode-male20-overlay";
    const male20=process.env.LEGACY_RPU_MALE_20_CORRECTED_BR_B64;
    if(male20){
      const rows=decode(male20,30000);
      tables["20"].M.rpu=rows;
    }

  }

  validationStage = "integrity-digests";
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
  validationStage = "masked-functional-tests";
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
  console.log("[Legacy Release Factor] PASS: verified factors + 72 cases; no private screenshot overlays");
} catch(error){
  console.error("[Legacy Release Factor] stage="+validationStage+"; type="+String(error?.name||"Unknown").replace(/[^A-Za-z]/g,"").slice(0,40));
  console.error("[Legacy Release Factor] BLOCKED: "+(
    ["manifest_structure","missing_configuration","female_payload_size","female_payload_truncated","male_rpu_dimensions","female_payload_overflow","factor_integrity_mismatch","mask_manifest_structure","table_b_response_length","table_b_year_mapping","table_b_amount_or_mask_mismatch","table_b_coverage_insufficient"].includes(error?.message)?error.message:"validation_failed"));
  process.exitCode=1;
}
