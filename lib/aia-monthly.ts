export type AiaScope = "person" | "unit";
export type AiaAction = "draft" | "confirm" | "reopen";
export type AiaGroup = "month" | "ytd" | "persist" | "pa";
export const AIA_METRICS = [
  { key: "month_cases_submitted", label: "Case นำส่ง", group: "month", integer: true },
  { key: "month_cases", label: "Case อนุมัติ", group: "month", integer: true },
  { key: "month_fyp_submitted", label: "FYP นำส่ง", group: "month", integer: false },
  { key: "month_fyp", label: "FYP อนุมัติ", group: "month", integer: false },
  { key: "month_fyc", label: "FYC อนุมัติ", group: "month", integer: false },
  { key: "ytd_cases", label: "Cases YTD", group: "ytd", integer: true },
  { key: "ytd_fyp", label: "FYP YTD", group: "ytd", integer: false },
  { key: "ytd_fyc", label: "FYC YTD", group: "ytd", integer: false },
  { key: "exp", label: "EXP", group: "persist", integer: false },
  { key: "lap", label: "LAP", group: "persist", integer: false },
  { key: "limra", label: "LIMRA (%)", group: "persist", integer: false },
  { key: "month_pa_cases", label: "PA Case เดือนนี้", group: "pa", integer: true },
  { key: "month_pa_fyp", label: "PA FYP เดือนนี้", group: "pa", integer: false },
  { key: "month_pa_fyc", label: "PA FYC เดือนนี้", group: "pa", integer: false },
  { key: "ytd_pa_cases", label: "PA Case YTD", group: "pa", integer: true },
  { key: "ytd_pa_fyp", label: "PA FYP YTD", group: "pa", integer: false },
  { key: "ytd_pa_fyc", label: "PA FYC YTD", group: "pa", integer: false },
] as const;
export type AiaMetric = typeof AIA_METRICS[number]["key"];
export type AiaEntity = {
  entity_code: string;
  entity_name: string;
  nickname: string | null;
  unit_id: number | null;
  unit_code: string | null;
  unit_name: string | null;
};
export type AiaRow = AiaEntity & Record<AiaMetric, number | null> & { active_agents: number | null; approved_months: number | null; note: string };
export type AiaInputKey = AiaMetric | "active_agents" | "approved_months";
export type AiaBatch = {
  id: number; report_year: number; report_month: number; scope: AiaScope;
  as_of_date: string; status: "draft" | "confirmed"; revision: number;
  updated_at: string; confirmed_at: string | null;
};
export type AiaPayload = {
  configured: boolean; batch: AiaBatch | null; rows: AiaRow[];
  entities: AiaEntity[]; history: { revision: number; action: string; changed_at: string }[];
};
export const SCOPE_LABEL: Record<AiaScope, string> = { person: "รายบุคคล", unit: "รายหน่วย" };
export const AIA_GROUP_LABEL: Record<AiaGroup, string> = { month: "ผลงานเดือนนี้", ytd: "สะสม YTD", persist: "EXP / LAP / LIMRA", pa: "PA" };

export function emptyAiaRow(entity: AiaEntity): AiaRow {
  return { ...entity, month_cases: null, month_fyp: null, month_fyc: null, month_cases_submitted: null, month_fyp_submitted: null,
    ytd_cases: null, ytd_fyp: null, ytd_fyc: null, exp: null, lap: null, limra: null, active_agents: null,
    month_pa_cases: null, month_pa_fyp: null, month_pa_fyc: null, ytd_pa_cases: null, ytd_pa_fyp: null, ytd_pa_fyc: null, approved_months: null, note: "" };
}

