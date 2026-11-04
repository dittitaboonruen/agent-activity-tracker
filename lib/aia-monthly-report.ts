import { AiaRow, AiaScope } from "./aia-monthly";

export type DailyReference = {
  production_date: string; agent_code: string | null; agent_name: string;
  aia_case_submitted: number; aia_fyp_submitted: number; aia_fyc_approved: number;
  pa_case: number; pa_fyp: number; pa_fyc: number;
};
export type ReferenceAgent = { agent_code: string | null; agent_name: string; unit_id?: number | null };
export type ReferenceTotals = { submitted_cases: number; submitted_fyp: number; approved_months: number;
  pa_cases: number; pa_fyp: number; pa_fyc: number; pa_ytd_cases: number; pa_ytd_fyp: number; pa_ytd_fyc: number };

export function dailyReferences(rows: DailyReference[], entity: AiaRow, scope: AiaScope, year: number, month: number, agents: ReferenceAgent[]): ReferenceTotals {
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const end = `${monthKey}-31`, start = `${year}-01-01`;
  const assignedCodes = new Set(agents.filter(a => a.unit_id === entity.unit_id).map(a => a.agent_code).filter(Boolean));
  const relevant = rows.filter(r => r.production_date >= start && r.production_date <= end && (
    scope === "person" ? (r.agent_code ? r.agent_code === entity.entity_code : r.agent_name === entity.entity_name)
      : !!r.agent_code && assignedCodes.has(r.agent_code)
  ));
  const current = relevant.filter(r => r.production_date.startsWith(monthKey));
  const sum = (values: DailyReference[], key: keyof DailyReference) => values.reduce((s, r) => s + (Number(r[key]) || 0), 0);
  const monthlyFyc = new Map<string, number>();
  for (const r of relevant) { const m = r.production_date.slice(0, 7); monthlyFyc.set(m, (monthlyFyc.get(m) ?? 0) + (Number(r.aia_fyc_approved) || 0)); }
  return { submitted_cases: sum(current, "aia_case_submitted"), submitted_fyp: sum(current, "aia_fyp_submitted"),
    approved_months: [...monthlyFyc.values()].filter(v => v >= 5000).length,
    pa_cases: sum(current, "pa_case"), pa_fyp: sum(current, "pa_fyp"), pa_fyc: sum(current, "pa_fyc"),
    pa_ytd_cases: sum(relevant, "pa_case"), pa_ytd_fyp: sum(relevant, "pa_fyp"), pa_ytd_fyc: sum(relevant, "pa_fyc") };
}

/** Escape all text fields for spreadsheet formula injection, including names and codes. */
export function csvCell(value: string | number | null | undefined) {
  let text = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
