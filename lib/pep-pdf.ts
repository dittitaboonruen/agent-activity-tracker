import type { KpiSummary, PepNote } from "@/types";
import type { QuizResultRow } from "@/lib/skool-quiz";
import { summarizeQuizResults } from "@/lib/skool-quiz";
import { dataTimestampLabel, formatThaiDateLong } from "@/lib/date-utils";

export type PepExportContext = {
  agentId: number;
  agentName: string;
  agentCode: string | null;
  pepAgentName: string;
  startDate: string;
  endDate: string;
  channel: string;
  year: number;
  activityState: "ready" | "empty" | "error" | "loading" | "stale";
  kpis: KpiSummary | null;
  fetchedAt: string | null;
};
export type PdfSkool = {
  records: number; courses: number; completed: number; inProgress: number;
  notStarted: number; averageProgress: number; syncedAt: string | null;
};
export type PdfTarget = {
  target_fyp: number; target_fyc: number; target_case: number; updated_at?: string | null;
};
export type PepPdfReport = {
  context: PepExportContext;
  note: PepNote | null;
  skool: PdfSkool | null;
  skoolError: boolean;
  quiz: ReturnType<typeof summarizeQuizResults> | null;
  quizError: boolean;
  target: PdfTarget | null;
  targetError: boolean;
  generatedAt: string;
};

