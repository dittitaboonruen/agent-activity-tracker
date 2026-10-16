import type { KpiSummary, PepNote } from "@/types";
import type { QuizResultRow } from "@/lib/skool-quiz";
import { summarizeQuizResults } from "@/lib/skool-quiz";
import { dataTimestampLabel, formatThaiDateLong } from "@/lib/date-utils";
import { courseProgressGroups, failedQuizAttempts, quizLessonTitle, selectCourseRows, type CourseLearningRow } from "@/lib/learning-details";

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
  skoolRows?: CourseLearningRow[];
  quizRows?: QuizResultRow[];
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
    skoolRows: skoolOk && Array.isArray(skool.value.rows) ? selectCourseRows(skool.value.rows as CourseLearningRow[], context.agentId) : [],
    quizRows: quizOk ? (quiz.value.rows as QuizResultRow[]).filter(row => row.agentId === context.agentId) : [],
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
export function reportLearningDetailLines(report: PepPdfReport): Array<[string, string]> {
  const lines: Array<[string, string]> = [];
  if (!report.quizError && report.quizRows) {
    const failed = failedQuizAttempts(report.quizRows, report.context.agentId);
    lines.push(["บทที่ต้องทบทวน / สอบไม่ผ่าน", report.quiz?.results ? `${failed.length} รายการ (ครั้งล่าสุดต่อข้อสอบ)` : "ยังไม่มีผลสอบ จึงยังระบุไม่ได้"]);
    for (const row of failed) lines.push([quizLessonTitle(row), `${row.score}/${row.maxScore} คะแนน (${row.scorePercent}%) • ไม่ผ่าน • ${dataTimestampLabel(row.submittedAt)}`]);
  }
  if (!report.skoolError) {
    const rows = selectCourseRows(report.skoolRows ?? [], report.context.agentId);
    lines.push(["รายละเอียด Skool", "ข้อมูลรายคอร์สจาก CSV ยังระบุการเรียนจบรายบทภายในคอร์สไม่ได้"]);
    if (rows.length) {
      for (const group of courseProgressGroups(rows)) {
        lines.push([group.label, `${group.rows.length} คอร์ส`]);
        for (const row of group.rows) lines.push([row.courseName, `${row.progressPercent}%`]);
      }
    } else lines.push(["รายคอร์ส", "ยังไม่มีรายละเอียดการเรียนที่นำเข้าหรือจับคู่ จึงยังระบุคอร์สที่ไม่เริ่มเรียนไม่ได้"]);
  }
  return lines;
}
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
/** Canvas preserves Thai shaping; compact cards fit ordinary PEP reports on one A4 page. */
export async function createPepPdf(report: PepPdfReport, onPreview?: (imageUrl: string, pages: number) => void): Promise<Blob> {
  const [{ jsPDF }] = await Promise.all([import("jspdf"), loadFonts()]);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
  const width = 595.28, height = 841.89, margin = 30, bottom = 770, scale = 3;
  const contentWidth = width - margin * 2, gap = 10;
  const colors = { ink: "#302B24", muted: "#766B5D", gold: "#A77A26", cream: "#F7F2E9", line: "#E5D8C1", green: "#356B4B", danger: "#A43B2C" };
  let firstPageImage = "", page = 0, y = 0;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D;
  const segmenter = new Intl.Segmenter("th", { granularity: "word" });
  const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });
  type Line = { text: string; bold?: boolean; color?: string; size?: number; before?: number };
  type Card = { title: string; columns: Line[][]; fill?: string; border?: string };
  type DrawLine = Line & { size: number; leading: number; before: number };
  type CardLayout = { title: string; columns: DrawLine[][]; height: number; fill: string; border: string };

  function text(value: string, x: number, baseline: number, size = 9.4, bold = false, color = colors.ink) {
    ctx.font = `${bold ? 600 : 400} ${size}px PepSarabun`;
    ctx.fillStyle = color; ctx.fillText(value, x, baseline);
  }
  function box(x: number, top: number, w: number, h: number, fill: string, border?: string) {
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(x, top, w, h, 6);
    else ctx.rect(x, top, w, h);
    ctx.fillStyle = fill; ctx.fill();
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 0.6; ctx.stroke(); }
  }
  function wrap(value: string, maxWidth: number, size: number, bold = false) {
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
  function finishPage() {
    ctx.strokeStyle = colors.line; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(margin, 785); ctx.lineTo(width - margin, 785); ctx.stroke();
    text("กิจกรรม: ตามวันที่เลือก • การเรียน / Quiz: ล่าสุด • เป้าหมาย: รายปี", margin, 798, 7, false, colors.muted);
    text(`สร้างรายงาน: ${dataTimestampLabel(report.generatedAt)}`, margin, 811, 7, false, colors.muted);
    text(`หน้า ${page}`, width - 65, 811, 7, false, colors.muted);
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
    ctx = context; ctx.scale(scale, scale);
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = colors.cream; ctx.fillRect(0, 0, width, page === 1 ? 106 : 69);
    text("ROYAL PARTNER", margin, 25, 8.5, true, colors.gold);
    text(page === 1 ? "สรุปผลงานสำหรับคุย PEP" : "สรุป PEP (ต่อ)", margin, 49, page === 1 ? 20 : 16, true);
    if (page === 1) {
      const nameLines = wrap(`${report.context.agentName} • รหัส ${report.context.agentCode || "ยังไม่มีรหัส"}`, contentWidth, 11, true);
      nameLines.forEach((line, index) => text(line, margin, 72 + index * 14, 11, true));
      const nameBottom = 72 + nameLines.length * 14;
      text(`วันที่ PEP: ${report.note ? formatThaiDateLong(report.note.pepDate) : "ไม่แนบคอมเมนต์ PEP"}`, margin, nameBottom + 1, 8, false, colors.muted);
      y = Math.max(123, nameBottom + 25);
    } else {
      text(report.context.agentName, margin, 63, 8, false, colors.muted); y = 91;
    }
  }
  function ensure(space: number) { if (y + space > bottom) newPage(); }
  function paragraph(value: string, size = 9, bold = false, leading = 13, color = colors.ink) {
    for (const line of wrap(value, contentWidth, size, bold)) {
      ensure(leading); text(line, margin, y, size, bold, color); y += leading;
    }
  }
  function heading(value: string) {
    ensure(36); y += 7; paragraph(value, 11, true, 18, colors.gold);
  }
  function lineHeight(lines: DrawLine[]) { return lines.reduce((sum, line) => sum + line.before + line.leading, 0); }
  function layout(card: Card, w: number): CardLayout {
    const colWidth = (w - 24 - gap * (card.columns.length - 1)) / card.columns.length;
    const columns = card.columns.map(column => column.flatMap(line => {
      const size = line.size ?? 9.3;
      return wrap(line.text, colWidth, size, line.bold).map((part, index) => ({
        ...line, text: part, size, leading: size + 3, before: index === 0 ? line.before ?? 0 : 0,
      }));
    }));
    return { title: card.title, columns, height: 31 + Math.max(0, ...columns.map(lineHeight)), fill: card.fill ?? "#FCFAF6", border: card.border ?? colors.line };
  }
  function paintCard(card: CardLayout, x: number, top: number, w: number, forcedHeight = card.height) {
    box(x, top, w, forcedHeight, card.fill, card.border);
    text(card.title, x + 12, top + 16, 10, true, colors.gold);
    const colWidth = (w - 24 - gap * (card.columns.length - 1)) / card.columns.length;
    card.columns.forEach((column, index) => {
      let baseline = top + 30;
      for (const line of column) {
        baseline += line.before;
        text(line.text, x + 12 + index * (colWidth + gap), baseline, line.size, line.bold, line.color ?? colors.ink);
        baseline += line.leading;
      }
    });
  }
  // Split oversized cards at wrapped line boundaries; never crop comments or course names.
  function fullCard(card: Card) {
    const measured = layout(card, contentWidth);
    if (measured.height <= bottom - 91) {
      ensure(measured.height); paintCard(measured, margin, y, contentWidth); y += measured.height + 8; return;
    }
    const remaining = measured.columns.map(column => [...column]); let part = 0;
    while (remaining.some(column => column.length)) {
      if (bottom - y < 90) newPage();
      const limit = bottom - y - 31;
      const columns = remaining.map(column => {
        const chunk: DrawLine[] = []; let used = 0;
        while (column.length && used + column[0].before + column[0].leading <= limit) {
          const line = column.shift()!; chunk.push(line); used += line.before + line.leading;
        }
        return chunk;
      });
      if (!columns.some(column => column.length)) { newPage(); continue; }
      const height = 31 + Math.max(...columns.map(lineHeight));
      paintCard({ ...measured, title: card.title + (part ? " (ต่อ)" : ""), columns, height }, margin, y, contentWidth);
      y += height + 8; part += 1;
      if (remaining.some(column => column.length)) newPage();
    }
  }
  function cardRow(cards: Card[], ratios = cards.map(() => 1)) {
    const available = contentWidth - gap * (cards.length - 1);
    const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0);
    const widths = ratios.map(ratio => available * ratio / totalRatio);
    const measured = cards.map((card, index) => layout(card, widths[index]));
    const rowHeight = Math.max(...measured.map(card => card.height));
    if (rowHeight > bottom - 91) { cards.forEach(fullCard); return; }
    ensure(rowHeight);
    let left = margin;
    measured.forEach((card, index) => { paintCard(card, left, y, widths[index], rowHeight); left += widths[index] + gap; });
    y += rowHeight + 8;
  }
  newPage();
  paragraph(`ช่วงกิจกรรม: ${formatThaiDateLong(report.context.startDate)} - ${formatThaiDateLong(report.context.endDate)}`, 9, true, 13);
  paragraph(`ช่องทาง: ${report.context.channel} • ตัวแทนรายบุคคล`, 7.5, false, 11, colors.muted);
  heading("01  กิจกรรมและการขาย");
  const metrics = reportActivityLines(report);
  if (!metrics.length) paragraph(report.context.activityState === "error" ? "โหลดกิจกรรมไม่สำเร็จ จึงไม่แสดงตัวเลข" : "ไม่มีบันทึกกิจกรรมในช่วงวันที่และช่องทางที่เลือก");
  else {
    const cardWidth = (contentWidth - gap * 2) / 3;
    for (let row = 0; row < 2; row++) {
      ensure(47);
      metrics.slice(row * 3, row * 3 + 3).forEach(([label, value], index) => {
        const x = margin + index * (cardWidth + gap);
        box(x, y, cardWidth, 41, colors.cream);
        text(label, x + 10, y + 13, 7.8, false, colors.muted);
        ctx.font = "600 14px PepSarabun";
        const size = Math.min(14, 14 * (cardWidth - 20) / Math.max(1, ctx.measureText(value).width));
        text(value, x + 10, y + 32, size, true);
      }); y += 47;
    }
  }
  paragraph("ข้อโต้แย้ง / ปิดการขาย: นับกิจกรรมในฟอร์ม ไม่ใช่จำนวนกรมธรรม์ที่อนุมัติ", 7, false, 10, colors.muted);
  if (report.context.activityState === "stale") paragraph("ข้อมูลกิจกรรมที่โหลดไว้ก่อนหน้า • รีเฟรชล่าสุดไม่สำเร็จ", 7.5, true, 11, colors.gold);
  paragraph(`ดึงกิจกรรมล่าสุด: ${dataTimestampLabel(report.context.fetchedAt)}`, 7, false, 10, colors.muted);

  heading("02  การเรียนและเป้าหมาย");
  const learning = reportLearningLines(report);
  const courseRows = selectCourseRows(report.skoolRows ?? [], report.context.agentId);
  const groups = courseProgressGroups(courseRows);
  const prefixes = new Map<string, Set<string>>();
  courseRows.forEach(row => {
    const short = row.courseName.split("|")[0].trim();
    if (!prefixes.has(short)) prefixes.set(short, new Set());
    prefixes.get(short)!.add(row.courseName);
  });
  const courseLabel = (name: string) => {
    const short = name.split("|")[0].trim();
    return short && prefixes.get(short)?.size === 1 ? short : name;
  };
  const courseColumns: Line[][] = [[], []];
  if (report.skoolError || !courseRows.length) {
    courseColumns[0].push({ text: report.skoolError ? "กดรีเฟรชแล้วสร้างรายงานใหม่" : "ยังระบุคอร์สที่ไม่เริ่มเรียนไม่ได้", size: 8, color: colors.muted });
  } else {
    for (const group of groups.filter(group => group.rows.length)) {
      const column = group.key === "completed" || group.key === "in_progress" ? courseColumns[0] : courseColumns[1];
      column.push({ text: `${group.label} · ${group.rows.length} คอร์ส`, bold: true, color: group.key === "completed" ? colors.green : colors.ink, before: column.length ? 5 : 0 });
      group.rows.forEach(row => column.push({ text: `${courseLabel(row.courseName)} · ${row.progressPercent}%` }));
    }
  }
  const actualColumns = courseColumns.filter(column => column.length);
  // A single large group uses both columns while keeping each course complete.
  if (actualColumns.length === 1 && actualColumns[0].length > 8 && groups.filter(group => group.rows.length).length === 1) {
    const original = actualColumns[0]; const middle = 1 + Math.ceil((original.length - 1) / 2);
    actualColumns.push([{ ...original[0], text: original[0].text + " (ต่อ)" }, ...original.splice(middle)]);
  }
  const summaryLines: Line[] = [
    { text: learning[0][1], size: 8.5, color: colors.muted },
    { text: `CSV ล่าสุด: ${learning[1][1]}`, size: 7.5, color: colors.muted },
  ];
  // Put summary in the left column; align the right column below the summary.
  const columns = actualColumns.length > 1
    ? [[...summaryLines, ...actualColumns[0].map((line, index) => index === 0 ? { ...line, before: 5 } : line)],
       [{ text: "สถานะตามข้อมูลรายคอร์ส", size: 8.5, color: colors.muted }, { text: "CSV ไม่ระบุการเรียนจบรายบท", size: 7.5, color: colors.muted }, ...actualColumns[1].map((line, index) => index === 0 ? { ...line, before: 5 } : line)]]
    : [[...summaryLines, ...actualColumns[0].map((line, index) => index === 0 ? { ...line, before: 5 } : line)]];
  fullCard({ title: "Skool | ความคืบหน้ารายคอร์ส", columns });

  const failed = failedQuizAttempts(report.quizRows ?? [], report.context.agentId);
  const quizLines: Line[] = [
    { text: learning[2][1], bold: true },
    { text: `คะแนนอัปเดต: ${learning[3][1]}`, size: 7.3, color: colors.muted },
  ];
  if (!report.quizError && report.quiz?.results) {
    quizLines.push({ text: `บทที่ต้องทบทวน · ${failed.length} รายการ`, bold: true, before: 5, color: failed.length ? colors.danger : colors.green });
    failed.forEach(row => {
      quizLines.push({ text: `${row.courseName.split("|")[0].trim()} / ${row.parentLessonName || row.lessonName}`, before: 3 });
      quizLines.push({ text: `${row.score}/${row.maxScore} (${row.scorePercent}%) • ไม่ผ่าน`, bold: true, color: colors.danger });
    });
    if (!failed.length) quizLines.push({ text: "ไม่มีผลสอบครั้งล่าสุดที่ไม่ผ่าน", color: colors.green, size: 8 });
  }
  cardRow([
    { title: "Google Forms | ผลสอบล่าสุด", columns: [quizLines], fill: failed.length ? "#FFF7F3" : "#FCFAF6" },
    { title: learning[4][0], columns: [[{ text: learning[4][1] }, { text: "เป้าหมายรายปีของตัวแทนที่เลือก", size: 7.5, color: colors.muted, before: 7 }]] },
  ], [0.64, 0.36]);

  heading("03  คอมเมนต์และแผนทำต่อ");
  if (!report.note) fullCard({ title: "บันทึก PEP", columns: [[{ text: "ไม่แนบคอมเมนต์ PEP ในรายงานนี้", color: colors.muted }]] });
  else {
    paragraph(`บันทึกวันที่ ${formatThaiDateLong(report.note.pepDate)} • อัปเดต ${dataTimestampLabel(report.note.updatedAt)}`, 7.2, false, 11, colors.muted);
    cardRow([
      { title: "ข้อเสนอแนะ / เทคนิค", columns: [[{ text: report.note.recommendation || "ยังไม่ได้บันทึก" }]] },
      { title: "คำถามชวนโค้ช", columns: [[{ text: report.note.coachingQuestion || "ยังไม่ได้บันทึก" }]] },
      { title: "Action Plan", columns: [[{ text: report.note.actionPlan || "ยังไม่ได้บันทึก" }]] },
    ]);
  }
  finishPage();
  doc.setProperties({ title: "Royal Partner - PEP Summary", subject: "Individual PEP summary", creator: "Agent Activity Tracker" });
  onPreview?.(firstPageImage, page);
  return doc.output("blob");
}
