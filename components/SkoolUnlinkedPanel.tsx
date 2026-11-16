"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Unlinked = {
  id: number; first_name: string; last_name: string; skool_profile_url: string;
  active: boolean; last_active_at: string | null; courses: number; started: number;
  completed: number; lastSyncedAt: string | null;
};
type Agent = { id: number; agentCode: string | null; agentName: string };
const normal = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ");

export default function SkoolUnlinkedPanel({ onLinked }: { onLinked?: () => void }) {
  const [items, setItems] = useState<Unlinked[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [confirmName, setConfirmName] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/skool-unlinked", { cache: "no-store" });
      if (r.status === 401 || r.status === 403) { setAllowed(false); return; }
      const data = await r.json();
      if (!r.ok || data.success !== true) throw new Error(data.error ?? "ไม่สามารถโหลดรายชื่อได้");
      setAllowed(true);
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
    if (!current || busy || matches.length !== 1 || normal(confirmName) !== fullName) return;
    const agent = matches[0];
    if (!window.confirm(`ยืนยันการเชื่อม?\nSkool: ${fullName}\nAgent Master: ${agent.agentName} (${agent.agentCode})\n\nข้อมูล Skool จะแสดงใน PEP ของตัวแทนรหัสนี้`)) return;
    setBusy(true); setError(""); setInfo("");
    try {
      const r = await fetch("/api/skool-unlinked", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: current.id, agentCode: agent.agentCode, confirmedName: confirmName }),
      });
      const result = await r.json();
      if (!r.ok || result.success !== true) throw new Error(result.error ?? "จับคู่ไม่สำเร็จ");
      setInfo(`จับคู่สำเร็จ: ${fullName} → ${result.agentName} (${result.agentCode})`);
      setSelected(null); setCode(""); setConfirmName("");
      await refresh();
      onLinked?.();
    } catch (e) { setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด"); }
    finally { setBusy(false); }
  }

  if (!loading && !allowed && !error) return null;
  return (
    <section aria-label="Skool Agent Matching" style={{padding:20,marginBottom:22,border:"1px solid var(--hairline)",borderRadius:16,background:"var(--surface)"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <div>
          <h2 style={{margin:"0 0 5px",fontSize:21}}>ตรวจสมาชิก Skool ที่ยังไม่เชื่อม Agent Master</h2>
          <p style={{margin:0,fontSize:13,color:"var(--cream-muted)"}}>สำหรับ Admin เท่านั้น · ไม่รวมสมาชิกกลุ่มนี้ใน PEP จนกว่าจะยืนยันตัวตนและจับคู่</p>
        </div>
        <button type="button" onClick={()=>void refresh()} disabled={loading || busy} style={button}>↻ ตรวจใหม่</button>
      </div>
      {loading ? <p role="status">กำลังตรวจสอบข้อมูล...</p> : null}
      {error ? <p role="alert" style={{color:"var(--rp-danger)"}}>{error}</p> : null}
      {info ? <p role="status" style={{color:"var(--gold-bright)"}}>{info}</p> : null}
      {allowed && !loading ? <>
        <p style={{fontWeight:700}}>Skool ที่ยังไม่เชื่อม: {items.length} บัญชี</p>
        <label style={{display:"block",marginBottom:10}}>ค้นหาสมาชิก <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="ชื่อหรือ Skool Profile" style={field}/></label>
        <div style={{maxHeight:300,overflowY:"auto",border:"1px solid var(--hairline)",borderRadius:10}}>
          {shown.map(m=><div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 12px",borderBottom:"1px solid var(--hairline)",flexWrap:"wrap"}}>
            <div><strong>{m.first_name} {m.last_name}</strong><div style={{fontSize:12,color:"var(--cream-muted)"}}>คอร์ส {m.courses} · เริ่มเรียน {m.started} · จบ {m.completed} · {m.active?"มีสิทธิ์เข้าเรียน":"ไม่มีสิทธิ์เข้าเรียน"} · <a href={m.skool_profile_url} target="_blank" rel="noreferrer">โปรไฟล์ Skool ↗</a></div></div>
            <button type="button" style={button} onClick={()=>{setSelected(m.id);setCode("");setConfirmName("");setError("");}}>ตรวจจับคู่</button>
          </div>)}
          {shown.length === 0 ? <p style={{padding:12}}>ไม่มีบัญชีตามตัวกรอง</p>:null}
        </div>
        {current ? <div style={{marginTop:14,padding:15,border:"1px solid var(--gold)",borderRadius:12}}>
          <h3 style={{marginTop:0}}>จับคู่บัญชี: {fullName}</h3>
          <p style={{fontSize:12,color:"var(--cream-muted)"}}>ต้องตรวจว่าเป็นคนเดียวกับตัวแทนจริง ห้ามจับคู่จากชื่อคล้ายกันอย่างเดียว และไม่สร้าง Agent Code ใหม่</p>
          <label style={{display:"block",marginBottom:10}}>กรอก Agent Code จาก Agent Master<input style={field} value={code} onChange={e=>setCode(e.target.value)} autoComplete="off" /></label>
          {code.trim() ? <p style={{fontSize:13}}>{matches.length===1?`พบตัวแทน: ${matches[0].agentName} (${matches[0].agentCode})`:"ไม่พบ Agent Code ที่ตรงเพียงหนึ่งรายการ"}</p>:null}
          <label style={{display:"block",marginBottom:10}}>พิมพ์ชื่อสมาชิก Skool ตามที่แสดง เพื่อยืนยัน<input style={field} value={confirmName} onChange={e=>setConfirmName(e.target.value)} placeholder={fullName} autoComplete="off" /></label>
          <button type="button" style={button} onClick={()=>void link()} disabled={busy || matches.length!==1 || normal(confirmName)!==fullName}>{busy?"กำลังบันทึก...":"ยืนยันจับคู่กับ Agent Master"}</button>
          <button type="button" style={{...button,marginLeft:8}} onClick={()=>setSelected(null)}>ยกเลิก</button>
        </div>:null}
      </>:null}
    </section>
  );
}
const field = { display:"block",marginTop:5,width:"100%",maxWidth:420,padding:"10px",border:"1px solid var(--hairline)",borderRadius:8,background:"var(--surface-alt)",color:"var(--cream)" };
const button = { padding:"10px 12px",borderRadius:9,border:"1px solid var(--gold)",background:"var(--surface-alt)",color:"var(--gold-bright)",cursor:"pointer",fontWeight:700 as const };
