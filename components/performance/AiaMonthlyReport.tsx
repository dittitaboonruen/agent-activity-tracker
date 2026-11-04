"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageTopBar from "@/components/PageTopBar";
import { AIA_METRICS, AiaPayload, AiaRow, AiaScope, aiaMoney, periodLabel, SCOPE_LABEL } from "@/lib/aia-monthly";
import { csvCell } from "@/lib/aia-monthly-report";
import { PeriodPicker, ScopeTabs } from "./PerformanceControls";

type ColumnGroup = "month" | "ytd" | "persist" | "pa" | "all";
type ReportRow = AiaRow;
type Column = { key: string; label: string; group: Exclude<ColumnGroup, "all">; source: "ยอดรายเดือน"; integer: boolean; get: (row: ReportRow) => number | null };
const GROUPS: [ColumnGroup, string][] = [["month", "เดือนนี้"], ["ytd", "สะสม YTD"], ["persist", "EXP / LAP / LIMRA"], ["pa", "PA"], ["all", "ทุกคอลัมน์"]];


export default function AiaMonthlyReport({ year, month, initialScope, onPeriodChange, onLegacy }: {
  year: number; month: number; initialScope: AiaScope;
  onPeriodChange: (year: number, month: number) => void; onLegacy: () => void;
}) {
  const [scope, setScope] = useState<AiaScope>(initialScope), [group, setGroup] = useState<ColumnGroup>("month");
  const [payload, setPayload] = useState<AiaPayload | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [ranked, setRanked] = useState(false);
  const [reload, setReload] = useState(0);
  const confirmed = loadedKey === `${year}-${month}-${scope}` && payload?.batch?.status === "confirmed";

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setPayload(null);
    void (async () => {
      try {
        const response = await fetch(`/api/monthly-performance/aia?year=${year}&month=${month}&scope=${scope}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "โหลดรายงานรายเดือน ไม่สำเร็จ");
        if (!controller.signal.aborted) { setPayload(data); setLoadedKey(`${year}-${month}-${scope}`); }
      } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [year, month, scope, reload]);


  const reportRows = useMemo<ReportRow[]>(() => {
    if (!confirmed) return [];
    const values = (payload?.rows ?? []).filter(r => !selectedUnit || r.unit_code === selectedUnit);
    return ranked ? values.sort((a, b) => (b.month_fyc ?? 0) - (a.month_fyc ?? 0)) : values;
  }, [payload, confirmed, selectedUnit, ranked]);
  const columns = useMemo<Column[]>(() => {
    const official: Column[] = AIA_METRICS.map(m => ({ key: m.key, label: m.label, group: m.group, source: "ยอดรายเดือน", integer: m.integer, get: r => r[m.key] }));
    official.push(scope === "unit"
      ? { key: "active_agents", label: "Active Agent", group: "month", source: "ยอดรายเดือน", integer: true, get: r => r.active_agents ?? null }
      : { key: "approved_months", label: "Approved Months (ถ้ามี)", group: "ytd", source: "ยอดรายเดือน", integer: true, get: r => r.approved_months ?? null });
    return official;
  }, [scope]);
  const visibleColumns = columns.filter(c => group === "all" || c.group === group);
  const unitOptions = [...new Map((payload?.rows ?? []).filter(r => r.unit_code).map(r => [r.unit_code!, r.unit_name ?? r.unit_code!])).entries()];
  const title = `${periodLabel(year, month)} · ${SCOPE_LABEL[scope]} · ยอดรายเดือนที่ยืนยัน`;
  const total = (key: "month_cases" | "month_fyp" | "month_fyc") => reportRows.reduce((s, r) => s + (r[key] ?? 0), 0);
  const active = scope === "person" ? reportRows.filter(r => (r.month_fyc ?? 0) >= 5000).length : reportRows.every(r => r.active_agents !== null) ? reportRows.reduce((s, r) => s + (r.active_agents ?? 0), 0) : null;
  const totalPa = (key: "month_pa_fyp" | "month_pa_fyc") => reportRows.every(r => r[key] != null) ? reportRows.reduce((sum, r) => sum + (r[key] ?? 0), 0) : null;

  function exportCsv() {
    const head = ["เดือน", "แหล่งข้อมูลหลัก", "ระดับ", "วันที่ AIA", "รหัส", "ชื่อ", "ชื่อเล่น", "หน่วย", ...columns.map(c => c.label), "หมายเหตุ"];
    const data = reportRows.map(r => [periodLabel(year, month), "ยอดรายเดือนที่ยืนยัน", SCOPE_LABEL[scope], payload?.batch?.as_of_date ?? "", r.entity_code, r.entity_name, r.nickname, r.unit_name, ...columns.map(c => c.get(r)), r.note ?? ""]);
    const csv = [head, ...data].map(r => r.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `RoyalPartner_Monthly_${scope}_${year}-${String(month).padStart(2, "0")}.csv`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const exportPdf = useCallback(() => {
    const oldTitle = document.title;
    document.title = `RoyalPartner_Monthly_${scope}_${year}-${String(month).padStart(2, "0")}`;
    try { window.print(); } finally { document.title = oldTitle; }
  }, [scope, year, month]);

  function table(list: Column[], print = false) {
    return <table style={!print && group === "all" ? { minWidth: 2300 } : undefined}><thead><tr><th className={print ? undefined : "rp-identity"}>{scope === "person" ? "ตัวแทน / รหัส / หน่วย" : "หน่วย / รหัส"}</th>{list.map(c => <th key={c.key}>{c.label}<small style={{ display: "block", fontWeight: 400 }}>{c.source}</small></th>)}{list.some(c => c.key === "month_fyc") && <th>หมายเหตุ</th>}</tr></thead><tbody>{reportRows.map((r, index) => <tr key={r.entity_code}><td className={print ? undefined : "rp-identity"}>{ranked ? `${index + 1}. ` : ""}{r.entity_name}{r.nickname && <small>ชื่อเล่น: {r.nickname}</small>}<small>{r.entity_code}{scope === "person" ? ` · ${r.unit_name ?? "ไม่ระบุหน่วย"}` : ""}</small></td>{list.map(c => <td key={c.key}>{aiaMoney(c.get(r), c.integer)}</td>)}{list.some(c => c.key === "month_fyc") && <td style={{ whiteSpace: "pre-wrap", minWidth: print ? 0 : 160 }}>{r.note ?? ""}</td>}</tr>)}</tbody></table>;
  }
  return <main className="rp-aia"><div className="rp-aia-inner rp-aia-screen"><PageTopBar />
    <div className="rp-eyebrow">ROYAL PARTNER · PERFORMANCE</div><h1>Monthly Performance</h1><p className="rp-muted">รายงานผลผลิตรายเดือนและยอดสะสม</p>
    <p className="rp-muted">ยอดรวมทั้งเดือนจากหน้าบันทึกรายเดือน · ไม่มีการรวมจากระบบรายวัน</p>
    <div className="rp-aia-toolbar"><PeriodPicker year={year} month={month} onChange={onPeriodChange} /><ScopeTabs scope={scope} onChange={value => { setScope(value); setSelectedUnit(""); }} />
      {unitOptions.length > 1 && <label>หน่วย<select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)}><option value="">ทุกหน่วย</option>{unitOptions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>}
      <div className="rp-push rp-performance-segments"><button type="button" onClick={onLegacy}>ดูข้อมูลเดิมก่อนปรับระบบ</button><button type="button" onClick={() => setReload(v => v + 1)} disabled={loading}>รีเฟรช</button><button type="button" aria-pressed={ranked} onClick={() => setRanked(v => !v)}>เรียงอันดับ FYC</button><button type="button" disabled={!confirmed || loading || !reportRows.length} onClick={exportCsv}>Excel (CSV)</button><button type="button" disabled={!confirmed || loading || !reportRows.length} onClick={exportPdf}>Export PDF</button></div>
    </div>
    <div className="rp-aia-hint">แหล่งข้อมูลหลัก: ยอดรายเดือนที่ยืนยัน · {SCOPE_LABEL[scope]} · {periodLabel(year, month)}{payload?.batch && ` · AIA ณ ${payload.batch.as_of_date}`} · {confirmed ? "ยืนยันแล้ว" : "รอยืนยัน"}</div>
    {error && <p role="alert" className="rp-aia-message rp-aia-error">{error}</p>}
    {loading ? <p className="rp-muted">กำลังโหลดรายงาน…</p> : !error && (!payload?.configured || !confirmed) ? <div className="rp-aia-panel rp-aia-empty"><h2>{!payload?.configured ? "ระบบบันทึกรายเดือนต้องอัปเดตฐานข้อมูล" : `ยอด${SCOPE_LABEL[scope]}ของเดือนนี้ยังไม่ยืนยัน`}</h2><p>{!payload?.configured ? "ผู้ดูแลต้องรันไฟล์ติดตั้งระบบรายเดือนฉบับล่าสุดก่อน" : "ยืนยันข้อมูลระดับนี้ในหน้ากรอกก่อนออกรายงานรายเดือน"}</p><a href="/admin/production">ไปหน้ากรอกผลงาน</a></div> : !error && <>
      {reportRows.some(r => AIA_METRICS.some(m => r[m.key] == null)) && <p className="rp-muted">บันทึกเดิมบางช่องยังไม่มีข้อมูล ช่องที่เพิ่มใหม่จะแสดง — จนกว่าจะเปิดแก้ไขและยืนยันใหม่</p>}
      <div className="rp-aia-cards">{[
        ["AIA Cases อนุมัติเดือนนี้", aiaMoney(total("month_cases"), true)], ["AIA FYP อนุมัติเดือนนี้", aiaMoney(total("month_fyp"))], ["AIA FYC อนุมัติเดือนนี้", aiaMoney(total("month_fyc"))],
        [scope === "person" ? "Active Agent (FYC ≥ 5,000)" : "Active Agent ตามรายงาน (ถ้ามี)", aiaMoney(active, true)], ["PA FYP เดือนนี้", aiaMoney(totalPa("month_pa_fyp"))], ["PA FYC เดือนนี้", aiaMoney(totalPa("month_pa_fyc"))],
      ].map(([label, value]) => <div className="rp-aia-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <div className="rp-aia-panel"><div className="rp-aia-panel-head"><h2>FYC อนุมัติ{SCOPE_LABEL[scope]} · ยอดรายเดือนที่ยืนยัน (บาท)</h2></div><div className="rp-aia-bars">{reportRows.length ? reportRows.map(r => <div className="rp-aia-bar-row" key={r.entity_code}><span>{r.entity_name}</span><div className="rp-aia-track" role="img" aria-label={`${r.entity_name} FYC ${aiaMoney(r.month_fyc)} บาท`}><div className="rp-aia-bar" style={{ width: `${(r.month_fyc ?? 0) / Math.max(...reportRows.map(row => row.month_fyc ?? 0), 1) * 100}%` }} /></div><span className="rp-aia-bar-value">{aiaMoney(r.month_fyc)}</span></div>) : <p>ไม่พบข้อมูลตามตัวเลือก</p>}</div></div>
      <div className="rp-aia-panel"><div className="rp-aia-panel-head"><h2>ผลผลิต{SCOPE_LABEL[scope]}</h2><div className="rp-performance-segments" role="group" aria-label="คอลัมน์รายงาน">{GROUPS.map(([key, label]) => <button type="button" key={key} aria-pressed={group === key} onClick={() => setGroup(key)}>{label}</button>)}</div></div><div className="rp-aia-scroll">{table(visibleColumns)}</div><div className="rp-aia-foot"><span>{reportRows.length} แถว · เลือก “ทุกคอลัมน์” เพื่อดูข้อมูลครบ · ส่งออกครบทุกกลุ่ม</span><span>LIMRA แสดงตาม AIA แต่ละแถว ไม่เฉลี่ยรวม</span></div></div>
      <p className="rp-muted">ยอดนำส่ง อนุมัติ YTD และ PA มาจากบันทึกของเดือนที่เลือกชุดเดียวกัน · ยอดหน่วยกับยอดบุคคลไม่บวกรวมกัน</p>
    </>}
  </div>{confirmed && <div className="rp-aia-print"><h1>รายงานผลผลิต เครือ Royal Partner</h1><p>{title}{selectedUnit ? ` · ${selectedUnit}` : ""}</p><p>ข้อมูล AIA ณ {payload?.batch?.as_of_date} · เวอร์ชัน {payload?.batch?.revision} · ข้อมูลยอดรวมทั้งเดือน ไม่ใช่ยอดรายวัน</p>{GROUPS.filter(([key]) => key !== "all").map(([key, label], index) => <section key={key} className={index ? "rp-aia-print-section" : undefined}><h2>{label}</h2>{table(columns.filter(c => c.group === key), true)}</section>)}</div>}</main>;
}
