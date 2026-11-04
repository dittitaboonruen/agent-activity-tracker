"use client";
import { AiaScope, periodLabel, SCOPE_LABEL } from "@/lib/aia-monthly";
import "./performance.css";

export function EntryModeTabs({ monthly, onDaily, onMonthly }: { monthly: boolean; onDaily: () => void; onMonthly: () => void }) {
  return <div className="rp-performance-tabs" role="group" aria-label="ประเภทการบันทึก">
    <button type="button" aria-pressed={!monthly} onClick={onDaily}>บันทึกรายวัน</button>
    <button type="button" aria-pressed={monthly} onClick={onMonthly}>ปิดยอด AIA สิ้นเดือน</button>
  </div>;
}
export function ReportSourceTabs({ aia, onDaily, onAia }: { aia: boolean; onDaily: () => void; onAia: () => void }) {
  return <div className="rp-performance-tabs rp-source-tabs" role="group" aria-label="แหล่งข้อมูลรายงาน">
    <button type="button" aria-pressed={!aia} onClick={onDaily}>ติดตามระหว่างเดือน</button>
    <button type="button" aria-pressed={aia} onClick={onAia}>ยอดยืนยัน AIA</button>
  </div>;
}
export function ScopeTabs({ scope, onChange, disabled = false }: { scope: AiaScope; onChange: (scope: AiaScope) => void; disabled?: boolean }) {
  return <div className="rp-performance-segments" role="group" aria-label="ระดับข้อมูล">
    {(["person", "unit"] as const).map(value => <button type="button" key={value} aria-pressed={scope === value} disabled={disabled} onClick={() => onChange(value)}>{SCOPE_LABEL[value]}</button>)}
  </div>;
}
export function PeriodPicker({ year, month, onChange, disabled = false }: { year: number; month: number; onChange: (year: number, month: number) => void; disabled?: boolean }) {
  const current = new Date().getFullYear();
  const years = Array.from(new Set([year, ...Array.from({ length: 10 }, (_, i) => current + 1 - i)])).sort((a, b) => b - a);
  return <div className="rp-performance-period">
    <label>เดือนรายงาน<select value={month} disabled={disabled} onChange={e => onChange(year, Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{periodLabel(year, i + 1).replace(/\s*\d+$/, "")}</option>)}</select></label>
    <label>ปี พ.ศ.<select value={year} disabled={disabled} onChange={e => onChange(Number(e.target.value), month)}>{years.map(y => <option key={y} value={y}>{y + 543}</option>)}</select></label>
  </div>;
}
