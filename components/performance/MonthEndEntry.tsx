"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import PageTopBar from "@/components/PageTopBar";
import { AIA_GROUP_LABEL, AIA_METRICS, AiaAction, AiaEntity, AiaGroup, AiaMetric, AiaInputKey, AiaPayload, AiaRow, AiaScope, aiaMoney, applyAiaPaste, bangkokPeriod, emptyAiaRow, monthEnd, periodLabel, SCOPE_LABEL, validateAiaRows } from "@/lib/aia-monthly";
import { PeriodPicker, ScopeTabs } from "./PerformanceControls";

type DraftRow = AiaEntity & Record<AiaInputKey, string> & { note: string };
function draftRow(row: AiaRow): DraftRow {
  const result = { ...row } as unknown as DraftRow;
  AIA_METRICS.forEach(m => { result[m.key] = row[m.key] == null ? "" : aiaMoney(row[m.key], m.integer); });
  result.active_agents = row.active_agents == null ? "" : String(row.active_agents);
  result.approved_months = row.approved_months == null ? "" : String(row.approved_months);
  result.note = row.note ?? "";
  return result;
}

export default function MonthEndEntry() {
  const [selection, setSelection] = useState(bangkokPeriod);
  const [scope, setScope] = useState<AiaScope>("person");
  const [group, setGroup] = useState<AiaGroup>("month");
  const [payload, setPayload] = useState<AiaPayload | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [asOf, setAsOf] = useState(monthEnd(selection.year, selection.month));
  const [dirty, setDirty] = useState(false), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [paste, setPaste] = useState<string | null>(null);
  const [comparison, setComparison] = useState<{ unit: string; person: number | null; reported: number | null }[] | null>(null);
  const requestVersion = useRef(0);
  const locked = payload?.batch?.status === "confirmed";
  const fields = AIA_METRICS.filter(m => m.group === group);
  const keys: AiaInputKey[] = [...fields.map(m => m.key)];
  const inputKeys: AiaInputKey[] = [...keys, ...(scope === "unit" && group === "month" ? ["active_agents" as const] : []), ...(scope === "person" && group === "ytd" ? ["approved_months" as const] : [])];

  const load = useCallback(async (signal?: AbortSignal) => {
    const version = ++requestVersion.current;
    setLoading(true); setError(""); setComparison(null); setPayload(null); setRows([]);
    try {
      const response = await fetch(`/api/monthly-production?year=${selection.year}&month=${selection.month}&scope=${scope}`, { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
      if (signal?.aborted || version !== requestVersion.current) return;
      const loaded = data as AiaPayload;
      const saved = new Map(loaded.rows.map(r => [r.entity_code, r]));
      const entities = loaded.batch?.status === "confirmed" ? loaded.rows : [...loaded.entities, ...loaded.rows.filter(r => !loaded.entities.some(e => e.entity_code === r.entity_code))];
      setRows(entities.map(e => draftRow(saved.get(e.entity_code) ?? emptyAiaRow(e))));
      setPayload(loaded); setLoadedKey(`${selection.year}-${selection.month}-${scope}`); setAsOf(loaded.batch?.as_of_date ?? monthEnd(selection.year, selection.month)); setDirty(false);
    } catch (e) { if (!signal?.aborted && version === requestVersion.current) setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"); }
    finally { if (!signal?.aborted && version === requestVersion.current) setLoading(false); }
  }, [selection.year, selection.month, scope]);

  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  useEffect(() => { const handler = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } }; window.addEventListener("beforeunload", handler); return () => window.removeEventListener("beforeunload", handler); }, [dirty]);
  const mayLeave = () => !dirty || window.confirm("มีข้อมูลที่ยังไม่บันทึก ต้องการออกจากส่วนนี้และทิ้งการแก้ไขหรือไม่?");

  async function save(action: AiaAction) {
    setError(""); setNotice("");
    let values: AiaRow[] = [];
    try { if (action !== "reopen") values = validateAiaRows(rows, action === "confirm"); }
    catch (e) { setError((e as Error).message); return; }
    if (action === "confirm" && !window.confirm(`ยืนยันยอด${SCOPE_LABEL[scope]} — ${periodLabel(selection.year, selection.month)} เป็นยอดรวมทั้งเดือน ใช่หรือไม่?`)) return;
    setSaving(true);
    try {
      const response = await fetch("/api/monthly-production", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...selection, scope, action, revision: payload?.batch?.revision ?? 0, as_of_date: asOf, schema_version: 2, rows: values }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      await load();
      setNotice(action === "reopen" ? "เปิดแก้ไขยอดระดับนี้แล้ว ต้องยืนยันอีกครั้งก่อนใช้รายงานประจำเดือน" : action === "confirm" ? `ยืนยันยอด${SCOPE_LABEL[scope]}แล้ว · อีกระดับยืนยันแยกกัน` : "บันทึกฉบับร่างแล้ว");
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  function applyPaste() {
    try {
      const numeric = validateAiaRows(rows);
      setRows(applyAiaPaste(paste ?? "", numeric, keys).map(draftRow)); setDirty(true); setPaste(null); setError(""); setNotice("จับคู่ด้วยรหัสและนำข้อมูลลงตารางแล้ว กรุณาตรวจทานก่อนยืนยัน");
    } catch (e) { setError((e as Error).message); }
  }
  async function compare() {
    if (comparison) { setComparison(null); return; }
    const version = requestVersion.current;
    try {
      const response = await fetch(`/api/monthly-production?year=${selection.year}&month=${selection.month}&scope=person`, { cache: "no-store" });
      const data = await response.json() as AiaPayload & { error?: string };
      if (version !== requestVersion.current) return;
      if (!response.ok) throw new Error(data.error || "โหลดข้อมูลบุคคลไม่สำเร็จ");
      if (!data.batch) throw new Error("ยังไม่มีข้อมูลรายบุคคลของเดือนนี้ให้เทียบ");
      const numeric = validateAiaRows(rows);
      setComparison(numeric.map(unit => {
        const members = data.rows.filter(r => r.unit_code === unit.entity_code);
        return { unit: unit.entity_name, reported: unit.month_fyp,
          person: members.length && members.every(r => r.month_fyp != null) ? members.reduce((sum, r) => sum + r.month_fyp!, 0) : null };
      }));
      setNotice(`เปรียบเทียบ FYP กับรายบุคคล (${data.batch.status === "confirmed" ? "ยืนยันแล้ว" : "ฉบับร่าง"}) · ใช้ช่วยตรวจ ไม่บังคับให้ยอดเท่ากัน`);
    } catch (e) { setError((e as Error).message); }
  }
  const busy = loading || saving || loadedKey !== `${selection.year}-${selection.month}-${scope}`;
  return <main className="rp-aia rp-monthly-entry"><div className="rp-aia-inner">
    <PageTopBar /><div className="rp-eyebrow">ROYAL PARTNER · PERFORMANCE</div><h1>บันทึกผลงานรายเดือน</h1>
    <p className="rp-muted">กรอกยอดรวมทั้งเดือน เดือนละครั้ง ทั้งนำส่งและอนุมัติ · รายบุคคล / รายหน่วย</p>
    <div className="rp-aia-toolbar">
      <PeriodPicker {...selection} disabled={saving} onChange={(year, month) => { if (mayLeave()) { setSelection({ year, month }); setPaste(null); setNotice(""); } }} />
      <div className="rp-push"><ScopeTabs scope={scope} disabled={saving} onChange={value => { if (value !== scope && mayLeave()) { setScope(value); setPaste(null); setNotice(""); } }} /></div>
      <span className="rp-aia-badge">{SCOPE_LABEL[scope]} · {locked ? "ยืนยันแล้ว" : "ฉบับร่าง"}</span>
    </div>
    {payload && !payload.configured && <p role="alert" className="rp-aia-message rp-aia-error">ระบบบันทึกรายเดือนต้องอัปเดตฐานข้อมูลก่อนใช้งาน กรุณาติดต่อผู้ดูแลระบบ</p>}
    {error && <div role="alert" className="rp-aia-message rp-aia-error">{error} <button type="button" disabled={saving} onClick={() => { if (mayLeave()) void load(); }}>โหลดใหม่</button></div>}
    <div className="rp-aia-panel"><div className="rp-aia-panel-head">
      <div className="rp-performance-segments" role="group" aria-label="กลุ่มข้อมูล">{(Object.keys(AIA_GROUP_LABEL) as AiaGroup[]).map(g => <button type="button" key={g} aria-pressed={group === g} onClick={() => { setGroup(g); setPaste(null); }}>{AIA_GROUP_LABEL[g]}</button>)}</div>
      <button type="button" disabled={busy || locked || !payload?.configured} onClick={() => setPaste(paste === null ? "" : null)}>วางจาก Excel</button>
    </div>
    <div className="rp-aia-hint">{group === "ytd" ? "กรอกยอดสะสมจาก AIA โดยตรง ไม่บวก YTD แต่ละเดือนเข้าด้วยกัน" : group === "persist" ? "กรอกค่าของเดือนที่เลือกตาม AIA ได้โดยตรง แม้ลดลงจากเดือนก่อน · LIMRA ไม่เฉลี่ยเอง" : group === "pa" ? "กรอกยอด PA รวมทั้งเดือน และยอดสะสม PA ตามรายงาน" : "กรอกยอดรวมทั้งเดือน ไม่ใช่ยอดของวันใดวันหนึ่ง · ยอดเป็นศูนย์ให้กรอก 0"}</div>
    {paste !== null && <div className="rp-aia-paste"><label>วางรหัส{scope === "person" ? "ตัวแทน" : "หน่วย"} ตามด้วย {keys.length} คอลัมน์: {keys.map(key => key === "active_agents" ? "Active Agent" : key === "approved_months" ? "Approved Months" : AIA_METRICS.find(m => m.key === key)?.label).join(" / ")}<textarea value={paste} onChange={e => setPaste(e.target.value)} placeholder="คัดลอกเซลล์จาก Excel โดยไม่รวมหัวตาราง · ไม่ต้องเรียงแถว" /></label><button type="button" onClick={applyPaste}>นำลงตาราง</button> <button type="button" onClick={() => setPaste(null)}>ยกเลิก</button></div>}
    <div className="rp-aia-scroll"><table><thead><tr><th className="rp-identity">{scope === "person" ? "ตัวแทน / รหัส / หน่วย" : "หน่วย / รหัส"}</th>{fields.map(m => <th key={m.key}>{m.label}</th>)}{scope === "unit" && group === "month" && <th>Active Agent (ถ้ามี)</th>}{scope === "person" && group === "ytd" && <th>Approved Months (ถ้ามี)</th>}{group === "month" && <th>หมายเหตุ</th>}</tr></thead><tbody>
      {loading ? <tr><td colSpan={inputKeys.length + 1 + (group === "month" ? 1 : 0)}>กำลังโหลดข้อมูล…</td></tr> : !rows.length ? <tr><td colSpan={inputKeys.length + 1 + (group === "month" ? 1 : 0)}>ไม่พบรายชื่อที่มีรหัสในทะเบียน</td></tr> : rows.map((row, index) => <tr key={row.entity_code}><td className="rp-identity">{row.entity_name}{row.nickname && <small>ชื่อเล่น: {row.nickname}</small>}<small>{row.entity_code}{scope === "person" ? ` · ${row.unit_name ?? "ไม่ระบุหน่วย"}` : ""}</small></td>{inputKeys.map(key => <td key={key}><input className="rp-aia-number" inputMode="decimal" disabled={busy || locked || !payload?.configured} aria-label={`${row.entity_name} ${key === "active_agents" ? "Active Agent" : key === "approved_months" ? "Approved Months" : AIA_METRICS.find(m => m.key === key)?.label}`} placeholder={key === "active_agents" || key === "approved_months" ? "ไม่ระบุ" : "ยังไม่มีข้อมูล"} value={row[key]} onChange={e => { setRows(current => current.map((r, i) => i === index ? { ...r, [key]: e.target.value } : r)); setDirty(true); }} /></td>)}{group === "month" && <td><input aria-label={`หมายเหตุ ${row.entity_name}`} value={row.note} maxLength={2000} disabled={busy || locked || !payload?.configured} onChange={e => { setRows(current => current.map((r, i) => i === index ? { ...r, note: e.target.value } : r)); setDirty(true); }} /></td>}</tr>)}
    </tbody></table></div><div className="rp-aia-foot"><span>{rows.length} {scope === "person" ? "คน" : "หน่วย"} · จับคู่ด้วยรหัส{dirty ? " · มีการแก้ไขที่ยังไม่บันทึก" : ""}</span><span>ยอดบุคคลและยอดหน่วยยืนยันแยกกัน</span></div></div>
    <div className="rp-aia-actions"><div>{scope === "unit" && <button type="button" disabled={busy} onClick={() => void compare()}>เทียบยอดรวมรายบุคคล</button>}</div><div><button type="button" disabled={busy || locked || !payload?.configured} onClick={() => void save("draft")}>บันทึกฉบับร่าง</button><button type="button" className="rp-primary" disabled={busy || !payload?.configured || !rows.length} onClick={() => void save(locked ? "reopen" : "confirm")}>{saving ? "กำลังบันทึก…" : `${locked ? "เปิดแก้ไขยอด" : "ยืนยันยอด"}${SCOPE_LABEL[scope]} — ${periodLabel(selection.year, selection.month)}`}</button></div></div>
    <div className="rp-aia-message" aria-live="polite">{notice}</div>
    {comparison && <div className="rp-aia-panel"><div className="rp-aia-panel-head"><h2>เทียบ FYP เดือนนี้</h2></div><div className="rp-aia-scroll"><table><thead><tr><th>หน่วย</th><th>รวมรายบุคคล</th><th>หน่วยตาม AIA</th><th>ส่วนต่าง</th></tr></thead><tbody>{comparison.map(r => <tr key={r.unit}><td>{r.unit}</td><td>{aiaMoney(r.person)}</td><td>{aiaMoney(r.reported)}</td><td>{aiaMoney(r.reported === null || r.person === null ? null : r.reported - r.person)}</td></tr>)}</tbody></table></div></div>}
    {payload?.history.length ? <details className="rp-aia-panel"><summary className="rp-aia-panel-head">ประวัติการบันทึก ({payload.history.length} รายการล่าสุด)</summary><ul>{payload.history.map(h => <li key={h.revision}>เวอร์ชัน {h.revision} · {h.action === "confirm" ? "ยืนยันยอด" : h.action === "reopen" ? "เปิดแก้ไข" : "บันทึกฉบับร่าง"} · {new Date(h.changed_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</li>)}</ul></details> : null}
  </div></main>;
}
