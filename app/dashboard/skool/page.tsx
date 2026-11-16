"use client";

import Link from "next/link";
import { dataTimestampLabel, latestDataTimestamp } from "@/lib/date-utils";
import SkoolQuizResults from "@/components/SkoolQuizResults";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { latestQuizAttempts, type QuizResultRow } from "@/lib/skool-quiz";
import { useSearchParams } from "next/navigation";
import { learningApiUrl, readLearningAgentId, type LearningAgentSelection } from "@/lib/learning-filter";

type ProgressStatus = "not_started" | "in_progress" | "completed";

type SkoolProgressRow = {
  agentId: number;
  agentCode: string;
  agentName: string;
  agentNickname: string;
  unitId: number | null;
  unitCode: string;
  unitName: string;
  skoolMemberId: number;
  skoolName: string;
  skoolProfileUrl: string;
  memberActive: boolean;
  lastActiveAt: string | null;
  courseId: number;
  courseName: string;
  hasAccess: boolean;
  progressPercent: number;
  status: ProgressStatus;
  syncedAt: string | null;
};

type DashboardResponse = {
  success?: boolean;
  error?: string;
  scope?: {
    canSeeAll: boolean;
    unitId: number | null;
    unitName: string | null;
  };
  summary?: {
    linkedAgents: number;
    courses: number;
    records: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    averageProgress: number;
    syncedAt: string | null;
  };
  rows?: SkoolProgressRow[];
};

const STATUS_OPTIONS: Array<{
  value: "all" | ProgressStatus;
  label: string;
}> = [
  { value: "all", label: "ทุกสถานะ" },
  { value: "not_started", label: "ยังไม่เริ่ม" },
  { value: "in_progress", label: "กำลังเรียน" },
  { value: "completed", label: "เรียนจบแล้ว" },
];

function statusLabel(status: ProgressStatus) {
  if (status === "completed") return "เรียนจบแล้ว";
  if (status === "in_progress") return "กำลังเรียน";
  return "ยังไม่เริ่ม";
}

