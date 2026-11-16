"use client";

import Link from "next/link";
import SkoolUnlinkedPanel from "@/components/SkoolUnlinkedPanel";

export default function SkoolMatchingPage() {
  return <main style={{minHeight:"100vh",padding:"26px clamp(16px,4vw,48px) 70px",background:"var(--rp-page-gradient), var(--bg)",color:"var(--cream)"}}>
    <div style={{maxWidth:1120,margin:"0 auto"}}>
      <nav style={{display:"flex",gap:18,marginBottom:25}}>
        <Link href="/dashboard/skool" style={{color:"var(--gold-bright)"}}>← Skool Learning Dashboard</Link>
        <Link href="/admin/skool-courses" style={{color:"var(--gold-bright)"}}>Course Manager</Link>
      </nav>
      <header style={{padding:"22px",border:"1px solid var(--hairline)",borderRadius:16,background:"var(--surface)",marginBottom:20}}>
        <div style={{fontSize:12,letterSpacing:2,color:"var(--gold)"}}>ROYAL PARTNER · TRAINING OPERATIONS</div>
        <h1 style={{margin:"8px 0",fontSize:"clamp(25px,4vw,38px)"}}>Skool Member Matching</h1>
        <p style={{margin:0,lineHeight:1.7,color:"var(--cream-muted)"}}>จัดประเภทสมาชิก Skool ที่ยังไม่มี Agent Code เป็น รอตรวจสอบ / ทีมงานหลังบ้าน / หัวหน้าทีม พร้อมประวัติการเปลี่ยนแปลง · ไม่แก้ Agent Master, Monthly Production หรือ PEP</p>
        <p style={{margin:"12px 0 0",fontWeight:700}}>Version: RP-SKOOL-CLASS-01</p>
      </header>
      <SkoolUnlinkedPanel />
    </div>
  </main>;
}
