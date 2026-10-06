"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { summarizeQuizResults, type QuizResultRow } from "@/lib/skool-quiz";

type QuizResponse = {
  success?: boolean;
  error?: string;
  rows?: QuizResultRow[];
  scope?: { canSeeAll: boolean };
};
const dateFormat = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short",
});

export default function SkoolQuizSummary({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<QuizResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    async function load() {
      try {
        // This endpoint restricts agent IDs on the server before reading scores.
        const response = await fetch("/api/skool-quiz-results", {
          cache: "no-store", signal: controller.signal,
        });
        const body: QuizResponse = await response.json();
        if (!response.ok || body.success !== true || !Array.isArray(body.rows)) {
          throw new Error(body.error || "ไม่สามารถโหลดสรุปผลสอบได้");
        }
        if (!controller.signal.aborted) setData(body);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดสรุปผลสอบได้");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [refreshKey, retry]);

  const summary = summarizeQuizResults(data?.rows ?? []);

  return (
    <section aria-labelledby="skool-quiz-summary-title" style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--hairline)" }}>
      <h3 id="skool-quiz-summary-title" style={{ margin: 0, color: "var(--gold-bright)", fontSize: 17 }}>สรุปผลสอบ Google Forms</h3>
      {loading ? <p role="status" style={captionStyle}>กำลังโหลดผลสอบ...</p> : error ? (
        <div role="alert" style={{ ...captionStyle, color: "var(--rp-danger)" }}>
          {error}{" "}
          <button type="button" onClick={() => setRetry(value => value + 1)} style={{ border: 0, background: "transparent", color: "inherit", cursor: "pointer", fontWeight: 700 }}>ลองใหม่</button>
        </div>
      ) : (
        <>
          <p style={captionStyle}>
            {data?.scope?.canSeeAll ? "ข้อมูลตัวแทนทุกหน่วย" : "เฉพาะตัวแทนในหน่วยของคุณ"}
            {" · "}นับครั้งล่าสุดต่อคนต่อข้อสอบที่เปิดใช้งาน
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10 }}>
            <Metric label="ตัวแทนที่มีผลสอบ" value={`${summary.agents} คน`} />
            <Metric label="ผลสอบผ่าน" value={`${summary.passed} รายการ`} />
            <Metric label="ผลสอบไม่ผ่าน" value={`${summary.failed} รายการ`} alert={summary.failed > 0} />
            <Metric label="คะแนนเฉลี่ย" value={summary.averageScore === null ? "—" : `${summary.averageScore}%`} />
          </div>
          <p style={{ ...captionStyle, marginBottom: 0 }}>
            ผลสอบล่าสุด {summary.results} รายการ · {summary.updatedAt ? `ข้อมูลคะแนนอัปเดต: ${dateFormat.format(new Date(summary.updatedAt))}` : "ยังไม่มีผลสอบในหน่วยที่คุณมีสิทธิ์ดู"}
            <br />ยังไม่มีผลสอบไม่ถือว่าสอบไม่ผ่าน · ผลสอบแสดงได้โดยไม่ต้องรอ CSV และไม่เปลี่ยนเปอร์เซ็นต์เรียนจบใน Skool
          </p>
        </>
      )}
    </section>
  );
}

function Metric({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div style={{ padding: "14px 15px", borderRadius: 12, border: "1px solid var(--hairline)", background: "var(--surface-alt)" }}>
    <div style={{ color: "var(--cream-muted)", fontSize: 12 }}>{label}</div>
    <div style={{ marginTop: 5, fontSize: 24, fontWeight: 900, color: alert ? "#D9A441" : "var(--cream)" }}>{value}</div>
  </div>;
}

const captionStyle: CSSProperties = { color: "var(--cream-muted)", fontSize: 12, lineHeight: 1.7 };
