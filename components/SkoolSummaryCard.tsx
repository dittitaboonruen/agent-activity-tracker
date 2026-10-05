"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Card } from "./ui";

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

function formatSyncedAt(value: string | null) {
  if (!value) return "ยังไม่มีข้อมูลนำเข้า";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "ไม่พบเวลาที่อัปเดต";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

export default function SkoolSummaryCard() {
  const [summary, setSummary] = useState<SkoolSummary>(EMPTY_SUMMARY);
  const [unitName, setUnitName] = useState<string | null>(null);
  const [canSeeAll, setCanSeeAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/skool-progress", {
        cache: "no-store",
        signal,
      });
      const body = (await response.json()) as SkoolProgressResponse;

      if (!response.ok || !body.success || !body.summary) {
        throw new Error(body.error || "ไม่สามารถโหลดข้อมูล Skool ได้");
      }

      setSummary(body.summary);
      setUnitName(body.scope?.unitName ?? null);
      setCanSeeAll(body.scope?.canSeeAll === true);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }

      setError(
        loadError instanceof Error
          ? loadError.message
          : "ไม่สามารถโหลดข้อมูล Skool ได้"
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadSummary(controller.signal);

    return () => controller.abort();
  }, [loadSummary]);

  const followUp = summary.inProgress + summary.notStarted;

  return (
    <Card style={{ marginTop: 18, padding: "20px 22px" }}>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>LEARNING PERFORMANCE</div>
          <h2 style={titleStyle}>สรุปความคืบหน้า Skool</h2>
          <div style={captionStyle}>
            {canSeeAll
              ? "ข้อมูลตัวแทนทุกหน่วย"
              : `เฉพาะตัวแทนใน${unitName ? `หน่วย ${unitName}` : "หน่วยของคุณ"}`}
            {" · "}ไม่เปลี่ยนตามตัวกรองวันที่กิจกรรม
          </div>
        </div>

        <div style={actionStyle}>
          <button
            type="button"
            onClick={() => void loadSummary()}
            disabled={loading}
            style={{
              ...refreshButtonStyle,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "กำลังโหลด..." : "↻ อัปเดต"}
          </button>

          <Link href="/dashboard/skool" style={detailLinkStyle}>
            ดูรายละเอียด →
          </Link>
        </div>
      </div>

      {error ? (
        <div style={errorStyle}>
          {error}
          <button
            type="button"
            onClick={() => void loadSummary()}
            style={retryButtonStyle}
          >
            ลองใหม่
          </button>
        </div>
      ) : (
        <>
          <div style={metricGridStyle}>
            <Metric label="ตัวแทนที่เชื่อมแล้ว" value={summary.linkedAgents} suffix=" คน" />
            <Metric label="ความคืบหน้าเฉลี่ย" value={summary.averageProgress} suffix="%" />
            <Metric label="เรียนจบแล้ว" value={summary.completed} suffix=" รายการ" />
            <Metric label="ต้องติดตาม" value={followUp} suffix=" รายการ" alert={followUp > 0} />
          </div>

          <div style={footerStyle}>
            <span>
              {summary.courses} คอร์ส · {summary.records} รายการเรียน ·
              กำลังเรียน {summary.inProgress} · ยังไม่เริ่ม {summary.notStarted}
            </span>
            <span>ข้อมูลล่าสุด: {formatSyncedAt(summary.syncedAt)}</span>
          </div>
        </>
      )}
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
  value: number;
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
