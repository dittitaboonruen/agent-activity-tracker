"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Unlinked = {
  id: number; first_name: string; last_name: string; skool_profile_url: string;
  active: boolean; last_active_at: string | null; courses: number; started: number;
  completed: number; lastSyncedAt: string | null;
};
type Agent = { id: number; agentCode: string | null; agentName: string };
type AuditEntry = {
 id: number; created_at: string; skool_member_id: number; skool_name: string;
 agent_code_snapshot: string; agent_name_snapshot: string; actor_email: string;
 verification_method: string;
};
const normal = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ");

export default function SkoolUnlinkedPanel({ onLinked }: { onLinked?: () => void }) {
  const [items, setItems] = useState<Unlinked[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [accessNotice, setAccessNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState("");
  const [verificationNote, setVerificationNote] = useState("");
  const [auditReady, setAuditReady] = useState(false);
  const [auditNotice, setAuditNotice] = useState("");
  const [auditHistory, setAuditHistory] = useState<AuditEntry[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    setAccessNotice("");
    try {
      const r = await fetch("/api/skool-unlinked", { cache: "no-store" });
      if (r.status === 401 || r.status === 403) {
        setAllowed(false);
        setAccessNotice(r.status === 401 ? "กรุณาเข้าสู่ระบบ Performance Hub ใหม่" : "บัญชีนี้ดู Skool Dashboard ได้ แต่ยังไม่มีสิทธิ์ตรวจจับคู่: ต้องเป็น Admin ที่ดูทุกหน่วย หรือบัญชี Training ที่ได้รับอนุญาตและมีสิทธิ์ดูทุกหน่วย");
        return;
      }
      const data = await r.json();
      if (!r.ok || data.success !== true) throw new Error(data.error ?? "ไม่สามารถโหลดรายชื่อได้");
      setAllowed(true);
      setAuditReady(data.auditReady === true);
      setAuditNotice(typeof data.auditNotice === "string" ? data.auditNotice : "");
      setAuditHistory(Array.isArray(data.auditHistory) ? data.auditHistory : []);
      setItems(Array.isArray(data.members) ? data.members : []);
      const ar = await fetch("/api/dashboard-agents", { cache: "no-store" });
      if (!ar.ok) throw new Error("ไม่สามารถดึงทะเบียน Agent Master ได้");
      const roster = await ar.json();
      setAgents(Array.isArray(roster.agents) ? roster.agents : []);
    } catch (e) { setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const current = items.find(x => x.id === selected);
  const fullName = current ? normal([current.first_name, current.last_name].filter(Boolean).join(" ")) : "";
  const matches = useMemo(() => agents.filter(a => a.agentCode?.trim() === code.trim()), [agents, code]);
  const shown = useMemo(() => items.filter(m => {
    const q = normal(keyword).toLocaleLowerCase("th");
    return !q || [m.first_name,m.last_name,m.skool_profile_url].some(x=>normal(x ?? "").toLocaleLowerCase("th").includes(q));
  }), [items, keyword]);

  async function link() {
    if (!current || busy || !auditReady || matches.length !== 1
      || !identityConfirmed || !verificationMethod || verificationNote.trim().length < 8) return;
    const agent = matches[0];
    if (!window.confirm(`ยืนยันการเชื่อม?\nSkool: ${fullName}\nAgent Master: ${agent.agentName} (${agent.agentCode})\n\nข้อมูล Skool จะแสดงใน PEP ของตัวแทนรหัสนี้`)) return;
    setBusy(true); setError(""); setInfo("");
    try {
      const r = await fetch("/api/skool-unlinked", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: current.id, agentCode: agent.agentCode,
        confirmedName: fullName, confirmedAgentName: agent.agentName,
        verificationMethod, verificationNote: verificationNote.trim(), identityConfirmed }),
      });
      const result = await r.json();
      if (!r.ok || result.success !== true) throw new Error(result.error ?? "จับคู่ไม่สำเร็จ");
      setInfo(`จับคู่สำเร็จ: ${fullName} → ${result.agentName} (${result.agentCode}) · Audit #${result.auditId}`);
      setSelected(null); setCode(""); setIdentityConfirmed(false); setVerificationMethod(""); setVerificationNote("");
      await refresh();
      onLinked?.();
    } catch (e) { setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด"); }
    finally { setBusy(false); }
  }

  return (
    <section aria-label="Skool Agent Matching" style={{padding:20,marginBottom:22,border:"1px solid var(--hairline)",borderRadius:16,background:"var(--surface)"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <div>
          <h2 style={{margin:"0 0 5px",fontSize:21}}>ตรวจสมาชิก Skool ที่ยังไม่เชื่อม Agent Master</h2>
          <p style={{margin:0,fontSize:13,color:"var(--cream-muted)"}}>สำหรับ Admin/Training ที่ได้รับอนุญาต · ยังไม่รวมใน PEP จนกว่าจะยืนยันตัวตนและจับคู่</p>
        </div>
        <button type="button" onClick={()=>void refresh()} disabled={loading || busy} style={button}>↻ ตรวจใหม่</button>
      </div>
      {loading ? <p role="status">กำลังตรวจสอบข้อมูล...</p> : null}
      {accessNotice ? <p role="status" style={{padding:12,border:"1px solid var(--hairline)",borderRadius:10,color:"var(--cream-muted)"}}>{accessNotice}</p> : null}
      {error ? <p role="alert" style={{color:"var(--rp-danger)"}}>{error}</p> : null}
      {info ? <p role="status" style={{color:"var(--gold-bright)"}}>{info}</p> : null}
      {allowed && !loading ? <>
        {auditNotice ? <p role="alert" style={{color:"var(--rp-danger)",fontWeight:700}}>{auditNotice}</p> : null}
        <p style={{fontWeight:700}}>Skool ที่ยังไม่เชื่อม: {items.length} บัญชี</p>
        <label style={{display:"block",marginBottom:10}}>ค้นหาสมาชิก <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="ชื่อหรือ Skool Profile" style={field}/></label>
        <div style={{maxHeight:300,overflowY:"auto",border:"1px solid var(--hairline)",borderRadius:10}}>
          {shown.map(m=><div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 12px",borderBottom:"1px solid var(--hairline)",flexWrap:"wrap"}}>
            <div><strong>{m.first_name} {m.last_name}</strong><div style={{fontSize:12,color:"var(--cream-muted)"}}>คอร์ส {m.courses} · เริ่มเรียน {m.started} · จบ {m.completed} · {m.active?"มีสิทธิ์เข้าเรียน":"ไม่มีสิทธิ์เข้าเรียน"} · <a href={m.skool_profile_url} target="_blank" rel="noreferrer">โปรไฟล์ Skool ↗</a></div></div>
            <button type="button" style={button} onClick={()=>{setSelected(m.id);setCode("");setIdentityConfirmed(false);setVerificationMethod("");setVerificationNote("");setError("");}}>ตรวจจับคู่</button>
          </div>)}
          {shown.length === 0 ? <p style={{padding:12}}>ไม่มีบัญชีตามตัวกรอง</p>:null}
        </div>
        {current ? <div style={{marginTop:14,padding:15,border:"1px solid var(--gold)",borderRadius:12}}>
          <h3 style={{marginTop:0}}>จับคู่บัญชี: {fullName}</h3>
          <p style={{fontSize:12,color:"var(--cream-muted)"}}>ต้องตรวจว่าเป็นคนเดียวกับตัวแทนจริง ห้ามจับคู่จากชื่อคล้ายกันอย่างเดียว และไม่สร้าง Agent Code ใหม่</p>
          <label style={{display:"block",marginBottom:10}}>กรอก Agent Code จาก Agent Master<input style={field} value={code} onChange={e=>setCode(e.target.value)} autoComplete="off" /></label>
          {code.trim() ? <p style={{fontSize:13}}>{matches.length===1?`พบตัวแทน: ${matches[0].agentName} (${matches[0].agentCode})`:"ไม่พบ Agent Code ที่ตรงเพียงหนึ่งรายการ"}</p>:null}
          {matches.length === 1 ? <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10,marginBottom:12}}>
            <div style={{padding:12,border:"1px solid var(--hairline)",borderRadius:9}}>
              <small>Skool Member</small><p style={{fontWeight:800,margin:"6px 0"}}>{fullName}</p>
              <a href={current.skool_profile_url} target="_blank" rel="noreferrer">ตรวจโปรไฟล์ Skool ↗</a>
            </div>
            <div style={{padding:12,border:"1px solid var(--hairline)",borderRadius:9}}>
              <small>Agent Master</small><p style={{fontWeight:800,margin:"6px 0"}}>{matches[0].agentName}</p>
              <small>Agent Code: {matches[0].agentCode}</small>
            </div>
          </div> : null}
          <label style={{display:"block",marginBottom:10}}>วิธียืนยันว่าเป็นบุคคลเดียวกัน
            <select style={field} value={verificationMethod} onChange={e=>setVerificationMethod(e.target.value)}>
              <option value="">เลือกหลักฐานที่ตรวจสอบแล้ว</option>
              <option value="company_roster">ตรวจทะเบียนบริษัท/เอกสารภายในที่ยืนยันตัวตน</option>
              <option value="skool_owner_confirmation">ยืนยันโดยเจ้าของบัญชี Skool โดยตรง</option>
              <option value="other_verified">หลักฐานอื่นที่ตรวจสอบได้</option>
            </select>
          </label>
          <label style={{display:"block",marginBottom:10}}>หมายเหตุการตรวจสอบ (อย่างน้อย 8 ตัวอักษร ไม่ใส่ข้อมูลบัตรประชาชน/ข้อมูลลับ)
            <textarea style={{...field,maxWidth:600,minHeight:64}} maxLength={500} value={verificationNote}
              onChange={e=>setVerificationNote(e.target.value)} placeholder="เช่น ยืนยันบัญชีโดยเจ้าของผ่านช่องทางบริษัท วันที่..." />
          </label>
          <label style={{display:"flex",gap:9,alignItems:"flex-start",marginBottom:14,lineHeight:1.6,fontWeight:700}}>
            <input type="checkbox" checked={identityConfirmed} onChange={e=>setIdentityConfirmed(e.target.checked)} />
            ฉันตรวจหลักฐานแล้วว่า Skool และ Agent Code นี้เป็นบุคคลเดียวกัน และเข้าใจว่าข้อมูลจะปรากฏใน PEP ของตัวแทนนี้
          </label>
          <button type="button" style={{...button,opacity:(!auditReady || busy || matches.length!==1 || !identityConfirmed || !verificationMethod || verificationNote.trim().length<8)?0.5:1}}
            onClick={()=>void link()} disabled={!auditReady || busy || matches.length!==1 || !identityConfirmed || !verificationMethod || verificationNote.trim().length<8}>
            {busy?"กำลังบันทึกพร้อม Audit Log...":"ยืนยันจับคู่และบันทึก Audit Log"}
          </button>
          <button type="button" style={{...button,marginLeft:8}} onClick={()=>setSelected(null)}>ยกเลิก</button>
        </div>:null}
        <details style={{marginTop:20,padding:"12px 0",borderTop:"1px solid var(--hairline)"}}>
          <summary style={{cursor:"pointer",fontWeight:800}}>ประวัติการจับคู่ล่าสุด (Audit Log) · {auditHistory.length} รายการ</summary>
          {!auditReady ? <p>ยังไม่ได้ติดตั้ง Audit Log ใน Supabase</p> :
            auditHistory.length === 0 ? <p>ยังไม่มีประวัติการจับคู่หลังเริ่มใช้ Audit Log</p> :
            <div style={{overflowX:"auto",marginTop:12}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr><th>วันเวลา</th><th>Skool</th><th>Agent Master</th><th>ผู้ดำเนินการ</th></tr></thead>
              <tbody>{auditHistory.map(a=><tr key={a.id}>
                <td style={{padding:8}}>{new Date(a.created_at).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}</td>
                <td style={{padding:8}}>{a.skool_name}</td>
                <td style={{padding:8}}>{a.agent_name_snapshot} ({a.agent_code_snapshot})</td>
                <td style={{padding:8}}>{a.actor_email}</td>
              </tr>)}</tbody></table></div>}
        </details>
      </>:null}
    </section>
  );
}
const field = { display:"block",marginTop:5,width:"100%",maxWidth:420,padding:"10px",border:"1px solid var(--hairline)",borderRadius:8,background:"var(--surface-alt)",color:"var(--cream)" };
const button = { padding:"10px 12px",borderRadius:9,border:"1px solid var(--gold)",background:"var(--surface-alt)",color:"var(--gold-bright)",cursor:"pointer",fontWeight:700 as const };
