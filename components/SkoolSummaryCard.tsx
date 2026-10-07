"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { dataTimestampLabel } from "@/lib/date-utils";
import { Card } from "./ui";
import SkoolQuizSummary from "./SkoolQuizSummary";
import { learningApiUrl, type LearningAgentSelection } from "@/lib/learning-filter";

type SkoolSummary = {
  linkedAgents: number;
  courses: number;
  records: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  averageProgress: number;
  syncedAt: string | null;
};

type SkoolProgressResponse = {
  success?: boolean;
  error?: string;
  scope?: {
    canSeeAll: boolean;
    unitId: number | null;
    unitName: string | null;
  };
  summary?: SkoolSummary;
};

const EMPTY_SUMMARY: SkoolSummary = {
  linkedAgents: 0,
  courses: 0,
  records: 0,
  completed: 0,
  inProgress: 0,
  notStarted: 0,
  averageProgress: 0,
  syncedAt: null,
};

export default function SkoolSummaryCard({ agentSelection = "all", agentName }: {
  agentSelection?: LearningAgentSelection;
  agentName?: string;
}) {
  const [summary, setSummary] = useState<SkoolSummary>(EMPTY_SUMMARY);
  const [unitName, setUnitName] = useState<string | null>(null);
  const [canSeeAll, setCanSeeAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizRefreshKey, setQuizRefreshKey] = useState(0);
  const requestRef = useRef<AbortController | null>(null);

  const loadSummary = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    setSummary(EMPTY_SUMMARY);

    try {
      const response = await fetch(learningApiUrl("/api/skool-progress", agentSelection), {
        cache: "no-store",
        signal: controller.signal,
      });
      const body = (await response.json()) as SkoolProgressResponse;

      if (!response.ok || !body.success || !body.summary) {
        throw new Error(body.error || "ไม่สามารถโหลดข้อมูล Skool ได้");
      }

      if (controller.signal.aborted) return;
      setSummary(body.summary);
      setUnitName(body.scope?.unitName ?? null);
      setCanSeeAll(body.scope?.canSeeAll === true);
    } catch (loadError) {
      if (controller.signal.aborted) return;

      setError(
        loadError instanceof Error
          ? loadError.message
          : "ไม่สามารถโหลดข้อมูล Skool ได้"
      );
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [agentSelection]);

  useEffect(() => {
    void loadSummary();

    return () => requestRef.current?.abort();
  }, [loadSummary]);

  const followUp = summary.inProgress + summary.notStarted;

  return (
    <Card style={{ marginTop: 18, padding: "20px 22px" }}>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>LEARNING PERFORMANCE</div>
          <h2 style={titleStyle}>สรุปความคืบหน้า Skool</h2>
          <div style={captionStyle}>
            {agentName ? `ตัวแทน: ${agentName}` : canSeeAll
              ? "ข้อมูลตัวแทนทุกหน่วย"
              : `เฉพาะตัวแทนใน${unitName ? `หน่วย ${unitName}` : "หน่วยของคุณ"}`}
            {" · "}ไม่เปลี่ยนตามตัวกรองวันที่กิจกรรม
          </div>
        </div>

        <div style={actionStyle}>
          <button
            type="button"
            onClick={() => {
              void loadSummary();
              setQuizRefreshKey(value => value + 1);
            }}
            disabled={loading}
            style={{
              ...refreshButtonStyle,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "กำลังโหลด..." : "↻ อัปเดต"}
          </button>

          <Link href={agentSelection === null ? "/dashboard/skool" : learningApiUrl("/dashboard/skool", agentSelection)} style={detailLinkStyle}>
            เปิดหน้ารายละเอียด Skool →
          </Link>
        </div>
      </div>

      {error ? (
        <div style={errorStyle} role="alert">
          {error}
          <button
            type="button"
            onClick={() => void loadSummary()}
            style={retryButtonStyle}
          >
            ลองใหม่
          </button>
        </div>
      ) : loading ? (
        <p role="status" style={{ ...captionStyle, marginTop: 18 }}>กำลังโหลดความคืบหน้าการเรียน...</p>
      ) : (
        <>
          <div style={metricGridStyle}>
            <Metric label="ตัวแทนที่เชื่อมแล้ว" value={summary.linkedAgents} suffix=" คน" />
            <Metric label="ความคืบหน้าเฉลี่ย" value={summary.records ? summary.averageProgress : "—"} suffix={summary.records ? "%" : ""} />
            <Metric label="เรียนจบแล้ว" value={summary.completed} suffix=" รายการ" />
            <Metric label="ต้องติดตาม" value={followUp} suffix=" รายการ" alert={followUp > 0} />
          </div>

          <div style={footerStyle}>
            <span>
              {summary.courses} คอร์ส · {summary.records} รายการเรียน ·
              กำลังเรียน {summary.inProgress} · ยังไม่เริ่ม {summary.notStarted}
            </span>
            <span>นำเข้า CSV ล่าสุดในขอบเขตนี้: {dataTimestampLabel(summary.syncedAt, summary.records ? "ยังไม่พบเวลานำเข้า" : "ยังไม่มีข้อมูลนำเข้าที่จับคู่ได้")}</span>
          </div>
          {summary.records === 0 && (
            <p style={captionStyle}>{agentName ? "ยังไม่มีข้อมูลการเรียนที่นำเข้าหรือจับคู่กับตัวแทนคนนี้" : "ยังไม่มีข้อมูลการเรียนในขอบเขตที่คุณมีสิทธิ์ดู"}</p>
          )}
        </>
      )}
      <p style={captionStyle}>รอบนำเข้า CSV: ทุกวันศุกร์ · ปุ่มอัปเดตอ่านข้อมูลที่นำเข้าแล้ว</p>
      <SkoolQuizSummary key={agentSelection ?? "unresolved"} refreshKey={quizRefreshKey} agentSelection={agentSelection} agentName={agentName} />
    </Card>
  );
}

function Metric({
  label,
  value,
  suffix,
  alert = false,
}: {
  label: string;
  value: number | string;
  suffix: string;
  alert?: boolean;
}) {
  return (
    <div style={metricStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={{ ...metricValueStyle, color: alert ? "#D9A441" : "var(--cream)" }}>
        {value}
        <span style={metricSuffixStyle}>{suffix}</span>
      </div>
    </div>
  );
}

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 18,
  flexWrap: "wrap" as const,
};

const eyebrowStyle = {
  color: "var(--gold)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 1.7,
};

const titleStyle = {
  margin: "5px 0 4px",
  color: "var(--cream)",
  fontSize: 22,
};

const captionStyle = {
  color: "var(--cream-muted)",
  fontSize: 13,
  lineHeight: 1.55,
};

const actionStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap" as const,
};