function statusColors(status: ProgressStatus) {
  if (status === "completed") {
    return {
      color: "#70C89A",
      background: "rgba(67, 160, 110, .13)",
      border: "rgba(112, 200, 154, .35)",
    };
  }

  if (status === "in_progress") {
    return {
      color: "var(--gold-bright)",
      background: "rgba(201, 162, 75, .13)",
      border: "rgba(201, 162, 75, .4)",
    };
  }

  return {
    color: "var(--cream-muted)",
    background: "rgba(180, 169, 141, .08)",
    border: "var(--hairline)",
  };
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function SkoolDashboardPage() {
  return <Suspense fallback={<p role="status" style={{ padding: 28 }}>กำลังโหลดหน้า Skool...</p>}><SkoolDashboardRoute /></Suspense>;
}

function SkoolDashboardRoute() {
  const search = useSearchParams().toString();
  let agentSelection: LearningAgentSelection;
  try {
    agentSelection = readLearningAgentId(`https://dashboard.local/?${search}`) ?? "all";
  } catch {
    agentSelection = null;
  }
  return <SkoolDashboardContent key={search} agentSelection={agentSelection} />;
}

function SkoolDashboardContent({ agentSelection }: { agentSelection: LearningAgentSelection }) {
  const [quizRefreshKey, setQuizRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"overview" | "learning" | "quiz" | "matching">("overview");
  const [expandedAgent, setExpandedAgent] = useState<number | null>(null);
  const [learningPage, setLearningPage] = useState(0);
  const [quizOverview, setQuizOverview] = useState<QuizResultRow[]>([]);
  const [quizError, setQuizError] = useState("");
  const [quizLoading, setQuizLoading] = useState(true);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [unit, setUnit] = useState("all");
  const [course, setCourse] = useState("all");
  const [status, setStatus] = useState<"all" | ProgressStatus>("all");
  const requestRef = useRef<AbortController | null>(null);

  const loadData = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    setData(null);

    try {
      const response = await fetch(learningApiUrl("/api/skool-progress", agentSelection), {
        cache: "no-store",
        signal: controller.signal,
      });
      const responseData = (await response.json().catch(() => ({
        error: "ไม่สามารถอ่านข้อมูลจากระบบได้",
      }))) as DashboardResponse;

      if (controller.signal.aborted) return;
      if (!response.ok || responseData.success !== true || !Array.isArray(responseData.rows) || !responseData.summary) {
        setData(null);
        setError(responseData.error || "ไม่สามารถโหลด Skool Dashboard ได้");
        return;
      }

      setData(responseData);
    } catch (loadError) {
      if (controller.signal.aborted) return;
      console.error("[skool-dashboard] load error:", loadError);
      setData(null);
      setError(agentSelection === null ? "ตัวกรองตัวแทนไม่ถูกต้อง กรุณากลับไปเลือกตัวแทนจาก Dashboard" : "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [agentSelection]);

  useEffect(() => {
    void loadData();
    return () => requestRef.current?.abort();
  }, [loadData]);

  const rows = useMemo(() => data?.rows ?? [], [data]);

  const units = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.unitName)))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "th")),
    [rows]
  );

  const courses = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.courseName)))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "th")),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const keyword = search.normalize("NFKC").trim().toLocaleLowerCase("th-TH");

    return rows.filter((row) => {
      const matchesSearch =
        !keyword ||
        [
          row.agentCode,
          row.agentName,
          row.agentNickname,
          row.skoolName,
        ].some((value) =>
          String(value ?? "")
            .normalize("NFKC")
            .toLocaleLowerCase("th-TH")
            .includes(keyword)
        );

      return (
        matchesSearch &&
        (unit === "all" || row.unitName === unit) &&
        (course === "all" || row.courseName === course) &&
        (status === "all" || row.status === status)
      );
    });
  }, [course, rows, search, status, unit]);

  const filteredSummary = useMemo(() => {
    const completed = filteredRows.filter(
      (row) => row.status === "completed"
    ).length;
    const inProgress = filteredRows.filter(
      (row) => row.status === "in_progress"
    ).length;
    const notStarted = filteredRows.filter(
      (row) => row.status === "not_started"
    ).length;
    const averageProgress =
      filteredRows.length > 0
        ? Math.round(
            filteredRows.reduce(
              (total, row) => total + row.progressPercent,
              0
            ) / filteredRows.length
          )
        : 0;

    return {
      agents: new Set(filteredRows.map((row) => row.agentId)).size,
      completed,
      inProgress,
      notStarted,
      averageProgress,
    };
  }, [filteredRows]);

  const hasFilters =
    search !== "" || unit !== "all" || course !== "all" || status !== "all";

  function clearFilters() {
    setSearch("");
    setUnit("all");
    setCourse("all");
    setStatus("all");
  }


  useEffect(() => {
    const controller = new AbortController();
    setQuizLoading(true); setQuizError("");
    fetch(learningApiUrl("/api/skool-quiz-results", agentSelection), {cache:"no-store",signal:controller.signal})
      .then(async r=>{const b=await r.json();if(!r.ok||b.success!==true||!Array.isArray(b.rows)) throw new Error(b.error??"โหลดผลสอบไม่สำเร็จ");return b.rows as QuizResultRow[];})
      .then(v=>{if(!controller.signal.aborted)setQuizOverview(latestQuizAttempts(v));})
      .catch(e=>{if(!controller.signal.aborted)setQuizError(e instanceof Error?e.message:"โหลดคะแนนไม่สำเร็จ");})
      .finally(()=>{if(!controller.signal.aborted)setQuizLoading(false);});
    return ()=>controller.abort();
  },[agentSelection,quizRefreshKey]);

  const agentGroups = useMemo(()=>{
    const grouped = new Map<number, {id:number;code:string;name:string;nickname:string;unit:string;profile:string;rows:SkoolProgressRow[];average:number;completed:number;inProgress:number;notStarted:number}>();
    filteredRows.forEach(row=>{
      if(!grouped.has(row.agentId)) grouped.set(row.agentId,{
        id:row.agentId,code:row.agentCode,name:row.agentName,nickname:row.agentNickname,
        unit:row.unitName,profile:row.skoolProfileUrl,rows:[],average:0,completed:0,inProgress:0,notStarted:0
      });
      const g=grouped.get(row.agentId)!;
      g.rows.push(row);
      if(row.status==="completed")g.completed++;
      else if(row.status==="in_progress")g.inProgress++;
      else g.notStarted++;
    });
    return Array.from(grouped.values()).map(g=>({
      ...g,average:g.rows.length?Math.round(g.rows.reduce((s,r)=>s+r.progressPercent,0)/g.rows.length):0,
      rows:g.rows.sort((a,b)=>b.progressPercent-a.progressPercent||a.courseName.localeCompare(b.courseName,"th"))
    })).sort((a,b)=>a.name.localeCompare(b.name,"th"));
  },[filteredRows]);
  const agentPageSize = 10;
  const pageCount = Math.max(1,Math.ceil(agentGroups.length/agentPageSize));
  const shownAgents = agentGroups.slice(Math.min(learningPage,pageCount-1)*agentPageSize,Math.min(learningPage,pageCount-1)*agentPageSize+agentPageSize);
  const quizPassed=quizOverview.filter(r=>r.passed).length;
  const quizScore=quizOverview.length?(quizOverview.reduce((s,r)=>s+r.scorePercent,0)/quizOverview.length).toFixed(1)+"%":"—";

  return (
    <main className="skool-v2" style={{minHeight:"100vh",padding:"24px clamp(14px,3vw,32px) 60px",background:"var(--rp-page-gradient), var(--bg)",color:"var(--cream)"}}>
      <style>{`
        .skool-v2{--v2-border:var(--hairline);--v2-soft:var(--surface-alt)}
        .skool-v2 .v2-panel{border:1px solid var(--v2-border);border-radius:17px;background:var(--surface);padding:18px}
        .skool-v2 .v2-metric{border:1px solid var(--v2-border);border-radius:15px;background:var(--surface);padding:16px;min-width:0}
        .skool-v2 .v2-icon{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:21px}
        .skool-v2 .v2-tabs{display:flex;gap:7px;flex-wrap:wrap;padding:6px;border-radius:13px;background:var(--surface-alt);margin:18px 0}
        .skool-v2 .v2-tab{background:transparent;color:var(--cream-muted);border:0;border-radius:9px;padding:11px 16px;font-weight:800;cursor:pointer}
        .skool-v2 .v2-tab[aria-selected="true"]{background:var(--gold);color:#231e16}
        .skool-v2 .v2-pill{display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;font-size:11px;font-weight:800}
        .skool-v2 .v2-action{border:1px solid var(--gold);border-radius:10px;padding:9px 13px;color:var(--gold-bright);background:var(--surface);text-decoration:none;font-weight:750;cursor:pointer}
        .skool-v2 .v2-action:disabled{opacity:.45;cursor:not-allowed}
        .skool-v2 .v2-course{padding:11px 2px;border-top:1px solid var(--hairline-soft)}
        .skool-v2 .v2-progress{height:7px;background:var(--surface-alt);border-radius:999px;overflow:hidden}
        .skool-v2 .v2-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
        .skool-v2 .v2-agent{border-top:1px solid var(--hairline-soft);padding:15px 2px}
        .skool-v2 .v2-muted{color:var(--cream-muted);font-size:12px;line-height:1.6}
        .skool-v2 .v2-section-title{font-size:19px;margin:0 0 10px;font-weight:850}
        @media(max-width:600px){.skool-v2 .v2-panel{padding:14px}.skool-v2 .v2-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.skool-v2 .v2-tab{padding:11px 7px}.skool-v2 .v2-agent-head{flex-direction:column;align-items:stretch!important}}
      `}</style>
      <div style={{maxWidth:1180,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:14}}>
          <Link href="/" className="v2-action">← กลับหน้าหลัก</Link>
          <button type="button" className="v2-action" disabled={loading} onClick={()=>{setQuizRefreshKey(v=>v+1);void loadData();}}>{loading?"กำลังโหลด...":"↻ รีเฟรชข้อมูล"}</button>
        </div>
        <header className="v2-panel" style={{padding:"clamp(20px,3vw,28px)",background:"linear-gradient(120deg,var(--rp-soft-gold),transparent 75%),var(--surface)"}}>
          <div style={{color:"var(--gold)",fontSize:11,fontWeight:850,letterSpacing:2}}>ROYAL PARTNER · LEARNING PERFORMANCE</div>
          <h1 style={{fontSize:"clamp(26px,4vw,37px)",margin:"8px 0"}}>🎓 Skool Learning Dashboard</h1>
          <p className="v2-muted" style={{margin:0}}>ภาพรวมความคืบหน้าการเรียนและผลสอบ พร้อมรายละเอียดเมื่อเลือกดูรายคน</p>
          {data?.scope && <p className="v2-muted" style={{margin:"10px 0 0"}}>🔒 สิทธิ์การมองเห็น: {data.scope.canSeeAll?"ทุกหน่วย":data.scope.unitName||"เฉพาะหน่วยของคุณ"}</p>}
        </header>
        {agentSelection!=="all" && <div className="v2-panel" style={{marginTop:12}}>
          {agentSelection===null?"ตัวกรองตัวแทนไม่ถูกต้อง":"กำลังแสดงข้อมูลเฉพาะตัวแทนที่เลือกจาก Activity Dashboard"} · <Link href="/dashboard/skool" style={{color:"var(--gold-bright)"}}>กลับไปดูทั้งหมด</Link>
        </div>}

        <section aria-label="ภาพรวมตัวชี้วัด" className="v2-grid" style={{marginTop:16}}>
          {[
            {icon:"👥",label:"ตัวแทนที่เชื่อมแล้ว",value:data?.summary?.linkedAgents??"—",sub:"คนในขอบเขตสิทธิ์",color:"#C99C48",bg:"rgba(201,156,72,.14)"},
            {icon:"📈",label:"Progress เฉลี่ย",value:data?.summary?.records?`${data.summary.averageProgress}%`:"—",sub:"ค่าเฉลี่ยรายการเรียน",color:"#5288CE",bg:"rgba(82,136,206,.14)"},
            {icon:"✅",label:"เรียนจบแล้ว",value:data?.summary?.completed??"—",sub:"รายการเรียน",color:"#37966B",bg:"rgba(55,150,107,.14)"},
            {icon:"📋",label:"ผลสอบ Quiz",value:quizLoading?"…":quizError?"—":quizOverview.length,sub:quizError?"โหลดคะแนนไม่สำเร็จ":`ผ่าน ${quizPassed} · ไม่ผ่าน ${quizOverview.length-quizPassed}`,color:"#6887C9",bg:"rgba(104,135,201,.14)"}
          ].map(m=><div className="v2-metric" key={m.label}>
            <div className="v2-icon" style={{background:m.bg,color:m.color}} aria-hidden="true">{m.icon}</div>
            <div style={{marginTop:10,fontSize:27,fontWeight:900,color:"var(--cream)"}}>{m.value}</div>
            <div style={{fontSize:13,fontWeight:800}}>{m.label}</div>
            <div className="v2-muted">{m.sub}</div>
          </div>)}
        </section>

        <div className="v2-tabs" role="tablist" aria-label="หมวดรายงาน">
          {[
            {id:"overview",name:"🏠 ภาพรวม"},{id:"learning",name:"📚 การเรียน"},
            {id:"quiz",name:"📝 ผลสอบ Quiz"},{id:"matching",name:"🔗 สมาชิก / Matching"}
          ].map(t=><button key={t.id} type="button" role="tab" aria-selected={activeTab===t.id} className="v2-tab" onClick={()=>setActiveTab(t.id as typeof activeTab)}>{t.name}</button>)}
        </div>

        {error && <div role="alert" className="v2-panel" style={{color:"var(--rp-danger)",marginBottom:12}}>{error}</div>}
        {loading && <div role="status" className="v2-panel">กำลังโหลดข้อมูลการเรียน…</div>}

        {activeTab==="overview" && !loading && <>
          <section className="v2-panel" style={{marginBottom:13}}>
            <h2 className="v2-section-title">📚 สรุปความคืบหน้าการเรียน</h2>
            <div className="v2-grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))"}}>
              {[
                {label:"เรียนจบ",n:data?.summary?.completed??0,color:"#31875F",bg:"rgba(50,150,100,.12)",icon:"✅"},
                {label:"กำลังเรียน",n:data?.summary?.inProgress??0,color:"#BC8B33",bg:"rgba(200,158,74,.15)",icon:"📖"},
                {label:"ยังไม่เริ่ม",n:data?.summary?.notStarted??0,color:"#8A867D",bg:"rgba(138,134,125,.12)",icon:"🕒"}
              ].map(x=><div key={x.label} style={{borderRadius:12,padding:14,background:x.bg}}>
                <div style={{color:x.color,fontWeight:850}}>{x.icon} {x.label}</div>
                <div style={{fontSize:27,fontWeight:900,color:"var(--cream)"}}>{x.n}</div>
                <span className="v2-muted">รายการเรียน</span>
              </div>)}
            </div>
            <p className="v2-muted">{data?.summary?.courses??0} คอร์ส · {data?.summary?.records??0} รายการเรียน · CSV ล่าสุด {dataTimestampLabel(data?.summary?.syncedAt??null,"ยังไม่มีข้อมูล")}</p>
            <button type="button" className="v2-action" onClick={()=>setActiveTab("learning")}>ดูรายตัวแทน →</button>
          </section>
          <div className="v2-grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))"}}>
            <section className="v2-panel">
              <h2 className="v2-section-title">📝 Google Form Quiz</h2>
              {quizError?<p role="alert" className="v2-muted">{quizError}</p>:<div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10}}>
                {[
                  ["ผู้เข้าสอบ",new Set(quizOverview.map(r=>r.agentId)).size,"#6887C9"],
                  ["ผ่าน",quizPassed,"#31875F"],
                  ["เฉลี่ย",quizScore,"#B08A45"]
                ].map(([label,value,color])=><div key={String(label)}><div style={{fontSize:23,fontWeight:900,color:String(color)}}>{quizLoading?"…":value}</div><div className="v2-muted">{label}</div></div>)}
              </div>}
              <button className="v2-action" type="button" style={{marginTop:16}} onClick={()=>setActiveTab("quiz")}>ดูผลสอบ →</button>
            </section>
            <section className="v2-panel">
              <h2 className="v2-section-title">🔐 Matching Safety</h2>
              <p className="v2-muted">การจับคู่และจัดประเภทสมาชิกแยกอยู่ในหน้าจัดการ เพื่อไม่ให้รายงานหลักยาวเกินไป</p>
              <p className="v2-muted">สมาชิกที่ยังไม่มี Agent Code จะไม่ถูกรวมใน PEP โดยอัตโนมัติ</p>
              <Link className="v2-action" style={{display:"inline-block",marginTop:9}} href="/admin/skool-matching">ไปหน้าจัดการสมาชิก ↗</Link>
            </section>
          </div>
        </>}

        {activeTab==="learning" && !loading && <section className="v2-panel">
          <div style={{display:"flex",justifyContent:"space-between",gap:9,alignItems:"center",flexWrap:"wrap"}}>
            <div><h2 className="v2-section-title" style={{marginBottom:4}}>📚 การเรียนรายตัวแทน</h2><div className="v2-muted">แสดงรายคนก่อน กดขยายเพื่อดูรายละเอียดคอร์ส ({filteredRows.length} รายการ)</div></div>
            <span className="v2-pill" style={{background:"rgba(201,156,72,.14)",color:"var(--gold-bright)"}}>{agentGroups.length} ตัวแทน</span>
          </div>
          <div className="v2-grid" style={{margin:"18px 0",gridTemplateColumns:"repeat(auto-fit,minmax(165px,1fr))"}}>
            <label style={fieldStyle}><span style={labelStyle}>ค้นหาชื่อ / รหัส</span><input style={inputStyle} value={search} onChange={e=>{setSearch(e.target.value);setLearningPage(0);}} placeholder="ค้นหาตัวแทน"/></label>
            {data?.scope?.canSeeAll && <label style={fieldStyle}><span style={labelStyle}>หน่วย</span><select style={inputStyle} value={unit} onChange={e=>{setUnit(e.target.value);setLearningPage(0);}}><option value="all">ทุกหน่วย</option>{units.map(u=><option key={u}>{u}</option>)}</select></label>}
            <label style={fieldStyle}><span style={labelStyle}>คอร์ส</span><select style={inputStyle} value={course} onChange={e=>{setCourse(e.target.value);setLearningPage(0);}}><option value="all">ทุกคอร์ส</option>{courses.map(c=><option key={c}>{c}</option>)}</select></label>
            <label style={fieldStyle}><span style={labelStyle}>สถานะ</span><select style={inputStyle} value={status} onChange={e=>{setStatus(e.target.value as "all"|ProgressStatus);setLearningPage(0);}}>{STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          </div>
          {hasFilters && <button type="button" onClick={()=>{clearFilters();setLearningPage(0);}} className="v2-action" style={{marginBottom:12}}>ล้างตัวกรอง</button>}
          {!filteredRows.length?<p className="v2-muted">ยังไม่มีข้อมูลในขอบเขตหรือตัวกรองที่เลือก</p>:
            shownAgents.map(a=><article key={a.id} className="v2-agent">
              <div className="v2-agent-head" style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:850}}>👤 {a.name} <span style={{fontSize:12,fontWeight:400,color:"var(--cream-muted)"}}>({a.code})</span></div>
                  <div className="v2-muted">{a.unit} · {a.rows.length} คอร์ส · จบ {a.completed} · กำลังเรียน {a.inProgress} · ยังไม่เริ่ม {a.notStarted}</div>
                  <div className="v2-progress" style={{marginTop:10,maxWidth:360}}><div style={{width:`${a.average}%`,height:"100%",background:"#C99C48"}}/></div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <strong style={{color:"var(--gold-bright)",fontSize:21}}>{a.average}%</strong>
                  <button type="button" className="v2-action" aria-expanded={expandedAgent===a.id} onClick={()=>setExpandedAgent(expandedAgent===a.id?null:a.id)}>{expandedAgent===a.id?"ซ่อนคอร์ส ▲":"ดูคอร์ส ▼"}</button>
                </div>
              </div>
              {expandedAgent===a.id && <div style={{padding:"12px 14px",background:"var(--surface-alt)",borderRadius:12,marginTop:12}}>
                {a.rows.map(r=><div className="v2-course" key={r.courseId}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
                    <div style={{fontWeight:750}}>{r.courseName}<div className="v2-muted">ใช้งานล่าสุด: {formatDate(r.lastActiveAt)}</div></div>
                    <span className="v2-pill" style={{whiteSpace:"nowrap",...statusColors(r.status)}}>{statusLabel(r.status)} · {r.progressPercent}%</span>
                  </div>
                  <div className="v2-progress" style={{marginTop:9}}><div style={{height:"100%",width:`${r.progressPercent}%`,background:r.status==="completed"?"#37966B":"#C99C48"}}/></div>
                </div>)}
                {a.profile && <a href={a.profile} target="_blank" rel="noreferrer" style={{display:"inline-block",marginTop:10,color:"var(--gold-bright)",fontWeight:750}}>เปิดโปรไฟล์ Skool ↗</a>}
              </div>}
            </article>)
          }
          {pageCount>1 && <div style={{display:"flex",gap:12,justifyContent:"center",alignItems:"center",marginTop:17}}>
            <button className="v2-action" disabled={learningPage===0} type="button" onClick={()=>{setLearningPage(p=>Math.max(0,p-1));setExpandedAgent(null);}}>ก่อนหน้า</button>
            <span className="v2-muted">หน้า {Math.min(learningPage,pageCount-1)+1} / {pageCount}</span>
            <button className="v2-action" disabled={learningPage>=pageCount-1} type="button" onClick={()=>{setLearningPage(p=>Math.min(pageCount-1,p+1));setExpandedAgent(null);}}>ถัดไป</button>
          </div>}
          <p className="v2-muted" style={{margin:"16px 0 0"}}>แหล่งข้อมูล: Skool Course Progress CSV · รอบนำเข้าทุกวันศุกร์ · เฉพาะสมาชิกที่เชื่อม Agent Master</p>
        </section>}

        {activeTab==="quiz" && <SkoolQuizResults refreshKey={quizRefreshKey} agentSelection={agentSelection} />}

        {activeTab==="matching" && <section className="v2-panel">
          <h2 className="v2-section-title">🔗 จัดการสมาชิก Skool</h2>
          <p className="v2-muted">Matching Safety, Member Classification และ Audit Log อยู่ในหน้าจัดการเฉพาะ เพื่อแยกจากรายงานความคืบหน้าการเรียน</p>
          <p className="v2-muted">บัญชีที่ไม่มี Agent Code ยังอยู่ใน Skool ได้ตามปกติ และจะไม่ถูกรวมใน PEP โดยอัตโนมัติ</p>
          <Link href="/admin/skool-matching" className="v2-action" style={{display:"inline-block",marginTop:10}}>เปิด Member Matching / Classification ↗</Link>
        </section>}
        <p className="v2-muted" style={{textAlign:"center",marginTop:18}}>ROYAL PARTNER · LEARNING PERFORMANCE · UI V2</p>
      </div>
    </main>
  );
}

const fieldStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 7,
};

const labelStyle = {
  color: "var(--cream-faint)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.6,
};

const inputStyle = {
  width: "100%",
  minHeight: 43,
  padding: "0 12px",
  border: "1px solid var(--hairline)",
  borderRadius: 9,
  background: "var(--surface-alt)",
  color: "var(--cream)",
  fontSize: 13,
  outline: "none",
};

const thStyle = {
  padding: "12px 14px",
  background: "var(--surface-alt)",
  color: "var(--cream-faint)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.7,
  textAlign: "left" as const,
  whiteSpace: "nowrap" as const,
};

const tdStyle = {
  padding: "14px",
  color: "var(--cream-muted)",
  verticalAlign: "middle" as const,
};

const emptyStyle = {
  padding: "46px 20px",
  color: "var(--cream-muted)",
  textAlign: "center" as const,
  lineHeight: 1.7,
};