/** Only authenticated existing APIs supply data; no keys or privileged DB access in the browser. */
export async function loadPepPdfReport(context: PepExportContext, note: PepNote | null, signal: AbortSignal): Promise<PepPdfReport> {
  if (!Number.isSafeInteger(context.agentId) || context.agentId <= 0) throw new Error("กรุณาเลือกตัวแทนที่มีรหัสใน Agent Master");
  if (!validDate(context.startDate) || !validDate(context.endDate) || context.startDate > context.endDate) throw new Error("กรุณาเลือกช่วงวันที่ให้ครบและถูกต้อง");
  if (context.activityState === "loading") throw new Error("กรุณารอข้อมูลกิจกรรมโหลดเสร็จ");
  const api = async (path: string) => {
    const response = await fetch(path, { cache: "no-store", signal });
    if (response.status === 401 || response.status === 403) throw new Error("สิทธิ์หมดอายุหรือไม่มีสิทธิ์ กรุณารีเฟรชหน้าและเข้าสู่ระบบใหม่");
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "โหลดข้อมูลไม่สำเร็จ");
    return data;
  };
  const [roster, notes, skool, quiz, target] = await Promise.allSettled([
    api("/api/dashboard-agents"),
    api(`/api/pep-notes?agent=${encodeURIComponent(context.pepAgentName)}`),
    api(`/api/skool-progress?agent_id=${context.agentId}`),
    api(`/api/skool-quiz-results?agent_id=${context.agentId}`),
    api(`/api/annual-target?agent=${encodeURIComponent(context.agentName)}&year=${context.year}`),
  ]);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (roster.status !== "fulfilled") throw roster.reason;
  const agents = roster.value.agents;
  if (!Array.isArray(agents) || !agents.some((agent: { id: number; agentName: string }) => agent.id === context.agentId && agent.agentName === context.agentName)) {
    throw new Error("ไม่พบตัวแทนที่เลือกในสิทธิ์ปัจจุบัน กรุณารีเฟรชหน้า");
  }
  if (notes.status !== "fulfilled") throw notes.reason;
  if (!Array.isArray(notes.value.notes)) throw new Error("โหลดบันทึก PEP ไม่สำเร็จ");
  const savedNote = note ? (notes.value.notes as PepNote[]).find(item => item.id === note.id && item.agentName === context.pepAgentName) : null;
  if (note && (!savedNote || savedNote.updatedAt !== note.updatedAt)) throw new Error("บันทึก PEP ถูกแก้ไขหรือลบแล้ว กรุณาโหลดประวัติใหม่ก่อนดาวน์โหลด");
  // Optional sources fail visibly, never as invented zero values.
  const skoolOk = skool.status === "fulfilled" && skool.value.success === true && !!skool.value.summary;
  const quizOk = quiz.status === "fulfilled" && quiz.value.success === true && Array.isArray(quiz.value.rows);
  const targetOk = target.status === "fulfilled" && Object.prototype.hasOwnProperty.call(target.value, "target");
  return {
    context, note: savedNote ?? null,
    skool: skoolOk ? skool.value.summary as PdfSkool : null, skoolError: !skoolOk,
    quiz: quizOk ? summarizeQuizResults((quiz.value.rows as QuizResultRow[]).filter(row => row.agentId === context.agentId)) : null, quizError: !quizOk,
    target: targetOk ? target.value.target as PdfTarget | null : null, targetError: !targetOk,
    generatedAt: new Date().toISOString(),
  };
}
function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function pepPdfFilename(context: PepExportContext) {
  const identity = (context.agentCode || context.agentName).normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001F]/g, "_").slice(0, 70);
  return `PEP_${identity}_${context.startDate}_${context.endDate}.pdf`;
}
const number = (value: number) => value.toLocaleString("th-TH");
export function reportActivityLines(report: PepPdfReport): Array<[string, string]> {
  const { context: { kpis, activityState } } = report;
  if (!kpis || activityState === "empty" || activityState === "error" || activityState === "loading") return [];
  return [["ลูกค้าที่ไม่ซ้ำ", `${number(kpis.totalCustomers)} ราย`], ["กิจกรรมทั้งหมด", `${number(kpis.totalActivities)} กิจกรรม`],
    ["นำเสนอผลิตภัณฑ์", `${number(kpis.presentations)} ครั้ง`], ["My Money Map", `${number(kpis.moneyMapDone)} บันทึก`],
    ["ข้อโต้แย้ง / ปิดการขาย", `${number(kpis.closedSales)} บันทึก`], ["บันทึกกิจกรรม", `${number(kpis.totalSubmissions)} รายการ`]];
}
export function reportLearningLines(report: PepPdfReport): Array<[string, string]> {
  const { skool, quiz, target, context } = report;
  return [
    ["Skool", report.skoolError ? "โหลดข้อมูลไม่สำเร็จ" : !skool?.records ? "ยังไม่มีข้อมูลการเรียนที่จับคู่กับตัวแทนนี้" : `ความคืบหน้า ${skool.averageProgress}% • เรียนจบ ${skool.completed} / ${skool.records} รายการ`],
    ["CSV ล่าสุด", dataTimestampLabel(skool?.syncedAt, "ยังไม่มีเวลานำเข้า")],
    ["Google Forms", report.quizError ? "โหลดข้อมูลไม่สำเร็จ" : !quiz?.results ? "ยังไม่มีผลสอบ • ไม่ถือว่าสอบไม่ผ่าน" : `ผ่าน ${quiz.passed} • ไม่ผ่าน ${quiz.failed} • คะแนนเฉลี่ย ${quiz.averageScore}%`],
    ["คะแนนอัปเดต", dataTimestampLabel(quiz?.updatedAt, "ยังไม่มีผลสอบ")],
    [`เป้าหมายปี ${context.year + 543}`, report.targetError ? "โหลดข้อมูลไม่สำเร็จ" : !target ? "ยังไม่ได้ตั้งเป้าหมาย" : `FYP ${number(Number(target.target_fyp))} บาท • FYC ${number(Number(target.target_fyc))} บาท • ${number(Number(target.target_case))} CASE`],
  ];
}

