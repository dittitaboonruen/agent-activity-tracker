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
  console.log("[Legacy Factor Runtime] PASS: all 6 groups / 12 factor arrays matched; no source values exported");
} catch (error) {
  // Keep errors coarse. Never include an exception's detailed payload in logs.
  stop([
    "manifest_structure","missing_configuration","female_payload_size",
    "female_payload_truncated","female_payload_overflow",
    "male_rpu_dimensions","factor_integrity_mismatch"
  ].includes(error?.message) ? error.message : "factor_decode_or_validation_failed");
}
