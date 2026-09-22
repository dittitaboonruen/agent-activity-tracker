"use client";

export default function AnnualTargetPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--rp-page-gradient), var(--bg)",
        color: "var(--cream)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        transition: "background .2s ease, color .2s ease",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "var(--surface)",
          border: "1px solid var(--hairline)",
          borderRadius: 24,
          padding: "40px 30px",
          textAlign: "center",
          boxShadow: "0 18px 50px rgba(0,0,0,.08)",
        }}
      >
        {/* BRAND */}
        <div
          style={{
            color: "var(--gold)",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 2.2,
            marginBottom: 20,
          }}
        >
          ROYAL PARTNER · AGENT PORTAL
        </div>

        {/* LOCK ICON */}
        <div
          style={{
            width: 78,
            height: 78,
            margin: "0 auto 22px",
            borderRadius: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--rp-soft-gold)",
            border: "1px solid var(--hairline)",
            fontSize: 38,
          }}
        >
          🔒
        </div>

        {/* TITLE */}
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(28px, 6vw, 38px)",
            lineHeight: 1.15,
            color: "var(--cream)",
          }}
        >
          Annual Target 2569
        </h1>

        {/* STATUS */}
        <div
          style={{
            marginTop: 16,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: 999,
            background: "var(--rp-soft-gold)",
            border: "1px solid var(--gold)",
            color: "var(--gold-bright)",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          🔒 ยังไม่เปิดใช้งาน
        </div>

        {/* DESCRIPTION */}
        <p
          style={{
            margin: "22px auto 0",
            maxWidth: 430,
            color: "var(--cream-muted)",
            fontSize: 15,
            lineHeight: 1.8,
          }}
        >
          ระบบตั้งเป้าหมายประจำปี FYP / FYC / CASE
          กำลังอยู่ระหว่างการเตรียมความพร้อม
          และยังไม่เปิดให้ตัวแทนเข้าใช้งานในขณะนี้
        </p>

        <p
          style={{
            margin: "12px auto 0",
            color: "var(--cream-faint)",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          เมื่อระบบพร้อมใช้งาน Royal Partner
          จะแจ้งให้ทราบอีกครั้ง
        </p>

        {/* BACK BUTTON */}
        <a
          href="/agent"
          style={{
            display: "block",
            width: "100%",
            boxSizing: "border-box",
            marginTop: 30,
            padding: "14px 18px",
            borderRadius: 12,
            background: "var(--gold)",
            color: "#18120A",
            textDecoration: "none",
            fontWeight: 800,
            fontSize: 15,
          }}
        >
          ← กลับไป Agent Portal
        </a>

        {/* FOOTER */}
        <div
          style={{
            marginTop: 24,
            color: "var(--cream-faint)",
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          Royal Partner · Agent Portal
        </div>
      </div>
    </main>
  );
}