export function parseAiaNumber(value: unknown, key: AiaInputKey): number | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
  if (typeof value !== "number" && typeof value !== "string") throw new Error("ตัวเลขไม่ถูกต้อง");
  const raw = String(value).trim();
  if (!/^\d+(?:,\d{3})*(?:\.\d{1,2})?$/.test(raw)) throw new Error("กรอกตัวเลขไม่ติดลบ และทศนิยมไม่เกิน 2 ตำแหน่ง");
  const result = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(result) || result > 999999999999.99) throw new Error("ตัวเลขเกินขอบเขตที่รองรับ");
  if ((AIA_METRICS.some(m => m.key === key && m.integer) || key === "active_agents" || key === "approved_months") && (!Number.isInteger(result) || result > 2147483647)) throw new Error("Cases และจำนวนคน/เดือนต้องเป็นจำนวนเต็ม");
  if (key === "approved_months" && result > 12) throw new Error("จำนวนเดือนต้องไม่เกิน 12");
  if (key === "limra" && result > 100) throw new Error("LIMRA ต้องอยู่ระหว่าง 0–100");
  return result;
}

export function validateAiaRows(raw: unknown, confirm = false): AiaRow[] {
  if (!Array.isArray(raw) || !raw.length || raw.length > 2000) throw new Error("จำนวนแถวต้องอยู่ระหว่าง 1–2,000");
  const seen = new Set<string>();
  return raw.map((value) => {
    if (!value || typeof value !== "object") throw new Error("ข้อมูลแถวไม่ถูกต้อง");
    const code = typeof value.entity_code === "string" ? value.entity_code.trim() : "";
    if (!code || code.length > 100 || seen.has(code)) throw new Error("รหัสว่างหรือมีรหัสซ้ำในตาราง");
    seen.add(code);
    const row = emptyAiaRow({ entity_code: code, entity_name: String(value.entity_name ?? "").trim().slice(0, 250),
      nickname: value.nickname ? String(value.nickname).slice(0, 100) : null,
      unit_id: Number.isInteger(value.unit_id) ? value.unit_id : null,
      unit_code: value.unit_code ? String(value.unit_code).slice(0, 100) : null,
      unit_name: value.unit_name ? String(value.unit_name).slice(0, 250) : null });
    for (const metric of AIA_METRICS) {
      row[metric.key] = parseAiaNumber(value[metric.key], metric.key);
      if (confirm && row[metric.key] === null) throw new Error(`${code}: ยังไม่ได้กรอก ${metric.label} (ถ้ายอดเป็นศูนย์ ให้กรอก 0)`);
    }
    row.active_agents = parseAiaNumber(value.active_agents, "active_agents");
    row.approved_months = parseAiaNumber(value.approved_months, "approved_months");
    row.note = typeof value.note === "string" ? value.note.trim().slice(0, 2000) : "";
    return row;
  });
}

/** TSV requires stable codes; never match a financial row by its current display name. */
export function applyAiaPaste(text: string, rows: AiaRow[], keys: AiaInputKey[]): AiaRow[] {
  if (!text.trim()) throw new Error("วางข้อมูลจาก Excel ก่อน");
  const seen = new Set<string>();
  const result = rows.map(row => ({ ...row }));
  for (const line of text.replace(/\r/g, "").replace(/\n+$/, "").split("\n")) {
    const cells = line.split("\t"), code = cells.shift()?.trim() ?? "";
    const row = result.find(item => item.entity_code === code);
    if (!row) throw new Error(`ไม่พบรหัส ${code} ในตาราง`);
    if (seen.has(code)) throw new Error(`รหัส ${code} ซ้ำ`);
    if (cells.length !== keys.length) throw new Error(`${code}: ต้องมีรหัสและตัวเลข ${keys.length} คอลัมน์ตามหัวตาราง`);
    seen.add(code);
    keys.forEach((key, index) => { row[key] = parseAiaNumber(cells[index], key); });
  }
  return result;
}

export function bangkokPeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return { year: Number(parts.find(p => p.type === "year")?.value), month: Number(parts.find(p => p.type === "month")?.value) };
}
export function monthEnd(year: number, month: number) { return `${year}-${String(month).padStart(2, "0")}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`; }
export function periodLabel(year: number, month: number) { return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1))); }
export function aiaMoney(value: number | null | undefined, integer = false) { return value === null || value === undefined ? "—" : value.toLocaleString("en-US", { minimumFractionDigits: integer ? 0 : 2, maximumFractionDigits: integer ? 0 : 2 }); }
