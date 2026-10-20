// Royal Partner Insurance Calculator — regression safety net.
// Run: node --test tests/insurance-calculator.test.cjs
// These are structural checks, NOT actuarial numerical certification or browser/PDF visual QA.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(
  path.join(root, "public/illustrations/royal_partners_illustration_tool.html"), "utf8"
);
const portal = fs.readFileSync(path.join(root, "app/agent/calculators/page.tsx"), "utf8");

const products = [
  ["Excellent", "excellent", "buildExcellentReportHTML", "downloadExcellentPDF"],
  ["15 Pay 25", "pay25", "buildPay25ReportHTML", "downloadPay25PDF"],
  ["20Pay Life", "paylife20", "build20PayLifeReportHTML", "download20PayLifePDF"],
  ["CI Pro Care", "ciprocare", "buildCIProCareReportHTML", "downloadCIProCarePDF"],
  ["CI SuperCare", "cisupercare", "buildCISuperCareReportHTML", "downloadCISuperCarePDF"],
  ["Annuity Fix", "annuityfix", "buildAnnuityFixReportHTML", "downloadAnnuityPDF"],
  ["Annuity Sure", "annuitysure", "buildAnnuitySureReportHTML", "downloadAnnuityPDF"],
];

test("all seven existing products retain report constructors and PDF handlers", () => {
  for (const [name, key, builder, downloader] of products) {
    assert.ok(html.includes("'" + key + "'"), name + ": product key missing");
    assert.ok(html.includes("function " + builder + "("), name + ": report builder missing");
    assert.ok(html.includes("function " + downloader + "("), name + ": PDF handler missing");
  }
});

test("PDF pipeline retains html2canvas, jsPDF, A4, and cross-device download", () => {
  for (const name of [
    "renderReportPageToCanvas", "savePdfCrossDevice",
    "showReportPreview", "download20PayLifePDF", "downloadAnnuityPDF"
  ]) assert.ok(html.includes("function " + name + "("), name + " missing");
  assert.match(html, /format:\s*['"]a4['"]/);
  assert.match(html, /html2canvas\s*\(/);
  assert.match(html, /\/vendor\/html2canvas\.min\.js/);
  assert.match(html, /\/vendor\/jspdf\.umd\.min\.js/);
});

test("report paper dimensions and PDF-safe preview layer are retained", () => {
  assert.match(html, /\.rp-report-page\s*\{[^}]*width:\s*794px/s);
  assert.match(html, /\.ann-report-page\s*\{[^}]*width:\s*794px/s);
  assert.match(html, /min-height:\s*1123px/);
  assert.ok(html.includes("rp-preview-fit-stage"));
  assert.ok(html.includes("rp-preview-pdf-source"));
  assert.ok(html.includes("fitReportA4Contents"));
  assert.ok(!html.includes("requestFullscreen("), "fullscreen preview must not return");
});

test("Next.js portal preserves the existing sandboxed iframe", () => {
  assert.ok(portal.includes("royal_partners_illustration_tool.html"));
  assert.match(portal, /<iframe\b/);
  for (const flag of ["allow-scripts", "allow-downloads", "allow-same-origin", "allow-modals"]) {
    assert.ok(portal.includes(flag), "iframe permission missing: " + flag);
  }
});

test("responsive expansion rules exist outside report calculations", () => {
  assert.ok(html.includes("RESPONSIVE EXPANSION — PHASE 2"));
  for (const breakpoint of ["1200px", "1199px", "768px", "560px"]) {
    assert.ok(html.includes(breakpoint), "breakpoint missing: " + breakpoint);
  }
  assert.ok(html.includes(".ledger-wrap"));
});

test("calculator HTML keeps balanced script/style tag boundaries", () => {
  const n = pattern => [...html.matchAll(pattern)].length;
  assert.equal(n(/<script\b/g), n(/<\/script>/g));
  assert.equal(n(/<style\b/g), n(/<\/style>/g));
});
