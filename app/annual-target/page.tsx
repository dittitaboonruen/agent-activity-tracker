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
  const [deleting, setDeleting] = useState(false);

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

      setStatus("✅ บันทึกเป้าหมายเรียบร้อยแล้ว");
    } catch {
      setStatus("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    const name = agentName.trim();

    if (!name) {
      setStatus("กรุณากรอกชื่อตัวแทนก่อนลบ Target");
      return;
    }

    const confirmed = window.confirm(
      `ต้องการลบ Annual Target ปี ${currentYear} ของ "${name}" ใช่หรือไม่?\n\nข้อมูล Target FYP / FYC / CASE จะถูกลบ`
    );

    if (!confirmed) return;

    setDeleting(true);
    setStatus("");

    try {
      const response = await fetch("/api/annual-target", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentName: name,
          targetYear: currentYear - 543,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "ไม่สามารถลบ Target ได้");
        return;
      }

      setTargetFyp("");
      setTargetFyc("");
      setTargetCase("");

      setStatus(
        `🗑️ ลบ Annual Target ปี ${currentYear} ของ ${name} เรียบร้อยแล้ว`
      );
    } catch {
      setStatus("เกิดข้อผิดพลาดในการลบข้อมูล");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--rp-page-gradient), var(--bg)",
        color: "var(--cream)",
        padding: "32px 20px 60px",
        transition: "background .2s ease, color .2s ease",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 680,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--hairline)",
            borderRadius: 20,
            padding: "clamp(22px, 5vw, 32px)",
            boxShadow: "0 14px 40px rgba(0,0,0,.06)",
          }}
        >
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                color: "var(--gold)",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 2,
                marginBottom: 8,
              }}
            >
              ROYAL PARTNER · PERFORMANCE
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(28px, 5vw, 34px)",
                color: "var(--cream)",
              }}
            >
              Annual Target {currentYear}
            </h1>

            <p
              style={{
                color: "var(--cream-muted)",
                marginTop: 10,
                marginBottom: 0,
                lineHeight: 1.6,
              }}
            >
              กำหนด Target FYP / FYC / CASE ประจำปี
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <FieldLabel>ชื่อ-นามสกุล / ชื่อตัวแทน</FieldLabel>

            <input
              style={inputStyle}
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              required
              placeholder="กรอกชื่อของคุณ"
            />

            <FieldLabel>Target FYP</FieldLabel>

            <input
              style={inputStyle}
              value={targetFyp}
              onChange={(e) => setTargetFyp(e.target.value)}
              required
              inputMode="numeric"
              placeholder="เช่น 1,200,000"
            />

            <FieldLabel>Target FYC</FieldLabel>

            <input
              style={inputStyle}
              value={targetFyc}
              onChange={(e) => setTargetFyc(e.target.value)}
              required
              inputMode="numeric"
              placeholder="เช่น 300,000"
            />

            <FieldLabel>Target CASE</FieldLabel>

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
              disabled={loading || deleting}
              style={{
                width: "100%",
                marginTop: 22,
                padding: "14px 18px",
                borderRadius: 12,
                border: "1px solid var(--gold)",
                background: "var(--gold)",
                color: "#18120A",
                fontWeight: 800,
                fontSize: 16,
                cursor: loading ? "default" : "pointer",
                opacity: loading || deleting ? 0.65 : 1,
              }}
            >
              {loading
                ? "กำลังบันทึก..."
                : "บันทึกเป้าหมายประจำปี"}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || deleting}
              style={{
                width: "100%",
                marginTop: 12,
                padding: "13px 18px",
                borderRadius: 12,
                border: "1px solid var(--rp-danger-border)",
                background: "transparent",
                color: "var(--rp-danger)",
                fontWeight: 700,
                fontSize: 15,
                cursor: deleting ? "default" : "pointer",
                opacity: loading || deleting ? 0.65 : 1,
              }}
            >
              {deleting
                ? "กำลังลบ..."
                : `🗑️ ลบ Target ปี ${currentYear}`}
            </button>

            {status && (
              <div
                style={{
                  marginTop: 18,
                  padding: "13px 14px",
                  textAlign: "center",
                  borderRadius: 10,
                  border: "1px solid var(--hairline)",
                  background: "var(--rp-soft-gold)",
                  color: "var(--gold-bright)",
                  lineHeight: 1.5,
                }}
              >
                {status}
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}

function FieldLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 8,
        marginTop: 18,
        fontSize: 14,
        fontWeight: 600,
        color: "var(--cream-muted)",
      }}
    >
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "13px 14px",
  borderRadius: 10,
  border: "1px solid var(--hairline)",
  background: "var(--surface-alt)",
  color: "var(--cream)",
  fontSize: 16,
  outline: "none",
};