let fontsReady: Promise<void> | null = null;
async function loadFonts() {
  if (!fontsReady) {
    fontsReady = Promise.all([
      new FontFace("PepSarabun", 'url("/fonts/Sarabun-Regular.ttf")', { weight: "400" }).load(),
      new FontFace("PepSarabun", 'url("/fonts/Sarabun-SemiBold.ttf")', { weight: "600" }).load(),
    ]).then(fonts => { fonts.forEach(font => document.fonts.add(font)); }).catch(() => {
      fontsReady = null;
      throw new Error("โหลดฟอนต์ไทยไม่สำเร็จ กรุณาตรวจว่าเพิ่มไฟล์ใน public/fonts ครบแล้ว");
    });
  }
  await fontsReady;
}
/** Canvas uses the browser's Thai shaping. PDF pages are sharp images at 3x A4 resolution. */
export async function createPepPdf(report: PepPdfReport, onPreview?: (imageUrl: string, pages: number) => void): Promise<Blob> {
  const [{ jsPDF }] = await Promise.all([import("jspdf"), loadFonts()]);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
  const width = 595.28, height = 841.89, margin = 36, bottom = 764, scale = 3;
  let firstPageImage = "";
  let page = 0, y = 0, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D;
  const colors = { ink: "#302B24", muted: "#766B5D", gold: "#A77A26", cream: "#F7F2E9", line: "#E5D8C1" };
  function text(value: string, x: number, baseline: number, size = 10, bold = false, color = colors.ink) {
    ctx.font = `${bold ? 600 : 400} ${size}px PepSarabun`;
    ctx.fillStyle = color; ctx.fillText(value, x, baseline);
  }
  function box(x: number, top: number, w: number, h: number, fill: string) {
    ctx.fillStyle = fill; ctx.fillRect(x, top, w, h);
  }
  function finishPage() {
    ctx.strokeStyle = colors.line; ctx.beginPath(); ctx.moveTo(margin, 779); ctx.lineTo(width - margin, 779); ctx.stroke();
    text("กิจกรรม: ตามวันที่เลือก • การเรียน / Quiz: ล่าสุด • เป้าหมาย: รายปี", margin, 795, 7.8, false, colors.muted);
    text(`สร้างรายงาน: ${dataTimestampLabel(report.generatedAt)}`, margin, 809, 7.5, false, colors.muted);
    text(`หน้า ${page}`, width - 75, 809, 8, false, colors.muted);
    if (page > 1) doc.addPage();
    const imageUrl = canvas.toDataURL("image/jpeg", 0.96);
    if (page === 1) firstPageImage = imageUrl;
    doc.addImage(imageUrl, "JPEG", 0, 0, width, height);
    canvas.width = 1; canvas.height = 1;
  }
  function newPage() {
    if (page > 0) finishPage();
    page += 1; canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d"); if (!context) throw new Error("เบราว์เซอร์นี้สร้าง PDF ไม่ได้");
    ctx = context; ctx.scale(scale, scale); box(0, 0, width, height, "#FFFFFF");
    box(0, 0, width, page === 1 ? 141 : 92, colors.cream);
    text("ROYAL PARTNER", margin, 36, 11, true, colors.gold);
    text(page === 1 ? "สรุปผลงานสำหรับคุย PEP" : "สรุป PEP (ต่อ)", margin, 68, page === 1 ? 23 : 17, true);
    y = page === 1 ? 99 : 113;
    if (page === 1) {
      paragraph(`${report.context.agentName} • รหัส ${report.context.agentCode || "ยังไม่มีรหัส"}`, 12, true, 18);
      paragraph(`วันที่ PEP: ${report.note ? formatThaiDateLong(report.note.pepDate) : "ไม่แนบคอมเมนต์ PEP"}`, 9, false, 15);
      y = Math.max(164, y + 15);
    } else { text(report.context.agentName, margin, 83, 9, false, colors.muted); }
  }
  const segmenter = new Intl.Segmenter("th", { granularity: "word" });
  const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });
  function wrap(value: string, maxWidth: number, size: number, bold: boolean) {
    ctx.font = `${bold ? 600 : 400} ${size}px PepSarabun`;
    const output: string[] = [];
    for (const block of value.replace(/\r\n?/g, "\n").split("\n")) {
      let line = "";
      for (const { segment } of segmenter.segment(block)) {
        if (ctx.measureText(line + segment).width <= maxWidth) { line += segment; continue; }
        if (line.trim()) output.push(line.trimEnd()); line = "";
        for (const { segment: letter } of graphemes.segment(segment)) {
          if (ctx.measureText(line + letter).width > maxWidth && line) { output.push(line.trimEnd()); line = ""; }
          line += letter;
        }
      }
      output.push(line.trimEnd());
    }
    return output;
  }
  function ensure(space: number) { if (y + space > bottom) newPage(); }
  function paragraph(value: string, size = 10, bold = false, leading = 16, color = colors.ink) {
    for (const line of wrap(value, width - margin * 2, size, bold)) {
      ensure(leading); text(line, margin, y, size, bold, color); y += leading;
    }
  }
  function heading(value: string) {
    ensure(48); y += 10; paragraph(value, 12, true, 20, colors.gold);
  }
  newPage();
  paragraph(`ช่วงกิจกรรม: ${formatThaiDateLong(report.context.startDate)} - ${formatThaiDateLong(report.context.endDate)}`, 10, true);
  paragraph(`ช่องทาง: ${report.context.channel} • ตัวแทนรายบุคคล`, 8, false, 14, colors.muted);
  heading("01  กิจกรรมและการขาย");
  const metrics = reportActivityLines(report);
  if (!metrics.length) paragraph(report.context.activityState === "error" ? "โหลดกิจกรรมไม่สำเร็จ จึงไม่แสดงตัวเลข" : "ไม่มีบันทึกกิจกรรมในช่วงวันที่และช่องทางที่เลือก", 10);
  else {
    const cardWidth = (width - 2 * margin - 16) / 3;
    for (let row = 0; row < 2; row++) {
      ensure(66);
      metrics.slice(row * 3, row * 3 + 3).forEach(([label, value], index) => {
        const x = margin + index * (cardWidth + 8);
        box(x, y, cardWidth, 56, colors.cream);
        text(label, x + 10, y + 17, 9, false, colors.muted);
        ctx.font = "600 17px PepSarabun";
        const fittedSize = Math.min(17, 17 * (cardWidth - 20) / Math.max(1, ctx.measureText(value).width));
        text(value, x + 10, y + 41, fittedSize, true);
      }); y += 65;
    }
  }
  paragraph("ข้อโต้แย้ง / ปิดการขาย: นับกิจกรรมในฟอร์ม ไม่ใช่จำนวนกรมธรรม์ที่อนุมัติ", 7.8, false, 13, colors.muted);
  if (report.context.activityState === "stale") paragraph("ข้อมูลกิจกรรมเป็นข้อมูลที่โหลดไว้ก่อนหน้า เนื่องจากรีเฟรชล่าสุดไม่สำเร็จ", 8, true, 14, colors.gold);
  paragraph(`ดึงกิจกรรมล่าสุด: ${dataTimestampLabel(report.context.fetchedAt)}`, 7.8, false, 13, colors.muted);
  heading("02  การเรียนและเป้าหมาย");
  for (const [label, value] of reportLearningLines(report)) paragraph(`${label}: ${value}`, 9, false, 16);
  paragraph("ผลสอบนับครั้งล่าสุดต่อข้อสอบที่เปิดใช้งาน • Skool อัปเดตตาม CSV ที่นำเข้า", 7.8, false, 13, colors.muted);
  heading("03  คอมเมนต์และแผนทำต่อ");
  if (!report.note) paragraph("ไม่แนบคอมเมนต์ PEP ในรายงานนี้", 10);
  else {
    paragraph(`บันทึกวันที่ ${formatThaiDateLong(report.note.pepDate)} • อัปเดต ${dataTimestampLabel(report.note.updatedAt)}`, 8, false, 14, colors.muted);
    for (const [label, value] of [["ข้อเสนอแนะ / เทคนิคที่แนะนำ", report.note.recommendation], ["คำถามชวนโค้ช", report.note.coachingQuestion], ["Action Plan", report.note.actionPlan]]) {
      ensure(40); y += 7; paragraph(label, 10, true, 17, colors.gold); paragraph(value || "ยังไม่ได้บันทึก", 10, false, 16);
    }
  }
  finishPage();
  doc.setProperties({ title: "Royal Partner - PEP Summary", subject: "Individual PEP summary", creator: "Agent Activity Tracker" });
  onPreview?.(firstPageImage, page);
  return doc.output("blob");
}