const refreshButtonStyle = {
  minHeight: 38,
  padding: "8px 13px",
  borderRadius: 10,
  border: "1px solid var(--hairline)",
  background: "var(--surface-alt)",
  color: "var(--cream-muted)",
  fontWeight: 700,
};

const detailLinkStyle = {
  minHeight: 38,
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid var(--gold)",
  color: "var(--gold-bright)",
  textDecoration: "none",
  fontWeight: 800,
};

const metricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
  gap: 10,
  marginTop: 18,
};

const metricStyle = {
  padding: "14px 15px",
  borderRadius: 12,
  border: "1px solid var(--hairline)",
  background: "var(--surface-alt)",
};

const metricLabelStyle = {
  color: "var(--cream-muted)",
  fontSize: 12,
  lineHeight: 1.4,
};

const metricValueStyle = {
  marginTop: 5,
  fontSize: 24,
  fontWeight: 900,
};

const metricSuffixStyle = {
  marginLeft: 4,
  color: "var(--cream-muted)",
  fontSize: 12,
  fontWeight: 600,
};

const footerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap" as const,
  marginTop: 13,
  color: "var(--cream-muted)",
  fontSize: 12,
  lineHeight: 1.55,
};

const errorStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginTop: 16,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid var(--rp-danger-border)",
  color: "var(--rp-danger)",
};

const retryButtonStyle = {
  border: "none",
  background: "transparent",
  color: "inherit",
  fontWeight: 800,
  cursor: "pointer",
};
