"use client";

import { useState } from "react";

export default function AnnualTargetPage() {
  const currentYear = new Date().getFullYear() + 543;

  const [agentName, setAgentName] = useState("");
  const [targetFyp, setTargetFyp] = useState("");
  const [targetFyc, setTargetFyc] = useState("");
  const [targetCase, setTargetCase] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setStatus("");

    try {
      const response = await fetch("/api/annual-target", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentName,
          targetYear: currentYear - 543,
          targetFyp: Number(targetFyp.replace(/,/g, "")),
          targetFyc: Number(targetFyc.replace(/,/g, "")),
          targetCase: Number(targetCase),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "ไม่สามารถบันทึกข้อมูลได้");
        return;
      }

      setStatus("บันทึกเป้าหมายเรียบร้อยแล้ว");
    } catch {
      setStatus("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0d0b08",
        color: "#f4ead8",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 620,
          margin: "0 auto",
          background: "#17120d",
          border: "1px solid #8c6b32",
          borderRadius: 20,
          padding: 30,
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              color: "#d8b66a",
              fontSize: 13,
              letterSpacing: 2,
              marginBottom: 8,
            }}
          >
            ROYAL PARTNER
          </div>

          <h1 style={{ margin: 0, fontSize: 30 }}>
            Annual Target {currentYear}
          </h1>

          <p style={{ opacity: 0.7, marginTop: 10 }}>
            กำหนดเป้าหมายประจำปีของคุณ
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>ชื่อ-นามสกุล / ชื่อตัวแทน</label>
          <input
            style={inputStyle}
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            required
            placeholder="กรอกชื่อของคุณ"
          />

          <label style={labelStyle}>Target FYP</label>
          <input
            style={inputStyle}
            value={targetFyp}
            onChange={(e) => setTargetFyp(e.target.value)}
            required
            inputMode="numeric"
            placeholder="เช่น 1,200,000"
          />

          <label style={labelStyle}>Target FYC</label>
          <input
            style={inputStyle}
            value={targetFyc}
            onChange={(e) => setTargetFyc(e.target.value)}
            required
            inputMode="numeric"
            placeholder="เช่น 300,000"
          />

          <label style={labelStyle}>Target CASE</label>
          <input
            style={inputStyle}
            value={targetCase}
            onChange={(e) => setTargetCase(e.target.value)}
            required
            inputMode="numeric"
            placeholder="เช่น 36"
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              marginTop: 12,
              padding: "14px 18px",
              borderRadius: 12,
              border: "1px solid #d8b66a",
              background: "#d8b66a",
              color: "#16110b",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            {loading ? "กำลังบันทึก..." : "บันทึกเป้าหมายประจำปี"}
          </button>

          {status && (
            <p
              style={{
                marginTop: 18,
                textAlign: "center",
                color: "#d8b66a",
              }}
            >
              {status}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: 8,
  marginTop: 18,
  fontSize: 14,
  color: "#e8d9bd",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "13px 14px",
  borderRadius: 10,
  border: "1px solid #4e412f",
  background: "#0f0c09",
  color: "#ffffff",
  fontSize: 16,
};
